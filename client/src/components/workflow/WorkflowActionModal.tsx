
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
import { useState } from "react";

type WorkflowActionModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (action: any) => void;
};

export function WorkflowActionModal({ open, onClose, onSave }: WorkflowActionModalProps) {
  const [actionType, setActionType] = useState<string>("");
  const [actionDetails, setActionDetails] = useState<any>({});

  const handleSave = () => {
    onSave({
      action_type: actionType,
      action_details: actionDetails
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Ação</DialogTitle>
          <DialogDescription>Configure a ação do workflow</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          {actionType === "send_email" && (
            <div className="space-y-2">
              <div>
                <Label>Destinatário</Label>
                <Input 
                  type="email" 
                  value={actionDetails.to || ""}
                  onChange={(e) => setActionDetails({...actionDetails, to: e.target.value})}
                />
              </div>
              <div>
                <Label>Assunto</Label>
                <Input 
                  type="text"
                  value={actionDetails.subject || ""}
                  onChange={(e) => setActionDetails({...actionDetails, subject: e.target.value})}
                />
              </div>
            </div>
          )}

          {actionType === "update_attribute" && (
            <div className="space-y-2">
              <div>
                <Label>Atributo</Label>
                <Input 
                  type="text"
                  value={actionDetails.attribute || ""}
                  onChange={(e) => setActionDetails({...actionDetails, attribute: e.target.value})}
                />
              </div>
              <div>
                <Label>Valor</Label>
                <Input 
                  type="text"
                  value={actionDetails.value || ""}
                  onChange={(e) => setActionDetails({...actionDetails, value: e.target.value})}
                />
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
                <Input 
                  type="text"
                  value={actionDetails.description || ""}
                  onChange={(e) => setActionDetails({...actionDetails, description: e.target.value})}
                />
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
