
import { useState, useMemo, useEffect } from "react";
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

export function KanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const [draggingStartupId, setDraggingStartupId] = useState<string | null>(null);
  const [deleteStartupId, setDeleteStartupId] = useState<string | null>(null);
  const [draggableMap, setDraggableMap] = useState<Record<string, string>>({});

  // Inicializa um mapa de IDs para garantir consistência
  useEffect(() => {
    const map: Record<string, string> = {};
    startups.forEach(startup => {
      map[startup.id] = String(startup.id);
    });
    setDraggableMap(map);
    
    // Log para debugging
    console.log("Draggable IDs map initialized:", map);
  }, [startups]);

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

  const columnStartupsMap = useMemo(() => {
    const map: Record<string, Startup[]> = {};
    columns.forEach(column => {
      map[column.id] = startups.filter(
        startup => startup.status_id === column.id
      );
    });
    return map;
  }, [columns, startups]);

  const handleDragStart = (result: any) => {
    console.log('🔄 Drag start:', { 
      draggableId: result.draggableId,
      source: result.source
    });
    setDraggingStartupId(result.draggableId);
  };

  const handleDragEnd = async (result: DropResult) => {
    setDraggingStartupId(null);

    const { destination, source, draggableId } = result;

    // Log mais detalhado para debugging
    console.log('Drag result:', { 
      destination, 
      source, 
      draggableId,
      draggableIdType: typeof draggableId
    });
    
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      console.log('Dropping in same position or outside valid area. Ignoring.');
      return;
    }

    // Tentar encontrar o startup de várias maneiras para robustez
    let startup = startups.find(s => String(s.id) === draggableId);
    
    // Se não encontrar pelo método padrão, tentar outras alternativas
    if (!startup) {
      // Tentar encontrar pelo ID no mapa
      for (const [originalId, mappedId] of Object.entries(draggableMap)) {
        if (mappedId === draggableId) {
          startup = startups.find(s => s.id === originalId);
          if (startup) {
            console.log('✅ Startup encontrado usando o draggableMap:', startup);
            break;
          }
        }
      }
    }
    
    // Se ainda não encontrou, registrar erro detalhado
    if (!startup) {
      console.error('❌ Startup não encontrado com ID:', draggableId);
      console.log('🔍 Informações de depuração:');
      console.log('- draggableId:', draggableId, 'tipo:', typeof draggableId);
      console.log('- draggableMap:', draggableMap);
      console.log('- Startups disponíveis:');
      startups.forEach(s => {
        console.log(`  ID: ${s.id}, Tipo: ${typeof s.id}, Correspondência: ${String(s.id) === draggableId}`);
      });
      
      // Notificar o usuário sobre o erro
      toast({
        title: "Erro de Arrastar e Soltar",
        description: "Não foi possível encontrar o card arrastado. Tente novamente.",
        variant: "destructive",
      });
      return;
    }
    
    // Log de sucesso detalhado
    console.log('✅ Startup encontrado:', { 
      id: startup.id, 
      name: startup.name,
      source_status: source.droppableId,
      destination_status: destination.droppableId 
    });

    const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);

    try {
      // Atualizar a cache localmente primeiro para UI responsiva
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === startup.id 
            ? { ...s, status_id: destination.droppableId } 
            : s
        );
      });

      // Enviar atualização para o servidor
      await apiRequest(
        "PATCH", 
        `/api/startups/${startup.id}/status`, 
        { status_id: destination.droppableId }
      );

      // Atualizar a query cache
      await queryClient.invalidateQueries({ queryKey: ['/api/startups'] });

      toast({
        title: "Success",
        description: "Card moved successfully",
      });
    } catch (error) {
      console.error('Error moving card:', error);
      // Reverter para os dados antigos em caso de erro
      queryClient.setQueryData(['/api/startups'], oldData);
      toast({
        title: "Error",
        description: "Failed to move card",
        variant: "destructive",
      });
    }
  };

  const handleDeleteStartup = async () => {
    if (!deleteStartupId) return;

    const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);

    try {
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.filter(s => s.id !== deleteStartupId);
      });

      await apiRequest("DELETE", `/api/startups/${deleteStartupId}`);

      toast({
        title: "Success",
        description: "Startup deleted successfully",
      });
    } catch (error) {
      queryClient.setQueryData(['/api/startups'], oldData);
      toast({
        title: "Error",
        description: "Failed to delete startup",
        variant: "destructive",
      });
    }

    setDeleteStartupId(null);
  };

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
        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => (
              <Droppable key={column.id} droppableId={column.id}>
                {(provided: DroppableProvided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow"
                  >
                    <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
                      <h3 className="text-md font-medium text-gray-700 flex items-center">
                        <span style={{ backgroundColor: column.color }} className="w-3 h-3 rounded-full mr-2"></span>
                        {column.name}
                        <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                          {columnStartupsMap[column.id]?.length || 0}
                        </span>
                      </h3>
                    </div>
                    <div className="p-2 min-h-[400px]">
                      {columnStartupsMap[column.id]?.map((startup, index) => (
                        <Draggable
                          key={startup.id}
                          draggableId={draggableMap[startup.id] || String(startup.id)}
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

      <AlertDialog open={!!deleteStartupId} onOpenChange={() => setDeleteStartupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Startup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this startup? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStartup}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
