import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { 
  Startup, 
  Task,
  Workflow, 
  WorkflowAction, 
  WorkflowCondition, 
  workflows, 
  workflowActions, 
  workflowConditions,
  startups,
  tasks
} from "@shared/schema";
import { createTransport } from "nodemailer";

// Classe que contém a lógica para executar workflows
export class WorkflowEngine {
  // Não depende mais da interface IStorage
  constructor() {
    // Sem dependências externas
  }

  // Processa workflows acionados por mudança de status
  async processStatusChangeWorkflows(startupId: string, statusId: string): Promise<void> {
    console.log(`[WorkflowEngine] Processando workflows para mudança de status. StartupId: ${startupId}, StatusId: ${statusId}`);
    
    try {
      // Buscar todos os workflows ativos com trigger_type = status_change
      const activeWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.is_active, true),
            eq(workflows.trigger_type, "status_change")
          )
        );
      
      console.log(`[WorkflowEngine] Encontrados ${activeWorkflows.length} workflows para status_change`);
      
      if (activeWorkflows.length === 0) return;

      // Startup que teve status alterado
      const [startup] = await db
        .select()
        .from(startups)
        .where(eq(startups.id, startupId));
        
      if (!startup) {
        console.error(`[WorkflowEngine] Startup não encontrada: ${startupId}`);
        return;
      }

      // Verificar cada workflow
      for (const workflow of activeWorkflows) {
        // Verificar se o status corresponde ao trigger_details
        const details = workflow.trigger_details as Record<string, any>;
        if (details?.status_id === statusId) {
          console.log(`[WorkflowEngine] Workflow elegível: ${workflow.name} (${workflow.id})`);
          
          // Verificar condições adicionais
          const shouldExecute = await this.evaluateWorkflowConditions(workflow.id, startup);
          
          if (shouldExecute) {
            console.log(`[WorkflowEngine] Executando ações do workflow: ${workflow.name} (${workflow.id})`);
            await this.executeWorkflowActions(workflow.id, startup);
          } else {
            console.log(`[WorkflowEngine] Condições não atendidas para o workflow: ${workflow.name} (${workflow.id})`);
          }
        }
      }
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao processar workflows de mudança de status:", error);
    }
  }

  // Processa workflows acionados por mudança de atributo
  async processAttributeChangeWorkflows(startupId: string, attributeName: string, newValue: any): Promise<void> {
    console.log(`[WorkflowEngine] Processando workflows para mudança de atributo. StartupId: ${startupId}, Atributo: ${attributeName}, Valor: ${newValue}`);
    
    try {
      // Buscar todos os workflows ativos com trigger_type = attribute_change
      const activeWorkflows = await db
        .select()
        .from(workflows)
        .where(
          and(
            eq(workflows.is_active, true),
            eq(workflows.trigger_type, "attribute_change")
          )
        );
      
      console.log(`[WorkflowEngine] Encontrados ${activeWorkflows.length} workflows para attribute_change`);
      
      if (activeWorkflows.length === 0) return;

      // Startup que teve atributo alterado
      const [startup] = await db
        .select()
        .from(startups)
        .where(eq(startups.id, startupId));
        
      if (!startup) {
        console.error(`[WorkflowEngine] Startup não encontrada: ${startupId}`);
        return;
      }

      // Verificar cada workflow
      for (const workflow of activeWorkflows) {
        // Verificar se o atributo corresponde ao trigger_details
        const details = workflow.trigger_details as Record<string, any>;
        if (details?.attribute === attributeName) {
          console.log(`[WorkflowEngine] Workflow elegível: ${workflow.name} (${workflow.id})`);
          
          // Verificar condições adicionais
          const shouldExecute = await this.evaluateWorkflowConditions(workflow.id, startup);
          
          if (shouldExecute) {
            console.log(`[WorkflowEngine] Executando ações do workflow: ${workflow.name} (${workflow.id})`);
            await this.executeWorkflowActions(workflow.id, startup);
          } else {
            console.log(`[WorkflowEngine] Condições não atendidas para o workflow: ${workflow.name} (${workflow.id})`);
          }
        }
      }
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao processar workflows de mudança de atributo:", error);
    }
  }

  // Avalia todas as condições de um workflow
  private async evaluateWorkflowConditions(workflowId: string, startup: Startup): Promise<boolean> {
    try {
      // Buscar todas as condições do workflow
      const conditions = await db
        .select()
        .from(workflowConditions)
        .where(eq(workflowConditions.workflow_id, workflowId));
      
      // Se não houver condições, retorna true (executa sempre)
      if (conditions.length === 0) {
        return true;
      }
      
      // Avalia cada condição
      for (const condition of conditions) {
        const { field_name, operator, value } = condition;
        
        // Obter o valor do campo da startup
        const fieldValue = startup[field_name as keyof Startup];
        
        // Verificar se a condição é atendida
        if (!this.evaluateCondition(fieldValue, operator, value)) {
          return false; // Se qualquer condição falhar, retorna false
        }
      }
      
      // Todas as condições foram atendidas
      return true;
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao avaliar condições do workflow:", error);
      return false;
    }
  }
  
  // Avalia uma condição específica
  private evaluateCondition(fieldValue: any, operator: string, conditionValue: string): boolean {
    // Converter valores se necessário (números, datas)
    if (typeof fieldValue === 'number') {
      conditionValue = Number(conditionValue) as any;
    }
    
    switch (operator) {
      case 'equals':
        return fieldValue == conditionValue;
      case 'not_equals':
        return fieldValue != conditionValue;
      case 'contains':
        return String(fieldValue).includes(String(conditionValue));
      case 'greater_than':
        return fieldValue > conditionValue;
      case 'less_than':
        return fieldValue < conditionValue;
      default:
        console.error(`[WorkflowEngine] Operador desconhecido: ${operator}`);
        return false;
    }
  }

  // Executa todas as ações de um workflow
  private async executeWorkflowActions(workflowId: string, startup: Startup): Promise<void> {
    try {
      // Buscar todas as ações do workflow, ordenadas por 'order'
      const actions = await db
        .select()
        .from(workflowActions)
        .where(eq(workflowActions.workflow_id, workflowId))
        .orderBy(workflowActions.order);
      
      console.log(`[WorkflowEngine] Executando ${actions.length} ações para o workflow ${workflowId}`);
      
      // Executar cada ação na ordem
      for (const action of actions) {
        await this.executeAction(action, startup);
      }
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao executar ações do workflow:", error);
    }
  }
  
  // Executa uma ação específica
  private async executeAction(action: WorkflowAction, startup: Startup): Promise<void> {
    console.log(`[WorkflowEngine] Executando ação: ${action.action_name} (${action.action_type})`);
    
    try {
      switch (action.action_type) {
        case 'send_email':
          await this.executeSendEmailAction(action, startup);
          break;
        case 'update_attribute':
          await this.executeUpdateAttributeAction(action, startup);
          break;
        case 'create_task':
          await this.executeCreateTaskAction(action, startup);
          break;
        default:
          console.error(`[WorkflowEngine] Tipo de ação desconhecido: ${action.action_type}`);
      }
    } catch (error) {
      console.error(`[WorkflowEngine] Erro ao executar ação ${action.id}:`, error);
    }
  }
  
  // Executa ação de envio de email
  private async executeSendEmailAction(action: WorkflowAction, startup: Startup): Promise<void> {
    // Verificar e pegar detalhes da ação
    const details = action.action_details as Record<string, any>;
    const { to, subject, body } = details;
    
    if (!to || !subject || !body) {
      console.error("[WorkflowEngine] Detalhes de email incompletos:", action.action_details);
      return;
    }
    
    console.log(`[WorkflowEngine] Enviando email para: ${to}, Assunto: ${subject}`);
    
    // Substituir placeholders no corpo do email
    const processedBody = this.replacePlaceholders(body, startup);
    const processedSubject = this.replacePlaceholders(subject, startup);
    
    // Configurar transporte de email (simulado para dev)
    try {
      // Em um ambiente de produção, configure com credenciais reais
      console.log(`[WorkflowEngine] Email seria enviado para ${to}`);
      console.log(`[WorkflowEngine] Assunto: ${processedSubject}`);
      console.log(`[WorkflowEngine] Corpo: ${processedBody}`);
      
      // Descomentar e configurar para envio real
      /*
      const transporter = createTransport({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
          user: "seu-email@example.com",
          pass: "sua-senha",
        },
      });
      
      const info = await transporter.sendMail({
        from: '"Sistema de Workflows" <sistema@example.com>',
        to,
        subject: processedSubject,
        html: processedBody,
      });
      
      console.log(`[WorkflowEngine] Email enviado: ${info.messageId}`);
      */
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao enviar email:", error);
    }
  }
  
  // Executa ação de atualização de atributo
  private async executeUpdateAttributeAction(action: WorkflowAction, startup: Startup): Promise<void> {
    // Verificar e pegar detalhes da ação
    const details = action.action_details as Record<string, any>;
    const { attribute, value } = details;
    
    if (!attribute) {
      console.error("[WorkflowEngine] Atributo não especificado:", action.action_details);
      return;
    }
    
    console.log(`[WorkflowEngine] Atualizando atributo: ${attribute} para ${value}`);
    
    try {
      // Criar objeto de atualização
      const updateData: Record<string, any> = {};
      updateData[attribute] = value;
      
      // Atualizar startup diretamente usando o db
      const [updatedStartup] = await db
        .update(startups)
        .set({
          ...updateData,
          updated_at: new Date()
        })
        .where(eq(startups.id, startup.id))
        .returning();
      
      if (updatedStartup) {
        console.log(`[WorkflowEngine] Atributo ${attribute} atualizado com sucesso`);
      } else {
        console.error(`[WorkflowEngine] Falha ao atualizar atributo ${attribute}`);
      }
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao atualizar atributo:", error);
    }
  }
  
  // Executa ação de criação de tarefa
  private async executeCreateTaskAction(action: WorkflowAction, startup: Startup): Promise<void> {
    // Verificar e pegar detalhes da ação
    const details = action.action_details as Record<string, any>;
    const { title, description, due_date, assignee_id, priority } = details;
    
    if (!title) {
      console.error("[WorkflowEngine] Título da tarefa não especificado:", action.action_details);
      return;
    }
    
    console.log(`[WorkflowEngine] Criando tarefa: ${title}`);
    
    try {
      // Processar título e descrição para substituir placeholders
      const processedTitle = this.replacePlaceholders(title, startup);
      const processedDescription = description ? this.replacePlaceholders(description, startup) : '';
      
      // Criar tarefa diretamente usando o db
      const [task] = await db
        .insert(tasks)
        .values({
          title: processedTitle,
          description: processedDescription,
          due_date: due_date ? new Date(due_date) : null,
          created_by: 'system', // Ou algum usuário admin
          assigned_to: assignee_id || null,
          is_completed: false,
          startup_id: startup.id,
          priority: priority || 'medium',
        })
        .returning();
      
      if (task) {
        console.log(`[WorkflowEngine] Tarefa criada com sucesso: ${task.id}`);
      } else {
        console.error('[WorkflowEngine] Falha ao criar tarefa');
      }
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao criar tarefa:", error);
    }
  }
  
  // Substituir placeholders em strings
  private replacePlaceholders(text: string, startup: Startup): string {
    return text.replace(/\{(\w+)\}/g, (match, field) => {
      const value = startup[field as keyof Startup];
      return value !== undefined ? String(value) : match;
    });
  }
}