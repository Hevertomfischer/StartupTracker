import { useState, useEffect } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNavigation } from "@/components/layout/TopNavigation";
import { useStartups, useStartupMembers, useAddTeamMember } from "@/hooks/use-startup";
import { Button } from "@/components/ui/button";
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
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PlusCircle, Loader2 } from "lucide-react";

// Formulário de adicionar membro
const AddMemberSchema = z.object({
  name: z.string().min(2, "Nome precisa ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  role: z.string().min(2, "Cargo precisa ter pelo menos 2 caracteres"),
  photo_url: z.string().optional(),
  startup_id: z.string(),
});

type AddMemberFormData = z.infer<typeof AddMemberSchema>;

export default function TeamManagement() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedStartupId, setSelectedStartupId] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  
  const { data: startups = [], isLoading: isLoadingStartups } = useStartups();
  const { data: members = [], isLoading: isLoadingMembers } = useStartupMembers(selectedStartupId || undefined);
  const addTeamMemberMutation = useAddTeamMember();
  
  // Form para adicionar membro
  const form = useForm<AddMemberFormData>({
    resolver: zodResolver(AddMemberSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "",
      photo_url: "",
      startup_id: "",
    },
  });
  
  // Atualiza o startup_id no formulário quando o startup selecionado muda
  useEffect(() => {
    if (selectedStartupId) {
      form.setValue("startup_id", selectedStartupId);
    }
  }, [selectedStartupId, form]);
  
  useEffect(() => {
    // Seleciona o primeiro startup por padrão
    if (startups.length > 0 && !selectedStartupId) {
      setSelectedStartupId(startups[0].id);
    }
  }, [startups, selectedStartupId]);
  
  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };
  
  const handleStartupChange = (value: string) => {
    setSelectedStartupId(value);
  };
  
  const onSubmitAddMember = async (data: AddMemberFormData) => {
    if (!selectedStartupId) return;
    
    try {
      await addTeamMemberMutation.mutateAsync({
        startupId: selectedStartupId,
        member: data
      });
      
      setIsAddMemberOpen(false);
      form.reset();
    } catch (error) {
      console.error("Erro ao adicionar membro:", error);
    }
  };
  
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

        {/* Área principal */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gray-50">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="md:flex md:items-center md:justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-2xl font-bold leading-7 text-gray-800 sm:text-3xl sm:truncate">
                    Gerenciamento de Equipes
                  </h2>
                </div>
              </div>
            </div>
            
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              <Card className="mb-4">
                <CardHeader className="pb-2">
                  <CardTitle>Selecione uma Startup</CardTitle>
                  <CardDescription>
                    Visualize e gerencie membros da equipe de cada startup
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <Select 
                        value={selectedStartupId || ""} 
                        onValueChange={handleStartupChange}
                        disabled={isLoadingStartups}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma startup" />
                        </SelectTrigger>
                        <SelectContent>
                          {startups.map(startup => (
                            <SelectItem key={startup.id} value={startup.id}>
                              {startup.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {selectedStartupId && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle>Membros da Equipe</CardTitle>
                      <CardDescription>
                        Gerenciamento de membros da equipe para {
                          startups.find(s => s.id === selectedStartupId)?.name
                        }
                      </CardDescription>
                    </div>
                    <Button 
                      onClick={() => setIsAddMemberOpen(true)}
                      className="ml-auto"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" />
                      Adicionar Membro
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {isLoadingMembers ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        Nenhum membro da equipe cadastrado para esta startup
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Cargo</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {members.map(member => (
                            <TableRow key={member.id}>
                              <TableCell className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.photo_url || undefined} alt={member.name} />
                                  <AvatarFallback>{member.name?.[0]?.toUpperCase() || "?"}</AvatarFallback>
                                </Avatar>
                                {member.name}
                              </TableCell>
                              <TableCell>{member.email}</TableCell>
                              <TableCell>{member.role}</TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">
                                  Editar
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </main>
      </div>
      
      {/* Modal Adicionar Membro */}
      <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Membro da Equipe</DialogTitle>
            <DialogDescription>
              Adicione um novo membro à equipe desta startup
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitAddMember)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do membro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="Email do membro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cargo</FormLabel>
                    <FormControl>
                      <Input placeholder="Cargo do membro" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="photo_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL da Foto (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://exemplo.com/foto.jpg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <input type="hidden" {...form.register("startup_id")} />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddMemberOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={addTeamMemberMutation.isPending}
                >
                  {addTeamMemberMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : "Adicionar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}