import { useState, useRef, useCallback } from "react";
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
  AlertDialogTrigger,
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
  parentIsOpen?: boolean; // Para controlar o estado do diálogo pai
};

export function TeamMembersTabNew({ 
  startup, 
  isEditing, 
  members, 
  isLoadingMembers,
  parentIsOpen = true
}: TeamMembersTabProps) {
  const { toast } = useToast();
  const [isAddMemberDialogOpen, setIsAddMemberDialogOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [isDeleteMemberDialogOpen, setIsDeleteMemberDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);

  // Função para adicionar membro
  const handleAddMember = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    // Interromper a propagação do evento para impedir fechamento do modal
    e.preventDefault();
    e.stopPropagation();
    
    console.log("Handleando submit do formulário de membro");
    
    if (!startup?.id || isSubmitting) {
      console.log("Startup ID ausente ou submissão em andamento, abortando");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const formData = new FormData(e.currentTarget);
      
      // Capturar dados do formulário
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
      
      console.log("Dados do membro capturados:", memberData);
      
      // Validação básica
      if (!memberData.name || !memberData.role) {
        console.log("Validação falhou: nome ou cargo ausente");
        toast({
          title: "Campos obrigatórios",
          description: "Nome e cargo são campos obrigatórios",
          variant: "destructive"
        });
        setIsSubmitting(false);
        return;
      }
      
      console.log("Enviando solicitação para API");
      
      // Enviar para a API
      await apiRequest("POST", `/api/startups/${startup?.id}/members`, memberData);
      
      console.log("Membro adicionado com sucesso");
      
      // Atualizar lista de membros
      queryClient.invalidateQueries({ 
        queryKey: ['/api/startups', startup?.id, 'members'] 
      });
      
      toast({
        title: "Membro adicionado",
        description: "O membro foi adicionado com sucesso à equipe",
      });
      
      // Resetar form
      if (formRef.current) {
        formRef.current.reset();
      }
      
      // Fechar o diálogo com um pequeno atraso para garantir
      // que a mensagem de sucesso seja vista
      setTimeout(() => {
        setIsAddMemberDialogOpen(false);
        setIsSubmitting(false);
      }, 1000); // Aumentado para 1 segundo para evitar fechamento prematuro
      
    } catch (error) {
      console.error("Erro ao adicionar membro:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o membro. Tente novamente.",
        variant: "destructive"
      });
      setIsSubmitting(false);
    }
  }, [startup?.id, isSubmitting, toast]);
  
  // Função para deletar membro
  const handleDeleteMember = useCallback(async () => {
    if (!memberToDelete || !startup?.id) {
      return;
    }
    
    try {
      await apiRequest("DELETE", `/api/startups/${startup.id}/members/${memberToDelete}`);
      
      queryClient.invalidateQueries({ 
        queryKey: ['/api/startups', startup?.id, 'members'] 
      });
      
      toast({
        title: "Membro removido",
        description: "O membro foi removido com sucesso da equipe",
      });
      
      setMemberToDelete(null);
      setIsDeleteMemberDialogOpen(false);
    } catch (error) {
      console.error("Erro ao remover membro:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o membro. Tente novamente.",
        variant: "destructive"
      });
    }
  }, [memberToDelete, startup?.id, toast]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-medium">Membros da Equipe</h3>
        <Button 
          size="sm"
          onClick={() => {
            if (parentIsOpen) {
              setIsAddMemberDialogOpen(true);
            }
          }}
          disabled={!isEditing || !startup?.id}
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
                <TableCell>{member.captable_percentage || 0}%</TableCell>
                <TableCell>
                  {member.email && (
                    <div className="text-xs text-muted-foreground">
                      {member.email}
                    </div>
                  )}
                  {member.phone && (
                    <div className="text-xs text-muted-foreground">
                      {member.phone}
                    </div>
                  )}
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
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      
      {/* Diálogo para adicionar novo membro */}
      <Dialog 
        open={parentIsOpen && isAddMemberDialogOpen} 
        modal={true}
        onOpenChange={(open) => {
          if (!isSubmitting) {
            setIsAddMemberDialogOpen(open);
          }
        }}
      >
        <DialogContent 
          className="max-w-md"
          // Impedir fechamento ao pressionar ESC
          onEscapeKeyDown={(e) => {
            console.log("Tecla ESC pressionada, prevenindo fechamento");
            e.preventDefault();
          }}
          // Impedir fechamento ao clicar fora
          onPointerDownOutside={(e) => {
            console.log("Clique fora do diálogo, prevenindo fechamento");
            e.preventDefault();
          }}
          // Impedir que o evento se propague
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <DialogHeader>
            <DialogTitle>Adicionar Membro da Equipe</DialogTitle>
            <DialogDescription>
              Preencha os dados do novo membro da equipe da startup.
            </DialogDescription>
          </DialogHeader>
          
          <form ref={formRef} onSubmit={handleAddMember} className="space-y-4">
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
                  placeholder="+55 (00) 00000-0000"
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
                  URL da Foto
                </label>
                <Input
                  id="photo_url"
                  name="photo_url"
                  placeholder="https://example.com/photo.jpg"
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
                  placeholder="Informações adicionais sobre o membro"
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>
            
            <DialogFooter className="mt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  if (!isSubmitting) {
                    setIsAddMemberDialogOpen(false);
                  }
                }}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  "Adicionar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog
        open={isDeleteMemberDialogOpen}
        onOpenChange={setIsDeleteMemberDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este membro da equipe?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={() => setMemberToDelete(null)}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}