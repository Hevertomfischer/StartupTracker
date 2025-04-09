
import { useState, useMemo } from "react";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult, 
  DroppableProvided, 
  DraggableProvided,
  DraggableStateSnapshot
} from "react-beautiful-dnd";
import { StartupCard } from "./StartupCard";
import { type Startup, type Status } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type KanbanBoardProps = {
  startups: Startup[];
  onCardClick: (startup: Startup) => Promise<void>;
};

type KanbanColumn = {
  id: string;
  name: string;
  color: string;
};

// Função auxiliar para gerar IDs estáveis para o Draggable
const getStartupDraggableId = (id: string): string => {
  return `startup-${id}`;
};

export function KanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const [deleteStartupId, setDeleteStartupId] = useState<string | null>(null);

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
  const columns: KanbanColumn[] = useMemo(() => {
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
  const columnStartupsMap = useMemo(() => {
    const map: Record<string, Startup[]> = {};
    
    // Inicializar todas as colunas com arrays vazios
    columns.forEach(column => {
      map[column.id] = [];
    });
    
    // Adicionar os startups às colunas corretas
    startups.forEach(startup => {
      const statusId = startup.status_id;
      if (statusId && map[statusId]) {
        map[statusId].push(startup);
      }
    });
    
    return map;
  }, [columns, startups]);

  // Manipulador para quando o arrastar termina
  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    // Log de debugging detalhado
    console.log('Drag result:', { 
      destination, 
      source, 
      draggableId,
    });
    
    // Verificar se o destino é válido
    if (!destination) {
      console.log('Card dropped outside of a valid area.');
      return;
    }
    
    // Verificar se o card foi largado na mesma posição
    if (destination.droppableId === source.droppableId && 
        destination.index === source.index) {
      console.log('Card dropped in the same position. No action needed.');
      return;
    }
    
    // Extrair o ID do startup do draggableId
    const startupIdMatch = draggableId.match(/^startup-(.+)$/);
    
    if (!startupIdMatch) {
      console.error('Invalid draggable ID format:', draggableId);
      return;
    }
    
    const startupId = startupIdMatch[1];
    
    // Encontrar o startup pelo ID
    const startup = startups.find(s => s.id === startupId);
    
    if (!startup) {
      console.error('Startup not found with ID:', startupId);
      console.log('Available startups:', startups.map(s => s.id));
      return;
    }
    
    console.log('Found startup:', startup);
    
    // Guardar os dados antigos para caso de erro
    const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);
    
    try {
      // Atualizar localmente para UI responsiva
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === startup.id 
            ? { ...s, status_id: destination.droppableId } 
            : s
        );
      });
      
      // Enviar para o servidor
      await apiRequest(
        "PATCH", 
        `/api/startups/${startup.id}/status`, 
        { status_id: destination.droppableId }
      );
      
      // Atualizar a cache
      await queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      
      toast({
        title: "Sucesso",
        description: "Card movido com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao mover card:', error);
      // Reverter para os dados antigos
      queryClient.setQueryData(['/api/startups'], oldData);
      toast({
        title: "Erro",
        description: "Falha ao mover o card. Tente novamente.",
        variant: "destructive",
      });
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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided: DroppableProvided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow"
                  >
                    {/* Cabeçalho da coluna */}
                    <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
                      <h3 className="text-md font-medium text-gray-700 flex items-center">
                        <span style={{ backgroundColor: column.color }} className="w-3 h-3 rounded-full mr-2"></span>
                        {column.name}
                        <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                          {columnStartupsMap[column.id]?.length || 0}
                        </span>
                      </h3>
                    </div>
                    
                    {/* Cards da coluna */}
                    <div className="p-2 min-h-[400px]">
                      {columnStartupsMap[column.id]?.map((startup, index) => (
                        <Draggable
                          key={startup.id}
                          draggableId={getStartupDraggableId(startup.id)}
                          index={index}
                        >
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              style={{
                                ...provided.draggableProps.style,
                                transition: 'all 0.2s ease-in-out',
                                transform: snapshot.isDragging
                                  ? `${provided.draggableProps.style?.transform} scale(1.02)`
                                  : provided.draggableProps.style?.transform,
                              }}
                              className={`mb-2 ${
                                snapshot.isDragging 
                                  ? 'opacity-75 shadow-lg' 
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
            ))}
          </div>
        </DragDropContext>
      </div>

      {/* Diálogo de confirmação para excluir */}
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
