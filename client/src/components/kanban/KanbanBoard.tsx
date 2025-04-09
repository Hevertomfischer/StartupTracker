
import { useState, useMemo, useCallback } from "react";
import { StartupCard } from "./StartupCard";
import { type Startup, type Status } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Importações para dnd-kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Componente para item arrastável (substituindo SortableItem para simplificar)
function DraggableItem({
  id,
  startup,
  onClickCard,
  onDeleteCard,
}: {
  id: string;
  startup: Startup;
  onClickCard: (startup: Startup) => void;
  onDeleteCard: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="mb-2 hover:shadow-md"
    >
      <StartupCard
        startup={startup}
        onClick={() => onClickCard(startup)}
        onDelete={() => onDeleteCard(id)}
      />
    </div>
  );
}

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

  // Estados para dnd-kit
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeStartup, setActiveStartup] = useState<Startup | null>(null);

  // Configuração dos sensores para dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // Distância mínima para iniciar o arrasto
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Tratamento de início de arrasto
  const handleDragStart = (event: DragStartEvent) => {
    console.log('Drag start:', event);
    const { active } = event;
    setActiveId(active.id as string);
    
    // Encontrar startup sendo arrastado
    const draggedStartup = startups.find(s => s.id === active.id);
    if (draggedStartup) {
      setActiveStartup(draggedStartup);
    }
  };

  // Tratamento do fim do arrasto com dnd-kit
  const handleDragEndDndKit = async (event: DragEndEvent) => {
    console.log('Drag end dnd-kit:', event);
    const { active, over } = event;
    
    setActiveId(null);
    setActiveStartup(null);
    
    if (!over) return;

    const startupId = active.id as string;
    const newStatusId = over.id as string;
    
    // Se a coluna não mudou, não fazer nada
    const startup = startups.find(s => s.id === startupId);
    if (!startup || startup.status_id === newStatusId) return;
    
    console.log('Moving startup:', {
      startupId,
      fromStatus: startup.status_id,
      toStatus: newStatusId
    });
    
    // Backup para caso de erro
    const oldData = queryClient.getQueryData<Startup[]>(['/api/startups']);
    
    try {
      // Atualizar UI primeiro (otimista)
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s => 
          s.id === startupId 
            ? { ...s, status_id: newStatusId } 
            : s
        );
      });
      
      // Montar corpo da requisição
      const requestBody = { status_id: newStatusId };
      
      console.log('Sending PATCH request to:', `/api/startups/${startupId}/status`);
      console.log('With body:', requestBody);
      
      // Atualizar no servidor
      await apiRequest(
        "PATCH", 
        `/api/startups/${startupId}/status`, 
        requestBody
      );
      
      // Revalidar dados
      await queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      
      toast({
        title: "Sucesso",
        description: "Card movido com sucesso",
      });
    } catch (error) {
      console.error('Error moving card:', error);
      // Desfazer mudanças em caso de erro
      queryClient.setQueryData(['/api/startups'], oldData);
      toast({
        title: "Erro",
        description: "Falha ao mover o card",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEndDndKit}
        >
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => {
              // Obter startups para esta coluna
              const columnStartups = getStartupsForColumn(column.id);
              const columnStartupIds = columnStartups.map(s => s.id);
              
              return (
                <div
                  key={column.id}
                  className="kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow"
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
                  
                  {/* Área dropável com o hook useDroppable */}
                  <div ref={useDroppable({ id: column.id }).setNodeRef} className="p-2 min-h-[400px]">
                    {columnStartups.map((startup) => (
                      <DraggableItem
                        key={startup.id}
                        id={startup.id}
                        startup={startup}
                        onClickCard={onCardClick}
                        onDeleteCard={(id: string) => setDeleteStartupId(id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Overlay para visualizar o item sendo arrastado */}
          <DragOverlay>
            {activeId && activeStartup && (
              <div className="opacity-80 shadow-lg z-50">
                <StartupCard
                  startup={activeStartup}
                  onClick={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>
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
