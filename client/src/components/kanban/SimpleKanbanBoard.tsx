import { useState, useMemo, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from "react-beautiful-dnd";
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

export function SimpleKanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const [deleteStartupId, setDeleteStartupId] = useState<string | null>(null);
  const [lastUpdatedColumn, setLastUpdatedColumn] = useState<string | null>(null);
  const [lastMovedStartupId, setLastMovedStartupId] = useState<string | null>(null);

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

  // Manipulador para quando o arrastar termina
  const handleDragEnd = useCallback(async (result: DropResult) => {
    console.log('Drag end:', result);
    
    const { destination, source, draggableId } = result;
    
    // Se não tiver destino, não faz nada
    if (!destination) {
      console.log('Sem destino detectado, abortando operação');
      return;
    }
    
    // Se o destino for o mesmo que a origem, não faz nada
    if (destination.droppableId === source.droppableId && 
        destination.index === source.index) {
      console.log('Destino igual à origem, abortando operação');
      return;
    }
    
    // O ID da coluna de destino é o droppableId
    const newStatusId = destination.droppableId;
    
    // Log detalhado para depuração
    console.log('Status de destino identificado:', {
      newStatusId, 
      isValid: columns.some(col => col.id === newStatusId)
    });
    
    // Verifica se o ID do status existe nas colunas
    const isValidStatus = columns.some(col => col.id === newStatusId);
    if (!isValidStatus) {
      console.error('ID de status inválido:', newStatusId);
      console.error('IDs de coluna válidos:', columns.map(c => c.id));
      toast({
        title: "Erro",
        description: "Coluna de destino inválida",
        variant: "destructive",
      });
      return;
    }
    
    // Obtenha o startup que foi arrastado
    const startup = startups.find(s => s.id === draggableId);
    
    if (!startup) {
      console.error('Startup not found with ID:', draggableId);
      toast({
        title: "Erro",
        description: "Não foi possível encontrar o item arrastado.",
        variant: "destructive",
      });
      return;
    }
    
    // Não faça nada se a coluna de destino é a mesma que a atual
    if (startup.status_id === newStatusId) {
      return;
    }

    try {
      console.log('Moving startup:', {
        startupId: startup.id,
        startupName: startup.name,
        fromStatus: startup.status_id,
        toStatus: newStatusId
      });
      
      // Backup para caso de erro
      const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);
      
      // Atualizar UI primeiro (otimista)
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === startup.id 
            ? { ...s, status_id: newStatusId } 
            : s
        );
      });
      
      // Montar corpo da requisição
      const requestBody = { status_id: newStatusId };
      
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
      setLastUpdatedColumn(newStatusId);
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
    }
  }, [startups, columns, toast]);

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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => {
              // Obter startups para esta coluna
              const columnStartups = getStartupsForColumn(column.id);
              
              // Log de diagnóstico para cada coluna
              console.log(`Coluna ${column.name} (${column.id}):`, {
                startups: columnStartups.map(s => ({ id: s.id, nome: s.name }))
              });
              
              return (
                <Droppable 
                  key={column.id} 
                  droppableId={column.id}
                >
                  {(provided: DroppableProvided) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow transition-all duration-300 ease-in-out ${
                        lastUpdatedColumn === column.id ? 'ring-4 ring-blue-400 shadow-lg scale-102' : ''
                      }`}
                      data-column-id={column.id}
                      data-type="column"
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
                        {columnStartups.map((startup, index) => (
                          <Draggable 
                            key={startup.id} 
                            draggableId={startup.id} 
                            index={index}
                          >
                            {(provided: DraggableProvided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                data-startup-id={startup.id}
                                className={`mb-2 transition-all duration-300 ease-in-out ${
                                  lastMovedStartupId === startup.id
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
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
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