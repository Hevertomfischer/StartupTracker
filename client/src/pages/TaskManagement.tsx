import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "../lib/queryClient";
import { Task, InsertTask, TaskStatusEnum, PriorityEnum } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { 
  Calendar as CalendarIcon,
  PlusCircle,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Edit,
  Trash2,
  AlertCircle,
  CalendarRange,
  Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";

// Layout component temporário (para solucionar erro de importação)
function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}

// Formatar uma data para exibição amigável
const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
};

// Badge para o status de uma tarefa
const StatusBadge = ({ status }: { status: string }) => {
  switch (status) {
    case TaskStatusEnum.TODO:
      return <Badge variant="outline" className="flex items-center gap-1"><Circle className="h-3 w-3" /> A fazer</Badge>;
    case TaskStatusEnum.IN_PROGRESS:
      return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" /> Em andamento</Badge>;
    case TaskStatusEnum.DONE:
      return <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Concluída</Badge>;
    case TaskStatusEnum.CANCELLED:
      return <Badge variant="destructive" className="flex items-center gap-1"><XCircle className="h-3 w-3" /> Cancelada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

// Badge para a prioridade de uma tarefa
const PriorityBadge = ({ priority }: { priority: string }) => {
  switch (priority) {
    case PriorityEnum.LOW:
      return <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">Baixa</Badge>;
    case PriorityEnum.MEDIUM:
      return <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">Média</Badge>;
    case PriorityEnum.HIGH:
      return <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">Alta</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
};

// Formulário de criação/edição de tarefas
const taskFormSchema = z.object({
  title: z.string().min(3, { message: "O título deve ter pelo menos 3 caracteres" }),
  description: z.string().optional(),
  startup_id: z.string().optional().nullable(),
  assigned_to: z.string().min(1, { message: "É necessário selecionar um responsável" }),
  priority: z.string().default(PriorityEnum.MEDIUM),
  status: z.string().default(TaskStatusEnum.TODO),
  due_date: z.date().optional().nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

export default function TaskManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, logoutMutation } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");

  // Queries
  const { 
    data: tasks, 
    isLoading: isLoadingTasks 
  } = useQuery<Task[]>({ 
    queryKey: ['/api/tasks'],
    enabled: !!user, // Só executa se o usuário estiver autenticado
    retry: 3, // Tenta novamente até 3 vezes em caso de falha
  });

  const { 
    data: startups, 
    isLoading: isLoadingStartups,
    error: startupsError
  } = useQuery({ 
    queryKey: ['/api/startups'],
    enabled: !!user, // Só executa se o usuário estiver autenticado
    retry: 3, // Tenta novamente até 3 vezes em caso de falha
  });

  const { 
    data: users, 
    isLoading: isLoadingUsers,
    error: usersError
  } = useQuery({ 
    queryKey: ['/api/users'],
    enabled: !!user, // Só executa se o usuário estiver autenticado
    retry: 3, // Tenta novamente até 3 vezes em caso de falha
  });

  // Mutations
  const createTaskMutation = useMutation({
    mutationFn: (taskData: TaskFormValues) => {
      return apiRequest('POST', '/api/tasks', taskData)
        .then(res => {
          if (!res.ok) throw new Error('Erro ao criar tarefa');
          return res.json();
        });
    },
    onSuccess: () => {
      toast({
        title: "Tarefa criada",
        description: "A tarefa foi criada com sucesso.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ id, task }: { id: string, task: TaskFormValues }) => {
      return apiRequest('PATCH', `/api/tasks/${id}`, task)
        .then(res => {
          if (!res.ok) throw new Error('Erro ao atualizar tarefa');
          return res.json();
        });
    },
    onSuccess: () => {
      toast({
        title: "Tarefa atualizada",
        description: "A tarefa foi atualizada com sucesso.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setDialogOpen(false);
      setSelectedTask(null);
    },
    onError: (error) => {
      toast({
        title: "Erro ao atualizar tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (id: string) => {
      return apiRequest('PATCH', `/api/tasks/${id}/complete`)
        .then(res => {
          if (!res.ok) throw new Error('Erro ao concluir tarefa');
          return res.json();
        });
    },
    onSuccess: () => {
      toast({
        title: "Tarefa concluída",
        description: "A tarefa foi marcada como concluída.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao concluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => {
      return apiRequest('DELETE', `/api/tasks/${id}`)
        .then(res => {
          if (!res.ok) throw new Error('Erro ao excluir tarefa');
          return res;
        });
    },
    onSuccess: () => {
      toast({
        title: "Tarefa excluída",
        description: "A tarefa foi excluída com sucesso.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir tarefa",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Form setup
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: "",
      description: "",
      startup_id: "none",
      assigned_to: "",
      priority: PriorityEnum.MEDIUM,
      status: TaskStatusEnum.TODO,
      due_date: null,
    },
  });

  // Reset form when selectedTask changes
  useEffect(() => {
    if (selectedTask) {
      form.reset({
        title: selectedTask.title,
        description: selectedTask.description ?? "",
        startup_id: selectedTask.startup_id || "none",
        // Responsável deve ter um valor válido
        assigned_to: selectedTask.assigned_to || "",
        priority: selectedTask.priority,
        status: selectedTask.status,
        due_date: selectedTask.due_date ? new Date(selectedTask.due_date) : null,
      });
    } else {
      form.reset({
        title: "",
        description: "",
        startup_id: "none",
        assigned_to: "",
        priority: PriorityEnum.MEDIUM,
        status: TaskStatusEnum.TODO,
        due_date: null,
      });
    }
  }, [selectedTask, form]);

  // Task filtering
  const filteredTasks = tasks?.filter(task => {
    // Texto de busca
    const searchMatch = 
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (task.description && task.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Filtro de status
    const statusMatch = filterStatus === "all" || task.status === filterStatus;
    
    // Filtro de prioridade
    const priorityMatch = filterPriority === "all" || task.priority === filterPriority;
    
    return searchMatch && statusMatch && priorityMatch;
  }) || [];

  // Form submission handler
  const onSubmit = (values: TaskFormValues) => {
    // Converte os valores "none" para null antes de enviar
    const processedValues = {
      ...values,
      startup_id: values.startup_id === "none" ? null : values.startup_id,
      // Garantir que due_date seja um objeto Date para o backend
      due_date: values.due_date ? new Date(values.due_date) : undefined
      // Não permitimos assigned_to como null para atender o schema
    };
    
    // Validação extra para garantir que assigned_to nunca seja "none"
    if (values.assigned_to === "none" || !values.assigned_to) {
      toast({
        title: "Erro de validação",
        description: "É necessário selecionar um responsável para a tarefa",
        variant: "destructive",
      });
      return;
    }
    
    if (selectedTask) {
      updateTaskMutation.mutate({
        id: selectedTask.id,
        task: processedValues
      });
    } else {
      createTaskMutation.mutate(processedValues);
    }
  };

  // Get startup name from ID
  const getStartupName = (id?: string | null) => {
    if (!id || !startups || !Array.isArray(startups)) return "-";
    const startup = startups.find((s: any) => s.id === id);
    return startup ? startup.name : id;
  };

  // Get user name from ID
  const getUserName = (id?: string | null) => {
    if (!id || !users || !Array.isArray(users)) return "-";
    const user = users.find((u: any) => u.id === id);
    return user ? user.name : id;
  };
  
  // Log whenever dialog is opened to check state
  useEffect(() => {
    if (dialogOpen) {
      console.log('Dialog aberto, estado do formulário:', form.getValues());
      console.log('Startups e usuários disponíveis:', { startups, users });
    }
  }, [dialogOpen, form, startups, users]);

  // Estado de autenticação
  const isLoading = isLoadingTasks || isLoadingUsers || isLoadingStartups;
  const showAuthWarning = !user && !isLoading;

  return (
    <Layout>
      <div className="container px-6 py-8 mx-auto">
        {showAuthWarning && (
          <div className="mb-6 p-4 border border-red-300 bg-red-50 rounded-md text-red-800">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <h3 className="font-medium">Não autenticado</h3>
            </div>
            <p className="mt-1">Você precisa estar autenticado para gerenciar tarefas.</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Tarefas</h1>
          
          <div className="flex items-center gap-4">
            {user ? (
              <Button variant="outline" onClick={() => logoutMutation.mutate()}>
                Sair ({user.name})
              </Button>
            ) : (
              <Button onClick={() => window.location.href = "/auth"}>
                Fazer Login
              </Button>
            )}
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => setSelectedTask(null)}
                disabled={!user}
                title={!user ? "Faça login para adicionar tarefas" : ""}
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nova Tarefa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>{selectedTask ? "Editar Tarefa" : "Nova Tarefa"}</DialogTitle>
                <DialogDescription>
                  {selectedTask 
                    ? "Atualize os detalhes da tarefa" 
                    : "Preencha os detalhes da nova tarefa"}
                </DialogDescription>
              </DialogHeader>
              
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Título</FormLabel>
                        <FormControl>
                          <Input placeholder="Digite o título da tarefa" {...field} />
                        </FormControl>
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
                            placeholder="Descreva a tarefa em detalhes" 
                            className="resize-none min-h-[100px]" 
                            {...field} 
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Prioridade</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione a prioridade" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={PriorityEnum.LOW}>Baixa</SelectItem>
                              <SelectItem value={PriorityEnum.MEDIUM}>Média</SelectItem>
                              <SelectItem value={PriorityEnum.HIGH}>Alta</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value={TaskStatusEnum.TODO}>A fazer</SelectItem>
                              <SelectItem value={TaskStatusEnum.IN_PROGRESS}>Em andamento</SelectItem>
                              <SelectItem value={TaskStatusEnum.DONE}>Concluída</SelectItem>
                              <SelectItem value={TaskStatusEnum.CANCELLED}>Cancelada</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="startup_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Startup relacionada</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value || "none"} 
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma startup" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sem startup</SelectItem>
                              {Array.isArray(startups) && startups.length > 0 ? (
                                startups.map((startup: any) => (
                                  <SelectItem key={startup.id} value={startup.id}>
                                    {startup.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="loading" disabled>
                                  Carregando startups...
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="assigned_to"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Responsável</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value || "none"}
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione um responsável" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Sem responsável</SelectItem>
                              {Array.isArray(users) && users.length > 0 ? (
                                users.map((user: any) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))
                              ) : (
                                <SelectItem value="loading" disabled>
                                  Carregando usuários...
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="due_date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Data de vencimento</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: ptBR })
                                ) : (
                                  <span>Selecione uma data</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value || undefined}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormDescription>
                          A data limite para a tarefa ser concluída.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button 
                      type="submit" 
                      disabled={createTaskMutation.isPending || updateTaskMutation.isPending}
                    >
                      {createTaskMutation.isPending || updateTaskMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        selectedTask ? "Atualizar" : "Criar"
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mb-6 grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar tarefas por título ou descrição"
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value={TaskStatusEnum.TODO}>A fazer</SelectItem>
                <SelectItem value={TaskStatusEnum.IN_PROGRESS}>Em andamento</SelectItem>
                <SelectItem value={TaskStatusEnum.DONE}>Concluídas</SelectItem>
                <SelectItem value={TaskStatusEnum.CANCELLED}>Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as prioridades</SelectItem>
                <SelectItem value={PriorityEnum.LOW}>Baixa</SelectItem>
                <SelectItem value={PriorityEnum.MEDIUM}>Média</SelectItem>
                <SelectItem value={PriorityEnum.HIGH}>Alta</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isLoadingTasks ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma tarefa encontrada</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm || filterStatus !== "all" || filterPriority !== "all"
                    ? "Tente ajustar seus filtros para encontrar o que procura."
                    : "Começe criando uma nova tarefa."}
                </p>
                <Button 
                  onClick={() => setDialogOpen(true)}
                  disabled={!user}
                  title={!user ? "Faça login para adicionar tarefas" : ""}
                >
                  <PlusCircle className="h-4 w-4 mr-2" />
                  Nova Tarefa
                </Button>
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableCaption>Lista de tarefas - Total: {filteredTasks.length}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Título</TableHead>
                      <TableHead>Startup</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          <div className="max-w-[300px]">
                            <div className="font-medium text-sm">{task.title}</div>
                            {task.description && (
                              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                {task.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getStartupName(task.startup_id)}</TableCell>
                        <TableCell><StatusBadge status={task.status} /></TableCell>
                        <TableCell><PriorityBadge priority={task.priority} /></TableCell>
                        <TableCell>{getUserName(task.assigned_to)}</TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <div className="flex items-center gap-1 text-sm">
                              <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                              {formatDate(String(task.due_date))}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {task.status !== TaskStatusEnum.DONE && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => completeTaskMutation.mutate(task.id)}
                                title="Marcar como concluída"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                setSelectedTask(task);
                                setDialogOpen(true);
                              }}
                              title="Editar tarefa"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-red-500 hover:text-red-700"
                              onClick={() => {
                                if (window.confirm("Tem certeza que deseja excluir esta tarefa?")) {
                                  deleteTaskMutation.mutate(task.id);
                                }
                              }}
                              title="Excluir tarefa"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

// Helper function to format date
function format(date: Date, format: string, options: any): string {
  // Simple implementation to avoid date-fns format import issues
  return date.toLocaleDateString('pt-BR', { 
    day: '2-digit', 
    month: '2-digit', 
    year: 'numeric' 
  });
}