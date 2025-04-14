import React, { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { WorkflowAction } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';

// Esquema de validação para o formulário
const workflowActionFormSchema = z.object({
  action_name: z.string().min(3, {
    message: 'O nome deve ter pelo menos 3 caracteres.',
  }),
  description: z.string().optional(),
  action_type: z.enum(['send_email', 'attribute_change', 'task_creation', 'status_query']),
  order: z.number().int().positive(),
  action_details: z.record(z.any()).optional(),
})
.refine(
  (data) => {
    // Validação específica para ação de e-mail
    if (data.action_type === 'send_email') {
      const details = data.action_details || {};
      // Se to_field estiver preenchido, não precisa do to_email
      if (!details.to_field && !details.to_email) {
        return false;
      }
      // Ambos subject e body são obrigatórios
      if (!details.subject || !details.body) {
        return false;
      }
    }
    return true;
  },
  {
    message: "Para ações de e-mail, você deve fornecer um destinatário (campo ou e-mail direto), assunto e corpo",
    path: ["action_details"],
  }
);

type WorkflowActionFormValues = z.infer<typeof workflowActionFormSchema>;

interface WorkflowActionModalProps {
  workflowId: string;
  action?: WorkflowAction | null;
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowActionModal: React.FC<WorkflowActionModalProps> = ({
  workflowId,
  action,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const isEditing = !!action;

  // Carregar as ações existentes para determinar a próxima ordem de execução
  const { data: actions } = useQuery<WorkflowAction[]>({
    queryKey: ['/api/workflows', workflowId, 'actions'],
    enabled: isOpen && !isEditing,
  });

  // Configurar formulário com valores padrão ou da ação existente
  const form = useForm<WorkflowActionFormValues>({
    resolver: zodResolver(workflowActionFormSchema),
    defaultValues: {
      action_name: action?.action_name || '',
      description: action?.description || '',
      action_type: (action?.action_type as any) || 'send_email',
      order: action?.order || (actions?.length ? actions.length + 1 : 1),
      action_details: action?.action_details || {},
    },
  });

  // Tipo de ação selecionado
  const actionType = form.watch('action_type');
  
  // Atualizar ordem de execução quando as ações forem carregadas (apenas em modo de criação)
  useEffect(() => {
    if (!isEditing && actions && actions.length > 0) {
      form.setValue('order', actions.length + 1);
    }
  }, [form, actions, isEditing]);

  // Resetar formulário quando a ação ou estado do modal mudar
  useEffect(() => {
    if (isOpen) {
      const actionDetails = action?.action_details || {};
      
      form.reset({
        action_name: action?.action_name || '',
        description: action?.description || '',
        action_type: (action?.action_type as any) || 'send_email',
        order: action?.order || (actions?.length ? actions.length + 1 : 1),
        action_details: actionDetails,
      });
    }
  }, [form, action, actions, isOpen]);

  // Manipular envio do formulário
  const onSubmit = async (data: WorkflowActionFormValues) => {
    try {
      // Preparar dados específicos do tipo de ação
      let actionDetails = {};
      
      if (data.action_type === 'send_email') {
        actionDetails = {
          to_field: form.getValues('action_details.to_field') || '',
          to_email: form.getValues('action_details.to_email') || '',
          subject: form.getValues('action_details.subject') || '',
          body: form.getValues('action_details.body') || '',
        };
      } else if (data.action_type === 'attribute_change') {
        actionDetails = {
          entity_type: form.getValues('action_details.entity_type') || 'startup',
          attribute_name: form.getValues('action_details.attribute_name') || '',
          attribute_value: form.getValues('action_details.attribute_value') || '',
        };
      } else if (data.action_type === 'task_creation') {
        actionDetails = {
          title: form.getValues('action_details.title') || '',
          description: form.getValues('action_details.description') || '',
          assigned_to: form.getValues('action_details.assigned_to') || null,
          due_date: form.getValues('action_details.due_date') || null,
          priority: form.getValues('action_details.priority') || 'medium',
        };
      } else if (data.action_type === 'status_query') {
        actionDetails = {
          target_status_id: form.getValues('action_details.target_status_id') || null,
        };
      }

      // Preparar dados para envio
      const actionData = {
        ...data,
        workflow_id: workflowId,
        action_details: actionDetails,
      };

      // Enviar requisição para API
      // apiRequest já lançará erro se a resposta não for ok
      const savedAction = await apiRequest(
        isEditing ? 'PATCH' : 'POST',
        isEditing ? `/api/workflow-actions/${action?.id}` : `/api/workflows/${workflowId}/actions`,
        actionData
      );
      
      console.log('Ação salva com sucesso:', savedAction);

      // Invalidar cache de queries para recarregar dados
      queryClient.invalidateQueries({ queryKey: ['/api/workflows', workflowId, 'actions'] });

      // Exibir notificação de sucesso
      toast({
        title: isEditing ? 'Ação atualizada' : 'Ação criada',
        description: isEditing
          ? `A ação "${data.action_name}" foi atualizada com sucesso.`
          : `A ação "${data.action_name}" foi adicionada com sucesso.`,
      });

      // Fechar modal
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} a ação: ${
          error instanceof Error ? error.message : String(error)
        }`,
        variant: 'destructive',
      });
    }
  };

  // Carregar usuários para tarefas
  const { data: users } = useQuery({
    queryKey: ['/api/users'],
    enabled: isOpen && actionType === 'task_creation',
  });

  // Carregar status para consulta de status
  const { data: statuses } = useQuery({
    queryKey: ['/api/statuses'],
    enabled: isOpen && actionType === 'status_query',
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Ação' : 'Nova Ação'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite os detalhes da ação do workflow.'
              : 'Configure uma nova ação para este workflow.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="action_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Ação</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Enviar notificação" {...field} />
                    </FormControl>
                    <FormDescription>
                      Nome descritivo para esta ação.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="action_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Ação</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isEditing} // Não permitir mudar o tipo na edição
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="send_email">Enviar E-mail</SelectItem>
                        <SelectItem value="attribute_change">Mudar Atributo</SelectItem>
                        <SelectItem value="task_creation">Criar Tarefa</SelectItem>
                        <SelectItem value="status_query">Consultar Status</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      O tipo de ação que será executada.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva o propósito desta ação..."
                      className="resize-none"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormDescription>
                    Uma descrição detalhada do que esta ação faz.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ordem de Execução</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="1" 
                      {...field} 
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      value={field.value}
                    />
                  </FormControl>
                  <FormDescription>
                    A ordem em que esta ação será executada no workflow.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campos específicos para cada tipo de ação */}
            {actionType === 'send_email' && (
              <div className="border rounded-md p-4 space-y-4">
                <h4 className="font-medium mb-2">Configuração de E-mail</h4>
                
                <div className="bg-muted/50 p-3 rounded-md mb-2">
                  <h5 className="text-sm font-medium mb-1">Variáveis disponíveis</h5>
                  <p className="text-xs text-muted-foreground mb-2">
                    Você pode usar as seguintes variáveis do banco de dados no seu e-mail:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <h6 className="text-xs font-medium">Startup:</h6>
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        <li>{'{{name}}'} - Nome da startup</li>
                        <li>{'{{status_name}}'} - Nome do status atual</li>
                        <li>{'{{ceo_name}}'} - Nome do CEO</li>
                        <li>{'{{investment_size}}'} - Valor do investimento</li>
                      </ul>
                    </div>
                    <div>
                      <h6 className="text-xs font-medium">Tarefa:</h6>
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        <li>{'{{title}}'} - Título da tarefa</li>
                        <li>{'{{description}}'} - Descrição da tarefa</li>
                        <li>{'{{due_date}}'} - Data de vencimento</li>
                        <li>{'{{priority}}'} - Prioridade da tarefa</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                <FormField
                  control={form.control}
                  name="action_details.to_field"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enviar para o campo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o campo do e-mail" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Usar endereço fixo</SelectItem>
                          <SelectItem value="ceo_email">E-mail do CEO da startup</SelectItem>
                          <SelectItem value="assigned_to_email">E-mail do responsável pela tarefa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Selecione um campo da entidade que contém o e-mail do destinatário.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {!form.watch('action_details.to_field') && (
                  <FormField
                    control={form.control}
                    name="action_details.to_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Para (E-mail)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: destinatario@example.com" 
                            {...field} 
                            value={field.value || ''}
                          />
                        </FormControl>
                        <FormDescription>
                          E-mail do destinatário.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="action_details.subject"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assunto</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Startup {{name}} mudou para {{status_name}}" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Use variáveis entre chaves duplas para inserir dados dinâmicos.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.body"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Corpo do E-mail</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Olá,

A startup {{name}} mudou para o status {{status_name}}.

Atenciosamente,
Equipe de Investimentos" 
                          className="min-h-[120px]"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Use variáveis entre chaves duplas para inserir dados dinâmicos.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {actionType === 'attribute_change' && (
              <div className="border rounded-md p-4 space-y-4">
                <h4 className="font-medium mb-2">Configuração de Mudança de Atributo</h4>
                
                <FormField
                  control={form.control}
                  name="action_details.entity_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Entidade</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || 'startup'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o tipo" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="startup">Startup</SelectItem>
                          <SelectItem value="task">Tarefa</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        O tipo de objeto que terá o atributo modificado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.attribute_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome do Atributo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: status_id" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        O nome do campo que será alterado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.attribute_value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor do Atributo</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: novo_valor" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        O novo valor para o atributo.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {actionType === 'task_creation' && (
              <div className="border rounded-md p-4 space-y-4">
                <h4 className="font-medium mb-2">Configuração de Criação de Tarefa</h4>
                
                <FormField
                  control={form.control}
                  name="action_details.title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Ex: Revisar documentação" 
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Título da tarefa a ser criada.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva a tarefa..."
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.assigned_to"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsável</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um responsável" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">Não atribuído</SelectItem>
                          {Array.isArray(users) && users.map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name || user.username}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data de Vencimento</FormLabel>
                      <FormControl>
                        <Input 
                          type="date"
                          {...field} 
                          value={field.value || ''}
                        />
                      </FormControl>
                      <FormDescription>
                        Data limite para conclusão da tarefa.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="action_details.priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prioridade</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value || 'medium'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a prioridade" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Baixa</SelectItem>
                          <SelectItem value="medium">Média</SelectItem>
                          <SelectItem value="high">Alta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {actionType === 'status_query' && (
              <div className="border rounded-md p-4 space-y-4">
                <h4 className="font-medium mb-2">Configuração de Consulta de Status</h4>
                
                <FormField
                  control={form.control}
                  name="action_details.target_status_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Alvo</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(statuses) && statuses.map((status: any) => (
                            <SelectItem key={status.id} value={status.id}>
                              {status.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        O status que será consultado.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {isEditing ? 'Atualizar' : 'Adicionar'} Ação
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowActionModal;