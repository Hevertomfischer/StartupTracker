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
import { Loader2, Plus, Settings, Play, Eye } from 'lucide-react';
import { Workflow } from '@shared/schema';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { WorkflowModal } from './WorkflowModal';
import { WorkflowExecuteModal } from './WorkflowExecuteModal';

export const WorkflowList: React.FC = () => {
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExecuteModalOpen, setIsExecuteModalOpen] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const { data: workflows, isLoading, error } = useQuery<Workflow[]>({
    queryKey: ['/api/workflows'],
    refetchOnWindowFocus: false,
  });

  const handleEdit = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setIsModalOpen(true);
  };

  const handleExecute = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setIsExecuteModalOpen(true);
  };

  const handleViewDetails = (workflow: Workflow) => {
    // Implementar visualização detalhada
    toast({
      title: 'Visualizando fluxo de trabalho',
      description: `Detalhes do fluxo de trabalho "${workflow.name}" serão exibidos aqui.`,
    });
  };

  const handleStatusChange = async (workflow: Workflow, isActive: boolean) => {
    try {
      // apiRequest já lança erro se a resposta não for ok
      // e retorna diretamente os dados JSON
      const updatedWorkflow = await apiRequest(
        'PATCH',
        `/api/workflows/${workflow.id}`,
        { is_active: isActive }
      );
      
      // Se chegou aqui, a requisição foi bem-sucedida
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });
      toast({
        title: `Workflow ${isActive ? 'ativado' : 'desativado'}`,
        description: `O workflow "${workflow.name}" foi ${isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível atualizar o status do workflow: ${error instanceof Error ? error.message : String(error)}`,
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
        <p>Erro ao carregar workflows: {error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Fluxos de Trabalho</h2>
          <p className="text-muted-foreground">
            Gerencie automações e fluxos de trabalho para startups e tarefas
          </p>
        </div>
        <Button onClick={() => { setSelectedWorkflow(null); setIsModalOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Workflow
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxos de Trabalho Configurados</CardTitle>
          <CardDescription>
            Lista de todos os fluxos de trabalho configurados no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workflows && workflows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo de Gatilho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.map((workflow) => (
                  <TableRow key={workflow.id}>
                    <TableCell className="font-medium">{workflow.name}</TableCell>
                    <TableCell>{workflow.description || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {renderTriggerType(workflow.trigger_type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={workflow.is_active}
                          onCheckedChange={(checked) => handleStatusChange(workflow, checked)}
                        />
                        <span className={workflow.is_active ? 'text-green-600' : 'text-gray-500'}>
                          {workflow.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(workflow)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(workflow)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExecute(workflow)}
                          disabled={!workflow.is_active}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-10 text-muted-foreground">
              <p>Nenhum fluxo de trabalho configurado.</p>
              <p className="mt-2">Clique em "Novo Workflow" para criar seu primeiro fluxo de trabalho.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <WorkflowModal
          workflow={selectedWorkflow}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {isExecuteModalOpen && selectedWorkflow && (
        <WorkflowExecuteModal
          workflow={selectedWorkflow}
          isOpen={isExecuteModalOpen}
          onClose={() => setIsExecuteModalOpen(false)}
        />
      )}
    </div>
  );
};

function renderTriggerType(triggerType: string): string {
  const triggerTypeMap: Record<string, string> = {
    status_change: 'Mudança de Status',
    task_creation: 'Criação de Tarefa',
    manual: 'Manual',
    scheduled: 'Agendado',
  };

  return triggerTypeMap[triggerType] || triggerType;
}

export default WorkflowList;