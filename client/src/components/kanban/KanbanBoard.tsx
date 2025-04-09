import { useState, useMemo, useCallback, useEffect } from "react";
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
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  UniqueIdentifier,
  useDroppable
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";

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
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [lastUpdatedColumn, setLastUpdatedColumn] = useState<string | null>(null);
  const [lastMovedStartupId, setLastMovedStartupId] = useState<string | null>(null);
  
  // Configuração dos sensores para detectar ações de arrastar
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Delay maior para evitar detecção acidental
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    }),
    useSensor(TouchSensor, {
      // Delay maior para dispositivos touch
      activationConstraint: {
        delay: 300,
        tolerance: 8,
      },
    })
  );

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
  useEffect(() => {
    if (startups.length > 0 && columns.length > 0) {
      console.log('Colunas disponíveis:', columns.map(c => c.id));
      console.log('Startups status_ids:', startups.map(s => s.status_id));
    }
  }, [startups, columns]);

  // Encontrar um startup pelo ID
  const findStartupById = useCallback((id: UniqueIdentifier) => {
    const startupId = String(id);
    return startups.find(s => s.id === startupId);
  }, [startups]);

  // Manipulador para quando começamos a arrastar
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    
    console.log('Drag start:', { active });
    
    setActiveId(active.id);
  }, []);
  
  // Manipulador para quando o arrastar termina
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    
    console.log('Drag end:', { active, over });
    
    setActiveId(null);
    
    // Se não tiver destino, não faz nada
    if (!over) return;
    
    const startupId = String(active.id);
    const newStatusId = String(over.id);
    
    // Obtenha o startup que foi arrastado
    const startup = startups.find(s => s.id === startupId);
    
    if (!startup) {
      console.error('Startup not found with ID:', startupId);
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
  }, [startups, toast]);

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

  // Efeito para limpar o lastUpdatedColumn após 2 segundos
  useEffect(() => {
    if (lastUpdatedColumn) {
      const timer = setTimeout(() => {
        setLastUpdatedColumn(null);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [lastUpdatedColumn]);
  
  // Efeito para limpar o lastMovedStartupId após 2 segundos
  useEffect(() => {
    if (lastMovedStartupId) {
      const timer = setTimeout(() => {
        setLastMovedStartupId(null);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [lastMovedStartupId]);
  
  // Startup ativo (sendo arrastado)
  const activeStartup = useMemo(() => 
    activeId ? findStartupById(activeId) : null
  , [activeId, findStartupById]);
  
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
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToWindowEdges]}
        >
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => {
              // Obter startups para esta coluna
              const columnStartups = getStartupsForColumn(column.id);
              
              return (
                <DroppableColumn
                  key={column.id}
                  id={column.id}
                  name={column.name}
                  color={column.color}
                  startups={columnStartups}
                  isHighlighted={lastUpdatedColumn === column.id}
                  onCardClick={onCardClick}
                  onDeleteCard={setDeleteStartupId}
                  lastMovedStartupId={lastMovedStartupId}
                />
              );
            })}
          </div>
          
          {activeStartup && (
            <DragOverlay 
              adjustScale={true} 
              zIndex={100}
              className="opacity-80"
            >
              <StartupCard 
                startup={activeStartup} 
                onClick={() => {}} 
                onDelete={() => {}}
              />
            </DragOverlay>
          )}
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

type DroppableColumnProps = {
  id: string;
  name: string;
  color: string;
  startups: Startup[];
  isHighlighted: boolean;
  onCardClick: (startup: Startup) => Promise<void>;
  onDeleteCard: (id: string) => void;
  lastMovedStartupId: string | null;
};

function DroppableColumn({ 
  id, 
  name, 
  color, 
  startups, 
  isHighlighted,
  onCardClick, 
  onDeleteCard,
  lastMovedStartupId 
}: DroppableColumnProps) {
  const { setNodeRef } = useDroppable({ id });
  
  // IDs dos startups desta coluna
  const startupIds = useMemo(() => startups.map(s => s.id), [startups]);
  
  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow transition-all duration-300 ease-in-out ${
        isHighlighted ? 'ring-4 ring-blue-400 shadow-lg scale-102' : ''
      }`}
      data-column-id={id}
    >
      <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
        <h3 className="text-md font-medium text-gray-700 flex items-center">
          <span 
            style={{ backgroundColor: color }} 
            className="w-3 h-3 rounded-full mr-2"
          />
          {name}
          <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
            {startups.length}
          </span>
        </h3>
      </div>
      
      <div className="p-2 min-h-[400px]">
        <SortableContext items={startupIds} strategy={verticalListSortingStrategy}>
          {startups.map(startup => (
            <DraggableCard
              key={startup.id}
              startup={startup}
              onClick={() => onCardClick(startup)}
              onDelete={() => onDeleteCard(startup.id)}
              isHighlighted={lastMovedStartupId === startup.id}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

type DraggableCardProps = {
  startup: Startup;
  onClick: () => void;
  onDelete: () => void;
  isHighlighted: boolean;
};

function DraggableCard({ startup, onClick, onDelete, isHighlighted }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: startup.id,
    data: {
      type: 'startup',
      startup
    }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };
  
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      data-startup-id={startup.id}
      className={`mb-2 transition-all duration-300 ease-in-out ${
        isDragging 
          ? 'shadow-lg' 
          : isHighlighted
            ? 'shadow-md bg-blue-50 ring-2 ring-blue-300 scale-102'
            : 'hover:shadow-md'
      }`}
    >
      <StartupCard 
        startup={startup} 
        onClick={onClick}
        onDelete={onDelete}
      />
    </div>
  );
}