import { useState, useEffect } from "react";
import { StartupHistory } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { Clock, BarChart2, History } from "lucide-react";
import { useStartup } from "@/hooks/use-startup";
import { apiRequest } from "@/lib/queryClient";

type StartupHistoryPanelProps = {
  startupId: string;
};

export function StartupHistoryPanel({ startupId }: StartupHistoryPanelProps) {
  const [history, setHistory] = useState<StartupHistory[]>([]);
  const [timeTracking, setTimeTracking] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: startup } = useStartup(startupId as any);
  
  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Fetch history data
        const historyData = await apiRequest("GET", `/api/startups/${startupId}/history`);
        setHistory(historyData || []);
        
        // Fetch time tracking data
        const trackingData = await apiRequest("GET", `/api/startups/${startupId}/time-tracking`);
        setTimeTracking(trackingData || []);
      } catch (error) {
        console.error("Error loading history data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    if (startupId) {
      loadData();
    }
  }, [startupId]);
  
  // Function to format time duration from seconds
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "N/A";
    
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };
  
  function getChangeTypeLabel(type: string) {
    switch (type) {
      case "status_change":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Status alterado</Badge>;
      case "data_update":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700">Dados atualizados</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  }
  
  function formatChanges(changes: any) {
    // If the change is a status change, handle it differently
    if (changes.status_id) {
      return (
        <div className="text-sm">
          <p>
            Status: <span className="font-semibold">{changes.status_id.from}</span> → <span className="font-semibold">{changes.status_id.to}</span>
          </p>
        </div>
      );
    }
    
    // Otherwise, format the data changes
    return (
      <div className="text-sm space-y-1">
        {Object.entries(changes).map(([key, value]: [string, any]) => (
          <p key={key}>
            {key}: <span className="font-semibold">{String(value.from)}</span> → <span className="font-semibold">{String(value.to)}</span>
          </p>
        ))}
      </div>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <History className="mr-2 h-5 w-5" />
          Histórico e Acompanhamento
        </CardTitle>
        <CardDescription>
          {startup?.name ? `Histórico de alterações e tempo em cada status para ${startup.name}` : 'Carregando...'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="history">
          <TabsList className="mb-4">
            <TabsTrigger value="history" className="flex items-center">
              <History className="mr-2 h-4 w-4" />
              Histórico
            </TabsTrigger>
            <TabsTrigger value="time-tracking" className="flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Tempo nos Status
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="history">
            {loading ? (
              <div className="py-4 text-center text-gray-500">Carregando histórico...</div>
            ) : history.length === 0 ? (
              <div className="py-4 text-center text-gray-500">Nenhum histórico de alteração disponível</div>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="border p-3 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        {getChangeTypeLabel(entry.change_type)}
                        <span className="ml-2 text-xs text-gray-500">
                          {format(new Date(entry.timestamp), "dd/MM/yyyy HH:mm")}
                        </span>
                      </div>
                    </div>
                    {formatChanges(entry.changes)}
                    {entry.comments && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="italic">{entry.comments}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="time-tracking">
            {loading ? (
              <div className="py-4 text-center text-gray-500">Carregando dados de tempo...</div>
            ) : timeTracking.length === 0 ? (
              <div className="py-4 text-center text-gray-500">Nenhum registro de tempo disponível</div>
            ) : (
              <div className="space-y-4">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Entrada</th>
                      <th className="text-left py-2">Saída</th>
                      <th className="text-left py-2">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeTracking.map((tracking) => (
                      <tr key={tracking.id} className="border-b hover:bg-gray-50">
                        <td className="py-2">{tracking.status_id}</td>
                        <td className="py-2">{format(new Date(tracking.entry_time), "dd/MM/yyyy HH:mm")}</td>
                        <td className="py-2">
                          {tracking.exit_time 
                            ? format(new Date(tracking.exit_time), "dd/MM/yyyy HH:mm")
                            : <Badge className="bg-green-100 text-green-800">Ativo</Badge>
                          }
                        </td>
                        <td className="py-2">{formatDuration(tracking.duration_seconds)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <BarChart2 className="mr-2 h-4 w-4" />
                    Resumo do Tempo
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {timeTracking
                      .filter((t) => t.duration_seconds)
                      .map((tracking) => (
                        <div 
                          key={tracking.id}
                          className="border rounded-md p-2 text-sm"
                        >
                          <div className="font-medium">{tracking.status_id}</div>
                          <div className="flex justify-between items-center mt-1">
                            <span>{formatDuration(tracking.duration_seconds)}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}