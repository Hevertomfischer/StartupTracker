import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useStartupHistory, useStartupStatusHistory } from "@/hooks/use-startup";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Startup, StartupHistory, StartupStatusHistory } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface StartupHistoryPanelProps {
  startup: Startup;
}

export function StartupHistoryPanel({ startup }: StartupHistoryPanelProps) {
  // Carregar histórico
  const { data: historyData, isLoading: isHistoryLoading } = 
    useStartupHistory(startup.id);
  
  // Carregar histórico de status
  const { data: statusHistoryData, isLoading: isStatusHistoryLoading } = 
    useStartupStatusHistory(startup.id);
  
  // Formatar data e hora
  const formatDateTime = (date: string | Date) => {
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return "Data inválida";
      }
      return format(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error("Erro ao formatar data:", error, date);
      return "Data inválida";
    }
  };
  
  // Formatar duração
  const formatDuration = (minutes?: number | null) => {
    try {
      if (!minutes || isNaN(minutes)) return "N/A";
      
      const days = Math.floor(minutes / (24 * 60));
      const hours = Math.floor((minutes % (24 * 60)) / 60);
      const mins = Math.floor(minutes % 60);
      
      const parts = [];
      if (days > 0) parts.push(`${days} dia${days !== 1 ? 's' : ''}`);
      if (hours > 0) parts.push(`${hours} hora${hours !== 1 ? 's' : ''}`);
      if (mins > 0) parts.push(`${mins} minuto${mins !== 1 ? 's' : ''}`);
      
      return parts.length > 0 ? parts.join(', ') : "Menos de 1 minuto";
    } catch (error) {
      console.error("Erro ao formatar duração:", error, minutes);
      return "N/A";
    }
  };
  
  return (
    <Tabs defaultValue="alteracoes" className="w-full mt-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="alteracoes">Alterações Gerais</TabsTrigger>
        <TabsTrigger value="status">Histórico de Status</TabsTrigger>
      </TabsList>
      
      {/* Aba de alterações gerais */}
      <TabsContent value="alteracoes">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Alterações</CardTitle>
            <CardDescription>
              Registro de todas as alterações feitas nesta startup
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isHistoryLoading ? (
              <div className="text-center py-4">Carregando histórico...</div>
            ) : !historyData || historyData.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                Nenhuma alteração registrada ainda.
              </div>
            ) : (
              <Table>
                <TableCaption>Histórico completo de alterações</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Campo</TableHead>
                    <TableHead>Valor Anterior</TableHead>
                    <TableHead>Novo Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyData.map((entry: StartupHistory) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {formatDateTime(entry.changed_at)}
                      </TableCell>
                      <TableCell>
                        {fieldNameMap[entry.field_name] || entry.field_name}
                      </TableCell>
                      <TableCell>{entry.old_value || "—"}</TableCell>
                      <TableCell>{entry.new_value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      {/* Aba de histórico de status */}
      <TabsContent value="status">
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Status</CardTitle>
            <CardDescription>
              Registro do tempo que a startup permaneceu em cada status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isStatusHistoryLoading ? (
              <div className="text-center py-4">Carregando histórico de status...</div>
            ) : !statusHistoryData || statusHistoryData.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                Nenhum histórico de status registrado ainda.
              </div>
            ) : (
              <Table>
                <TableCaption>Histórico de movimentações entre status</TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                    <TableHead>Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusHistoryData.map((entry: StartupStatusHistory) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Badge variant="outline">{entry.status_name}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatDateTime(entry.start_date)}
                      </TableCell>
                      <TableCell>
                        {entry.end_date 
                          ? formatDateTime(entry.end_date) 
                          : <Badge variant="secondary">Atual</Badge>}
                      </TableCell>
                      <TableCell>
                        {entry.duration_minutes 
                          ? formatDuration(entry.duration_minutes)
                          : entry.end_date ? "—" : "Em andamento"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

// Mapeamento de nomes de campos para exibição mais amigável
const fieldNameMap: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  website: "Website",
  sector: "Setor",
  business_model: "Modelo de Negócio",
  category: "Categoria",
  market: "Mercado",
  ceo_name: "Nome do CEO",
  ceo_email: "Email do CEO",
  ceo_whatsapp: "WhatsApp do CEO",
  ceo_linkedin: "LinkedIn do CEO",
  city: "Cidade",
  state: "Estado",
  status_id: "Status",
  mrr: "MRR",
  client_count: "Número de Clientes",
  accumulated_revenue_current_year: "Receita Acumulada (Ano Atual)",
  total_revenue_last_year: "Receita Total (Ano Passado)",
  total_revenue_previous_year: "Receita Total (Ano Retrasado)",
  partner_count: "Número de Parceiros",
  tam: "TAM",
  sam: "SAM",
  som: "SOM",
  founding_date: "Data de Fundação",
  due_date: "Data Limite",
  problem_solution: "Solução de Problema",
  problem_solved: "Problema Resolvido",
  differentials: "Diferenciais",
  competitors: "Concorrentes",
  positive_points: "Pontos Positivos",
  attention_points: "Pontos de Atenção",
  scangels_value_add: "Valor Agregado SC Angels",
  no_investment_reason: "Motivo de Não Investimento",
  assigned_to: "Atribuído para",
  google_drive_link: "Link do Google Drive",
  origin_lead: "Origem do Lead",
  referred_by: "Indicado por",
  priority: "Prioridade",
  observations: "Observações"
};