import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Trash2, ArrowUp, ArrowDown, Edit } from "lucide-react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type Status, insertStatusSchema } from "@shared/schema";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

// Custom color input component with preview
const ColorInput = ({ value, onChange }: { value: string; onChange: (color: string) => void }) => {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        placeholder="#3498db"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-grow"
      />
      <div 
        className="w-8 h-8 rounded-md border border-gray-300" 
        style={{ backgroundColor: value }}
      />
    </div>
  );
};

type StatusManagementModalProps = {
  open: boolean;
  onClose: () => void;
};

// Status form schema
const statusFormSchema = insertStatusSchema.extend({
  name: z.string().min(1, "Status name is required"),
  color: z.string().min(1, "Color is required"),
});

export function StatusManagementModal({ open, onClose }: StatusManagementModalProps) {
  const { toast } = useToast();
  const [editingStatus, setEditingStatus] = useState<Status | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  
  // Form for adding/editing a status
  const form = useForm<z.infer<typeof statusFormSchema>>({
    resolver: zodResolver(statusFormSchema),
    defaultValues: {
      name: "",
      color: "#3498db",
      order: 0
    },
  });
  
  // Fetch statuses
  const { data: fetchedStatuses, isLoading } = useQuery<Status[]>({
    queryKey: ['/api/statuses'],
    queryFn: async () => {
      const response = await fetch('/api/statuses');
      if (!response.ok) {
        throw new Error('Failed to fetch statuses');
      }
      return response.json();
    }
  });
  
  // Set statuses when data is fetched
  useEffect(() => {
    if (fetchedStatuses) {
      // Sort by order
      const sortedStatuses = [...fetchedStatuses].sort((a, b) => (a.order || 0) - (b.order || 0));
      setStatuses(sortedStatuses);
    }
  }, [fetchedStatuses]);
  
  // Reset form when editingStatus changes
  useEffect(() => {
    if (editingStatus) {
      form.reset({
        name: editingStatus.name,
        color: editingStatus.color,
        order: editingStatus.order || 0
      });
    } else {
      form.reset({
        name: "",
        color: "#3498db",
        order: statuses.length
      });
    }
  }, [editingStatus, form, statuses.length]);
  
  // Create status mutation
  const createStatusMutation = useMutation({
    mutationFn: async (data: z.infer<typeof statusFormSchema>) => {
      const response = await apiRequest("POST", "/api/statuses", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/statuses'] });
      form.reset({
        name: "",
        color: "#3498db",
        order: statuses.length + 1
      });
      toast({
        title: "Status added",
        description: "The new status column has been added!",
      });
    },
    onError: (error) => {
      console.error("Error adding status:", error);
      toast({
        title: "Error",
        description: "Failed to add status. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<z.infer<typeof statusFormSchema>> }) => {
      const response = await apiRequest("PATCH", `/api/statuses/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/statuses'] });
      setEditingStatus(null);
      form.reset({
        name: "",
        color: "#3498db",
        order: statuses.length
      });
      toast({
        title: "Status updated",
        description: "The status column has been updated!",
      });
    },
    onError: (error) => {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Delete status mutation
  const deleteStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/statuses/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/statuses'] });
      toast({
        title: "Status deleted",
        description: "The status column has been deleted!",
      });
    },
    onError: (error) => {
      console.error("Error deleting status:", error);
      toast({
        title: "Error",
        description: "Failed to delete status. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  // Handle form submission
  const onSubmit = (data: z.infer<typeof statusFormSchema>) => {
    if (editingStatus) {
      updateStatusMutation.mutate({
        id: editingStatus.id,
        data: {
          name: data.name,
          color: data.color,
          order: data.order
        }
      });
    } else {
      createStatusMutation.mutate(data);
    }
  };
  
  // Handle status deletion
  const handleDelete = (status: Status) => {
    if (window.confirm(`Are you sure you want to delete "${status.name}" status column?`)) {
      deleteStatusMutation.mutate(status.id);
    }
  };
  
  // Handle drag and drop reordering
  const handleDragEnd = (result: any) => {
    if (!result.destination) return;
    
    const items = Array.from(statuses);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    // Update order property for all items
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }));
    
    setStatuses(updatedItems);
    
    // Update in database
    updatedItems.forEach(item => {
      updateStatusMutation.mutate({
        id: item.id,
        data: { order: item.order }
      });
    });
  };
  
  // Handle manual reordering (up/down buttons)
  const moveStatus = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === statuses.length - 1)
    ) {
      return;
    }
    
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newStatuses = [...statuses];
    const temp = newStatuses[index];
    newStatuses[index] = newStatuses[newIndex];
    newStatuses[newIndex] = temp;
    
    // Update order property
    const updatedStatuses = newStatuses.map((status, idx) => ({
      ...status,
      order: idx
    }));
    
    setStatuses(updatedStatuses);
    
    // Update in database
    updatedStatuses.forEach(item => {
      updateStatusMutation.mutate({
        id: item.id,
        data: { order: item.order }
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="h-6 w-6 rounded-full"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-700">
            Manage Status Columns
          </DialogTitle>
          <DialogDescription>
            Add, edit, or rearrange status columns for your Kanban board.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Status Form */}
          <div className="p-4 border rounded-md bg-gray-50">
            <h3 className="font-medium mb-3">
              {editingStatus ? "Edit Status" : "Add New Status"}
            </h3>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. In Progress" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <ColorInput
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex items-center gap-2 pt-2">
                  {editingStatus && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setEditingStatus(null)}
                    >
                      Cancel
                    </Button>
                  )}
                  
                  <Button
                    type="submit"
                    disabled={createStatusMutation.isPending || updateStatusMutation.isPending}
                    className="flex-1"
                  >
                    {editingStatus ? "Update Status" : "Add Status"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
          
          {/* Status List */}
          <div className="border rounded-md">
            <h3 className="font-medium p-3 bg-gray-100 rounded-t-md">Status Columns</h3>
            
            <div className="p-2">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-blue-500"></div>
                </div>
              ) : statuses.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  No status columns defined. Add one to get started.
                </div>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="status-list">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-2"
                      >
                        {statuses.map((status, index) => (
                          <Draggable
                            key={status.id}
                            draggableId={status.id}
                            index={index}
                          >
                            {(provided) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="flex items-center justify-between p-2 bg-white border rounded-md shadow-sm"
                              >
                                <div className="flex items-center gap-2 flex-1">
                                  <div 
                                    className="w-4 h-4 rounded-sm" 
                                    style={{ backgroundColor: status.color }}
                                  ></div>
                                  <span className="font-medium">{status.name}</span>
                                </div>
                                
                                <div className="flex items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveStatus(index, 'up')}
                                    disabled={index === 0}
                                    className="h-8 w-8"
                                  >
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => moveStatus(index, 'down')}
                                    disabled={index === statuses.length - 1}
                                    className="h-8 w-8"
                                  >
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingStatus(status)}
                                    className="h-8 w-8 text-blue-600"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(status)}
                                    className="h-8 w-8 text-red-600"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
              
              <div className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingStatus(null);
                    form.reset({
                      name: "",
                      color: "#3498db",
                      order: statuses.length
                    });
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Status
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        <DialogFooter className="mt-6">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}