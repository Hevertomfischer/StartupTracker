import { useState } from "react";
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
import { type Startup, StatusEnum } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type KanbanBoardProps = {
  startups: Startup[];
  onCardClick: (startup: Startup) => void;
};

type KanbanColumn = {
  id: string;
  title: string;
  color: string;
};

export function KanbanBoard({ startups, onCardClick }: KanbanBoardProps) {
  const { toast } = useToast();
  
  const columns: KanbanColumn[] = [
    { id: StatusEnum.IDEA, title: "Idea Stage", color: "bg-blue-400" },
    { id: StatusEnum.MVP, title: "MVP Stage", color: "bg-purple-400" },
    { id: StatusEnum.TRACTION, title: "Traction Stage", color: "bg-green-400" },
    { id: StatusEnum.SCALING, title: "Scaling Stage", color: "bg-yellow-400" },
  ];

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
      const startupId = parseInt(draggableId);
      const newStatus = destination.droppableId;

      try {
        // Optimistically update the UI
        queryClient.setQueryData(
          ['/api/startups'],
          (old: Startup[] | undefined) => {
            if (!old) return old;
            return old.map(startup => 
              startup.id === startupId 
                ? { ...startup, status: newStatus } 
                : startup
            );
          }
        );

        // Send API request to update the status
        await apiRequest("PATCH", `/api/startups/${startupId}/status`, { status: newStatus });
        
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="kanban-board flex space-x-4 overflow-x-auto pb-4">
          {columns.map(column => {
            const columnStartups = startups.filter(
              startup => startup.status === column.id
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
                        <span className={`w-3 h-3 ${column.color} rounded-full mr-2`}></span>
                        {column.title}
                        <span className="ml-2 text-xs text-gray-500 bg-gray-200 rounded-full px-2 py-0.5">
                          {columnStartups.length}
                        </span>
                      </h3>
                    </div>
                    <div className="p-2 min-h-[400px]">
                      {columnStartups.map((startup, index) => (
                        <Draggable
                          key={startup.id.toString()}
                          draggableId={startup.id.toString()}
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
