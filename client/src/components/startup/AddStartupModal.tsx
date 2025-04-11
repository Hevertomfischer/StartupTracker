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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  type Status,
  StartupMember
} from "@shared/schema";
import { StartupHistoryPanel } from "@/components/startup/StartupHistoryPanel";
import { TeamMembersTab } from "@/components/team/TeamMembersTab";
import { X } from "lucide-react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AddStartupModalProps = {
  open: boolean;
  onClose: () => void;
  startup?: any; // Startup to edit (optional)
  isEditing?: boolean;
};

// Extended schema with required fields
const formSchema = insertStartupSchema.extend({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").optional(),
  
  // Add validation for additional fields
  business_model: z.string().optional(),
  website: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  
  // CEO Information
  ceo_name: z.string().optional(),
  ceo_email: z.string().email("Must be a valid email").optional().or(z.literal("")),
  ceo_whatsapp: z.string().optional(),
  ceo_linkedin: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  
  // Location
  city: z.string().optional(),
  state: z.string().optional(),
  
  // Financial Metrics - accept string or number
  mrr: z.union([z.string(), z.number()]).nullable().optional(),
  client_count: z.union([z.string(), z.number()]).nullable().optional(),
  accumulated_revenue_current_year: z.union([z.string(), z.number()]).nullable().optional(),
  total_revenue_last_year: z.union([z.string(), z.number()]).nullable().optional(),
  total_revenue_previous_year: z.union([z.string(), z.number()]).nullable().optional(),
  partner_count: z.union([z.string(), z.number()]).nullable().optional(),
  
  // Market Metrics
  tam: z.union([z.string(), z.number()]).nullable().optional(),
  sam: z.union([z.string(), z.number()]).nullable().optional(),
  som: z.union([z.string(), z.number()]).nullable().optional(),
  
  // Dates - use string or null for compatibility
  founding_date: z.string().optional().or(z.null()),
  
  observations: z.string().optional(),
});

export function AddStartupModal({ open, onClose, startup, isEditing = false }: AddStartupModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
  
  // Fetch team members if editing an existing startup
  const { data: members = [], isLoading: isLoadingMembers } = useQuery<StartupMember[]>({
    queryKey: ['/api/startups', startup?.id, 'members'],
    enabled: !!startup?.id && isEditing,
    queryFn: async () => {
      const response = await fetch(`/api/startups/${startup.id}/members`);
      if (!response.ok) {
        throw new Error('Failed to fetch team members');
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
      business_model: "",
      website: "",
      ceo_name: "",
      ceo_email: "",
      ceo_whatsapp: "",
      ceo_linkedin: "",
      city: "",
      state: "",
      mrr: undefined,
      client_count: undefined,
      total_revenue_last_year: undefined,
      partner_count: undefined,
      tam: undefined,
      sam: undefined,
      som: undefined,
      founding_date: "",
      observations: "",
    },
  });
  
  // Initialize form with startup data if editing
  useEffect(() => {
    if (isEditing && startup) {
      // Reset the form with startup data
      const defaultValues = {
        name: startup.name || "",
        description: startup.description || "",
        sector: startup.sector || "tech",
        status_id: startup.status_id || "",
        priority: startup.priority || "medium",
        business_model: startup.business_model || "",
        website: startup.website || "",
        ceo_name: startup.ceo_name || "",
        ceo_email: startup.ceo_email || "",
        ceo_whatsapp: startup.ceo_whatsapp || "",
        ceo_linkedin: startup.ceo_linkedin || "",
        city: startup.city || "",
        state: startup.state || "",
        mrr: startup.mrr,
        client_count: startup.client_count,
        total_revenue_last_year: startup.total_revenue_last_year,
        partner_count: startup.partner_count,
        tam: startup.tam,
        sam: startup.sam,
        som: startup.som,
        founding_date: startup.founding_date || "",
        observations: startup.observations || "",
      };
      
      // Update the form with the startup data
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          form.setValue(key as any, value);
        }
      });
    }
  }, [form, startup, isEditing]);
  
  // Set the default status when statuses are loaded
  useEffect(() => {
    if (statuses.length > 0 && !form.getValues().status_id && !isEditing) {
      // Use the first status as default for new startups
      form.setValue('status_id', statuses[0].id);
    }
  }, [statuses, form, isEditing]);
  
  const createStartupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      try {
        return await apiRequest("POST", "/api/startups", data);
      } catch (error) {
        console.error("Error in create mutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      form.reset();
      setIsSubmitting(false);
      // Fecha o modal APENAS após sucesso na operação, prevenindo fechamentos prematuros
      toast({
        title: "Startup adicionada",
        description: "A startup foi adicionada com sucesso!",
      });
      // Atrasa levemente o fechamento para garantir que os efeitos visuais sejam concluídos
      setTimeout(() => {
        onClose();
      }, 500);
    },
    onError: (error) => {
      setIsSubmitting(false);
      console.error("Error adding startup:", error);
      toast({
        title: "Erro",
        description: "Falha ao adicionar startup. Por favor, tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  const updateStartupMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        return await apiRequest("PATCH", `/api/startups/${startup?.id}`, data);
      } catch (error) {
        console.error("Error in update mutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      setIsSubmitting(false);
      // Fecha o modal APENAS após sucesso na operação, prevenindo fechamentos prematuros
      toast({
        title: "Startup atualizada",
        description: "A startup foi atualizada com sucesso!",
      });
      // Atrasa levemente o fechamento para garantir que os efeitos visuais sejam concluídos
      setTimeout(() => {
        onClose();
      }, 500);
    },
    onError: (error) => {
      setIsSubmitting(false);
      console.error("Error updating startup:", error);
      toast({
        title: "Erro",
        description: "Falha ao atualizar startup. Por favor, tente novamente.",
        variant: "destructive",
      });
    },
  });
  
  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // Impede múltiplas submissões
    if (isSubmitting) {
      return;
    }
    
    setIsSubmitting(true);
    
    // Prepare data for submission
    const submissionData = { ...data };
    
    // Handle `founding_date` - convert empty string to null
    // or properly formatted date string to avoid database validation errors
    if (submissionData.founding_date === "") {
      submissionData.founding_date = null;
    } else if (submissionData.founding_date) {
      // Make sure date is in ISO format for API
      try {
        const dateObj = new Date(submissionData.founding_date);
        if (!isNaN(dateObj.getTime())) {
          submissionData.founding_date = dateObj.toISOString();
        } else {
          submissionData.founding_date = null;
        }
      } catch (error) {
        console.error("Invalid date:", error);
        submissionData.founding_date = null;
      }
    }

    console.log("Submitting data:", submissionData);
    
    try {
      if (isEditing && startup) {
        updateStartupMutation.mutate(submissionData);
      } else {
        createStartupMutation.mutate(submissionData);
      }
    } catch (error) {
      console.error("Error during submission:", error);
      setIsSubmitting(false);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao processar seu formulário. Tente novamente.",
        variant: "destructive"
      });
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Quando o modal estiver sendo fechado
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleOpenChange}
      modal={true}
    >
      <DialogContent 
        className="max-w-lg" 
        onEscapeKeyDown={(e) => {
          // Impede que o ESC feche o dialog principal
          e.preventDefault();
        }}
        onPointerDownOutside={(e) => {
          // Impede que cliques fora fechem o dialog principal
          e.preventDefault();
        }}
      >
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => onClose()}
            className="h-6 w-6 rounded-full"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-700">
            {isEditing ? "Edit Startup" : "Add New Startup"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <DialogDescription className="text-sm text-gray-500">
              {isEditing 
                ? "Update the details of this startup." 
                : "Fill in the details to add a new startup to your board."
              }
            </DialogDescription>
            
            <Tabs defaultValue={isEditing ? "basic" : "basic"} className="w-full">
              <TabsList className="grid grid-cols-7 mb-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="ceo">CEO</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="location">Location</TabsTrigger>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="team">Equipe</TabsTrigger>
                {isEditing && <TabsTrigger value="history">History</TabsTrigger>}
              </TabsList>
              
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
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
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                </div>
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  
                  <Controller
                    control={form.control}
                    name="business_model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Business Model</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g. SaaS, Marketplace" 
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
              </TabsContent>
              
              {/* CEO Information Tab */}
              <TabsContent value="ceo" className="space-y-4">
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
                    name="ceo_email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEO Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="CEO's email" 
                            type="email"
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
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="ceo_whatsapp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEO WhatsApp</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="WhatsApp number"
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
                    name="ceo_linkedin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEO LinkedIn</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="LinkedIn profile URL" 
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
              </TabsContent>
              
              {/* Metrics Tab */}
              <TabsContent value="metrics" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="mrr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Recurring Revenue (MRR)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter amount in $" 
                            type="number"
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
                    name="client_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Clients</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter client count" 
                            type="number"
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
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="total_revenue_last_year"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Total Revenue (Last Year)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter amount in $" 
                            type="number"
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
                    name="partner_count"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Partners</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter partner count" 
                            type="number"
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
                
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Controller
                    control={form.control}
                    name="tam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TAM</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Total Addressable Market" 
                            type="number"
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
                    name="sam"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SAM</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Serviceable Available Market" 
                            type="number"
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
                    name="som"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>SOM</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Serviceable Obtainable Market" 
                            type="number"
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
              </TabsContent>
              
              {/* Location Tab */}
              <TabsContent value="location" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="City" 
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
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="State/Province" 
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
              </TabsContent>
              
              {/* Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Controller
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Website</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="https://example.com" 
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
                    name="founding_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Founding Date</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="YYYY-MM-DD" 
                            type="date"
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
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observations</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Additional notes or observations..."
                          className="resize-none"
                          rows={5}
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
              </TabsContent>
              
              {/* Team Tab */}
              <TabsContent value="team" className="space-y-4">
                <TeamMembersTab 
                  startup={startup}
                  isEditing={isEditing}
                  members={members}
                  isLoadingMembers={isLoadingMembers}
                />
              </TabsContent>
              
              {/* History Tab - Only shown when editing */}
              {isEditing && startup && (
                <TabsContent value="history" className="space-y-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-500">ID da Startup: {startup.id}</p>
                  </div>
                  <StartupHistoryPanel startup={startup} />
                </TabsContent>
              )}
            </Tabs>
            
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
                disabled={createStartupMutation.isPending || updateStartupMutation.isPending}
              >
                {createStartupMutation.isPending || updateStartupMutation.isPending 
                  ? (isEditing ? "Saving..." : "Adding...") 
                  : (isEditing ? "Save Changes" : "Add Startup")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
