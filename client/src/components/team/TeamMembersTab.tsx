import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StartupMember } from "@shared/schema";
import { z } from "zod";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
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
} from "@/components/ui/alert-dialog";
import { 
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Avatar, 
  AvatarFallback, 
  AvatarImage 
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";

// Schema para validação de membros da equipe
const addMemberSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.string().min(2, "Cargo deve ter pelo menos 2 caracteres"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  linkedin: z.string().url("URL do LinkedIn inválida").optional().or(z.literal("")),
  photo_url: z.string().url("URL da foto inválida").optional().or(z.literal("")),
  captable_percentage: z.number().default(0).or(z.string().transform(val => val === '' ? 0 : Number(val))),
  observations: z.string().optional(),
});

type TeamMembersTabProps = {
  startup?: any;
  isEditing: boolean;
  members: StartupMember[];
  isLoadingMembers: boolean;
};

export function TeamMembersTab({ 
  startup, 
  isEditing, 
  members, 
  isLoadingMembers 
}: TeamMembersTabProps) {
  const { toast } = useToast();
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [isDeleteMemberDialogOpen, setIsDeleteMemberDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Membros da Equipe</h3>
        <Button 
          size="sm"
          onClick={() => setIsAddMemberDialogOpen(true)}
          disabled={!isEditing && !startup?.id}
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Adicionar Membro
        </Button>
      </div>
      
      {isLoadingMembers ? (
        <div className="flex justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-6 text-gray-500 border border-dashed rounded-md">
          Nenhum membro da equipe cadastrado para esta startup.
          {!isEditing && !startup?.id && (
            <p className="text-sm mt-2">
              Salve a startup primeiro para adicionar membros da equipe.
            </p>
          )}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>% Captable</TableHead>
              <TableHead>Contato</TableHead>
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
                <TableCell>{member.role}</TableCell>
                <TableCell>{member.captable_percentage ?? 0}%</TableCell>
                <TableCell>
                  {member.email && <div className="text-xs">{member.email}</div>}
                  {member.phone && <div className="text-xs">{member.phone}</div>}
                </TableCell>
                <TableCell className="text-right">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => {
                      setMemberToDelete(member.id);
                      setIsDeleteMemberDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog para adicionar membro da equipe */}
      <Dialog open={isAddMemberDialogOpen} onOpenChange={setIsAddMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Membro da Equipe</DialogTitle>
            <DialogDescription>
              Adicione informações do membro da equipe desta startup.
            </DialogDescription>
          </DialogHeader>
          
          <form 
            className="space-y-4 mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              const memberData = {
                name: formData.get('name') as string,
                role: formData.get('role') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                linkedin: formData.get('linkedin') as string,
                photo_url: formData.get('photo_url') as string,
                captable_percentage: formData.get('captable_percentage') ? 
                  Number(formData.get('captable_percentage')) : 0,
                observations: formData.get('observations') as string,
                startup_id: startup?.id
              };
              
              // Validação básica
              if (!memberData.name || !memberData.role) {
                toast({
                  title: "Campos obrigatórios",
                  description: "Nome e cargo são campos obrigatórios",
                  variant: "destructive"
                });
                return;
              }
              
              // Enviar para a API
              apiRequest("POST", `/api/startups/${startup?.id}/members`, memberData)
                .then(() => {
                  queryClient.invalidateQueries({ 
                    queryKey: ['/api/startups', startup?.id, 'members'] 
                  });
                  setIsAddMemberDialogOpen(false);
                  toast({
                    title: "Membro adicionado",
                    description: "O membro foi adicionado com sucesso à equipe",
                  });
                })
                .catch(error => {
                  console.error("Erro ao adicionar membro:", error);
                  toast({
                    title: "Erro",
                    description: "Não foi possível adicionar o membro. Tente novamente.",
                    variant: "destructive"
                  });
                });
            }}
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Nome <span className="text-red-500">*</span>
                </label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Nome do membro"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="role" className="text-sm font-medium">
                  Cargo <span className="text-red-500">*</span>
                </label>
                <Input
                  id="role"
                  name="role"
                  placeholder="Ex: CEO, CTO, Desenvolvedor"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="exemplo@email.com"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  WhatsApp
                </label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+55 (11) 99999-9999"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="linkedin" className="text-sm font-medium">
                  LinkedIn
                </label>
                <Input
                  id="linkedin"
                  name="linkedin"
                  placeholder="https://linkedin.com/in/username"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="photo_url" className="text-sm font-medium">
                  URL da foto
                </label>
                <Input
                  id="photo_url"
                  name="photo_url"
                  placeholder="https://exemplo.com/foto.jpg"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="captable_percentage" className="text-sm font-medium">
                  % do Captable
                </label>
                <Input
                  id="captable_percentage"
                  name="captable_percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  defaultValue="0"
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="observations" className="text-sm font-medium">
                  Observações
                </label>
                <Textarea
                  id="observations"
                  name="observations"
                  placeholder="Informações adicionais sobre este membro"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter className="mt-6">
              <Button 
                type="button"
                variant="outline" 
                onClick={() => setIsAddMemberDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit">
                Adicionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para confirmar exclusão de membro */}
      <AlertDialog open={isDeleteMemberDialogOpen} onOpenChange={setIsDeleteMemberDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro da equipe?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setMemberToDelete(null);
              setIsDeleteMemberDialogOpen(false);
            }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (memberToDelete) {
                apiRequest("DELETE", `/api/startups/${startup?.id}/members/${memberToDelete}`)
                  .then(() => {
                    queryClient.invalidateQueries({ 
                      queryKey: ['/api/startups', startup?.id, 'members'] 
                    });
                    setMemberToDelete(null);
                    setIsDeleteMemberDialogOpen(false);
                    toast({
                      title: "Membro removido",
                      description: "O membro foi removido com sucesso da equipe",
                    });
                  })
                  .catch(error => {
                    console.error("Erro ao remover membro:", error);
                    toast({
                      title: "Erro",
                      description: "Não foi possível remover o membro. Tente novamente.",
                      variant: "destructive"
                    });
                  });
              }
            }}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}