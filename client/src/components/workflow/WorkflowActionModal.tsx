
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Toggle } from "@/components/ui/toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
// Importação do PriorityEnum do schema compartilhado
import { PriorityEnum } from "@shared/schema";
import { HelpCircle, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Atributos disponíveis da startup que podem ser incluídos no email
const availableStartupAttributes = [
  { id: "nome", label: "Nome", group: "startup" },
  { id: "website", label: "Website", group: "startup" },
  { id: "description", label: "Descrição", group: "startup" },
  { id: "investment_stage", label: "Estágio de Investimento", group: "startup" },
  { id: "valuation", label: "Avaliação", group: "startup" },
  { id: "funding_goal", label: "Meta de Captação", group: "startup" },
  { id: "sector", label: "Setor", group: "startup" },
  { id: "foundation_date", label: "Data de Fundação", group: "startup" },
  { id: "location", label: "Localização", group: "startup" },
  { id: "team_size", label: "Tamanho da Equipe", group: "startup" },
  { id: "contact_email", label: "Email de Contato", group: "contato" },
  { id: "contact_phone", label: "Telefone de Contato", group: "contato" },
  { id: "status_name", label: "Nome do Status", group: "status" },
  { id: "status_date", label: "Data de Mudança de Status", group: "status" },
];

// Atributos que podem ser alterados
const editableAttributes = [
  { id: "status_id", label: "Status", type: "select", group: "principal" },
  { id: "investment_stage", label: "Estágio de Investimento", type: "select", group: "principal" },
  { id: "valuation", label: "Avaliação", type: "number", group: "financeiro" },
  { id: "funding_goal", label: "Meta de Captação", type: "number", group: "financeiro" },
  { id: "sector", label: "Setor", type: "select", group: "principal" },
  { id: "team_size", label: "Tamanho da Equipe", type: "number", group: "principal" },
  { id: "priority", label: "Prioridade", type: "select", group: "principal" },
  { id: "notes", label: "Notas", type: "text", group: "dados" },
];

type WorkflowActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (action: any) => void;
};

export default function WorkflowActionModal({ open, onClose, onSave }: WorkflowActionModalProps) {
  const [actionType, setActionType] = useState<string>("");
  const [actionDetails, setActionDetails] = useState<any>({});
  const [selectedTab, setSelectedTab] = useState("basicInfo");
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>([]);

  const [actionName, setActionName] = useState<string>("");

  const handleSave = () => {
    // Inclui os atributos selecionados no corpo do email se for envio de email
    if (actionType === "send_email") {
      onSave({
        action_type: actionType,
        action_name: actionName,
        action_details: {
          ...actionDetails,
          selectedAttributes: selectedAttributes
        }
      });
    } else {
      onSave({
        action_type: actionType,
        action_name: actionName,
        action_details: actionDetails
      });
    }
    onClose();
  };

  const handleAttributeToggle = (attributeId: string) => {
    setSelectedAttributes(prev => 
      prev.includes(attributeId) 
        ? prev.filter(id => id !== attributeId) 
        : [...prev, attributeId]
    );
  };

  const insertAttributePlaceholder = (attributeId: string) => {
    const currentBody = actionDetails.body || '';
    const placeholder = `{{${attributeId}}}`;
    setActionDetails({
      ...actionDetails,
      body: currentBody + placeholder
    });
  };

  // Agrupa atributos por categoria
  const groupedAttributes = availableStartupAttributes.reduce((acc, attr) => {
    if (!acc[attr.group]) {
      acc[attr.group] = [];
    }
    acc[attr.group].push(attr);
    return acc;
  }, {} as Record<string, typeof availableStartupAttributes>);

  // Agrupa atributos editáveis por categoria
  const groupedEditableAttributes = editableAttributes.reduce((acc, attr) => {
    if (!acc[attr.group]) {
      acc[attr.group] = [];
    }
    acc[attr.group].push(attr);
    return acc;
  }, {} as Record<string, typeof editableAttributes>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Adicionar Ação</DialogTitle>
          <DialogDescription>Configure a ação do workflow</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-4">
            <div>
              <Label>Nome da Ação</Label>
              <Input
                value={actionName}
                onChange={(e) => setActionName(e.target.value)}
                placeholder="Nome descritivo para identificar esta ação"
                required
              />
            </div>
            <div>
              <Label>Tipo de Ação</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Enviar E-mail</SelectItem>
                  <SelectItem value="update_attribute">Atualizar Atributo</SelectItem>
                  <SelectItem value="create_task">Criar Tarefa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {actionType === "send_email" && (
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basicInfo">Informações Básicas</TabsTrigger>
                <TabsTrigger value="content">Conteúdo do Email</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basicInfo" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <div>
                    <Label>Destinatário</Label>
                    <Input 
                      type="email" 
                      value={actionDetails.to || ""}
                      onChange={(e) => setActionDetails({...actionDetails, to: e.target.value})}
                      placeholder="Destinatário ou {{email}} para usar o email da startup"
                    />
                  </div>
                  <div>
                    <Label>Assunto</Label>
                    <Input 
                      type="text"
                      value={actionDetails.subject || ""}
                      onChange={(e) => setActionDetails({...actionDetails, subject: e.target.value})}
                      placeholder="Assunto do email"
                    />
                  </div>
                </div>
              </TabsContent>
              
              <TabsContent value="content" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <Label>Corpo do Email</Label>
                    <Textarea 
                      value={actionDetails.body || ""}
                      onChange={(e) => setActionDetails({...actionDetails, body: e.target.value})}
                      placeholder="Conteúdo do email. Use {{atributo}} para incluir dados da startup."
                      className="min-h-[200px]"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Digite o conteúdo do email e use os placeholders de atributos conforme necessário.
                    </p>
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>Atributos Disponíveis</Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5">
                              <HelpCircle className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-[200px]">
                              Estes são os atributos que você pode incluir no corpo do email.
                              Clique para inserir o placeholder.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    
                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      {Object.entries(groupedAttributes).map(([group, attributes]) => (
                        <div key={group} className="mb-3">
                          <h4 className="text-sm font-medium capitalize mb-1">{group}</h4>
                          <div className="space-y-1">
                            {attributes.map(attr => (
                              <div key={attr.id} className="flex items-center justify-between">
                                <span className="text-sm">{attr.label}</span>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  onClick={() => insertAttributePlaceholder(attr.id)} 
                                  className="h-6 py-1 px-2"
                                >
                                  Inserir
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}

          {actionType === "update_attribute" && (
            <div className="space-y-4">
              <div>
                <Label>Selecione o Atributo a ser Atualizado</Label>
                <Select 
                  value={actionDetails.attribute || ""} 
                  onValueChange={(value) => setActionDetails({...actionDetails, attribute: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um atributo" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(groupedEditableAttributes).map(([group, attributes]) => (
                      <div key={group}>
                        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground capitalize">
                          {group}
                        </div>
                        {attributes.map(attr => (
                          <SelectItem key={attr.id} value={attr.id}>
                            {attr.label}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Novo Valor</Label>
                {actionDetails.attribute === "status_id" ? (
                  <Select 
                    value={actionDetails.value || ""} 
                    onValueChange={(value) => setActionDetails({...actionDetails, value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status1">Novo Lead</SelectItem>
                      <SelectItem value="status2">Contato Inicial</SelectItem>
                      <SelectItem value="status3">Reunião Agendada</SelectItem>
                      <SelectItem value="status4">Proposta Enviada</SelectItem>
                      <SelectItem value="status5">Negociação</SelectItem>
                      <SelectItem value="status6">Fechamento (Ganho)</SelectItem>
                      <SelectItem value="status7">Fechamento (Perdido)</SelectItem>
                    </SelectContent>
                  </Select>
                ) : actionDetails.attribute === "priority" ? (
                  <Select 
                    value={actionDetails.value || ""} 
                    onValueChange={(value) => setActionDetails({...actionDetails, value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma prioridade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={PriorityEnum.LOW}>Baixa</SelectItem>
                      <SelectItem value={PriorityEnum.MEDIUM}>Média</SelectItem>
                      <SelectItem value={PriorityEnum.HIGH}>Alta</SelectItem>
                    </SelectContent>
                  </Select>
                ) : actionDetails.attribute === "is_active" ? (
                  <Select 
                    value={actionDetails.value || ""} 
                    onValueChange={(value) => setActionDetails({...actionDetails, value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um valor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Ativo</SelectItem>
                      <SelectItem value="false">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input 
                    type={actionDetails.attribute && editableAttributes.find(a => a.id === actionDetails.attribute)?.type === "number" ? "number" : "text"}
                    value={actionDetails.value || ""}
                    onChange={(e) => setActionDetails({...actionDetails, value: e.target.value})}
                  />
                )}
              </div>
            </div>
          )}

          {actionType === "create_task" && (
            <div className="space-y-2">
              <div>
                <Label>Título da Tarefa</Label>
                <Input 
                  type="text"
                  value={actionDetails.title || ""}
                  onChange={(e) => setActionDetails({...actionDetails, title: e.target.value})}
                />
              </div>
              <div>
                <Label>Descrição</Label>
                <Textarea 
                  value={actionDetails.description || ""}
                  onChange={(e) => setActionDetails({...actionDetails, description: e.target.value})}
                  placeholder="Descreva a tarefa. Você pode usar {{atributo}} para incluir dados da startup."
                  className="min-h-[120px]"
                />
              </div>
              <div>
                <Label>Prioridade</Label>
                <Select 
                  value={actionDetails.priority || ""} 
                  onValueChange={(value) => setActionDetails({...actionDetails, priority: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PriorityEnum.LOW}>Baixa</SelectItem>
                    <SelectItem value={PriorityEnum.MEDIUM}>Média</SelectItem>
                    <SelectItem value={PriorityEnum.HIGH}>Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Vencimento (dias a partir da criação)</Label>
                <Input 
                  type="number"
                  value={actionDetails.dueInDays || ""}
                  onChange={(e) => setActionDetails({...actionDetails, dueInDays: e.target.value})}
                  min="1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Defina quantos dias a partir da criação da tarefa será o prazo de vencimento.
                </p>
              </div>
              <div>
                <Label>Responsável pela Tarefa</Label>
                <Select 
                  value={actionDetails.assignee_id || ""} 
                  onValueChange={(value) => setActionDetails({...actionDetails, assignee_id: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem responsável</SelectItem>
                    <SelectItem value="currentUser">Usuário atual</SelectItem>
                    {/* Esta opção será substituída pelo engine pelo ID do usuário que disparou o workflow */}
                    <SelectItem value="triggerUser">Usuário que disparou a ação</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  "Usuário atual" designará a tarefa para o usuário que está executando a ação que disparou o workflow.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
