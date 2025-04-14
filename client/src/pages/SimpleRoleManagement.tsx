import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  PlusCircle, 
  Edit, 
  Trash2, 
  Search, 
  Check, 
  ShieldCheck,
  Settings,
  Users,
  LayoutDashboard,
  Rocket,
  Loader2
} from "lucide-react";
import { Redirect } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../lib/queryClient";
import { UserRole, SystemPage, RolePagePermission } from "@shared/schema";

// Definir o tipo para páginas com permissão
type PageWithPermission = SystemPage & {
  hasPermission: boolean;
};

export default function SimpleRoleManagement() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showSidebar, setShowSidebar] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState("roles");
  const [editMode, setEditMode] = useState(false);
  
  // Estado para controle do modal de novo perfil
  const [newRole, setNewRole] = useState({ name: "", description: "" });
  
  // Estado para controle do modal de nova página
  const [newPage, setNewPage] = useState({ name: "", path: "", description: "", icon: "" });
  
  // Verifique se o usuário é administrador
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('Administrador');
  
  // Funções para controlar a interface
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  // Queries
  const { 
    data: roles = [], 
    isLoading: rolesLoading 
  } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/roles');
      return response;
    },
    enabled: isAdmin
  });

  const { 
    data: pages = [], 
    isLoading: pagesLoading 
  } = useQuery({
    queryKey: ['pages'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/system-pages');
      return response;
    },
    enabled: isAdmin
  });

  const selectedRole = roles.find(role => role.id === selectedRoleId) || null;

  const { 
    data: rolePermissions = [], 
    isLoading: permissionsLoading,
    refetch: refetchPermissions
  } = useQuery({
    queryKey: ['rolePermissions', selectedRoleId],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const response = await apiRequest('GET', `/api/roles/${selectedRoleId}/pages`);
      return response;
    },
    enabled: !!selectedRoleId,
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: async (role: typeof newRole) => {
      return await apiRequest('POST', '/api/roles', role);
    },
    onSuccess: () => {
      toast({
        title: "Perfil criado",
        description: "O perfil foi criado com sucesso.",
      });
      setNewRole({ name: "", description: "" });
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar perfil",
        description: error instanceof Error ? error.message : "Não foi possível criar o perfil.",
        variant: "destructive",
      });
    }
  });

  const createPageMutation = useMutation({
    mutationFn: async (page: typeof newPage) => {
      return await apiRequest('POST', '/api/system-pages', page);
    },
    onSuccess: () => {
      toast({
        title: "Página criada",
        description: "A página foi criada com sucesso.",
      });
      setNewPage({ name: "", path: "", description: "", icon: "" });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar página",
        description: error instanceof Error ? error.message : "Não foi possível criar a página.",
        variant: "destructive",
      });
    }
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (roleId: string) => {
      return await apiRequest('DELETE', `/api/roles/${roleId}`);
    },
    onSuccess: (_, roleId) => {
      toast({
        title: "Perfil excluído",
        description: "O perfil foi excluído com sucesso.",
      });
      if (selectedRoleId === roleId) {
        setSelectedRoleId(null);
        setSelectedTab("roles");
      }
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir perfil",
        description: error instanceof Error ? error.message : "Não foi possível excluir o perfil.",
        variant: "destructive",
      });
    }
  });

  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      return await apiRequest('DELETE', `/api/system-pages/${pageId}`);
    },
    onSuccess: () => {
      toast({
        title: "Página excluída",
        description: "A página foi excluída com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      if (selectedRoleId) {
        refetchPermissions();
      }
    },
    onError: (error) => {
      toast({
        title: "Erro ao excluir página",
        description: error instanceof Error ? error.message : "Não foi possível excluir a página.",
        variant: "destructive",
      });
    }
  });

  const addPermissionMutation = useMutation({
    mutationFn: async ({ roleId, pageId }: { roleId: string, pageId: string }) => {
      return await apiRequest('POST', `/api/roles/${roleId}/pages/${pageId}`);
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', roleId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao adicionar permissão",
        description: error instanceof Error ? error.message : "Não foi possível adicionar a permissão.",
        variant: "destructive",
      });
    }
  });

  const removePermissionMutation = useMutation({
    mutationFn: async ({ roleId, pageId }: { roleId: string, pageId: string }) => {
      return await apiRequest('DELETE', `/api/roles/${roleId}/pages/${pageId}`);
    },
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['rolePermissions', roleId] });
    },
    onError: (error) => {
      toast({
        title: "Erro ao remover permissão",
        description: error instanceof Error ? error.message : "Não foi possível remover a permissão.",
        variant: "destructive",
      });
    }
  });

  // Funções de manipulação
  const handleRoleClick = (role: UserRole) => {
    setSelectedRoleId(role.id);
    setSelectedTab("permissions");
  };

  const handleNewRoleSubmit = () => {
    createRoleMutation.mutate(newRole);
  };

  const handleNewPageSubmit = () => {
    createPageMutation.mutate(newPage);
  };

  const handleDeleteRole = (roleId: string) => {
    deleteRoleMutation.mutate(roleId);
  };

  const handleDeletePage = (pageId: string) => {
    deletePageMutation.mutate(pageId);
  };

  const togglePagePermission = (pageId: string, hasPermission: boolean) => {
    if (!selectedRoleId) return;
    
    if (hasPermission) {
      removePermissionMutation.mutate({ roleId: selectedRoleId, pageId });
    } else {
      addPermissionMutation.mutate({ roleId: selectedRoleId, pageId });
    }
  };

  // Computar páginas com permissões
  const pagesWithPermissions: PageWithPermission[] = pages.map(page => ({
    ...page,
    hasPermission: rolePermissions.some((p: RolePagePermission) => p.page_id === page.id)
  }));

  // Filtragem
  const filteredRoles = roles.filter(role => 
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  const filteredPages = pages.filter(page => 
    page.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    page.path.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (page.description && page.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Loading state
  const isLoading = 
    authLoading || 
    rolesLoading || 
    pagesLoading || 
    (selectedTab === "permissions" && permissionsLoading);

  // Bloqueio de mutações
  const isMutating = 
    createRoleMutation.isPending || 
    createPageMutation.isPending || 
    deleteRoleMutation.isPending || 
    deletePageMutation.isPending ||
    addPermissionMutation.isPending ||
    removePermissionMutation.isPending;
  
  // Se não estiver carregado e não for admin, redirecionar
  if (!authLoading && !isAdmin) {
    return <Redirect to="/" />;
  }
  
  // Tela de carregamento
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar para telas maiores, oculta em mobile */}
      <div className={`${showSidebar ? 'block' : 'hidden'} md:flex md:flex-shrink-0`}>
        <Sidebar />
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Navegação superior mobile */}
        <TopNavigation onToggleSidebar={toggleSidebar} />

        {/* Conteúdo da página */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none p-6">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Perfis e Permissões</h1>
            </div>
            
            {/* Pesquisa */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Buscar perfis ou páginas..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="roles">Perfis</TabsTrigger>
                <TabsTrigger value="pages">Páginas do Sistema</TabsTrigger>
                {selectedRole && <TabsTrigger value="permissions">Permissões</TabsTrigger>}
              </TabsList>
              
              {/* Aba de Perfis */}
              <TabsContent value="roles">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Perfis de Usuário</h2>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isMutating}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Novo Perfil
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Adicionar Novo Perfil</AlertDialogTitle>
                        <AlertDialogDescription>
                          Preencha os dados abaixo para criar um novo perfil de usuário.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="name" className="text-right">
                            Nome
                          </label>
                          <Input
                            id="name"
                            value={newRole.name}
                            onChange={(e) => setNewRole({...newRole, name: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="description" className="text-right">
                            Descrição
                          </label>
                          <Input
                            id="description"
                            value={newRole.description || ""}
                            onChange={(e) => setNewRole({...newRole, description: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                      </div>
                      
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleNewRoleSubmit} disabled={isMutating}>
                          {createRoleMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <PlusCircle className="h-4 w-4 mr-2" />
                          )}
                          Adicionar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRoles.map((role) => (
                          <TableRow key={role.id} className={role.id === selectedRoleId ? "bg-muted/50" : ""}>
                            <TableCell className="font-medium">{role.name}</TableCell>
                            <TableCell>{role.description}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => handleRoleClick(role)}
                                  disabled={isMutating}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="destructive" 
                                      size="sm"
                                      disabled={isMutating}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Perfil</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir o perfil "{role.name}"? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteRole(role.id)} disabled={isMutating}>
                                        {deleteRoleMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 mr-2" />
                                        )}
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {filteredRoles.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-8 text-gray-500">
                              Nenhum perfil encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Aba de Páginas */}
              <TabsContent value="pages">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">Páginas do Sistema</h2>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button disabled={isMutating}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Nova Página
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Adicionar Nova Página</AlertDialogTitle>
                        <AlertDialogDescription>
                          Preencha os dados abaixo para criar uma nova página no sistema.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="page-name" className="text-right">
                            Nome
                          </label>
                          <Input
                            id="page-name"
                            value={newPage.name}
                            onChange={(e) => setNewPage({...newPage, name: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="page-path" className="text-right">
                            Caminho
                          </label>
                          <Input
                            id="page-path"
                            value={newPage.path}
                            onChange={(e) => setNewPage({...newPage, path: e.target.value})}
                            className="col-span-3"
                            placeholder="/caminho-da-pagina"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="page-description" className="text-right">
                            Descrição
                          </label>
                          <Input
                            id="page-description"
                            value={newPage.description || ""}
                            onChange={(e) => setNewPage({...newPage, description: e.target.value})}
                            className="col-span-3"
                          />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                          <label htmlFor="page-icon" className="text-right">
                            Ícone
                          </label>
                          <Input
                            id="page-icon"
                            value={newPage.icon || ""}
                            onChange={(e) => setNewPage({...newPage, icon: e.target.value})}
                            className="col-span-3"
                            placeholder="dashboard"
                          />
                        </div>
                      </div>
                      
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleNewPageSubmit} disabled={isMutating}>
                          {createPageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <PlusCircle className="h-4 w-4 mr-2" />
                          )}
                          Adicionar
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Caminho</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPages.map((page) => (
                          <TableRow key={page.id}>
                            <TableCell className="font-medium">
                              <div className="flex items-center">
                                {page.icon && (
                                  <span className="mr-2 text-gray-500">
                                    {page.icon === "dashboard" && <LayoutDashboard className="h-4 w-4" />}
                                    {page.icon === "users" && <Users className="h-4 w-4" />}
                                    {page.icon === "settings" && <Settings className="h-4 w-4" />}
                                    {page.icon === "building" && <Rocket className="h-4 w-4" />}
                                  </span>
                                )}
                                {page.name}
                              </div>
                            </TableCell>
                            <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{page.path}</code></TableCell>
                            <TableCell>{page.description}</TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" disabled={isMutating}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={isMutating}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir Página</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Tem certeza que deseja excluir a página "{page.name}"? Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeletePage(page.id)} disabled={isMutating}>
                                        {deletePageMutation.isPending ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                          <Trash2 className="h-4 w-4 mr-2" />
                                        )}
                                        Excluir
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        
                        {filteredPages.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                              Nenhuma página encontrada
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              
              {/* Aba de Permissões */}
              {selectedRole && (
                <TabsContent value="permissions">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        Permissões do Perfil: {selectedRole.name}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedRole.description || "Sem descrição"}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button 
                        variant={editMode ? "default" : "outline"} 
                        onClick={() => setEditMode(!editMode)}
                        className={editMode ? "bg-primary hover:bg-primary/90" : ""}
                        disabled={isMutating}
                      >
                        {editMode ? (
                          <>
                            <Check className="mr-2 h-4 w-4" />
                            Concluir Edição
                          </>
                        ) : (
                          <>
                            <Edit className="mr-2 h-4 w-4" />
                            Editar Permissões
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <Card>
                    <CardHeader className={editMode ? "bg-muted/30" : ""}>
                      <CardTitle className="flex items-center">
                        <ShieldCheck className="mr-2 h-5 w-5" />
                        Páginas do Sistema
                        {editMode && (
                          <Badge className="ml-2 bg-blue-100 text-blue-800 border-blue-200">
                            Modo de Edição
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {editMode 
                          ? "Clique nas caixas de seleção para conceder ou revogar acesso às páginas." 
                          : `Páginas que usuários com o perfil "${selectedRole.name}" podem acessar.`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="bg-muted/10 p-2 mb-4 rounded-lg text-sm flex items-center">
                        <div className="flex items-center mr-4">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>
                          <span>Permitido</span>
                        </div>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                          <span>Bloqueado</span>
                        </div>
                      </div>
                      
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Caminho</TableHead>
                            <TableHead>Descrição</TableHead>
                            <TableHead className="text-center">Acesso</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {pagesWithPermissions.map((page) => (
                            <TableRow 
                              key={page.id} 
                              className={page.hasPermission 
                                ? "border-l-4 border-l-green-500 border-opacity-50" 
                                : "border-l-4 border-l-red-500 border-opacity-50"}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center">
                                  {page.icon && (
                                    <span className="mr-2 text-gray-500">
                                      {page.icon === "dashboard" && <LayoutDashboard className="h-4 w-4" />}
                                      {page.icon === "users" && <Users className="h-4 w-4" />}
                                      {page.icon === "settings" && <Settings className="h-4 w-4" />}
                                      {page.icon === "building" && <Rocket className="h-4 w-4" />}
                                    </span>
                                  )}
                                  {page.name}
                                </div>
                              </TableCell>
                              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{page.path}</code></TableCell>
                              <TableCell>{page.description}</TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  {editMode ? (
                                    <Checkbox 
                                      checked={page.hasPermission}
                                      onCheckedChange={() => togglePagePermission(page.id, page.hasPermission)}
                                      className="h-5 w-5"
                                      disabled={isMutating}
                                    />
                                  ) : (
                                    <Badge className={page.hasPermission 
                                      ? "bg-green-100 text-green-800 border-green-200" 
                                      : "bg-red-100 text-red-800 border-red-200"}
                                    >
                                      {page.hasPermission ? "Permitido" : "Bloqueado"}
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          
                          {pagesWithPermissions.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                Nenhuma página encontrada
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                      
                      {editMode && (
                        <div className="flex justify-end mt-4">
                          <Button 
                            onClick={() => setEditMode(false)}
                            className="bg-primary hover:bg-primary/90"
                            disabled={isMutating}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Salvar Alterações
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  );
}