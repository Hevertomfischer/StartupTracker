import { useState, useEffect } from "react";
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

type KanbanBoardProps = {
  startups: Startup[];
  onCardClick: (startup: Startup) => void;
};

type KanbanColumn = {
  id: string;
  name: string;
  color: string;
};

export function KanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  
  // Fetch statuses for the Kanban columns
  const { data: statuses, isLoading } = useQuery({
    queryKey: ['/api/statuses'],
    queryFn: async () => {
      const response = await fetch('/api/statuses');
      if (!response.ok) {
        throw new Error('Failed to fetch statuses');
      }
      return response.json() as Promise<Status[]>;
    }
  });

  // Create columns from statuses and ensure proper ordering
  const columns: KanbanColumn[] = statuses ? 
    [...statuses]
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(status => ({
        id: status.id,
        name: status.name,
        color: status.color,
      })) 
    : [];

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area or in the same place
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }

    // If the status has changed
    if (destination.droppableId !== source.droppableId) {
      const startupId = draggableId;
      const newStatusId = destination.droppableId;

      try {
        // Optimistically update the UI
        queryClient.setQueryData(
          ['/api/startups'],
          (old: Startup[] | undefined) => {
            if (!old) return old;
            return old.map(startup => 
              startup.id === startupId 
                ? { ...startup, status_id: newStatusId } 
                : startup
            );
          }
        );

        // Send API request to update the status
        await apiRequest("PATCH", `/api/startups/${startupId}/status`, { status_id: newStatusId });
        
        // Refetch to ensure data consistency
        queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
        
        toast({
          title: "Status updated",
          description: "The startup has been moved successfully!",
        });
      } catch (error) {
        console.error("Failed to update startup status:", error);
        toast({
          title: "Update failed",
          description: "Failed to update the startup status. Please try again.",
          variant: "destructive",
        });
        
        // Revert the optimistic update
        queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      }
    }
  };

  // If statuses are still loading, show a loading state
  if (isLoading || columns.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
          {columns.map(column => {
            const columnStartups = startups.filter(
              startup => startup.status_id === column.id
            );

            return (
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
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${snapshot.isDragging ? 'opacity-70 transform scale-105' : ''}`}
                            >
                              <StartupCard 
                                startup={startup} 
                                onClick={() => onCardClick(startup)} 
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
  );
}
