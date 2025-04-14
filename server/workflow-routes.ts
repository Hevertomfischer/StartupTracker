import { Request, Response } from 'express';
import { workflowService } from './workflow-service';
import { isAdmin, isAuthenticated } from './auth';
import { 
  insertWorkflowSchema, 
  insertWorkflowActionSchema, 
  WorkflowTriggerTypeEnum,
  WorkflowActionTypeEnum
} from '@shared/schema';

/**
 * Configura as rotas relacionadas a workflows
 */
export function setupWorkflowRoutes(app: any) {
  // Rotas para gerenciamento de workflows

  // Obter todos os workflows
  app.get('/api/workflows', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workflows = await workflowService.getWorkflows();
      res.json(workflows);
    } catch (error) {
      console.error('Erro ao buscar workflows:', error);
      res.status(500).json({ 
        error: 'Erro ao buscar workflows',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Obter um workflow específico
  app.get('/api/workflows/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }
      res.json(workflow);
    } catch (error) {
      console.error(`Erro ao buscar workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao buscar workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Criar um novo workflow
  app.post('/api/workflows', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar dados de entrada
      const validationResult = insertWorkflowSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }

      // Validar tipo de gatilho
      if (!Object.values(WorkflowTriggerTypeEnum).includes(req.body.trigger_type as any)) {
        return res.status(400).json({ 
          error: 'Tipo de gatilho inválido',
          validTypes: Object.values(WorkflowTriggerTypeEnum)
        });
      }

      // Adicionar o usuário atual como criador
      const workflowData = {
        ...validationResult.data,
        created_by: req.user?.id
      };

      const workflow = await workflowService.createWorkflow(workflowData);
      res.status(201).json(workflow);
    } catch (error) {
      console.error('Erro ao criar workflow:', error);
      res.status(500).json({ 
        error: 'Erro ao criar workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Atualizar um workflow
  app.patch('/api/workflows/:id', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar se o workflow existe
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }

      // Validar dados parciais de entrada
      const validationResult = insertWorkflowSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }

      // Validar tipo de gatilho se estiver sendo atualizado
      if (req.body.trigger_type && !Object.values(WorkflowTriggerTypeEnum).includes(req.body.trigger_type as any)) {
        return res.status(400).json({ 
          error: 'Tipo de gatilho inválido',
          validTypes: Object.values(WorkflowTriggerTypeEnum)
        });
      }

      const updated = await workflowService.updateWorkflow(req.params.id, validationResult.data);
      res.json(updated);
    } catch (error) {
      console.error(`Erro ao atualizar workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao atualizar workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Excluir um workflow
  app.delete('/api/workflows/:id', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar se o workflow existe
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }

      await workflowService.deleteWorkflow(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error(`Erro ao excluir workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao excluir workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Executar um workflow manualmente
  app.post('/api/workflows/:id/execute', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validar se o workflow existe
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }

      // Validar entidade para execução
      if (!req.body.entityId || !req.body.entityType) {
        return res.status(400).json({ 
          error: 'entityId e entityType são obrigatórios para execução manual'
        });
      }

      // Executar o workflow
      const success = await workflowService.executeWorkflow(
        req.params.id, 
        req.body.entityId, 
        req.body.entityType
      );

      if (success) {
        res.json({ message: 'Workflow executado com sucesso' });
      } else {
        res.status(500).json({ error: 'Falha na execução do workflow' });
      }
    } catch (error) {
      console.error(`Erro ao executar workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao executar workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Rotas para gerenciamento de ações de workflow

  // Obter todas as ações de um workflow
  app.get('/api/workflows/:id/actions', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Validar se o workflow existe
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }

      const actions = await workflowService.getWorkflowActions(req.params.id);
      res.json(actions);
    } catch (error) {
      console.error(`Erro ao buscar ações do workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao buscar ações do workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Obter uma ação específica
  app.get('/api/workflow-actions/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const action = await workflowService.getWorkflowAction(req.params.id);
      if (!action) {
        return res.status(404).json({ error: 'Ação de workflow não encontrada' });
      }
      res.json(action);
    } catch (error) {
      console.error(`Erro ao buscar ação de workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao buscar ação de workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Adicionar uma ação a um workflow
  app.post('/api/workflows/:id/actions', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar se o workflow existe
      const workflow = await workflowService.getWorkflow(req.params.id);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow não encontrado' });
      }

      // Validar dados de entrada
      const validationResult = insertWorkflowActionSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }

      // Validar tipo de ação
      if (!Object.values(WorkflowActionTypeEnum).includes(req.body.action_type as any)) {
        return res.status(400).json({ 
          error: 'Tipo de ação inválido',
          validTypes: Object.values(WorkflowActionTypeEnum)
        });
      }

      // Garantir que a ação esteja associada ao workflow correto
      const actionData = {
        ...validationResult.data,
        workflow_id: req.params.id
      };

      const action = await workflowService.addWorkflowAction(actionData);
      res.status(201).json(action);
    } catch (error) {
      console.error(`Erro ao adicionar ação ao workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao adicionar ação ao workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Atualizar uma ação de workflow
  app.patch('/api/workflow-actions/:id', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar se a ação existe
      const action = await workflowService.getWorkflowAction(req.params.id);
      if (!action) {
        return res.status(404).json({ error: 'Ação de workflow não encontrada' });
      }

      // Validar dados parciais de entrada
      const validationResult = insertWorkflowActionSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Dados inválidos',
          details: validationResult.error.format()
        });
      }

      // Validar tipo de ação se estiver sendo atualizado
      if (req.body.action_type && !Object.values(WorkflowActionTypeEnum).includes(req.body.action_type as any)) {
        return res.status(400).json({ 
          error: 'Tipo de ação inválido',
          validTypes: Object.values(WorkflowActionTypeEnum)
        });
      }

      // Não permitir alterar o workflow_id
      if (req.body.workflow_id && req.body.workflow_id !== action.workflow_id) {
        return res.status(400).json({ 
          error: 'Não é permitido alterar o workflow associado a uma ação existente'
        });
      }

      const updated = await workflowService.updateWorkflowAction(req.params.id, validationResult.data);
      res.json(updated);
    } catch (error) {
      console.error(`Erro ao atualizar ação de workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao atualizar ação de workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Excluir uma ação de workflow
  app.delete('/api/workflow-actions/:id', isAdmin, async (req: Request, res: Response) => {
    try {
      // Validar se a ação existe
      const action = await workflowService.getWorkflowAction(req.params.id);
      if (!action) {
        return res.status(404).json({ error: 'Ação de workflow não encontrada' });
      }

      await workflowService.deleteWorkflowAction(req.params.id);
      res.status(204).end();
    } catch (error) {
      console.error(`Erro ao excluir ação de workflow ${req.params.id}:`, error);
      res.status(500).json({ 
        error: 'Erro ao excluir ação de workflow',
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
}