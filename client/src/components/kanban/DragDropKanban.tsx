import { useState, useMemo, useCallback } from "react";
import { StartupCard } from "./StartupCard";
import { type Startup, type Status } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

type KanbanBoardProps = {
  startups: Startup[];
  onCardClick: (startup: Startup) => Promise<void>;
};

type KanbanColumn = {
  id: string;
  name: string;
  color: string;
};

// Versão simplificada do KanbanBoard sem usar bibliotecas de drag-and-drop
export function DragDropKanban({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const [deleteStartupId, setDeleteStartupId] = useState<string | null>(null);
  const [lastUpdatedColumn, setLastUpdatedColumn] = useState<string | null>(null);
  const [lastMovedStartupId, setLastMovedStartupId] = useState<string | null>(null);
  
  // Para selecionar a startup que está sendo arrastada
  const [draggingStartup, setDraggingStartup] = useState<Startup | null>(null);

  // Buscar as colunas de status
  const { data: statuses } = useQuery({
    queryKey: ['/api/statuses'],
    queryFn: async () => {
      const response = await fetch('/api/statuses');
      if (!response.ok) {
        throw new Error('Failed to fetch statuses');
      }
      return response.json() as Promise<Status[]>;
    }
  });

  // Organizar as colunas por ordem
  const columns = useMemo(() => {
    if (!statuses) return [];
    return [...statuses]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(status => ({
        id: status.id,
        name: status.name,
        color: status.color,
      }));
  }, [statuses]);

  // Mapear os startups para as colunas
  const getStartupsForColumn = useCallback((columnId: string) => {
    return startups.filter(startup => startup.status_id === columnId);
  }, [startups]);

  // Log de diagnóstico para verificar IDs de colunas e startups
  useMemo(() => {
    if (startups.length > 0 && columns.length > 0) {
      console.log('Colunas disponíveis:', columns.map(c => c.id));
      console.log('Startups status_ids:', startups.map(s => s.status_id));
    }
  }, [startups, columns]);

  // Início da operação de drag
  const handleDragStart = (startup: Startup, e: React.DragEvent) => {
    console.log('Iniciando drag para startup:', startup.name);
    setDraggingStartup(startup);
    
    // Definir os dados do drag
    e.dataTransfer.setData("text/plain", startup.id);
    
    // Definir uma imagem para o drag (opcional)
    const dragImg = new Image(100, 30);
    dragImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='30'><rect width='100%' height='100%' rx='5' fill='%23eef2ff' stroke='%232563eb' stroke-width='2'/></svg>";
    e.dataTransfer.setDragImage(dragImg, 50, 15);
    
    // Definir um efeito de drag
    e.dataTransfer.effectAllowed = "move";
  };

  // Permitir drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  // Processar o drop
  const handleDrop = async (columnId: string, e: React.DragEvent) => {
    e.preventDefault();
    
    if (!draggingStartup) {
      console.error("No dragging startup found");
      return;
    }
    
    const startupId = e.dataTransfer.getData("text/plain");
    console.log('Drop de startup com ID:', startupId, 'na coluna:', columnId);
    
    // Verificar se o ID de coluna é válido
    const isValidColumn = columns.some(col => col.id === columnId);
    if (!isValidColumn) {
      console.error('Coluna inválida:', columnId);
      toast({
        title: "Erro",
        description: "Coluna de destino inválida",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se o startup existe
    const startup = startups.find(s => s.id === startupId);
    if (!startup) {
      console.error('Startup não encontrado:', startupId);
      toast({
        title: "Erro",
        description: "Startup não encontrado",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se a coluna é a mesma
    if (startup.status_id === columnId) {
      console.log('Mesma coluna, ignorando operação');
      return;
    }
    
    try {
      console.log('Movendo startup:', {
        startupId: startup.id,
        startupName: startup.name,
        fromStatus: startup.status_id,
        toStatus: columnId
      });
      
      // Backup para caso de erro
      const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);
      
      // Atualizar UI primeiro (otimista)
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === startup.id 
            ? { ...s, status_id: columnId } 
            : s
        );
      });
      
      // Montar corpo da requisição
      const requestBody = { status_id: columnId };
      
      console.log('Sending PATCH request to:', `/api/startups/${startup.id}/status`);
      console.log('With body:', requestBody);
      
      // Atualizar no servidor
      await apiRequest(
        "PATCH", 
        `/api/startups/${startup.id}/status`, 
        requestBody
      );
      
      // Revalidar dados
      await queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      
      // Definir coluna atualizada e startup movido para efeitos visuais
      setLastUpdatedColumn(columnId);
      setLastMovedStartupId(startup.id);
      
      toast({
        title: "Sucesso",
        description: "Card movido com sucesso",
      });
    } catch (error) {
      console.error('Error moving card:', error);
      toast({
        title: "Erro",
        description: "Falha ao mover o card",
        variant: "destructive",
      });
    } finally {
      setDraggingStartup(null);
    }
  };

  // Manipulador para excluir um startup
  const handleDeleteStartup = async () => {
    if (!deleteStartupId) return;
    
    const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);
    
    try {
      // Atualizar UI primeiro
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.filter(s => s.id !== deleteStartupId);
      });
      
      // Enviar para o servidor
      await apiRequest("DELETE", `/api/startups/${deleteStartupId}`);
      
      toast({
        title: "Sucesso",
        description: "Startup excluído com sucesso",
      });
    } catch (error) {
      // Reverter em caso de erro
      queryClient.setQueryData(['/api/startups'], oldData);
      toast({
        title: "Erro",
        description: "Falha ao excluir startup",
        variant: "destructive",
      });
    }
    
    setDeleteStartupId(null);
  };

  // Exibir carregamento se não tiver colunas
  if (!columns.length) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
          {columns.map(column => {
            // Obter startups para esta coluna
            const columnStartups = getStartupsForColumn(column.id);
            
            // Log de diagnóstico para cada coluna
            console.log(`Coluna ${column.name} (${column.id}):`, {
              startups: columnStartups.map(s => ({ id: s.id, nome: s.name }))
            });
            
            return (
              <div 
                key={column.id}
                className={`kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow transition-all duration-300 ease-in-out ${
                  lastUpdatedColumn === column.id ? 'ring-4 ring-blue-400 shadow-lg scale-102' : ''
                } ${draggingStartup && draggingStartup.status_id !== column.id ? 'border-2 border-dashed border-blue-300' : ''}`}
                data-column-id={column.id}
                data-droppable="true"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(column.id, e)}
              >
                <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
                  <h3 className="text-md font-medium text-gray-700 flex items-center">
                    <span 
                      style={{ backgroundColor: column.color }} 
                      className="w-3 h-3 rounded-full mr-2"
                    />
                    {column.name}
                    <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                      {columnStartups.length}
                    </span>
                  </h3>
                </div>
                
                <div className="p-2 min-h-[400px]">
                  {columnStartups.map((startup) => (
                    <div
                      key={startup.id}
                      draggable
                      onDragStart={(e) => handleDragStart(startup, e)}
                      data-startup-id={startup.id}
                      className={`mb-2 transition-all duration-300 ease-in-out ${
                        draggingStartup && draggingStartup.id === startup.id 
                          ? 'opacity-50' 
                          : lastMovedStartupId === startup.id
                            ? 'shadow-md bg-blue-50 ring-2 ring-blue-300 scale-102'
                            : 'hover:shadow-md'
                      }`}
                    >
                      <StartupCard 
                        startup={startup} 
                        onClick={() => onCardClick(startup)}
                        onDelete={() => setDeleteStartupId(startup.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AlertDialog open={!!deleteStartupId} onOpenChange={() => setDeleteStartupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Startup</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este startup? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStartup}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}