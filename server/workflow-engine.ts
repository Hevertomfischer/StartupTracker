import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { 
  Startup, 
  Task,
  Workflow, 
  WorkflowAction, 
  WorkflowCondition,
  WorkflowLog,
  workflows, 
  workflowActions, 
  workflowConditions,
  workflowLogs,
  startups,
  tasks,
  startupHistory,
  WorkflowLogStatusEnum
} from "@shared/schema";
// Interface para os resultados de envio de email
interface EmailResult {
  success: boolean;
  testMode?: boolean;
  testRecipient?: string;
  realRecipient?: string;
  errorCode?: string;
  errorMessage?: string;
}

// Classe que contém a lógica para executar workflows
export class WorkflowEngine {
  // Não depende mais da interface IStorage
  constructor() {
    // Sem dependências externas
  }
  
  // Registra um log de execução do workflow
  async logWorkflowEvent(params: {
    workflow_id?: string;
    workflow_action_id?: string;
    startup_id?: string;
    action_type?: string;
    status: keyof typeof WorkflowLogStatusEnum;
    message: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      await db.insert(workflowLogs).values({
        workflow_id: params.workflow_id,
        workflow_action_id: params.workflow_action_id,
        startup_id: params.startup_id,
        action_type: params.action_type,
        status: params.status,
        message: params.message,
        details: params.details || {}
      });
      console.log(`[WorkflowEngine] Log registrado: ${params.status} - ${params.message}`);
    } catch (error) {
      console.error("[WorkflowEngine] Erro ao registrar log:", error);
    }
  }

  // Processa workflows acionados por mudança de status
  async processStatusChangeWorkflows(startupId: string, statusId: string, userId?: string): Promise<void> {
    console.log(`[WorkflowEngine] Processando workflows para mudança de status. StartupId: ${startupId}, StatusId: ${statusId}, UserId: ${userId || 'não informado'}`);
    
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
            await this.executeWorkflowActions(workflow.id, startup, userId);
          } else {
            console.log(`[WorkflowEngine] Condições não atendidas para o workflow: ${workflow.name} (${workflow.id})`);
          }
        }
      }
    } catch (error: any) {
      console.error("[WorkflowEngine] Erro ao processar workflows de mudança de status:", error);
    }
  }

  // Processa workflows acionados por mudança de atributo
  async processAttributeChangeWorkflows(startupId: string, attributeName: string, newValue: any, userId?: string): Promise<void> {
    console.log(`[WorkflowEngine] Processando workflows para mudança de atributo. StartupId: ${startupId}, Atributo: ${attributeName}, Valor: ${newValue}, UserId: ${userId || 'não informado'}`);
    
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
            await this.executeWorkflowActions(workflow.id, startup, userId);
          } else {
            console.log(`[WorkflowEngine] Condições não atendidas para o workflow: ${workflow.name} (${workflow.id})`);
          }
        }
      }
    } catch (error: any) {
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
    } catch (error: any) {
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
  private async executeWorkflowActions(workflowId: string, startup: Startup, userId?: string): Promise<void> {
    try {
      // Buscar todas as ações do workflow, ordenadas por 'order'
      const actions = await db
        .select()
        .from(workflowActions)
        .where(eq(workflowActions.workflow_id, workflowId))
        .orderBy(workflowActions.order);
      
      console.log(`[WorkflowEngine] Executando ${actions.length} ações para o workflow ${workflowId}, UserId: ${userId || 'não informado'}`);
      
      await this.logWorkflowEvent({
        workflow_id: workflowId,
        startup_id: startup.id,
        status: "INFO",
        message: `Iniciando execução de ${actions.length} ações do workflow`
      });
      
      // Executar cada ação na ordem
      for (const action of actions) {
        await this.executeAction(action, startup, userId);
      }
      
      await this.logWorkflowEvent({
        workflow_id: workflowId,
        startup_id: startup.id,
        status: "SUCCESS",
        message: `Concluída execução de ${actions.length} ações do workflow`
      });
    } catch (error: any) {
      console.error("[WorkflowEngine] Erro ao executar ações do workflow:", error);
      
      await this.logWorkflowEvent({
        workflow_id: workflowId,
        startup_id: startup.id,
        status: "ERROR",
        message: `Erro ao executar ações do workflow: ${error.message || "Erro desconhecido"}`,
        details: { error: error.toString(), stack: error.stack }
      });
    }
  }
  
  // Executa uma ação específica
  private async executeAction(action: WorkflowAction, startup: Startup, userId?: string): Promise<void> {
    console.log(`[WorkflowEngine] Executando ação: ${action.action_name} (${action.action_type}), UserId: ${userId || 'não informado'}`);
    
    await this.logWorkflowEvent({
      workflow_id: action.workflow_id,
      workflow_action_id: action.id,
      startup_id: startup.id,
      action_type: action.action_type,
      status: "INFO",
      message: `Iniciando execução da ação "${action.action_name}" do tipo "${action.action_type}"`
    });
    
    try {
      switch (action.action_type) {
        case 'send_email':
          await this.executeSendEmailAction(action, startup);
          break;
        case 'update_attribute':
          await this.executeUpdateAttributeAction(action, startup);
          break;
        case 'create_task':
          await this.executeCreateTaskAction(action, startup, userId);
          break;
        default:
          console.error(`[WorkflowEngine] Tipo de ação desconhecido: ${action.action_type}`);
          await this.logWorkflowEvent({
            workflow_id: action.workflow_id,
            workflow_action_id: action.id,
            startup_id: startup.id,
            action_type: action.action_type,
            status: "ERROR",
            message: `Tipo de ação desconhecido: ${action.action_type}`
          });
          return;
      }
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: action.action_type,
        status: "SUCCESS",
        message: `Ação "${action.action_name}" executada com sucesso`
      });
    } catch (error: any) { // Typed as any to access error.message
      console.error(`[WorkflowEngine] Erro ao executar ação ${action.id}:`, error);
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: action.action_type,
        status: "ERROR",
        message: `Erro ao executar ação "${action.action_name}": ${error.message || "Erro desconhecido"}`,
        details: { error: error.toString(), stack: error.stack }
      });
    }
  }
  
  // Executa ação de envio de email
  private async executeSendEmailAction(action: WorkflowAction, startup: Startup): Promise<void> {
    // Importa o serviço de email somente quando necessário para evitar ciclos de dependência
    const { sendEmail } = await import('./email-service');
    
    // Verificar se a API Key do Resend está configurada
    if (!process.env.RESEND_API_KEY) {
      const errorMsg = "RESEND_API_KEY não configurada no ambiente";
      console.error(`[WorkflowEngine] ${errorMsg}`);
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: "send_email",
        status: "ERROR",
        message: `Erro na configuração: ${errorMsg}`,
        details: { error: "RESEND_API_KEY não configurada. Contacte o administrador do sistema." }
      });
      
      return;
    }
    
    // Verificar e pegar detalhes da ação
    const details = action.action_details as Record<string, any>;
    const { to, subject, body } = details;
    
    if (!to || !subject || !body) {
      // Registrar quais campos específicos estão ausentes para diagnóstico
      const missingFields = [];
      if (!to) missingFields.push('destinatário (to)');
      if (!subject) missingFields.push('assunto (subject)');
      if (!body) missingFields.push('corpo (body)');
      
      const errorMsg = `Detalhes de email incompletos: campos ausentes [${missingFields.join(', ')}]`;
      console.error(`[WorkflowEngine] ${errorMsg}`, action.action_details);
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: "send_email",
        status: "ERROR",
        message: errorMsg,
        details: { 
          action_details: action.action_details,
          missing_fields: missingFields
        }
      });
      
      return;
    }
    
    console.log(`[WorkflowEngine] Preparando envio de email para: ${to}, Assunto: ${subject}`);
    
    // Verificar se o destinatário é um email válido (formato básico)
    const isValidEmailFormat = (email: string): boolean => {
      return /\S+@\S+\.\S+/.test(email);
    };
    
    // Substituir placeholders no corpo do email e assunto
    const processedBody = this.replacePlaceholders(body, startup);
    const processedSubject = this.replacePlaceholders(subject, startup);
    
    // Substituir placeholder de email se for o caso
    const processedTo = to.includes('{{') ? this.replacePlaceholders(to, startup) : to;
    
    // Verificar se o email processado é válido
    if (!isValidEmailFormat(processedTo)) {
      const errorMsg = `Destinatário de email inválido após processamento: "${processedTo}"`;
      console.error(`[WorkflowEngine] ${errorMsg}`);
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: "send_email",
        status: "ERROR",
        message: errorMsg,
        details: { 
          original_to: to,
          processed_to: processedTo 
        }
      });
      
      return;
    }
    
    await this.logWorkflowEvent({
      workflow_id: action.workflow_id,
      workflow_action_id: action.id,
      startup_id: startup.id,
      action_type: "send_email",
      status: "INFO",
      message: `Preparando envio de email para: ${processedTo}, Assunto: ${processedSubject}`,
      details: { to: processedTo, subject: processedSubject }
    });
    
    try {
      // Processar atributos selecionados para incluir no corpo (se houver)
      let finalBody = processedBody;
      
      // Se tiver atributos selecionados para tabela, adicionar ao corpo
      if (details.selectedAttributes && details.selectedAttributes.length > 0) {
        const tableRows = details.selectedAttributes.map((attr: string) => {
          const attrLabel = this.getAttributeLabel(attr);
          const attrValue = startup[attr as keyof Startup] || 'N/A';
          return `<tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>${attrLabel}</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${attrValue}</td></tr>`;
        }).join('');
        
        const tableHtml = `
          <div style="margin-top: 20px; margin-bottom: 20px;">
            <table style="border-collapse: collapse; width: 100%;">
              <thead>
                <tr>
                  <th style="padding: 8px; text-align: left; background-color: #f2f2f2; border: 1px solid #ddd;">Atributo</th>
                  <th style="padding: 8px; text-align: left; background-color: #f2f2f2; border: 1px solid #ddd;">Valor</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>
        `;
        
        // Adicionar tabela ao final do corpo
        finalBody += tableHtml;
      }
      
      // Log do corpo final do email para diagnóstico (truncado para evitar logs muito grandes)
      const bodySummary = finalBody.length > 200 
        ? `${finalBody.substring(0, 200)}... (${finalBody.length} caracteres)`
        : finalBody;
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: "send_email",
        status: "INFO",
        message: `Corpo do email preparado com ${finalBody.length} caracteres`,
        details: { body_summary: bodySummary }
      });
      
      // Envia o email usando o serviço
      console.log(`[WorkflowEngine] Enviando email via Resend para: ${processedTo}`);
      
      const result = await sendEmail({
        to: processedTo,
        subject: processedSubject,
        body: finalBody
      }) as EmailResult;
      
      if (result.success) {
        let successMsg = '';
        
        // Verificar se o e-mail foi enviado em modo de teste
        if (result.testMode && result.testRecipient) {
          successMsg = `Email redirecionado para ${result.testRecipient} (modo de teste) ao invés de ${processedTo}`;
        } else if (result.realRecipient) {
          successMsg = `Email enviado com sucesso para destinatário real: ${result.realRecipient}`;
        } else {
          successMsg = `Email enviado com sucesso para: ${processedTo}`;
        }
        
        console.log(`[WorkflowEngine] ${successMsg}`);
        
        await this.logWorkflowEvent({
          workflow_id: action.workflow_id,
          workflow_action_id: action.id,
          startup_id: startup.id,
          action_type: "send_email",
          status: "SUCCESS",
          message: successMsg,
          details: {
            to: processedTo,
            subject: processedSubject,
            testMode: result.testMode || false,
            testRecipient: result.testRecipient,
            realRecipient: result.realRecipient,
            time: new Date().toISOString()
          }
        });
      } else {
        // Construir mensagem de erro mais detalhada
        let errorMsg = `Falha ao enviar email para: ${processedTo}`;
        
        // Incluir o código e mensagem de erro específicos, se disponíveis
        if (result.errorCode) {
          errorMsg += ` (Código: ${result.errorCode})`;
        }
        if (result.errorMessage) {
          errorMsg += `: ${result.errorMessage}`;
        }
        
        console.error(`[WorkflowEngine] ${errorMsg}`);
        
        await this.logWorkflowEvent({
          workflow_id: action.workflow_id,
          workflow_action_id: action.id,
          startup_id: startup.id,
          action_type: "send_email",
          status: "ERROR",
          message: errorMsg,
          details: {
            to: processedTo,
            subject: processedSubject,
            api: "Resend",
            errorCode: result.errorCode || "UNKNOWN",
            errorMessage: result.errorMessage || "Erro desconhecido",
            time: new Date().toISOString()
          }
        });
      }
    } catch (error: any) {
      // Extrair mensagens específicas de erros comuns do Resend
      let errorDetail = "Erro desconhecido";
      let errorCode = "UNKNOWN_ERROR";
      const errorObj = error as Error;
      
      if (errorObj && errorObj.message) {
        // Registrar códigos de erro específicos do Resend
        if (errorObj.message.includes("rate limited")) {
          errorCode = "RATE_LIMITED";
        } else if (errorObj.message.includes("unauthorized") || errorObj.message.includes("invalid api key")) {
          errorCode = "AUTH_ERROR";
        } else if (errorObj.message.includes("invalid email")) {
          errorCode = "INVALID_EMAIL";
        }
        
        errorDetail = errorObj.message;
      }
      
      const errorMsg = `Erro ao enviar email: ${errorDetail}`;
      console.error(`[WorkflowEngine] ${errorMsg}`, error);
      
      await this.logWorkflowEvent({
        workflow_id: action.workflow_id,
        workflow_action_id: action.id,
        startup_id: startup.id,
        action_type: "send_email",
        status: "ERROR",
        message: errorMsg,
        details: { 
          error: errorObj ? errorObj.toString() : String(error), 
          stack: errorObj?.stack || "Sem stack trace",
          error_code: errorCode,
          to: processedTo,
          subject: processedSubject,
          api: "Resend",
          time: new Date().toISOString()
        }
      });
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
      // Primeiro, registrar a alteração no histórico para manter auditoria
      const oldStartup = await db
        .select()
        .from(startups)
        .where(eq(startups.id, startup.id))
        .then(results => results[0]);
        
      if (!oldStartup) {
        console.error(`[WorkflowEngine] Startup não encontrada: ${startup.id}`);
        return;
      }
      
      const oldValue = (oldStartup as any)[attribute];
      
      // Registrar no histórico antes de alterar
      await db.insert(startupHistory).values({
        startup_id: startup.id,
        field_name: attribute,
        old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : 'Não definido',
        new_value: value !== null && value !== undefined ? String(value) : 'Não definido',
        changed_at: new Date()
      });
      
      // Criar objeto de atualização com conversão de tipos adequada
      const updateData: Record<string, any> = {};
      
      // Converter valor para o tipo apropriado com base no atributo
      if (attribute === "is_active") {
        // Converter strings 'true'/'false' para booleanos verdadeiros
        if (value === "true" || value === true) {
          updateData[attribute] = true;
        } else if (value === "false" || value === false) {
          updateData[attribute] = false;
        }
        console.log(`[WorkflowEngine] Convertendo valor booleano para ${attribute}: ${updateData[attribute]}`);
      } else if (attribute === "priority") {
        // Garantir que o valor de prioridade seja válido
        let finalValue = "medium"; // valor padrão
        
        console.log(`[WorkflowEngine] Processando valor de prioridade original: "${value}" (${typeof value})`);
        
        // Normalize strings em inglês
        if (value === "low" || value === "medium" || value === "high") {
          finalValue = value;
        } 
        // Normalize strings em português (insensitive to case)
        else if (typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue === "baixa" || lowerValue === "baixo") {
            finalValue = "low";
          } else if (lowerValue === "média" || lowerValue === "medio" || lowerValue === "média") {
            finalValue = "medium";
          } else if (lowerValue === "alta" || lowerValue === "alto") {
            finalValue = "high";
          }
        }
        
        updateData[attribute] = finalValue;
        console.log(`[WorkflowEngine] Valor de prioridade normalizado: "${value}" -> "${finalValue}"`); 
      
      } else if (
        attribute === "mrr" || 
        attribute === "accumulated_revenue_current_year" || 
        attribute === "total_revenue_last_year" || 
        attribute === "total_revenue_previous_year" ||
        attribute === "tam" ||
        attribute === "sam" ||
        attribute === "som" ||
        attribute === "client_count" ||
        attribute === "partner_count" ||
        attribute === "time_tracking"
      ) {
        // Converter para número se for um dos campos numéricos
        const numValue = Number(value);
        if (!isNaN(numValue)) {
          updateData[attribute] = numValue;
          console.log(`[WorkflowEngine] Convertendo valor numérico para ${attribute}: ${updateData[attribute]}`);
        } else {
          updateData[attribute] = value;
        }
      } else {
        // Para outros campos, usar o valor como está
        updateData[attribute] = value;
      }
      
      console.log(`[WorkflowEngine] Objeto de atualização final:`, updateData);
      
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
    } catch (error: any) {
      console.error("[WorkflowEngine] Erro ao atualizar atributo:", error);
    }
  }
  
  // Executa ação de criação de tarefa
  private async executeCreateTaskAction(action: WorkflowAction, startup: Startup, triggeredByUserId?: string): Promise<void> {
    // Verificar e pegar detalhes da ação
    const details = action.action_details as Record<string, any>;
    const { title, description, dueInDays, assignee_id, priority } = details;
    
    if (!title) {
      console.error("[WorkflowEngine] Título da tarefa não especificado:", details);
      return;
    }
    
    console.log(`[WorkflowEngine] Criando tarefa: ${title}`);
    
    // Normalizar valor de prioridade
    let normalizedPriority = "medium"; // valor padrão
    
    if (priority) {
      console.log(`[WorkflowEngine] Processando valor de prioridade para tarefa: "${priority}" (${typeof priority})`);
      
      // Normalize strings em inglês
      if (priority === "low" || priority === "medium" || priority === "high") {
        normalizedPriority = priority;
      } 
      // Normalize strings em português (insensitive to case)
      else if (typeof priority === 'string') {
        const lowerValue = priority.toLowerCase();
        if (lowerValue === "baixa" || lowerValue === "baixo") {
          normalizedPriority = "low";
        } else if (lowerValue === "média" || lowerValue === "medio" || lowerValue === "média") {
          normalizedPriority = "medium";
        } else if (lowerValue === "alta" || lowerValue === "alto") {
          normalizedPriority = "high";
        }
      }
      
      console.log(`[WorkflowEngine] Prioridade normalizada para tarefa: "${priority}" -> "${normalizedPriority}"`);
    }
    
    try {
      // Processar título e descrição para substituir placeholders
      const processedTitle = this.replacePlaceholders(title, startup);
      const processedDescription = description ? this.replacePlaceholders(description, startup) : '';
      
      // Calcular a data de vencimento baseada nos dias informados
      let dueDate = null;
      if (dueInDays && !isNaN(Number(dueInDays))) {
        const days = Number(dueInDays);
        if (days > 0) {
          dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + days);
          console.log(`[WorkflowEngine] Data de vencimento calculada: ${dueDate} (${dueInDays} dias)`);
        }
      }
      
      // Processar o responsável pela tarefa
      let finalAssigneeId = null;
      if (assignee_id) {
        if (assignee_id === "currentUser" && triggeredByUserId) {
          finalAssigneeId = triggeredByUserId;
          console.log(`[WorkflowEngine] Responsável pela tarefa: usuário atual (${triggeredByUserId})`);
        } else if (assignee_id === "triggerUser" && triggeredByUserId) {
          finalAssigneeId = triggeredByUserId;
          console.log(`[WorkflowEngine] Responsável pela tarefa: usuário que disparou (${triggeredByUserId})`);
        } else if (assignee_id !== "currentUser" && assignee_id !== "triggerUser") {
          finalAssigneeId = assignee_id;
          console.log(`[WorkflowEngine] Responsável pela tarefa: ID específico (${assignee_id})`);
        }
      }
      
      // Criar tarefa diretamente usando o db
      const [task] = await db
        .insert(tasks)
        .values({
          title: processedTitle,
          description: processedDescription,
          startup_id: startup.id,
          due_date: dueDate,
          created_by: triggeredByUserId || details.created_by || null,
          assigned_to: finalAssigneeId,
          priority: normalizedPriority,
          status: "todo",
        })
        .returning();
      
      if (task) {
        console.log(`[WorkflowEngine] Tarefa criada com sucesso: ${task.id}`);
        
        // Informações adicionais para ajudar na depuração
        console.log(`[WorkflowEngine] Detalhes da tarefa:`, {
          id: task.id,
          title: task.title,
          due_date: task.due_date,
          assigned_to: task.assigned_to,
          priority: task.priority
        });
      } else {
        console.error('[WorkflowEngine] Falha ao criar tarefa');
      }
    } catch (error: any) {
      console.error("[WorkflowEngine] Erro ao criar tarefa:", error);
      console.error("[WorkflowEngine] Detalhes do erro:", error.message);
      if (error.stack) {
        console.error("[WorkflowEngine] Stack de erro:", error.stack);
      }
    }
  }
  
  // Substituir placeholders em strings
  private replacePlaceholders(text: string, startup: Startup): string {
    // Adicionar mapeamento de nomes amigáveis para atributos reais da tabela
    const attributeMap: Record<string, keyof Startup> = {
      'nome': 'name',
      'email': 'ceo_email',
      'ceo_email': 'ceo_email',
      'telefone': 'ceo_whatsapp',
      'whatsapp': 'ceo_whatsapp',
      'website': 'website',
      'setor': 'sector',
      'descricao': 'description',
      'status': 'status_id',
      'cidade': 'city',
      'estado': 'state',
      'modelo': 'business_model',
      'mrr': 'mrr',
      'prioridade': 'priority'
    };
    
    return text.replace(/\{\{(\w+)\}\}/g, (match, field) => {
      // Verificar se é um nome amigável e mapeá-lo para o atributo correto
      const attributeName = attributeMap[field] || field as keyof Startup;
      
      // Obter o valor do atributo
      const value = startup[attributeName as keyof Startup];
      
      // Logging para diagnóstico
      console.log(`[WorkflowEngine] Substituindo placeholder {{${field}}} => atributo: ${String(attributeName)}, valor: ${String(value || 'undefined')}`);
      
      // Retornar valor ou o placeholder original se o valor for undefined
      return value !== undefined ? String(value) : match;
    });
  }
  
  // Retorna o label amigável para um atributo
  private getAttributeLabel(attributeId: string): string {
    const attributeLabels: Record<string, string> = {
      name: "Nome",
      website: "Website",
      description: "Descrição",
      investment_stage: "Estágio de Investimento",
      valuation: "Avaliação",
      funding_goal: "Meta de Captação",
      sector: "Setor",
      foundation_date: "Data de Fundação",
      location: "Localização",
      team_size: "Tamanho da Equipe",
      contact_email: "Email de Contato",
      contact_phone: "Telefone de Contato",
      priority: "Prioridade",
      notes: "Notas",
      status_name: "Status Atual",
      status_date: "Data do Status"
    };
    
    return attributeLabels[attributeId] || attributeId;
  }
}