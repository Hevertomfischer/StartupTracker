import { MailService } from '@sendgrid/mail';
import { db } from './db';
import {
  workflows,
  workflowActions,
  workflowExecutionLogs,
  startups,
  tasks,
  users,
  statuses,
  Workflow,
  WorkflowAction,
  InsertWorkflow,
  InsertWorkflowAction,
  WorkflowTriggerTypeEnum,
  WorkflowActionTypeEnum,
  WorkflowExecutionStatusEnum,
  InsertWorkflowExecutionLog,
  InsertTask
} from '@shared/schema';
import { eq, and, asc } from 'drizzle-orm';

// Inicializar o serviço de email se a API key estiver disponível
let mailService: MailService | null = null;
if (process.env.SENDGRID_API_KEY) {
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY não está configurada. Funcionalidade de e-mail estará indisponível.');
}

/**
 * Interface para representar o resultado de uma execução de ação
 */
interface ActionExecutionResult {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * Classe principal do serviço de workflow
 */
export class WorkflowService {
  /**
   * Cria um novo workflow
   */
  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(data).returning();
    return workflow;
  }

  /**
   * Obtém todos os workflows
   */
  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows).orderBy(workflows.name);
  }

  /**
   * Obtém um workflow pelo ID
   */
  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  /**
   * Atualiza um workflow existente
   */
  async updateWorkflow(id: string, data: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [updated] = await db
      .update(workflows)
      .set({ ...data, updated_at: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updated;
  }

  /**
   * Exclui um workflow
   */
  async deleteWorkflow(id: string): Promise<boolean> {
    await db.delete(workflows).where(eq(workflows.id, id));
    return true;
  }

  /**
   * Adiciona uma ação a um workflow
   */
  async addWorkflowAction(data: InsertWorkflowAction): Promise<WorkflowAction> {
    const workflowActionData = {
      workflow_id: data.workflow_id,
      action_name: data.action_name, 
      description: data.description,
      action_type: data.action_type,
      action_details: data.action_details,
      order: data.order || 0
    };
    
    const [action] = await db.insert(workflowActions).values(workflowActionData).returning();
    return action;
  }

  /**
   * Obtém todas as ações de um workflow
   */
  async getWorkflowActions(workflowId: string): Promise<WorkflowAction[]> {
    return await db
      .select()
      .from(workflowActions)
      .where(eq(workflowActions.workflow_id, workflowId))
      .orderBy(asc(workflowActions.order));
  }

  /**
   * Obtém uma ação de workflow pelo ID
   */
  async getWorkflowAction(id: string): Promise<WorkflowAction | undefined> {
    const [action] = await db.select().from(workflowActions).where(eq(workflowActions.id, id));
    return action;
  }

  /**
   * Atualiza uma ação de workflow
   */
  async updateWorkflowAction(id: string, data: Partial<InsertWorkflowAction>): Promise<WorkflowAction | undefined> {
    const [updated] = await db
      .update(workflowActions)
      .set({ ...data, updated_at: new Date() })
      .where(eq(workflowActions.id, id))
      .returning();
    return updated;
  }

  /**
   * Exclui uma ação de workflow
   */
  async deleteWorkflowAction(id: string): Promise<boolean> {
    await db.delete(workflowActions).where(eq(workflowActions.id, id));
    return true;
  }

  /**
   * Dispara a execução de um workflow manualmente
   */
  async executeWorkflow(workflowId: string, entityId?: string, entityType?: string): Promise<boolean> {
    try {
      const workflow = await this.getWorkflow(workflowId);
      if (!workflow || !workflow.is_active) {
        console.error(`Workflow não encontrado ou inativo: ${workflowId}`);
        return false;
      }

      // Buscar as ações ordenadas
      const actions = await this.getWorkflowActions(workflowId);
      if (actions.length === 0) {
        await this.logWorkflowExecution({
          workflow_id: workflowId,
          status: WorkflowExecutionStatusEnum.ERROR,
          error_message: 'Workflow sem ações definidas',
          entity_id: entityId,
          entity_type: entityType
        });
        return false;
      }

      // Executar cada ação em ordem
      const results: ActionExecutionResult[] = [];
      let allSuccessful = true;

      for (const action of actions) {
        try {
          const result = await this.executeAction(action, entityId, entityType);
          results.push(result);
          
          if (!result.success) {
            allSuccessful = false;
          }
        } catch (error) {
          console.error(`Erro ao executar ação ${action.id}:`, error);
          results.push({
            success: false,
            message: `Erro na execução: ${error instanceof Error ? error.message : String(error)}`
          });
          allSuccessful = false;
        }
      }

      // Registrar log de execução
      await this.logWorkflowExecution({
        workflow_id: workflowId,
        status: allSuccessful 
          ? WorkflowExecutionStatusEnum.SUCCESS 
          : (results.some(r => r.success) ? WorkflowExecutionStatusEnum.PARTIAL_SUCCESS : WorkflowExecutionStatusEnum.ERROR),
        entity_id: entityId,
        entity_type: entityType,
        execution_details: results
      });

      return allSuccessful;
    } catch (error) {
      console.error(`Erro ao executar workflow ${workflowId}:`, error);
      
      // Registrar falha
      await this.logWorkflowExecution({
        workflow_id: workflowId,
        status: WorkflowExecutionStatusEnum.ERROR,
        error_message: error instanceof Error ? error.message : String(error),
        entity_id: entityId,
        entity_type: entityType
      });
      
      return false;
    }
  }

  /**
   * Verifica gatilhos de mudança de status e executa workflows correspondentes
   */
  async handleStatusChange(entityId: string, statusId: string, entityType: string = 'startup'): Promise<void> {
    // Buscar workflows com trigger_type 'status_change'
    const triggeredWorkflows = await db
      .select()
      .from(workflows)
      .where(and(
        eq(workflows.trigger_type, WorkflowTriggerTypeEnum.STATUS_CHANGE),
        eq(workflows.is_active, true)
      ));

    // Filtrar workflows com statusId no trigger_details
    for (const workflow of triggeredWorkflows) {
      const triggerDetails = workflow.trigger_details as any;
      
      if (triggerDetails && 
          ((triggerDetails.status_id === statusId) || 
           (triggerDetails.status_ids && triggerDetails.status_ids.includes(statusId)))) {
        await this.executeWorkflow(workflow.id, entityId, entityType);
      }
    }
  }

  /**
   * Verifica gatilhos de alteração de atributos e executa workflows correspondentes
   */
  async handleAttributeChange(
    entityId: string, 
    entityType: string, 
    fieldName: string, 
    oldValue: any, 
    newValue: any
  ): Promise<void> {
    // Buscar workflows com trigger_type 'attribute_change'
    const triggeredWorkflows = await db
      .select()
      .from(workflows)
      .where(and(
        eq(workflows.trigger_type, WorkflowTriggerTypeEnum.ATTRIBUTE_CHANGE),
        eq(workflows.is_active, true)
      ));

    // Filtrar workflows baseados nos detalhes do gatilho
    for (const workflow of triggeredWorkflows) {
      const triggerDetails = workflow.trigger_details as any;
      
      // Verificar se o workflow deve ser acionado para esta mudança de atributo
      if (triggerDetails) {
        // Verificar se o workflow monitora este tipo de entidade
        const entityTypeMatch = !triggerDetails.entity_type || 
                               triggerDetails.entity_type === entityType;
        
        // Verificar se o workflow monitora este campo específico
        const fieldMatch = !triggerDetails.field_name || 
                          triggerDetails.field_name === fieldName;
        
        // Verificar se o workflow monitora valores específicos (opcional)
        let valueMatch = true;
        if (triggerDetails.old_value !== undefined) {
          valueMatch = valueMatch && String(oldValue) === String(triggerDetails.old_value);
        }
        if (triggerDetails.new_value !== undefined) {
          valueMatch = valueMatch && String(newValue) === String(triggerDetails.new_value);
        }
        
        // Se todas as condições forem atendidas, executar o workflow
        if (entityTypeMatch && fieldMatch && valueMatch) {
          await this.executeWorkflow(workflow.id, entityId, entityType);
        }
      }
    }
  }

  /**
   * Verifica gatilhos de criação de tarefa e executa workflows correspondentes
   */
  async handleTaskCreation(taskId: string): Promise<void> {
    // Buscar workflows com trigger_type 'task_creation'
    const triggeredWorkflows = await db
      .select()
      .from(workflows)
      .where(and(
        eq(workflows.trigger_type, WorkflowTriggerTypeEnum.TASK_CREATION),
        eq(workflows.is_active, true)
      ));

    // Executar workflows de criação de tarefa
    for (const workflow of triggeredWorkflows) {
      await this.executeWorkflow(workflow.id, taskId, 'task');
    }
  }

  /**
   * Registra a execução de um workflow
   */
  private async logWorkflowExecution(logData: InsertWorkflowExecutionLog): Promise<void> {
    await db.insert(workflowExecutionLogs).values(logData);
  }

  /**
   * Executa uma ação específica de um workflow
   */
  private async executeAction(
    action: WorkflowAction, 
    entityId?: string, 
    entityType?: string
  ): Promise<ActionExecutionResult> {
    if (!entityId || !entityType) {
      return { success: false, message: 'ID ou tipo de entidade não fornecido' };
    }

    switch (action.action_type) {
      case WorkflowActionTypeEnum.EMAIL:
        return await this.executeEmailAction(action, entityId, entityType);
      
      case WorkflowActionTypeEnum.ATTRIBUTE_CHANGE:
        return await this.executeAttributeChangeAction(action, entityId, entityType);
      
      case WorkflowActionTypeEnum.TASK_CREATION:
        return await this.executeTaskCreationAction(action, entityId, entityType);
      
      case WorkflowActionTypeEnum.STATUS_QUERY:
        return await this.executeStatusQueryAction(action, entityId, entityType);
      
      default:
        return {
          success: false,
          message: `Tipo de ação desconhecido: ${action.action_type}`
        };
    }
  }

  /**
   * Executa uma ação de envio de e-mail
   */
  private async executeEmailAction(
    action: WorkflowAction, 
    entityId: string, 
    entityType: string
  ): Promise<ActionExecutionResult> {
    try {
      if (!mailService) {
        return { 
          success: false, 
          message: 'Serviço de email não configurado (SENDGRID_API_KEY não definida)'
        };
      }

      const details = action.action_details as any;
      
      // Validar se os detalhes necessários estão presentes
      if (!details.to_email && !details.to_field && !details.cc && !details.bcc) {
        return { 
          success: false, 
          message: 'Destinatário não especificado na ação de email'
        };
      }

      if (!details.subject || !details.body) {
        return {
          success: false,
          message: 'Assunto ou corpo do email não especificado'
        };
      }

      // Obter dados da entidade para substituição de variáveis
      let entityData: any = {};
      let toEmail: string = details.to_email || '';
      
      if (entityType === 'startup') {
        const [startup] = await db
          .select()
          .from(startups)
          .where(eq(startups.id, entityId));
        
        if (!startup) {
          return { success: false, message: `Startup com ID ${entityId} não encontrada` };
        }
        
        entityData = startup;
        
        // Se o email deve ser enviado para um campo da entidade (ex: ceo_email)
        if (details.to_field && typeof details.to_field === 'string') {
          const fieldName = details.to_field as keyof typeof startup;
          if (fieldName in startup && typeof startup[fieldName] === 'string') {
            toEmail = startup[fieldName] as string;
          }
        }
      } else if (entityType === 'task') {
        const [task] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, entityId));
        
        if (!task) {
          return { success: false, message: `Tarefa com ID ${entityId} não encontrada` };
        }
        
        entityData = task;
        
        // Se a tarefa tem assigned_to, obter o email do usuário
        if (details.to_field === 'assigned_to' && task.assigned_to) {
          const [user] = await db
            .select()
            .from(users)
            .where(eq(users.id, task.assigned_to));
          
          if (user) {
            toEmail = user.email;
          }
        }
      }

      if (!toEmail) {
        return { 
          success: false, 
          message: 'Não foi possível determinar o endereço de email do destinatário'
        };
      }

      // Substituir variáveis no assunto e corpo
      let subject = details.subject;
      let body = details.body;

      // Substituição simples de variáveis (poderia ser mais sofisticado com template engine)
      for (const [key, value] of Object.entries(entityData)) {
        if (typeof value === 'string' || typeof value === 'number') {
          const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          subject = subject.replace(regex, String(value));
          body = body.replace(regex, String(value));
        }
      }

      // Enviar email
      await mailService.send({
        to: toEmail,
        from: details.from || 'no-reply@example.com', // Deve ser um remetente verificado no SendGrid
        subject,
        text: body,
        html: details.html_body ? details.html_body : body.replace(/\n/g, '<br>'),
        cc: details.cc,
        bcc: details.bcc
      });

      return {
        success: true,
        message: `Email enviado com sucesso para ${toEmail}`,
        data: { to: toEmail, subject }
      };
    } catch (error) {
      console.error('Erro ao enviar email:', error);
      return {
        success: false,
        message: `Erro ao enviar email: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Executa uma ação de modificação de atributo
   */
  private async executeAttributeChangeAction(
    action: WorkflowAction, 
    entityId: string, 
    entityType: string
  ): Promise<ActionExecutionResult> {
    try {
      const details = action.action_details as any;
      
      // Validar se os detalhes necessários estão presentes
      if (!details.attributes || Object.keys(details.attributes).length === 0) {
        return {
          success: false,
          message: 'Nenhum atributo especificado para modificação'
        };
      }

      if (entityType === 'startup') {
        // Verificar se a startup existe
        const [startup] = await db
          .select()
          .from(startups)
          .where(eq(startups.id, entityId));
        
        if (!startup) {
          return { success: false, message: `Startup com ID ${entityId} não encontrada` };
        }

        // Atualizar atributos da startup
        const [updated] = await db
          .update(startups)
          .set({ 
            ...details.attributes,
            updated_at: new Date() 
          })
          .where(eq(startups.id, entityId))
          .returning();

        return {
          success: true,
          message: `Atributos da startup atualizados com sucesso`,
          data: { updated }
        };
      } else if (entityType === 'task') {
        // Verificar se a tarefa existe
        const [task] = await db
          .select()
          .from(tasks)
          .where(eq(tasks.id, entityId));
        
        if (!task) {
          return { success: false, message: `Tarefa com ID ${entityId} não encontrada` };
        }

        // Atualizar atributos da tarefa
        const [updated] = await db
          .update(tasks)
          .set({ 
            ...details.attributes,
            updated_at: new Date() 
          })
          .where(eq(tasks.id, entityId))
          .returning();

        return {
          success: true,
          message: `Atributos da tarefa atualizados com sucesso`,
          data: { updated }
        };
      }

      return {
        success: false,
        message: `Tipo de entidade não suportado: ${entityType}`
      };
    } catch (error) {
      console.error('Erro ao modificar atributos:', error);
      return {
        success: false,
        message: `Erro ao modificar atributos: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Executa uma ação de criação de tarefa
   */
  private async executeTaskCreationAction(
    action: WorkflowAction, 
    entityId: string, 
    entityType: string
  ): Promise<ActionExecutionResult> {
    try {
      const details = action.action_details as any;
      
      // Validar se os detalhes necessários estão presentes
      if (!details.title) {
        return {
          success: false,
          message: 'Título da tarefa não especificado'
        };
      }

      // Preparar dados da tarefa
      const taskData: InsertTask = {
        title: details.title,
        description: details.description,
        priority: details.priority || 'medium',
        status: details.status || 'todo',
        assigned_to: details.assigned_to,
        created_by: details.created_by
      };

      // Se a data de vencimento foi especificada
      if (details.due_date) {
        taskData.due_date = details.due_date;
      }

      // Se a entidade é uma startup, associar a tarefa a ela
      if (entityType === 'startup') {
        taskData.startup_id = entityId;
      }

      // Criar a tarefa
      const [task] = await db
        .insert(tasks)
        .values(taskData)
        .returning();

      return {
        success: true,
        message: `Tarefa criada com sucesso: ${task.title}`,
        data: { task }
      };
    } catch (error) {
      console.error('Erro ao criar tarefa:', error);
      return {
        success: false,
        message: `Erro ao criar tarefa: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Executa uma ação de consulta de status
   */
  private async executeStatusQueryAction(
    action: WorkflowAction, 
    entityId: string, 
    entityType: string
  ): Promise<ActionExecutionResult> {
    try {
      if (entityType !== 'startup') {
        return {
          success: false,
          message: `Consulta de status só é suportada para startups, não para ${entityType}`
        };
      }

      // Buscar a startup
      const [startup] = await db
        .select()
        .from(startups)
        .where(eq(startups.id, entityId));
      
      if (!startup) {
        return { success: false, message: `Startup com ID ${entityId} não encontrada` };
      }

      if (!startup.status_id) {
        return {
          success: true,
          message: `Startup não possui status definido`,
          data: { hasStatus: false }
        };
      }

      // Buscar o status
      const [status] = await db
        .select()
        .from(statuses)
        .where(eq(statuses.id, startup.status_id));

      return {
        success: true,
        message: `Status da startup obtido com sucesso`,
        data: { 
          status_id: startup.status_id,
          status_name: status?.name || 'Desconhecido',
          status_color: status?.color || '#CCCCCC'
        }
      };
    } catch (error) {
      console.error('Erro ao consultar status:', error);
      return {
        success: false,
        message: `Erro ao consultar status: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Instância única do serviço de workflow
export const workflowService = new WorkflowService();