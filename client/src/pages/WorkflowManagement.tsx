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
import WorkflowActionModal from "@/components/workflow/WorkflowActionModal";
import WorkflowConditionModal from "@/components/workflow/WorkflowConditionModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
  AlertTriangle
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
  
  // Consulta para carregar os status (para os triggers de status change)
  const {
    data: statuses = [],
    isLoading: isStatusesLoading
  } = useQuery<Status[]>({
    queryKey: ["/api/statuses"],
    enabled: !!user
  });
  
  // Consulta para carregar as ações do workflow selecionado
  const {
    data: workflowActions = [],
    refetch: refetchWorkflowActions
  } = useQuery<WorkflowAction[]>({
    queryKey: ["/api/workflows", selectedWorkflow?.id, "actions"],
    queryFn: async () => {
      if (!selectedWorkflow) return [];
      const res = await apiRequest("GET", `/api/workflows/${selectedWorkflow.id}/actions`);
      return await res.json();
    },
    enabled: !!selectedWorkflow
  });
  
  // Consulta para carregar as condições do workflow selecionado
  const {
    data: workflowConditions = [],
    refetch: refetchWorkflowConditions
  } = useQuery<WorkflowCondition[]>({
    queryKey: ["/api/workflows", selectedWorkflow?.id, "conditions"],
    queryFn: async () => {
      if (!selectedWorkflow) return [];
      const res = await apiRequest("GET", `/api/workflows/${selectedWorkflow.id}/conditions`);
      return await res.json();
    },
    enabled: !!selectedWorkflow
  });
  
  // Mutação para criar um novo workflow
  const createWorkflowMutation = useMutation({
    mutationFn: async (data: typeof workflowForm) => {
      const res = await apiRequest("POST", "/api/workflows", data);
      return await res.json();
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
      const res = await apiRequest("PATCH", `/api/workflows/${selectedWorkflow.id}`, data);
      return await res.json();
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
      await apiRequest("DELETE", `/api/workflows/${selectedWorkflow.id}`);
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
      return await apiRequest("POST", `/api/workflows/${selectedWorkflow.id}/actions`, actionData);
    },
    onSuccess: () => {
      toast({
        title: "Ação adicionada",
        description: "A ação foi adicionada ao workflow com sucesso.",
      });
      refetchWorkflowActions();
      setIsActionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar ação",
        description: error.message || "Ocorreu um erro ao adicionar a ação.",
        variant: "destructive",
      });
    }
  });
  
  // Mutação para adicionar uma condição ao workflow
  const addWorkflowConditionMutation = useMutation({
    mutationFn: async (conditionData: any) => {
      if (!selectedWorkflow) throw new Error("Nenhum workflow selecionado");
      return await apiRequest("POST", `/api/workflows/${selectedWorkflow.id}/conditions`, conditionData);
    },
    onSuccess: () => {
      toast({
        title: "Condição adicionada",
        description: "A condição foi adicionada ao workflow com sucesso.",
      });
      refetchWorkflowConditions();
      setIsConditionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar condição",
        description: error.message || "Ocorreu um erro ao adicionar a condição.",
        variant: "destructive",
      });
    }
  });
  
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
    addWorkflowActionMutation.mutate(actionData);
  };
  
  // Adicionar uma condição ao workflow
  const handleAddCondition = (conditionData: any) => {
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
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:bg-gray-50"
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
                          <Button size="sm" onClick={() => setIsActionModalOpen(true)}>
                            <PlusCircle className="h-4 w-4 mr-1" />
                            Adicionar Ação
                          </Button>
                        </div>
                        
                        <Table>
                          <TableHeader>
                            <TableRow>
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
                                      <p>Descrição: {action.action_details.description}</p>
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
                            
                            {workflowActions.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  Nenhuma ação configurada para este workflow
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                    
                    {/* Aba de Condições */}
                    <TabsContent value="conditions">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium">Condições do Workflow</h3>
                          <Button size="sm" onClick={() => setIsConditionModalOpen(true)}>
                            <PlusCircle className="h-4 w-4 mr-1" />
                            Adicionar Condição
                          </Button>
                        </div>
                        
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
                                <TableCell className="font-medium">{condition.field_name}</TableCell>
                                <TableCell>
                                  {condition.operator === "equals" && "Igual a"}
                                  {condition.operator === "not_equals" && "Diferente de"}
                                  {condition.operator === "contains" && "Contém"}
                                  {condition.operator === "greater_than" && "Maior que"}
                                  {condition.operator === "less_than" && "Menor que"}
                                </TableCell>
                                <TableCell>{condition.value}</TableCell>
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
                            
                            {workflowConditions.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                  Nenhuma condição configurada para este workflow
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              ) : (
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <AlertTriangle className="h-12 w-12 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhum workflow selecionado</h3>
                    <p className="max-w-md">
                      Selecione um workflow na lista para visualizar e gerenciar seus detalhes,
                      ações e condições.
                    </p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
          
          {/* Modal de Criação/Edição de Workflow */}
          <Dialog open={isWorkflowModalOpen} onOpenChange={setIsWorkflowModalOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {selectedWorkflow ? "Editar Workflow" : "Novo Workflow"}
                </DialogTitle>
                <DialogDescription>
                  {selectedWorkflow
                    ? "Altere as informações do workflow selecionado"
                    : "Preencha os dados para criar um novo workflow"}
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="name"
                    value={workflowForm.name}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, name: e.target.value })}
                    placeholder="Nome do workflow"
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium mb-1">
                    Descrição
                  </label>
                  <Textarea
                    id="description"
                    value={workflowForm.description}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, description: e.target.value })}
                    placeholder="Descreva o propósito deste workflow"
                    rows={3}
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={workflowForm.is_active}
                    onChange={(e) => setWorkflowForm({ ...workflowForm, is_active: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium">
                    Workflow ativo
                  </label>
                </div>
                
                <div>
                  <label htmlFor="trigger_type" className="block text-sm font-medium mb-1">
                    Tipo de Gatilho <span className="text-red-500">*</span>
                  </label>
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
                
                {/* Detalhes específicos por tipo de gatilho */}
                {workflowForm.trigger_type === "status_change" && (
                  <div>
                    <label htmlFor="status_id" className="block text-sm font-medium mb-1">
                      Status <span className="text-red-500">*</span>
                    </label>
                    <Select
                      value={workflowForm.trigger_details.status_id || ""}
                      onValueChange={(value) => handleTriggerDetailsChange("status_id", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o status" />
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
                  <div>
                    <label htmlFor="attribute" className="block text-sm font-medium mb-1">
                      Atributo <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="attribute"
                      value={workflowForm.trigger_details.attribute || ""}
                      onChange={(e) => handleTriggerDetailsChange("attribute", e.target.value)}
                      placeholder="Nome do atributo"
                    />
                  </div>
                )}
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsWorkflowModalOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSaveWorkflow}
                  disabled={
                    !workflowForm.name ||
                    (workflowForm.trigger_type === "status_change" && !workflowForm.trigger_details.status_id) ||
                    (workflowForm.trigger_type === "attribute_change" && !workflowForm.trigger_details.attribute)
                  }
                >
                  {selectedWorkflow ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Modal de exclusão de workflow */}
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir o workflow "{selectedWorkflow?.name}"?
                  Esta ação não poderá ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => deleteWorkflowMutation.mutate()}
                  disabled={deleteWorkflowMutation.isPending}
                >
                  {deleteWorkflowMutation.isPending ? "Excluindo..." : "Excluir"}
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