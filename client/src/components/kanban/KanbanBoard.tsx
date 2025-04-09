import { useState, useCallback } from "react";
import { StartupCard } from "./StartupCard";
import { type Startup, type Status } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

type KanbanBoardProps = {
  startups: Startup[];
  onCardClick: (startup: Startup) => Promise<void>;
};

export function KanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  const [deleteStartupId, setDeleteStartupId] = useState<string | null>(null);

  // Fetch statuses
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

  // Organize columns by order
  const columns = statuses ? [...statuses].sort((a, b) => (a.order || 0) - (b.order || 0)) : [];

  // Map startups to columns
  const getStartupsForColumn = useCallback((columnId: string) => {
    return startups.filter(startup => startup.status_id === columnId);
  }, [startups]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) return;

    const startupId = active.id as string;
    const newStatusId = over.id as string;

    const startup = startups.find(s => s.id === startupId);
    if (!startup || startup.status_id === newStatusId) return;

    try {
      // Optimistic update
      queryClient.setQueryData(['/api/startups'], (old: Startup[] | undefined) => {
        if (!old) return old;
        return old.map(s =>
          s.id === startupId ? { ...s, status_id: newStatusId } : s
        );
      });

      // Update in server
      await apiRequest("PATCH", `/api/startups/${startupId}/status`, {
        status_id: newStatusId
      });

      toast({
        title: "Success",
        description: "Card moved successfully",
      });
    } catch (error) {
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Error",
        description: "Failed to move card",
        variant: "destructive",
      });
    }
  }, [startups, toast]);

  const handleDeleteStartup = async () => {
    if (!deleteStartupId) return;

    try {
      await apiRequest("DELETE", `/api/startups/${deleteStartupId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Success",
        description: "Startup deleted successfully",
      });
    } catch (error) {
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <DndContext onDragEnd={handleDragEnd}>
        <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
          {columns.map(column => {
            const columnStartups = getStartupsForColumn(column.id);

            return (
              <Column
                key={column.id}
                id={column.id}
                name={column.name}
                color={column.color}
                startups={columnStartups}
                onCardClick={onCardClick}
                onDeleteCard={setDeleteStartupId}
              />
            );
          })}
        </div>
      </DndContext>
    </div>
  );
}

type ColumnProps = {
  id: string;
  name: string;
  color: string;
  startups: Startup[];
  onCardClick: (startup: Startup) => Promise<void>;
  onDeleteCard: (id: string) => void;
};

function Column({ id, name, color, startups, onCardClick, onDeleteCard }: ColumnProps) {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div className="kanban-column flex-shrink-0 w-80 bg-white rounded-lg shadow">
      <div className="p-3 border-b border-gray-200 bg-gray-100 rounded-t-lg">
        <h3 className="text-md font-medium text-gray-700 flex items-center">
          <span style={{ backgroundColor: color }} className="w-3 h-3 rounded-full mr-2" />
          {name}
          <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
            {startups.length}
          </span>
        </h3>
      </div>

      <div ref={setNodeRef} className="p-2 min-h-[400px]">
        {startups.map((startup) => (
          <DraggableCard
            key={startup.id}
            startup={startup}
            onClick={() => onCardClick(startup)}
            onDelete={() => onDeleteCard(startup.id)}
          />
        ))}
      </div>
    </div>
  );
}

type DraggableCardProps = {
  startup: Startup;
  onClick: () => void;
  onDelete: () => void;
};

function DraggableCard({ startup, onClick, onDelete }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: startup.id,
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`transition-all duration-200 ${isDragging ? 'scale-105 shadow-lg' : ''}`}
    >
      <StartupCard
        startup={startup}
        onClick={onClick}
        onDelete={onDelete}
      />
    </div>
  );
}

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