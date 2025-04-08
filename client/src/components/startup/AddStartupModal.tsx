import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogHeader,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  insertStartupSchema, 
  SectorEnum,
  PriorityEnum,
  type Status
} from "@shared/schema";
import { X } from "lucide-react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AddStartupModalProps = {
  open: boolean;
  onClose: () => void;
};

// Extended schema with required fields
const formSchema = insertStartupSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
});

export function AddStartupModal({ open, onClose }: AddStartupModalProps) {
  const { toast } = useToast();
  
  // Fetch statuses for the dropdown
  const { data: statuses = [] } = useQuery<Status[]>({
    queryKey: ['/api/statuses'],
    queryFn: async () => {
      const response = await fetch('/api/statuses');
      if (!response.ok) {
        throw new Error('Failed to fetch statuses');
      }
      return response.json();
    }
  });
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      sector: "tech",
      status_id: "",
      priority: "medium",
      ceo_name: "",
      city: "",
      state: "",
      observations: "",
    },
  });
  
  // Set the default status when statuses are loaded
  useEffect(() => {
    if (statuses.length > 0 && !form.getValues().status_id) {
      // Use the first status as default
      form.setValue('status_id', statuses[0].id);
    }
  }, [statuses, form]);
  
  const createStartupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const response = await apiRequest("POST", "/api/startups", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      form.reset();
      onClose();
      toast({
        title: "Startup added",
        description: "The startup has been successfully added!",
      });
    },
    onError: (error) => {
      console.error("Error adding startup:", error);
      toast({
        title: "Error",
        description: "Failed to add startup. Please try again.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    createStartupMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
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
            Add New Startup
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Startup Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter startup name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Controller
              control={form.control}
              name="sector"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sector</FormLabel>
                  <Select 
                    value={field.value || "tech"} 
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SectorEnum.TECH}>Technology</SelectItem>
                      <SelectItem value={SectorEnum.HEALTH}>Healthcare</SelectItem>
                      <SelectItem value={SectorEnum.FINANCE}>Finance</SelectItem>
                      <SelectItem value={SectorEnum.ECOMMERCE}>E-commerce</SelectItem>
                      <SelectItem value={SectorEnum.EDUCATION}>Education</SelectItem>
                      <SelectItem value={SectorEnum.AGRITECH}>AgriTech</SelectItem>
                      <SelectItem value={SectorEnum.CLEANTECH}>CleanTech</SelectItem>
                      <SelectItem value={SectorEnum.OTHER}>Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Controller
              control={form.control}
              name="status_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Status</FormLabel>
                  <Select 
                    value={field.value || ""} 
                    onValueChange={field.onChange}
                    disabled={statuses.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {statuses.map(status => (
                        <SelectItem key={status.id} value={status.id}>
                          {status.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select 
                    value={field.value || "medium"} 
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={PriorityEnum.HIGH}>High</SelectItem>
                      <SelectItem value={PriorityEnum.MEDIUM}>Medium</SelectItem>
                      <SelectItem value={PriorityEnum.LOW}>Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="ceo_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CEO Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="CEO's name" 
                        value={field.value || ""} 
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
              <Controller
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g. São Paulo" 
                        value={field.value || ""} 
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        ref={field.ref}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <Controller
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g. SP" 
                      value={field.value || ""} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Describe the startup..." 
                      className="resize-none" 
                      rows={3}
                      value={field.value || ""} 
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          
            <DialogFooter className="mt-5 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="w-full sm:w-auto"
                disabled={createStartupMutation.isPending}
              >
                {createStartupMutation.isPending ? "Adding..." : "Add Startup"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
