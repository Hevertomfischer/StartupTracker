import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import WorkflowActionModal from "@/components/workflow/WorkflowActionModal";
import WorkflowConditionModal from "@/components/workflow/WorkflowConditionModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient } from "@/lib/queryClient";
import { Redirect } from "wouter";
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  Search, 
  Check, 
  X,
  ArrowDownUp,
  Activity,
  Sliders,
  Workflow,
  AlertTriangle,
  Loader2
} from "lucide-react";

// Tipos básicos do workflow
interface Workflow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  trigger_type: string;
  trigger_details: Record<string, any>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowAction {
  id: string;
  workflow_id: string;
  action_type: string;
  action_details: Record<string, any>;
  action_name: string;
  order: number;
  created_at: string;
}

interface WorkflowCondition {
  id: string;
  workflow_id: string;
  field_name: string;
  operator: string;
  value: string;
  created_at: string;
}

interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
}

// Componente de gestão de workflows
export default function WorkflowManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.roles?.includes("Administrador") || false;
  
  // Estados
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isConditionModalOpen, setIsConditionModalOpen] = useState(false);
  const [actionCreationStatus, setActionCreationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [conditionCreationStatus, setConditionCreationStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [workflowForm, setWorkflowForm] = useState({
    name: "",
    description: "",
    is_active: true,
    trigger_type: "status_change",
    trigger_details: {} as Record<string, any>
  });
  
  // Consulta para carregar os workflows
  const {
    data: workflows = [],
    isLoading: isWorkflowsLoading,
    refetch: refetchWorkflows
  } = useQuery<Workflow[]>({
    queryKey: ["/api/workflows"],
    enabled: !!user
  });

  // Consulta para carregar os status disponíveis
  const {
    data: statuses = [],
    isLoading: isStatusesLoading,
  } = useQuery<Status[]>({
    queryKey: ["/api/statuses"],
    enabled: !!user
  });

  // Consulta para carregar as ações de um workflow selecionado
  const {
    data: workflowActions = [],
    isLoading: isActionsLoading,
    refetch: refetchWorkflowActions
  } = useQuery<WorkflowAction[]>({
    queryKey: ["/api/workflows", selectedWorkflow?.id, "actions"],
    queryFn: async () => {
      const response = await fetch(`/api/workflows/${selectedWorkflow?.id}/actions`);
      if (!response.ok) {
        throw new Error("Erro ao carregar ações");
      }
      return response.json();
    },
    enabled: !!selectedWorkflow
  });

  // Consulta para carregar as condições de um workflow selecionado
  const {
    data: workflowConditions = [],
    isLoading: isConditionsLoading,
    refetch: refetchWorkflowConditions
  } = useQuery<WorkflowCondition[]>({
    queryKey: ["/api/workflows", selectedWorkflow?.id, "conditions"],
    queryFn: async () => {
      const response = await fetch(`/api/workflows/${selectedWorkflow?.id}/conditions`);
      if (!response.ok) {
        throw new Error("Erro ao carregar condições");
      }
      return response.json();
    },
    enabled: !!selectedWorkflow
  });

  // Mutação para criar um novo workflow
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: typeof workflowForm) => {
      const response = await fetch("/api/workflows", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar workflow: ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Workflow criado",
        description: "O workflow foi criado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setIsWorkflowModalOpen(false);
      console.log("Workflow salvo com sucesso:", data);
      setSelectedWorkflow(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar workflow",
        description: error.message || "Ocorreu um erro ao criar o workflow.",
        variant: "destructive",
      });
    }
  });
  
  // Mutação para atualizar um workflow
  const updateWorkflowMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!selectedWorkflow) throw new Error("Nenhum workflow selecionado");
      
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data),
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao atualizar workflow: ${errorText}`);
      }
      
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Workflow atualizado",
        description: "O workflow foi atualizado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setIsWorkflowModalOpen(false);
      setSelectedWorkflow(data);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar workflow",
        description: error.message || "Ocorreu um erro ao atualizar o workflow.",
        variant: "destructive",
      });
    }
  });
  
  // Mutação para excluir um workflow
  const deleteWorkflowMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWorkflow) throw new Error("Nenhum workflow selecionado");
      
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}`, {
        method: "DELETE",
        credentials: "include"
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao excluir workflow: ${errorText}`);
      }
    },
    onSuccess: () => {
      toast({
        title: "Workflow excluído",
        description: "O workflow foi excluído com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setIsDeleteDialogOpen(false);
      setSelectedWorkflow(null);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao excluir workflow",
        description: error.message || "Ocorreu um erro ao excluir o workflow.",
        variant: "destructive",
      });
    }
  });
  
  // Mutação para adicionar uma ação ao workflow
  const addWorkflowActionMutation = useMutation({
    mutationFn: async (actionData: any) => {
      if (!selectedWorkflow) throw new Error("Nenhum workflow selecionado");
      setActionCreationStatus("loading");
      
      // Adiciona o workflow_id ao payload
      const completeActionData = {
        ...actionData,
        workflow_id: selectedWorkflow.id
      };
      
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/actions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(completeActionData),
        credentials: "include"
      });
      
      if (!response.ok) {
        setActionCreationStatus("error");
        const errorText = await response.text();
        throw new Error(`Erro ao adicionar ação: ${errorText}`);
      }
      
      const result = await response.json();
      setActionCreationStatus("success");
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Ação adicionada",
        description: "A ação foi adicionada ao workflow com sucesso.",
      });
      // Atualiza a lista de ações
      refetchWorkflowActions();
      setIsActionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar ação",
        description: error.message || "Ocorreu um erro ao adicionar a ação.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Independente do resultado, voltamos para o estado de repouso
      setTimeout(() => {
        setActionCreationStatus("idle");
      }, 1000);
    }
  });
  
  // Mutação para adicionar uma condição ao workflow
  const addWorkflowConditionMutation = useMutation({
    mutationFn: async (conditionData: any) => {
      if (!selectedWorkflow) throw new Error("Nenhum workflow selecionado");
      setConditionCreationStatus("loading");
      
      // Adiciona o workflow_id ao payload
      const completeConditionData = {
        ...conditionData,
        workflow_id: selectedWorkflow.id
      };
      
      const response = await fetch(`/api/workflows/${selectedWorkflow.id}/conditions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(completeConditionData),
        credentials: "include"
      });
      
      if (!response.ok) {
        setConditionCreationStatus("error");
        const errorText = await response.text();
        throw new Error(`Erro ao adicionar condição: ${errorText}`);
      }
      
      const result = await response.json();
      setConditionCreationStatus("success");
      return result;
    },
    onSuccess: () => {
      toast({
        title: "Condição adicionada",
        description: "A condição foi adicionada ao workflow com sucesso.",
      });
      // Atualiza a lista de condições
      refetchWorkflowConditions();
      setIsConditionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar condição",
        description: error.message || "Ocorreu um erro ao adicionar a condição.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Independente do resultado, voltamos para o estado de repouso
      setTimeout(() => {
        setConditionCreationStatus("idle");
      }, 1000);
    }
  });
  
  // Recarregar dados quando o workflow muda
  useEffect(() => {
    if (selectedWorkflow) {
      refetchWorkflowActions();
      refetchWorkflowConditions();
    }
  }, [selectedWorkflow, refetchWorkflowActions, refetchWorkflowConditions]);
  
  // Filtrar workflows com base no termo de pesquisa
  const filteredWorkflows = workflows.filter(workflow => 
    workflow.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (workflow.description && workflow.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Seleção de um workflow
  const handleSelectWorkflow = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
  };
  
  // Abertura do modal de criação/edição de workflow
  const handleOpenWorkflowModal = (workflow?: Workflow) => {
    if (workflow) {
      // Modo edição
      setWorkflowForm({
        name: workflow.name,
        description: workflow.description || "",
        is_active: workflow.is_active,
        trigger_type: workflow.trigger_type,
        trigger_details: workflow.trigger_details
      });
    } else {
      // Modo criação
      setWorkflowForm({
        name: "",
        description: "",
        is_active: true,
        trigger_type: "status_change",
        trigger_details: {} as Record<string, any>
      });
    }
    setIsWorkflowModalOpen(true);
  };
  
  // Salvar workflow (criar ou atualizar)
  const handleSaveWorkflow = () => {
    if (selectedWorkflow) {
      updateWorkflowMutation.mutate(workflowForm);
    } else {
      createWorkflowMutation.mutate(workflowForm);
    }
  };
  
  // Gerenciamento do trigger_type e trigger_details
  const handleTriggerTypeChange = (value: string) => {
    setWorkflowForm({
      ...workflowForm,
      trigger_type: value,
      trigger_details: {} as Record<string, any>
    });
  };
  
  // Atualização dos detalhes do trigger com base no tipo
  const handleTriggerDetailsChange = (key: string, value: any) => {
    setWorkflowForm({
      ...workflowForm,
      trigger_details: {
        ...workflowForm.trigger_details,
        [key]: value
      } as Record<string, any>
    });
  };
  
  // Adicionar uma ação ao workflow
  const handleAddAction = (actionData: any) => {
    console.log("Dados da ação a serem enviados:", actionData);
    addWorkflowActionMutation.mutate(actionData);
  };
  
  // Adicionar uma condição ao workflow
  const handleAddCondition = (conditionData: any) => {
    console.log("Dados da condição a serem enviados:", conditionData);
    addWorkflowConditionMutation.mutate(conditionData);
  };
  
  // Renderizar o tipo de trigger em texto legível
  const renderTriggerType = (type: string) => {
    switch (type) {
      case "status_change":
        return "Mudança de Status";
      case "task_creation":
        return "Criação de Tarefa";
      case "attribute_change":
        return "Mudança de Atributo";
      default:
        return type;
    }
  };
  
  // Renderizar detalhes do trigger
  const renderTriggerDetails = (type: string, details: Record<string, any>) => {
    if (type === "status_change" && details.status_id) {
      const status = statuses.find(s => s.id === details.status_id);
      return status ? `Status: ${status.name}` : "Status desconhecido";
    }
    
    if (Object.keys(details).length === 0) {
      return "Sem condições específicas";
    }
    
    return JSON.stringify(details);
  };
  
  // Desativado para não-admins
  if (!isAdmin) {
    return <Redirect to="/" />;
  }
  
  // Para gerenciar o estado da sidebar mobile
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const handleToggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  
  // Tela de carregamento
  if (isWorkflowsLoading || isStatusesLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1">
          <TopNavigation onToggleSidebar={handleToggleSidebar} />
          <main className="p-6">
            <div className="flex justify-center items-center h-[calc(100vh-10rem)]">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </main>
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-y-auto">
        <TopNavigation onToggleSidebar={handleToggleSidebar} />
        <main className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold">Gerenciamento de Workflows</h1>
              <p className="text-sm text-muted-foreground">
                Crie e gerencie regras automatizadas para processos do sistema
              </p>
            </div>
            <Button onClick={() => handleOpenWorkflowModal()}>
              <PlusCircle className="mr-2 h-4 w-4" />
              Novo Workflow
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Lista de Workflows */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Workflows</CardTitle>
                <CardDescription>
                  Selecione um workflow para gerenciar suas ações e condições
                </CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar workflows..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {filteredWorkflows.map(workflow => (
                    <div
                      key={workflow.id}
                      className={`p-3 rounded-md cursor-pointer border ${
                        selectedWorkflow?.id === workflow.id
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
                      }`}
                      onClick={() => handleSelectWorkflow(workflow)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium">{workflow.name}</h3>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {workflow.description || "Sem descrição"}
                          </p>
                        </div>
                        <Badge variant={workflow.is_active ? "default" : "outline"}>
                          {workflow.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center">
                          <Activity className="h-3 w-3 mr-1" />
                          {renderTriggerType(workflow.trigger_type)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  {filteredWorkflows.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      {searchTerm
                        ? "Nenhum workflow encontrado com esse termo"
                        : "Nenhum workflow cadastrado"}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Detalhes do Workflow */}
            <Card className="md:col-span-2">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {selectedWorkflow
                        ? `Workflow: ${selectedWorkflow.name}`
                        : "Selecione um workflow"}
                    </CardTitle>
                    <CardDescription>
                      {selectedWorkflow
                        ? selectedWorkflow.description || "Sem descrição"
                        : "Selecione um workflow na lista para visualizar seus detalhes"}
                    </CardDescription>
                  </div>
                  
                  {selectedWorkflow && (
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenWorkflowModal(selectedWorkflow)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setIsDeleteDialogOpen(true)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              
              {selectedWorkflow ? (
                <CardContent>
                  <Tabs defaultValue="details">
                    <TabsList className="mb-4">
                      <TabsTrigger value="details">Detalhes</TabsTrigger>
                      <TabsTrigger value="actions">Ações</TabsTrigger>
                      <TabsTrigger value="conditions">Condições</TabsTrigger>
                    </TabsList>
                    
                    {/* Aba de Detalhes */}
                    <TabsContent value="details">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Status</p>
                            <Badge variant={selectedWorkflow.is_active ? "default" : "outline"}>
                              {selectedWorkflow.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Tipo de Gatilho</p>
                            <p className="text-sm">{renderTriggerType(selectedWorkflow.trigger_type)}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Detalhes do Gatilho</p>
                          <p className="text-sm">
                            {renderTriggerDetails(
                              selectedWorkflow.trigger_type,
                              selectedWorkflow.trigger_details
                            )}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Criado em</p>
                          <p className="text-sm">
                            {new Date(selectedWorkflow.created_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Última atualização</p>
                          <p className="text-sm">
                            {new Date(selectedWorkflow.updated_at).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </TabsContent>
                    
                    {/* Aba de Ações */}
                    <TabsContent value="actions">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium">Ações do Workflow</h3>
                          <Button 
                            size="sm" 
                            onClick={() => setIsActionModalOpen(true)}
                            disabled={actionCreationStatus === "loading"}
                          >
                            {actionCreationStatus === "loading" ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <PlusCircle className="h-4 w-4 mr-1" />
                            )}
                            Adicionar Ação
                          </Button>
                        </div>
                        
                        {isActionsLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : workflowActions.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tipo de Ação</TableHead>
                                <TableHead>Detalhes</TableHead>
                                <TableHead>Ordem</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {workflowActions.map(action => (
                                <TableRow key={action.id}>
                                  <TableCell className="font-medium">
                                    {action.action_name}
                                  </TableCell>
                                  <TableCell>
                                    {action.action_type === "send_email" && "Enviar Email"}
                                    {action.action_type === "update_attribute" && "Atualizar Atributo"}
                                    {action.action_type === "create_task" && "Criar Tarefa"}
                                  </TableCell>
                                  <TableCell>
                                    {action.action_type === "send_email" && (
                                      <div>
                                        <p>Para: {action.action_details.to}</p>
                                        <p>Assunto: {action.action_details.subject}</p>
                                      </div>
                                    )}
                                    {action.action_type === "update_attribute" && (
                                      <div>
                                        <p>Atributo: {action.action_details.attribute}</p>
                                        <p>Valor: {action.action_details.value}</p>
                                      </div>
                                    )}
                                    {action.action_type === "create_task" && (
                                      <div>
                                        <p>Título: {action.action_details.title}</p>
                                        <p>Descrição: {action.action_details.description?.substring(0, 30)}...</p>
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell>{action.order}</TableCell>
                                  <TableCell>
                                    <div className="flex space-x-1">
                                      <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-10 border rounded-md">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Activity className="h-10 w-10 text-muted-foreground" />
                              <h3 className="font-medium text-lg">Nenhuma ação configurada</h3>
                              <p className="text-sm text-muted-foreground max-w-md">
                                Adicione ações para serem executadas quando as condições 
                                do workflow forem atendidas.
                              </p>
                              <Button 
                                onClick={() => setIsActionModalOpen(true)}
                                className="mt-2"
                                disabled={actionCreationStatus === "loading"}
                              >
                                {actionCreationStatus === "loading" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                )}
                                Adicionar Ação
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                    
                    {/* Aba de Condições */}
                    <TabsContent value="conditions">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium">Condições do Workflow</h3>
                          <Button 
                            size="sm" 
                            onClick={() => setIsConditionModalOpen(true)}
                            disabled={conditionCreationStatus === "loading"}
                          >
                            {conditionCreationStatus === "loading" ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <PlusCircle className="h-4 w-4 mr-1" />
                            )}
                            Adicionar Condição
                          </Button>
                        </div>
                        
                        {isConditionsLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                          </div>
                        ) : workflowConditions.length > 0 ? (
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Campo</TableHead>
                                <TableHead>Operador</TableHead>
                                <TableHead>Valor</TableHead>
                                <TableHead className="w-[100px]">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {workflowConditions.map(condition => (
                                <TableRow key={condition.id}>
                                  <TableCell>
                                    {condition.field_name}
                                  </TableCell>
                                  <TableCell>
                                    {condition.operator === "equals" && "Igual a"}
                                    {condition.operator === "not_equals" && "Diferente de"}
                                    {condition.operator === "contains" && "Contém"}
                                    {condition.operator === "greater_than" && "Maior que"}
                                    {condition.operator === "less_than" && "Menor que"}
                                  </TableCell>
                                  <TableCell>
                                    {condition.value}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex space-x-1">
                                      <Button variant="ghost" size="icon">
                                        <Edit className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        ) : (
                          <div className="text-center py-10 border rounded-md">
                            <div className="flex flex-col items-center justify-center space-y-2">
                              <Sliders className="h-10 w-10 text-muted-foreground" />
                              <h3 className="font-medium text-lg">Nenhuma condição configurada</h3>
                              <p className="text-sm text-muted-foreground max-w-md">
                                Adicione condições para determinar quando este workflow 
                                deve ser executado.
                              </p>
                              <Button 
                                onClick={() => setIsConditionModalOpen(true)}
                                className="mt-2"
                                disabled={conditionCreationStatus === "loading"}
                              >
                                {conditionCreationStatus === "loading" ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <PlusCircle className="h-4 w-4 mr-1" />
                                )}
                                Adicionar Condição
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Workflow className="h-16 w-16 text-muted-foreground" />
                    <h3 className="text-lg font-medium">Selecione um workflow</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      Selecione um workflow na lista ao lado ou crie um novo para 
                      gerenciar suas ações e condições.
                    </p>
                    <Button onClick={() => handleOpenWorkflowModal()}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Criar Novo Workflow
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
          
          {/* Modal de Criação/Edição de Workflow */}
          <Dialog open={isWorkflowModalOpen} onOpenChange={setIsWorkflowModalOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {selectedWorkflow ? "Editar Workflow" : "Criar Workflow"}
                </DialogTitle>
                <DialogDescription>
                  Preencha as informações do workflow
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={workflowForm.name}
                    onChange={(e) => setWorkflowForm({...workflowForm, name: e.target.value})}
                    placeholder="Nome do workflow"
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({...workflowForm, description: e.target.value})}
                    placeholder="Descrição do workflow (opcional)"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="is_active"
                    checked={workflowForm.is_active}
                    onCheckedChange={(checked: boolean) => 
                      setWorkflowForm({...workflowForm, is_active: checked})
                    }
                  />
                  <Label htmlFor="is_active">Workflow ativo</Label>
                </div>
                
                <div>
                  <Label htmlFor="trigger_type">Tipo de Gatilho</Label>
                  <Select 
                    value={workflowForm.trigger_type} 
                    onValueChange={handleTriggerTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de gatilho" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status_change">Mudança de Status</SelectItem>
                      <SelectItem value="task_creation">Criação de Tarefa</SelectItem>
                      <SelectItem value="attribute_change">Mudança de Atributo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {workflowForm.trigger_type === "status_change" && (
                  <div>
                    <Label htmlFor="status_id">Status que dispara o workflow</Label>
                    <Select 
                      value={workflowForm.trigger_details.status_id || ""}
                      onValueChange={(value) => handleTriggerDetailsChange("status_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um status" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(status => (
                          <SelectItem key={status.id} value={status.id}>
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {workflowForm.trigger_type === "attribute_change" && (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="attribute">Atributo monitorado</Label>
                      <Select
                        value={workflowForm.trigger_details.attribute || ""}
                        onValueChange={(value) => handleTriggerDetailsChange("attribute", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um atributo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="status_id">Status</SelectItem>
                          <SelectItem value="valuation">Avaliação</SelectItem>
                          <SelectItem value="priority">Prioridade</SelectItem>
                          <SelectItem value="funding_goal">Meta de Captação</SelectItem>
                          <SelectItem value="investment_stage">Estágio de Investimento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWorkflowModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveWorkflow}>
                  {selectedWorkflow ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Dialog de Confirmação de Exclusão */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir o workflow "{selectedWorkflow?.name}"?
                  Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-start space-x-2 rounded-md bg-amber-50 dark:bg-amber-950/50 p-3 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-amber-800 dark:text-amber-300">Atenção</h4>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Todas as ações e condições associadas a este workflow também serão removidas.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => deleteWorkflowMutation.mutate()}>
                  Excluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Modal de Ação do Workflow */}
          <WorkflowActionModal
            open={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            onSave={handleAddAction}
          />
          
          {/* Modal de Condição do Workflow */}
          <WorkflowConditionModal
            open={isConditionModalOpen}
            onClose={() => setIsConditionModalOpen(false)}
            onSave={handleAddCondition}
          />
        </main>
      </div>
    </div>
  );
}