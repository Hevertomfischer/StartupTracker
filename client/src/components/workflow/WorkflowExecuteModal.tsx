import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Workflow } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

// Esquema para validação do formulário
const executeWorkflowSchema = z.object({
  entity_type: z.enum(['startup', 'task']),
  entity_id: z.string().min(1, { message: 'Por favor, selecione um item' }),
});

type ExecuteWorkflowValues = z.infer<typeof executeWorkflowSchema>;

interface WorkflowExecuteModalProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowExecuteModal: React.FC<WorkflowExecuteModalProps> = ({
  workflow,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Configurar formulário com valores padrão
  const form = useForm<ExecuteWorkflowValues>({
    resolver: zodResolver(executeWorkflowSchema),
    defaultValues: {
      entity_type: 'startup',
      entity_id: '',
    },
  });

  const entityType = form.watch('entity_type');

  // Buscar startups ou tarefas dependendo do tipo de entidade selecionado
  const { data: entityOptions = [], isLoading: isLoadingEntities } = useQuery<any[]>({
    queryKey: [entityType === 'startup' ? '/api/startups' : '/api/tasks'],
    enabled: isOpen,
  });

  // Manipular envio do formulário
  const onSubmit = async (data: ExecuteWorkflowValues) => {
    setIsSubmitting(true);
    try {
      // Enviar requisição para API para executar o workflow
      const response = await apiRequest(
        'POST',
        `/api/workflows/${workflow.id}/execute`,
        {
          entity_type: data.entity_type,
          entity_id: data.entity_id,
        }
      );

      if (!response.ok) {
        throw new Error('Falha ao executar workflow');
      }

      // Exibir notificação de sucesso
      toast({
        title: 'Workflow executado',
        description: `O workflow "${workflow.name}" foi executado com sucesso.`,
      });

      // Fechar modal
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível executar o workflow: ${
          error instanceof Error ? error.message : String(error)
        }`,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Executar Workflow</DialogTitle>
          <DialogDescription>
            Configure os parâmetros para execução manual do workflow "{workflow.name}".
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="entity_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Entidade</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de entidade" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="startup">Startup</SelectItem>
                      <SelectItem value="task">Tarefa</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    O tipo de objeto sobre o qual o workflow será executado.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="entity_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {entityType === 'startup' ? 'Startup' : 'Tarefa'}
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione ${
                          entityType === 'startup' ? 'uma startup' : 'uma tarefa'
                        }`} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingEntities ? (
                        <div className="flex justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        Array.isArray(entityOptions) 
                          ? entityOptions.map((entity: any) => (
                              <SelectItem key={entity.id} value={entity.id}>
                                {entityType === 'startup' ? entity.name : entity.title}
                              </SelectItem>
                            ))
                          : <SelectItem value="">Nenhuma opção disponível</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {entityType === 'startup'
                      ? 'A startup para a qual o workflow será aplicado.'
                      : 'A tarefa para a qual o workflow será aplicado.'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Executando...
                  </>
                ) : (
                  'Executar Workflow'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowExecuteModal;