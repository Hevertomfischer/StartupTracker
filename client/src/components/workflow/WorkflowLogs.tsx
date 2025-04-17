import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle, Info, XCircle } from "lucide-react";
import { Workflow } from "@shared/schema";

interface WorkflowLog {
  id: string;
  workflow_id: string;
  workflow_action_id: string | null;
  startup_id: string;
  action_type: string | null;
  status: string;
  message: string;
  details: any;
  created_at: string;
}

interface WorkflowLogsProps {
  workflowId?: string;
  startupId?: string;
}

const StatusIcons: Record<string, React.ReactNode> = {
  SUCCESS: <CheckCircle className="h-4 w-4 text-green-500" />,
  ERROR: <XCircle className="h-4 w-4 text-red-500" />,
  INFO: <Info className="h-4 w-4 text-blue-500" />,
  WARNING: <AlertCircle className="h-4 w-4 text-yellow-500" />,
};

const StatusColors: Record<string, string> = {
  SUCCESS: "bg-green-100 text-green-800 border-green-300",
  ERROR: "bg-red-100 text-red-800 border-red-300",
  INFO: "bg-blue-100 text-blue-800 border-blue-300",
  WARNING: "bg-yellow-100 text-yellow-800 border-yellow-300",
};

export default function WorkflowLogs({ workflowId, startupId }: WorkflowLogsProps) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [actionTypeFilter, setActionTypeFilter] = useState<string | null>(null);
  const pageSize = 10;

  // Construir URL com base nos filtros
  const buildUrl = () => {
    let url = "/api/workflow-logs";
    
    if (workflowId) {
      url = `/api/workflows/${workflowId}/logs`;
    } else if (startupId) {
      url = `/api/startups/${startupId}/workflow-logs`;
    }
    
    const queryParams = new URLSearchParams();
    if (statusFilter) queryParams.append("status", statusFilter);
    if (actionTypeFilter) queryParams.append("action_type", actionTypeFilter);
    queryParams.append("page", page.toString());
    queryParams.append("limit", pageSize.toString());
    
    return `${url}?${queryParams.toString()}`;
  };

  const url = buildUrl();
  
  const {
    data: logs,
    isLoading,
    isError,
    refetch,
  } = useQuery<WorkflowLog[]>({ 
    queryKey: [url],
    enabled: true,
  });

  // Dados para os filtros (devem ser obtidos do backend em um caso real completo)
  const statusOptions = ["SUCCESS", "ERROR", "INFO", "WARNING"];
  const actionTypeOptions = ["send_email", "update_attribute", "create_task"];

  // Usar useEffect para refetch sempre que os filtros ou página mudarem
  useEffect(() => {
    refetch();
  }, [statusFilter, actionTypeFilter, page, refetch]);

  // Formatação de data relativa
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
    } catch (e) {
      return dateString;
    }
  };

  // Renderizar detalhes (se existirem)
  const renderDetails = (details: any) => {
    if (!details) return null;
    
    try {
      // Verificar se é um email em modo de teste
      if (details.testMode && details.testRecipient) {
        return (
          <div className="mt-2 p-2 text-xs bg-blue-50 rounded-md border border-blue-200 max-h-32 overflow-auto">
            <div className="font-medium mb-1 text-blue-700">
              Email em Modo de Teste
            </div>
            <div className="grid grid-cols-2 gap-x-2">
              <div className="text-gray-600">Destinatário original:</div>
              <div>{details.to}</div>
              <div className="text-gray-600">Redirecionado para:</div>
              <div className="font-medium text-blue-700">{details.testRecipient}</div>
              <div className="text-gray-600">Assunto:</div>
              <div>{details.subject}</div>
              <div className="text-gray-600">Hora:</div>
              <div>{new Date(details.time).toLocaleString()}</div>
            </div>
          </div>
        );
      }
      
      // Verificar se é um email normal (não em modo de teste)
      if (details.to && details.subject) {
        return (
          <div className="mt-2 p-2 text-xs bg-gray-50 rounded-md border border-gray-200 max-h-32 overflow-auto">
            <div className="grid grid-cols-2 gap-x-2">
              <div className="text-gray-600">Destinatário:</div>
              <div>{details.to}</div>
              <div className="text-gray-600">Assunto:</div>
              <div>{details.subject}</div>
              <div className="text-gray-600">Hora:</div>
              <div>{details.time ? new Date(details.time).toLocaleString() : 'N/A'}</div>
            </div>
          </div>
        );
      }
      
      // Para outros tipos de detalhes, mostrar como JSON
      return (
        <div className="mt-2 p-2 text-xs bg-gray-50 rounded-md border border-gray-200 max-h-32 overflow-auto">
          <pre className="whitespace-pre-wrap break-words">
            {typeof details === 'string' ? details : JSON.stringify(details, null, 2)}
          </pre>
        </div>
      );
    } catch (e) {
      return <div className="text-xs text-red-500">Erro ao renderizar detalhes</div>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl font-bold">
          Logs de Execução de Workflow
          {workflowId && <span className="text-sm ml-2 text-gray-500">Workflow: {workflowId}</span>}
          {startupId && <span className="text-sm ml-2 text-gray-500">Startup: {startupId}</span>}
        </CardTitle>

        <div className="flex gap-4">
          <div className="w-40">
            <label className="text-sm font-medium leading-none mb-1 block">
              Status
            </label>
            <Select
              value={statusFilter || "todos"}
              onValueChange={(value) => {
                setStatusFilter(value === "todos" ? null : value);
                setPage(1); // Reset page when filter changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center">
                      {StatusIcons[status]}
                      <span className="ml-2">{status}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <label className="text-sm font-medium leading-none mb-1 block">
              Tipo de Ação
            </label>
            <Select
              value={actionTypeFilter || "todos"}
              onValueChange={(value) => {
                setActionTypeFilter(value === "todos" ? null : value);
                setPage(1); // Reset page when filter changes
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {actionTypeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "send_email" && "Enviar Email"}
                    {type === "update_attribute" && "Atualizar Atributo"}
                    {type === "create_task" && "Criar Tarefa"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center justify-between">
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="text-center py-6 text-red-500">
            Erro ao carregar logs. Por favor, tente novamente.
          </div>
        ) : logs && logs.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="w-1/2">Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={`flex items-center gap-1 ${StatusColors[log.status] || ""}`}
                      >
                        {StatusIcons[log.status]}
                        <span>{log.status}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.action_type ? (
                        log.action_type === "send_email" ? "Enviar Email" :
                        log.action_type === "update_attribute" ? "Atualizar Atributo" :
                        log.action_type === "create_task" ? "Criar Tarefa" :
                        log.action_type
                      ) : "N/A"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{log.message}</div>
                      {log.details && renderDetails(log.details)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setPage(Math.max(1, page - 1))}
                    className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationLink isActive>{page}</PaginationLink>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setPage(page + 1)}
                    className={logs.length < pageSize ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </>
        ) : (
          <div className="text-center py-6 text-gray-500">
            Nenhum log encontrado para os filtros selecionados.
          </div>
        )}
      </CardContent>
    </Card>
  );
}