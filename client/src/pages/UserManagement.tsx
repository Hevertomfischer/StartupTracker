import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Edit, UserX, UserCheck, Search } from "lucide-react";
import { Redirect } from "wouter";
import { apiRequest, queryClient } from "../lib/queryClient";
import { User, UserRole } from "@shared/schema";

type UserWithRoles = User & {
  roles: string[];
};

export default function UserManagement() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [showSidebar, setShowSidebar] = useState(true);
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Estado para controle do modal de novo usuário
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    roleId: ""
  });
  
  // Verifique se o usuário é administrador
  const userRoles = user?.roles || [];
  const isAdmin = userRoles.includes('Administrador');
  
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };
  
  const loadUsers = async () => {
    try {
      const response = await apiRequest('GET', '/api/users');
      setUsers(response);
      setIsLoaded(true);
    } catch (error) {
      toast({
        title: "Erro ao carregar usuários",
        description: "Não foi possível carregar a lista de usuários.",
        variant: "destructive",
      });
    }
  };
  
  const loadRoles = async () => {
    try {
      const response = await apiRequest('GET', '/api/roles');
      setRoles(response);
    } catch (error) {
      toast({
        title: "Erro ao carregar perfis",
        description: "Não foi possível carregar a lista de perfis.",
        variant: "destructive",
      });
    }
  };
  
  const handleNewUserSubmit = async () => {
    try {
      await apiRequest('POST', '/api/users', newUser);
      
      toast({
        title: "Usuário criado",
        description: "O usuário foi criado com sucesso.",
      });
      
      // Limpar formulário
      setNewUser({
        name: "",
        email: "",
        password: "",
        roleId: ""
      });
      
      // Recarregar lista de usuários
      loadUsers();
    } catch (error) {
      toast({
        title: "Erro ao criar usuário",
        description: error instanceof Error ? error.message : "Não foi possível criar o usuário.",
        variant: "destructive",
      });
    }
  };
  
  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      await apiRequest('PATCH', `/api/users/${userId}/status`, {
        active: !currentStatus
      });
      
      toast({
        title: currentStatus ? "Usuário desativado" : "Usuário ativado",
        description: `O usuário foi ${currentStatus ? "desativado" : "ativado"} com sucesso.`,
      });
      
      // Recarregar lista de usuários
      loadUsers();
    } catch (error) {
      toast({
        title: "Erro ao alterar status",
        description: "Não foi possível alterar o status do usuário.",
        variant: "destructive",
      });
    }
  };
  
  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  useEffect(() => {
    if (isAdmin) {
      loadUsers();
      loadRoles();
    }
  }, [isAdmin]);
  
  // Se não estiver carregado e não for admin, redirecionar
  if (!isLoading && !isAdmin) {
    return <Redirect to="/" />;
  }
  
  // Tela de carregamento
  if (isLoading || !isLoaded) {
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
              <h1 className="text-2xl font-semibold text-gray-900">Gerenciamento de Usuários</h1>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Novo Usuário
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Adicionar Novo Usuário</AlertDialogTitle>
                    <AlertDialogDescription>
                      Preencha os dados abaixo para criar um novo usuário.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="name" className="text-right">
                        Nome
                      </label>
                      <Input
                        id="name"
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="email" className="text-right">
                        Email
                      </label>
                      <Input
                        id="email"
                        type="email"
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="password" className="text-right">
                        Senha
                      </label>
                      <Input
                        id="password"
                        type="password"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <label htmlFor="role" className="text-right">
                        Perfil
                      </label>
                      <select
                        id="role"
                        value={newUser.roleId}
                        onChange={(e) => setNewUser({...newUser, roleId: e.target.value})}
                        className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">Selecione um perfil</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleNewUserSubmit}>Adicionar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
            
            {/* Pesquisa */}
            <div className="relative mb-6">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                type="text"
                placeholder="Buscar usuários por nome ou email..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Lista de usuários */}
            <Card>
              <CardHeader>
                <CardTitle>Usuários</CardTitle>
                <CardDescription>Gerencie os usuários do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Perfis</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles?.map((role) => (
                              <Badge key={role} variant="outline">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={user.active ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>
                            {user.active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant={user.active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleUserStatus(user.id, user.active)}
                            >
                              {user.active ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {filteredUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                          Nenhum usuário encontrado
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}