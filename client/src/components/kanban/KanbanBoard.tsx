import { useState, useMemo } from "react";
import { 
  DragDropContext, 
  Droppable, 
  Draggable, 
  DropResult, 
  DroppableProvided, 
  DraggableProvided, 
  DraggableStateSnapshot,
  ResponderProvided,
  DragStart
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
  const [draggingStartupId, setDraggingStartupId] = useState<string | null>(null);
  
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

  // Use useMemo to create stable columns reference
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
  
  // Create a map of columns to startups
  const columnStartupsMap = useMemo(() => {
    const map: Record<string, Startup[]> = {};
    
    if (columns) {
      columns.forEach(column => {
        map[column.id] = startups.filter(
          startup => startup.status_id === column.id
        );
      });
    }
    
    return map;
  }, [columns, startups]);

  // Event handlers for drag and drop
  const handleDragStart = (initial: DragStart) => {
    // Save the dragging startup ID
    setDraggingStartupId(initial.draggableId);
  };

  const handleDragEnd = async (result: DropResult, provided?: ResponderProvided) => {
    // Clear the dragging state
    setDraggingStartupId(null);
    
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area or in the same place
    if (!destination || 
        (destination.droppableId === source.droppableId && 
         destination.index === source.index)) {
      return;
    }

    // Find the startup that was dragged
    const draggedStartup = startups.find(startup => startup.id === draggableId);
    if (!draggedStartup) {
      console.error("Could not find startup with ID:", draggableId);
      toast({
        title: "Error",
        description: "Could not find the startup you were trying to move.",
        variant: "destructive",
      });
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
      <DragDropContext 
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
          {columns.map(column => {
            const columnStartups = columnStartupsMap[column.id] || [];

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
                          isDragDisabled={draggingStartupId !== null && draggingStartupId !== startup.id}
                        >
                          {(provided: DraggableProvided, snapshot: DraggableStateSnapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`mb-2 ${snapshot.isDragging ? 'opacity-70 transform scale-105' : ''}`}
                              data-startup-id={startup.id}
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
