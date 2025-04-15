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
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";

// Campos disponíveis para condições
const availableFields = [
  { id: "name", label: "Nome", group: "startup" },
  { id: "website", label: "Website", group: "startup" },
  { id: "description", label: "Descrição", group: "startup" },
  { id: "investment_stage", label: "Estágio de Investimento", group: "startup" },
  { id: "valuation", label: "Avaliação", group: "financeiro" },
  { id: "funding_goal", label: "Meta de Captação", group: "financeiro" },
  { id: "sector", label: "Setor", group: "startup" },
  { id: "foundation_date", label: "Data de Fundação", group: "startup" },
  { id: "location", label: "Localização", group: "startup" },
  { id: "team_size", label: "Tamanho da Equipe", group: "startup" },
  { id: "contact_email", label: "Email de Contato", group: "contato" },
  { id: "contact_phone", label: "Telefone de Contato", group: "contato" },
  { id: "status_id", label: "Status", group: "status" },
  { id: "priority", label: "Prioridade", group: "startup" },
];

// Operadores disponíveis
const operators = [
  { id: "equals", label: "Igual a" },
  { id: "not_equals", label: "Diferente de" },
  { id: "contains", label: "Contém" },
  { id: "greater_than", label: "Maior que" },
  { id: "less_than", label: "Menor que" },
];

// Agrupar campos por categoria
const groupedFields = availableFields.reduce((acc, field) => {
  if (!acc[field.group]) {
    acc[field.group] = [];
  }
  acc[field.group].push(field);
  return acc;
}, {} as Record<string, typeof availableFields>);

type WorkflowConditionModalProps = {
  open: boolean;
  onClose: () => void;
  onSave: (condition: any) => void;
};

export default function WorkflowConditionModal({ open, onClose, onSave }: WorkflowConditionModalProps) {
  const [fieldName, setFieldName] = useState<string>("");
  const [operator, setOperator] = useState<string>("");
  const [value, setValue] = useState<string>("");

  const handleSave = () => {
    if (!fieldName || !operator || value === "") {
      return; // Validação simples
    }
    
    onSave({
      field_name: fieldName,
      operator,
      value
    });
    
    // Limpar o formulário
    setFieldName("");
    setOperator("");
    setValue("");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Condição</DialogTitle>
          <DialogDescription>
            Configure uma condição para o workflow. Esta condição será verificada antes de executar as ações.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Campo</Label>
            <Select value={fieldName} onValueChange={setFieldName}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um campo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groupedFields).map(([group, fields]) => (
                  <div key={group}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground capitalize">
                      {group}
                    </div>
                    {fields.map(field => (
                      <SelectItem key={field.id} value={field.id}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Operador</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map(op => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label>Valor</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-5 w-5">
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-[200px]">
                      Digite o valor que será comparado com o campo selecionado.
                      Para campos numéricos, insira apenas números.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Valor para comparação"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleSave}
            disabled={!fieldName || !operator || value === ""}
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}