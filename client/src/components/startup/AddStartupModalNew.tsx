import React, { useState, useEffect, useCallback, useRef } from "react";
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
import { TeamMembersTabNew } from "@/components/team/TeamMembersTabNew";
import { FileManager } from "@/components/startup/FileManager";
import { Loader2, X, FileText } from "lucide-react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AddStartupModalProps = {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  startup?: any; // Startup to edit (optional)
  editingStartup?: any; // Alternative prop name for consistency
  isEditing?: boolean;
  onSuccess?: () => void;
};

// Extended schema with required fields
const formSchema = insertStartupSchema.extend({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").optional(),
  
  // Add validation for additional fields
  business_model: z.string().optional(),
  website: z.string().url("Deve ser uma URL válida").optional().or(z.literal("")),
  
  // CEO Information
  ceo_name: z.string().optional(),
  ceo_email: z.string().email("Deve ser um email válido").optional().or(z.literal("")),
  ceo_whatsapp: z.string().optional(),
  ceo_linkedin: z.string().url("Deve ser uma URL válida").optional().or(z.literal("")),
  
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

export function AddStartupModalNew({ 
  open, 
  onClose, 
  onOpenChange, 
  startup, 
  editingStartup, 
  isEditing = false,
  onSuccess 
}: AddStartupModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [isToastShowing, setIsToastShowing] = useState(false);
  const [shouldPreventClosing, setShouldPreventClosing] = useState(false);
  
  // Estado para controlar se o fechamento foi solicitado pelo código e não pelo usuário
  const [isProgrammaticClose, setIsProgrammaticClose] = useState(false);
  const [isForceClose, setIsForceClose] = useState(false);
  
  // Usando uma ref para garantir que o modal não será fechado durante operações
  const isClosingRef = useRef(false);
  
  // Use either startup or editingStartup prop
  const startupToEdit = startup || editingStartup;
  const actualIsEditing = isEditing || !!startupToEdit;
  
  // Handle close event
  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
    if (onClose) {
      onClose();
    }
  };

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
    enabled: !!startup?.id && isEditing && open,
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
  
  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      // Reset form values when modal is closed
      setTimeout(() => {
        if (!isEditing) {
          form.reset();
        }
      }, 300);
    }
  }, [open, form, isEditing]);
  
  // Initialize form with startup data if editing
  useEffect(() => {
    if ((actualIsEditing && startupToEdit && open)) {
      // Reset the form with startup data
      const defaultValues = {
        name: startupToEdit.name || "",
        description: startupToEdit.description || "",
        sector: startupToEdit.sector || "tech",
        status_id: startupToEdit.status_id || "",
        priority: startupToEdit.priority || "medium",
        business_model: startupToEdit.business_model || "",
        website: startupToEdit.website || "",
        ceo_name: startupToEdit.ceo_name || "",
        ceo_email: startupToEdit.ceo_email || "",
        ceo_whatsapp: startupToEdit.ceo_whatsapp || "",
        ceo_linkedin: startupToEdit.ceo_linkedin || "",
        city: startupToEdit.city || "",
        state: startupToEdit.state || "",
        mrr: startupToEdit.mrr,
        client_count: startupToEdit.client_count,
        total_revenue_last_year: startupToEdit.total_revenue_last_year,
        partner_count: startupToEdit.partner_count,
        tam: startupToEdit.tam,
        sam: startupToEdit.sam,
        som: startupToEdit.som,
        founding_date: startupToEdit.founding_date || "",
        observations: startupToEdit.observations || "",
      };
      
      // Update the form with the startup data
      Object.entries(defaultValues).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          form.setValue(key as any, value);
        }
      });
    }
  }, [form, startupToEdit, actualIsEditing, open]);
  
  // Set the default status when statuses are loaded
  useEffect(() => {
    if (statuses.length > 0 && !form.getValues().status_id && !actualIsEditing && open) {
      // Use the first status as default for new startups
      form.setValue('status_id', statuses[0].id);
    }
  }, [statuses, form, actualIsEditing, open]);
  
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
      console.log("onSuccess da criação");
      
      // Sinalizamos que a operação está em andamento para impedir fechamento
      setIsToastShowing(true);
      setShouldPreventClosing(true);
      setIsProgrammaticClose(false);
      
      // Invalidamos as queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      setIsSubmitting(false);
      
      // Mensagem de sucesso removida
      // Continuamos sinalizando que o toast estaria sendo exibido
      // para evitar problemas com a lógica de fechamento
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      // Para criação de startup, sempre fechamos o modal pois é preciso salvar primeiro 
      // antes de poder adicionar membros da equipe
      console.log("Fechando modal após adição bem-sucedida de nova startup");
      
      // Aguardar um pouco após exibir o toast antes de iniciar o fechamento
      setTimeout(() => {
        console.log("Preparando para fechar modal após tempo de exibição do toast (criação)");
        setIsToastShowing(false);
        
        // Agora programamos o fechamento com um atraso
        setTimeout(() => {
          console.log("Executando fechamento programado do modal (criação)");
          if (!isClosingRef.current) {
            // Sinaliza que o fechamento está sendo solicitado pelo código
            setIsProgrammaticClose(true);
            
            // Liberamos o controle de fechamento
            setShouldPreventClosing(false);
            isClosingRef.current = true;
            
            // Finalmente fechamos o modal
            handleClose();
          }
        }, 700);
      }, 1000);
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
        const startupId = startupToEdit?.id;
        if (!startupId) {
          throw new Error("No startup ID available for update");
        }
        return await apiRequest("PATCH", `/api/startups/${startupId}`, data);
      } catch (error) {
        console.error("Error in update mutation:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("onSuccess da atualização - aba atual:", activeTab);
      
      // Registramos quais abas não devem fechar o modal
      const shouldKeepOpen = activeTab === "team" || activeTab === "history";

      // Sinalizamos que a operação está em andamento para impedir fechamento
      setIsToastShowing(true);
      setShouldPreventClosing(true);
      setIsProgrammaticClose(false);
      
      // Invalidamos as queries para atualizar os dados
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      setIsSubmitting(false);
      
      // Mensagem de sucesso removida
      // Continuamos sinalizando que o toast estaria sendo exibido
      // para evitar problemas com a lógica de fechamento
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
      
      if (shouldKeepOpen) {
        // NUNCA fecha o modal quando está nas abas team ou history
        console.log("Modal MANTIDO aberto - usuário está na aba:", activeTab);
        
        // Apenas resolvemos o estado do toast após um tempo
        setTimeout(() => {
          console.log("Resolvendo estados após toast em aba que deve permanecer aberta");
          setIsToastShowing(false);
          setShouldPreventClosing(false);
        }, 2000);
      } else {
        // Nas outras abas, fecha o modal após um tempo
        console.log("Fechando modal após atualização (não está na aba protegida)");
        
        // Aguardar um pouco após exibir o toast antes de iniciar o fechamento
        setTimeout(() => {
          console.log("Preparando para fechar modal após tempo de exibição do toast");
          setIsToastShowing(false);
          
          // Agora programamos o fechamento com um atraso
          setTimeout(() => {
            console.log("Executando fechamento programado do modal");
            if (!isClosingRef.current) {
              // Sinaliza que o fechamento está sendo solicitado pelo código
              setIsProgrammaticClose(true);
              
              // Liberamos o controle de fechamento
              setShouldPreventClosing(false);
              isClosingRef.current = true;
              
              // Finalmente fechamos o modal
              onClose();
            }
          }, 700);
        }, 1000);
      }
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
  
  const onSubmit = useCallback((data: z.infer<typeof formSchema>) => {
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
  }, [isSubmitting, isEditing, startup, updateStartupMutation, createStartupMutation, toast]);
  
  // Função ajustada para lidar tanto com eventos quanto com chamadas diretas
  const handleCloseModal = useCallback((eventOrForce?: React.MouseEvent | boolean) => {
    // Determina se é uma chamada forçada (passando true diretamente)
    const forceClose = typeof eventOrForce === 'boolean' ? eventOrForce : false;
    
    // Armazena o estado de fechamento forçado quando true
    if (forceClose) {
      setIsForceClose(true);
    }
    // Verificação específica para abas protegidas (incluindo a aba "files")
    const isProtectedTab = activeTab === "team" || activeTab === "history" || activeTab === "files";
    
    console.log("handleCloseModal:", {
      isSubmitting,
      isToastShowing,
      shouldPreventClosing,
      isProtectedTab,
      activeTab,
      forceClose
    });
    
    // NUNCA permitir fechamento quando está nas abas protegidas, a menos que seja forçado
    if (isProtectedTab && !forceClose) {
      console.log("Tentativa de fechamento manual em aba protegida impedida:", activeTab);
      return;
    }
    
    // Não permitir fechamento se estiver em submissão, ou durante a exibição de toast, 
    // ou quando solicitamos explicitamente prevenir o fechamento
    if (!isSubmitting && !isToastShowing && !shouldPreventClosing && !isClosingRef.current) {
      console.log("Fechando modal via handleCloseModal - condições atendidas");
      isClosingRef.current = true;
      
      // Programar o fechamento
      setIsProgrammaticClose(true);
      onClose();
    } else {
      console.log(
        "Fechamento manual impedido por outras condições:", 
        { isSubmitting, isToastShowing, shouldPreventClosing, isClosingRef: isClosingRef.current }
      );
    }
  }, [isSubmitting, isToastShowing, shouldPreventClosing, activeTab, onClose, setIsForceClose]);

  return (
    <Dialog 
      open={open}
      modal={true}
      // Impedir fechamento automático quando é definido por código
      onOpenChange={(isOpen) => {
        // Verificação específica para abas protegidas (incluindo a aba "files")
        const isProtectedTab = activeTab === "team" || activeTab === "history" || activeTab === "files";
        
        console.log("Dialog onOpenChange:", { 
          isOpen, 
          isSubmitting, 
          isToastShowing, 
          shouldPreventClosing,
          isProtectedTab,
          isProgrammaticClose,
          isForceClose,
          isClosingByRef: isClosingRef.current 
        });
        
        // Se estiver em uma aba protegida, nunca permitir fechamento pela UI a menos que seja um fechamento forçado
        if (!isOpen && isProtectedTab && !isProgrammaticClose && !isForceClose) {
          console.log("Tentativa de fechamento BLOQUEADA - usuário está em aba protegida:", activeTab);
          return; // Bloqueia o fechamento completamente
        }
        
        // Para os outros casos, verificamos várias condições
        // Se for um fechamento forçado, permitimos mesmo com outras condições
        if (!isOpen && isForceClose) {
          console.log("Fechando o modal via onOpenChange - FORÇADO");
          isClosingRef.current = true;
          onClose();
        }
        // Caso padrão: verificações normais
        else if (!isOpen && !isSubmitting && !isToastShowing && !shouldPreventClosing && !isClosingRef.current) {
          console.log("Fechando o modal via onOpenChange - condições permitidas");
          isClosingRef.current = true;
          onClose();
        } else if (!isOpen) {
          // Se tentarem fechar o modal quando não deveria, apenas logamos
          console.log("Tentativa de fechamento via onOpenChange impedida por outras condições");
        }
      }}
    >
      <DialogContent 
        className="max-w-lg sm:max-w-2xl"
        onClick={(e) => {
          // Prevenir propagação de cliques para evitar fechamento do diálogo pai
          e.stopPropagation();
        }}
        // Sempre impedir fechamento via ESC
        onEscapeKeyDown={(e) => {
          console.log("ESC pressionado, prevenindo fechamento automático");
          e.preventDefault();
        }}
        // Sempre impedir fechamento ao clicar fora
        onPointerDownOutside={(e) => {
          console.log("Clique fora detectado, prevenindo fechamento automático");
          e.preventDefault();
        }}
        // Impedir qualquer interação externa
        onInteractOutside={(e) => {
          console.log("Interação externa detectada, prevenindo");
          e.preventDefault();
        }}
      >
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => handleCloseModal(true)}
            disabled={isSubmitting}
            className="h-6 w-6 rounded-full"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </Button>
        </div>
        
        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-700">
            {isEditing ? "Editar Startup" : "Adicionar Nova Startup"}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {isEditing 
              ? "Atualize os detalhes desta startup." 
              : "Preencha os detalhes para adicionar uma nova startup ao seu quadro."
            }
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            <Tabs 
              defaultValue="basic" 
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid grid-cols-8 mb-4">
                <TabsTrigger value="basic">Básico</TabsTrigger>
                <TabsTrigger value="ceo">CEO</TabsTrigger>
                <TabsTrigger value="metrics">Métricas</TabsTrigger>
                <TabsTrigger value="location">Localização</TabsTrigger>
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="team">Equipe</TabsTrigger>
                {isEditing && <TabsTrigger value="files"><FileText className="h-4 w-4 mr-1" />Arquivos</TabsTrigger>}
                {isEditing && <TabsTrigger value="history">Histórico</TabsTrigger>}
              </TabsList>
              
              {/* Basic Info Tab */}
              <TabsContent value="basic" className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Startup</FormLabel>
                      <FormControl>
                        <Input placeholder="Digite o nome da startup" {...field} />
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
                        <FormLabel>Setor</FormLabel>
                        <Select 
                          value={field.value || "tech"} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o setor" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SectorEnum.TECH}>Tecnologia</SelectItem>
                            <SelectItem value={SectorEnum.HEALTH}>Saúde</SelectItem>
                            <SelectItem value={SectorEnum.FINANCE}>Finanças</SelectItem>
                            <SelectItem value={SectorEnum.ECOMMERCE}>E-commerce</SelectItem>
                            <SelectItem value={SectorEnum.EDUCATION}>Educação</SelectItem>
                            <SelectItem value={SectorEnum.AGRITECH}>AgriTech</SelectItem>
                            <SelectItem value={SectorEnum.CLEANTECH}>CleanTech</SelectItem>
                            <SelectItem value={SectorEnum.OTHER}>Outro</SelectItem>
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
                        <FormLabel>Status Atual</FormLabel>
                        <Select 
                          value={field.value || ""} 
                          onValueChange={field.onChange}
                          disabled={statuses.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o status" />
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
                        <FormLabel>Prioridade</FormLabel>
                        <Select 
                          value={field.value || "medium"} 
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a prioridade" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={PriorityEnum.HIGH}>Alta</SelectItem>
                            <SelectItem value={PriorityEnum.MEDIUM}>Média</SelectItem>
                            <SelectItem value={PriorityEnum.LOW}>Baixa</SelectItem>
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
                        <FormLabel>Modelo de Negócio</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: SaaS, Marketplace" 
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
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva a startup..." 
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
                        <FormLabel>Nome do CEO</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Nome do CEO" 
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
                        <FormLabel>Email do CEO</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Email do CEO" 
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
                        <FormLabel>WhatsApp do CEO</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Número do WhatsApp"
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
                        <FormLabel>LinkedIn do CEO</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="URL do perfil LinkedIn" 
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
                        <FormLabel>Receita Mensal Recorrente (MRR)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Valor em R$" 
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
                        <FormLabel>Número de Clientes</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Quantidade de clientes" 
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
                        <FormLabel>Receita Total do Último Ano</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Valor em R$" 
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
                        <FormLabel>Número de Parceiros</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Quantidade de parceiros" 
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
                            placeholder="Valor em R$" 
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
                            placeholder="Valor em R$" 
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
                            placeholder="Valor em R$" 
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
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Cidade da startup" 
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
                        <FormLabel>Estado</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Estado/UF" 
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
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Website</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://example.com" 
                          type="url"
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
                      <FormLabel>Data de Fundação</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="AAAA-MM-DD" 
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
              </TabsContent>
              
              {/* Additional Details Tab */}
              <TabsContent value="details" className="space-y-4">
                <Controller
                  control={form.control}
                  name="observations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Notas adicionais ou observações..."
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
                {isEditing && startup?.id ? (
                  <div className="overflow-hidden">
                    <TeamMembersTabNew 
                      startup={startupToEdit} 
                      isEditing={isEditing}
                      members={members}
                      isLoadingMembers={isLoadingMembers}
                      parentIsOpen={open}
                    />
                  </div>
                ) : (
                  <div className="text-center p-6 text-gray-500 border border-dashed rounded-md">
                    Para adicionar membros da equipe, salve a startup primeiro.
                  </div>
                )}
              </TabsContent>
              
              {/* Files Tab */}
              <TabsContent value="files" className="space-y-4">
                {isEditing && startup?.id ? (
                  <FileManager startupId={startup.id} />
                ) : (
                  <div className="text-center p-6 text-gray-500 border border-dashed rounded-md">
                    Para adicionar arquivos, salve a startup primeiro.
                  </div>
                )}
              </TabsContent>
              
              {/* History Tab */}
              <TabsContent value="history" className="space-y-4">
                {isEditing && startup?.id ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm text-gray-500">ID da Startup: {startup.id}</p>
                    </div>
                    <StartupHistoryPanel startup={startup} />
                  </>
                ) : (
                  <div className="text-center p-6 text-gray-500 border border-dashed rounded-md">
                    Histórico não disponível para startups não salvas.
                  </div>
                )}
              </TabsContent>
            </Tabs>
            
            <DialogFooter className="mt-5 gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => handleCloseModal(true)} 
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button 
                type="submit"
                className="w-full sm:w-auto"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Salvando..." : "Adicionando..."}
                  </>
                ) : (
                  isEditing ? "Salvar Alterações" : "Adicionar Startup"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}