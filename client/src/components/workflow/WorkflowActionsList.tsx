import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, Settings, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Workflow, WorkflowAction } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import WorkflowActionModal from './WorkflowActionModal';

interface WorkflowActionsListProps {
  workflow: Workflow;
}

export const WorkflowActionsList: React.FC<WorkflowActionsListProps> = ({ workflow }) => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<WorkflowAction | null>(null);

  const { data: actions, isLoading, error } = useQuery<WorkflowAction[]>({
    queryKey: ['/api/workflows', workflow.id, 'actions'],
    enabled: !!workflow.id,
  });

  const handleOpenModal = (action?: WorkflowAction) => {
    setSelectedAction(action || null);
    setIsModalOpen(true);
  };

  const handleDelete = async (action: WorkflowAction) => {
    if (!confirm(`Tem certeza que deseja excluir a ação "${action.action_name}"?`)) {
      return;
    }

    try {
      const response = await apiRequest(
        'DELETE',
        `/api/workflow-actions/${action.id}`,
      );

      if (response.ok) {
        queryClient.invalidateQueries({ queryKey: ['/api/workflows', workflow.id, 'actions'] });
        toast({
          title: 'Ação excluída',
          description: `A ação "${action.action_name}" foi excluída com sucesso.`,
        });
      } else {
        throw new Error('Falha ao excluir ação');
      }
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível excluir a ação: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  const handleMoveAction = async (action: WorkflowAction, direction: 'up' | 'down') => {
    if (!actions || actions.length <= 1) return;

    const currentIndex = actions.findIndex(a => a.id === action.id);
    if (currentIndex === -1) return;

    let targetIndex;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < actions.length - 1) {
      targetIndex = currentIndex + 1;
    } else {
      return; // Não é possível mover mais para cima/baixo
    }

    try {
      const newOrder = action.order;
      const targetOrder = actions[targetIndex].order;

      // Atualizar a ordem da ação selecionada
      await apiRequest(
        'PATCH',
        `/api/workflow-actions/${action.id}`,
        { order: targetOrder }
      );

      // Atualizar a ordem da ação de destino
      await apiRequest(
        'PATCH',
        `/api/workflow-actions/${actions[targetIndex].id}`,
        { order: newOrder }
      );

      queryClient.invalidateQueries({ queryKey: ['/api/workflows', workflow.id, 'actions'] });
      toast({
        title: 'Ordem atualizada',
        description: `A ordem de execução foi atualizada.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível alterar a ordem: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md text-destructive">
        <p>Erro ao carregar ações: {error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold tracking-tight">Ações do Workflow</h3>
          <p className="text-muted-foreground">
            Gerencie as ações que serão executadas quando este workflow for disparado
          </p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="mr-2 h-4 w-4" /> Nova Ação
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ações Configuradas</CardTitle>
          <CardDescription>
            As ações serão executadas na ordem definida
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actions && actions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ordem</TableHead>
                  <TableHead>Nome da Ação</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((action) => (
                  <TableRow key={action.id}>
                    <TableCell className="font-medium">{action.order}</TableCell>
                    <TableCell>{action.action_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {renderActionType(action.action_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{action.description || '-'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveAction(action, 'up')}
                          disabled={actions.indexOf(action) === 0}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMoveAction(action, 'down')}
                          disabled={actions.indexOf(action) === actions.length - 1}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(action)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(action)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Nenhuma ação configurada para este workflow.</p>
              <p className="mt-2">Clique em "Nova Ação" para adicionar uma ação.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <WorkflowActionModal
          workflowId={workflow.id}
          action={selectedAction}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

function renderActionType(actionType: string): string {
  const actionTypeMap: Record<string, string> = {
    send_email: 'Enviar E-mail',
    attribute_change: 'Mudar Atributo',
    task_creation: 'Criar Tarefa',
    status_query: 'Consultar Status',
  };

  return actionTypeMap[actionType] || actionType;
}

export default WorkflowActionsList;