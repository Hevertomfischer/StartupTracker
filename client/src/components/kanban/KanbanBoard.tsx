import { useState, useMemo, useCallback, useEffect, useRef } from "react";
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
  useDroppable,
  pointerWithin,
  closestCorners,
  getFirstCollision
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
    
    console.log('Drag end:', event);
    console.log('Active data:', active.data?.current);
    console.log('Over data:', over?.data?.current);
    
    setActiveId(null);
    
    // Se não tiver destino, não faz nada
    if (!over) {
      console.log('Sem destino detectado, abortando operação');
      return;
    }
    
    // Obtenha o ID do startup que está sendo arrastado
    const startupId = String(active.id);
    
    // Verificando se estamos movendo para uma coluna ou outro elemento
    const overId = String(over.id);
    
    console.log('Detalhes do arrastar:', {
      startupId,
      overId,
      overData: over.data?.current,
      activeData: active.data?.current
    });
    
    // Primeiro, verificamos o tipo de destino através dos dados
    let newStatusId = "";
    
    // Estratégia 1: Verificar se o over.id é diretamente um ID de coluna
    const isDirectColumn = columns.some(col => col.id === overId);
    if (isDirectColumn) {
      console.log('Destino é uma coluna direta:', overId);
      newStatusId = overId;
    } 
    // Estratégia 2: Verificar pelo tipo nos dados
    else if (over.data?.current?.type === 'column') {
      console.log('Destino identificado pelos dados como coluna');
      newStatusId = over.data.current.columnId || "";
    } 
    // Estratégia 3: Verificar se caiu em um card e pegar sua coluna pai
    else if (over.data?.current?.type === 'startup') {
      console.log('Destino é um startup:', over.data.current.startup?.name);
      if (over.data.current.startup && over.data.current.startup.status_id) {
        newStatusId = over.data.current.startup.status_id;
        console.log('Usando status_id do startup alvo:', newStatusId);
      } else if (over.data.current.status_id) {
        newStatusId = over.data.current.status_id;
        console.log('Usando status_id dos dados:', newStatusId);
      } else if (over.data.current.parentColumn) {
        newStatusId = over.data.current.parentColumn;
        console.log('Usando parentColumn dos dados:', newStatusId);
      }
    }
    // Estratégia 4: Última tentativa - verificar pelo atributo no DOM
    else {
      console.log('Tentando encontrar coluna por attributos de dados no DOM');
      // Tentativa de buscar pelo DOM
      const overElement = document.querySelector(`[data-droppable-id="${overId}"]`);
      if (overElement && overElement.getAttribute('data-column-id')) {
        newStatusId = overElement.getAttribute('data-column-id') || "";
        console.log('Coluna encontrada por atributo data-column-id:', newStatusId);
      }
    }
    
    // Log detalhado para depuração
    console.log('Status de destino identificado:', {
      newStatusId, 
      isValid: columns.some(col => col.id === newStatusId)
    });
    
    // Verifica se o ID do status existe nas colunas
    const isValidStatus = columns.some(col => col.id === newStatusId);
    if (!isValidStatus || !newStatusId) {
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
          collisionDetection={closestCorners}
          modifiers={[restrictToWindowEdges]}
        >
          <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
            {columns.map(column => {
              // Obter startups para esta coluna
              const columnStartups = getStartupsForColumn(column.id);
              
              // Log de diagnóstico para cada coluna
              console.log(`Coluna ${column.name} (${column.id}):`, {
                startups: columnStartups.map(s => ({ id: s.id, nome: s.name }))
              });
              
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
              adjustScale={false} 
              zIndex={100}
              className="opacity-90 w-[320px] transform-none"
              dropAnimation={{
                duration: 300,
                easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                sideEffects: () => {}
              }}
            >
              <div className="scale-95 shadow-md">
                <StartupCard 
                  startup={activeStartup} 
                  onClick={() => {}} 
                  onDelete={() => {}}
                />
              </div>
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
  const { setNodeRef, isOver } = useDroppable({ 
    id,
    data: {
      type: 'column',
      columnId: id,
      accepts: ['startup']
    }
  });
  
  // IDs dos startups desta coluna
  const startupIds = useMemo(() => startups.map(s => s.id), [startups]);
  
  // Log para debugging dessa coluna
  useEffect(() => {
    console.log(`Coluna ${name} está pronta com ID: ${id}`);
  }, [id, name]);
  
  return (
    <div 
      ref={setNodeRef}
      className={`kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow transition-all duration-300 ease-in-out ${
        isHighlighted ? 'ring-4 ring-blue-400 shadow-lg scale-102' : ''
      } ${isOver ? 'ring-2 ring-blue-500 bg-blue-50' : ''}`}
      data-column-id={id}
      data-droppable-id={id}
      data-type="column"
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
  // Recupera o ID da coluna pai para referência e logging
  const columnElement = useRef<HTMLElement | null>(null);
  const [parentColumnId, setParentColumnId] = useState<string | null>(null);
  
  useEffect(() => {
    // Encontra o elemento de coluna pai
    const findParentColumn = (element: HTMLElement | null): HTMLElement | null => {
      if (!element) return null;
      if (element.dataset.type === 'column') return element;
      if (element.parentElement) return findParentColumn(element.parentElement);
      return null;
    };
    
    // Timeout para garantir que o DOM esteja pronto
    const timeoutId = setTimeout(() => {
      const cardElement = document.querySelector(`[data-startup-id="${startup.id}"]`);
      if (cardElement) {
        columnElement.current = findParentColumn(cardElement as HTMLElement);
        const colId = columnElement.current ? columnElement.current.dataset.columnId : null;
        setParentColumnId(colId);
        console.log(`Card ${startup.name} conectado à coluna:`, colId);
      }
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, [startup.id, startup.name]);
  
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
      startup,
      status_id: startup.status_id,
      parentColumn: parentColumnId
    }
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
    scale: isDragging ? '0.95' : '1',
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