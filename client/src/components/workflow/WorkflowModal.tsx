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
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Workflow, WorkflowTriggerTypeEnum } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { 
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowActionsList } from './WorkflowActionsList';
import { useQuery } from '@tanstack/react-query';
import { Status } from '@shared/schema';

// Esquema de validação para o formulário
const workflowFormSchema = z.object({
  name: z.string().min(3, {
    message: 'O nome deve ter pelo menos 3 caracteres.',
  }),
  description: z.string().optional(),
  is_active: z.boolean().default(true),
  trigger_type: z.enum(['status_change', 'task_creation', 'manual', 'scheduled']),
  trigger_details: z.any().optional(),
});

type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

interface WorkflowModalProps {
  workflow?: Workflow | null;
  isOpen: boolean;
  onClose: () => void;
}

export const WorkflowModal: React.FC<WorkflowModalProps> = ({
  workflow,
  isOpen,
  onClose,
}) => {
  const { toast } = useToast();
  const isEditing = !!workflow;

  // Carregar status para o tipo de gatilho de mudança de status
  const { data: statuses } = useQuery<Status[]>({
    queryKey: ['/api/statuses'],
    enabled: isOpen,
  });

  // Configurar formulário com valores padrão ou do workflow existente
  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: {
      name: workflow?.name || '',
      description: workflow?.description || '',
      is_active: workflow?.is_active ?? true,
      trigger_type: (workflow?.trigger_type as any) || 'manual',
      trigger_details: workflow?.trigger_details || {},
    },
  });

  const triggerType = form.watch('trigger_type');

  // Resetar formulário quando o workflow ou estado do modal mudar
  useEffect(() => {
    if (isOpen) {
      form.reset({
        name: workflow?.name || '',
        description: workflow?.description || '',
        is_active: workflow?.is_active ?? true,
        trigger_type: (workflow?.trigger_type as any) || 'manual',
        trigger_details: workflow?.trigger_details || {},
      });
    }
  }, [form, workflow, isOpen]);

  // Manipular envio do formulário
  const onSubmit = async (data: WorkflowFormValues) => {
    try {
      // Preparar dados específicos do tipo de gatilho
      let triggerDetails = {};
      
      if (data.trigger_type === 'status_change' && data.trigger_details) {
        triggerDetails = {
          status_id: data.trigger_details.status_id || null,
        };
      }

      // Preparar dados do formulário para envio
      const workflowData = {
        ...data,
        trigger_details: triggerDetails,
      };

      // Enviar requisição para API
      const response = await apiRequest(
        isEditing ? 'PATCH' : 'POST',
        isEditing ? `/api/workflows/${workflow?.id}` : '/api/workflows',
        workflowData
      );

      if (!response.ok) {
        throw new Error('Falha ao salvar workflow');
      }

      // Invalidar cache de queries para recarregar dados
      queryClient.invalidateQueries({ queryKey: ['/api/workflows'] });

      // Exibir notificação de sucesso
      toast({
        title: isEditing ? 'Workflow atualizado' : 'Workflow criado',
        description: isEditing
          ? `O workflow "${data.name}" foi atualizado com sucesso.`
          : `O workflow "${data.name}" foi criado com sucesso.`,
      });

      // Fechar modal
      onClose();
    } catch (error) {
      toast({
        title: 'Erro',
        description: `Não foi possível ${isEditing ? 'atualizar' : 'criar'} o workflow: ${
          error instanceof Error ? error.message : String(error)
        }`,
        variant: 'destructive',
      });
    }
  };

  const renderWorkflowForm = () => (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Workflow</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Notificar mudança de status" {...field} />
              </FormControl>
              <FormDescription>
                Um nome descritivo para identificar este workflow.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Descreva o propósito deste workflow..."
                  className="resize-none"
                  {...field}
                  value={field.value || ''}
                />
              </FormControl>
              <FormDescription>
                Uma descrição detalhada do que este workflow faz.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Ativo</FormLabel>
                <FormDescription>
                  Quando ativo, este workflow será executado automaticamente.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="trigger_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tipo de Gatilho</FormLabel>
              <Select
                onValueChange={field.onChange}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo de gatilho" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="status_change">Mudança de Status</SelectItem>
                  <SelectItem value="task_creation">Criação de Tarefa</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                </SelectContent>
              </Select>
              <FormDescription>
                O evento que irá disparar a execução deste workflow.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Campos específicos para cada tipo de gatilho */}
        {triggerType === 'status_change' && (
          <div className="border rounded-md p-4">
            <h4 className="font-medium mb-2">Configuração de Mudança de Status</h4>
            <FormField
              control={form.control}
              name="trigger_details.status_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
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
                      {statuses?.map((status) => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    O workflow será executado quando uma startup mudar para este status.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {triggerType === 'scheduled' && (
          <div className="border rounded-md p-4">
            <h4 className="font-medium mb-2">Configuração de Agendamento</h4>
            <p className="text-sm text-muted-foreground mb-4">
              A funcionalidade de agendamento será implementada em uma versão futura.
            </p>
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
            {isEditing ? 'Atualizar' : 'Criar'} Workflow
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={isEditing ? "sm:max-w-[800px]" : "sm:max-w-[600px]"}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Workflow' : 'Novo Workflow'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Edite as configurações do workflow existente.'
              : 'Configure um novo workflow de automação.'}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
          <Tabs defaultValue="settings" className="mt-2">
            <TabsList className="w-full mb-4">
              <TabsTrigger value="settings" className="flex-1">Configurações Básicas</TabsTrigger>
              <TabsTrigger value="actions" className="flex-1">Ações</TabsTrigger>
            </TabsList>
            <TabsContent value="settings">
              {renderWorkflowForm()}
            </TabsContent>
            <TabsContent value="actions">
              {workflow && <WorkflowActionsList workflow={workflow} />}
            </TabsContent>
          </Tabs>
        ) : (
          renderWorkflowForm()
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WorkflowModal;