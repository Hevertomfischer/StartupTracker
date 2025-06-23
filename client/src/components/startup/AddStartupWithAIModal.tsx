import React, { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartAutoCompleteField } from "./SmartAutoCompleteField";
import { SmartFormProvider, useSmartForm } from "./SmartFormContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, CheckCircle, Loader2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertStartupSchema, type SelectStatus } from "@shared/schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

type AddStartupWithAIModalProps = {
  open: boolean;
  onClose: () => void;
};

const basicSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  pitchDeck: z.instanceof(File).refine(
    (file) => file.type === "application/pdf",
    "Apenas arquivos PDF são aceitos"
  ),
});

const confirmationSchema = insertStartupSchema.extend({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
});

export function AddStartupWithAIModal({ open, onClose }: AddStartupWithAIModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simplified state management
  const [currentView, setCurrentView] = useState<"upload" | "confirm" | "processing">("upload");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [fileName, setFileName] = useState<string>("");

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prevent state reset when we have extracted data or are confirming
  useEffect(() => {
    if (!open && !extractedData && currentView === "upload") {
      closeTimeoutRef.current = setTimeout(() => {
        setCurrentView("upload");
        setExtractedData(null);
        setFileName("");
        closeTimeoutRef.current = null;
      }, 200);
    } else if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
  }, [open]);

  // Forms
  const uploadForm = useForm<z.infer<typeof basicSchema>>({
    resolver: zodResolver(basicSchema),
    defaultValues: { name: "", pitchDeck: undefined }
  });

  const confirmForm = useForm<z.infer<typeof confirmationSchema>>({
    resolver: zodResolver(confirmationSchema),
    defaultValues: {}
  });

  // Fetch statuses
  const { data: statuses = [] } = useQuery<SelectStatus[]>({
    queryKey: ['/api/statuses'],
    enabled: open
  });

  // PDF Processing mutation
  const processPDFMutation = useMutation({
    mutationFn: async (data: z.infer<typeof basicSchema>) => {
      console.log('=== MUTATION START ===');
      console.log('Creating FormData with:', { name: data.name, fileName: data.pitchDeck.name });
      
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('file', data.pitchDeck);

      console.log('Sending request to /api/startup/process-pitch-deck');
      const response = await fetch('/api/startup/process-pitch-deck', {
        method: 'POST',
        body: formData,
        credentials: 'include', // Include cookies for authentication
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`Falha no processamento: ${response.status}`);
      }

      const result = await response.json();
      console.log('=== MUTATION SUCCESS ===');
      console.log('Response data:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('=== PDF MUTATION SUCCESS START ===');
      console.log('PDF processed successfully:', result);
      console.log('COMPLETE EXTRACTED DATA:', result.extractedData);
      console.log('EXTRACTED DATA KEYS:', Object.keys(result.extractedData || {}));
      console.log('Current view before switch:', currentView);

      // Immediate state updates
      console.log('Setting extracted data...');
      setExtractedData(result.extractedData);
      console.log('Setting file name...');
      setFileName(result.originalFileName || '');

      console.log('Filling confirmation form...');
      // Fill confirmation form
      if (result.extractedData) {
        Object.entries(result.extractedData).forEach(([key, value]) => {
          console.log(`Setting form field: ${key} = ${value} (type: ${typeof value})`);
          try {
            confirmForm.setValue(key as any, value);
          } catch (error) {
            console.warn(`Failed to set form field ${key}:`, error);
          }
        });
      }

      // Set default status
      if (statuses.length > 0 && !result.extractedData?.status_id) {
        console.log('Setting default status:', statuses[0].id);
        confirmForm.setValue('status_id', statuses[0].id);
      }

      // Critical: Switch to confirm view immediately
      console.log('=== SWITCHING TO CONFIRM VIEW ===');
      setCurrentView("confirm");
      
      // Force a microtask to ensure state is updated
      Promise.resolve().then(() => {
        console.log('State verification - currentView:', currentView, 'extractedData exists:', !!extractedData);
      });

      toast({
        title: "Dados extraídos com sucesso",
        description: "Revise as informações antes de salvar.",
      });
      
      console.log('=== PDF MUTATION SUCCESS END ===');
    },
    onError: (error) => {
      console.error('=== PDF MUTATION ERROR ===');
      console.error('Error details:', error);
      console.error('Error message:', error.message);
      
      setCurrentView("upload");
      
      // Check if it's an authentication error
      if (error.message.includes('401')) {
        toast({
          title: "Erro de Autenticação",
          description: "Você precisa estar logado para usar esta funcionalidade.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao processar PDF",
          description: `Falha no processamento: ${error.message}`,
          variant: "destructive",
        });
      }
    },
  });

  // Create startup mutation
  const createStartupMutation = useMutation({
    mutationFn: async (data: z.infer<typeof confirmationSchema>) => {
      return await apiRequest("POST", "/api/startups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      toast({
        title: "Startup criada com sucesso",
        description: "A startup foi adicionada ao sistema.",
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        title: "Erro ao criar startup",
        description: "Falha ao salvar startup. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const handleUploadSubmit = async (data: z.infer<typeof basicSchema>) => {
    console.log('=== UPLOAD SUBMIT START ===');
    console.log('Form data validation:', {
      name: data.name,
      hasFile: !!data.pitchDeck,
      fileName: data.pitchDeck?.name,
      fileType: data.pitchDeck?.type
    });
    
    if (!data.name || !data.pitchDeck) {
      console.error('Missing required data:', { name: !!data.name, file: !!data.pitchDeck });
      return;
    }
    
    console.log('Setting view to processing...');
    setCurrentView("processing");
    
    console.log('Triggering PDF mutation...');
    processPDFMutation.mutate(data);
    console.log('=== UPLOAD SUBMIT END ===');
  };

  const handleConfirmSubmit = (data: z.infer<typeof confirmationSchema>) => {
    createStartupMutation.mutate(data);
  };

  const handleClose = () => {
    uploadForm.reset();
    confirmForm.reset();
    setExtractedData(null);
    setCurrentView("upload");
    setFileName("");
    onClose();
  };

  const goBack = () => {
    setCurrentView("upload");
    setExtractedData(null);
    setFileName("");
  };

  // Keep modal open if there's extracted data or we're in confirm/processing state
  const isModalOpen = open || currentView === "confirm" || currentView === "processing";



  return (
    <SmartFormProvider>
      <Dialog 
        open={isModalOpen} 
        onOpenChange={(isOpen) => {
          // Block closing if we have extracted data or are in processing/confirm state
          if (!isOpen && (extractedData || currentView === "confirm" || currentView === "processing")) {
            console.log('Preventing modal close - has data or in confirmation');
            return;
          }
          if (!isOpen) {
            handleClose();
          }
        }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Startup com IA</DialogTitle>
          <DialogDescription>
            {currentView === "upload" && "Carregue o pitch deck para extrair informações automaticamente"}
            {currentView === "processing" && "Processando pitch deck com IA..."}
            {currentView === "confirm" && "Revise e confirme as informações extraídas"}
          </DialogDescription>
        </DialogHeader>

        {/* Upload View */}
        {currentView === "upload" && (
          <Form {...uploadForm}>
            <form onSubmit={uploadForm.handleSubmit(handleUploadSubmit)} className="space-y-6">
              <FormField
                control={uploadForm.control}
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

              <FormField
                control={uploadForm.control}
                name="pitchDeck"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Pitch Deck (PDF)</FormLabel>
                    <FormControl>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            console.log('File selected:', file?.name, file?.type);
                            if (file) onChange(file);
                          }}
                          className="hidden"
                          id="pitch-deck-upload"
                        />
                        <label
                          htmlFor="pitch-deck-upload"
                          className="cursor-pointer text-sm text-gray-600 hover:text-gray-800"
                        >
                          Clique para selecionar o arquivo PDF do pitch deck
                        </label>
                        {uploadForm.watch("pitchDeck") && (
                          <p className="mt-2 text-sm text-green-600">
                            ✓ {uploadForm.watch("pitchDeck")?.name}
                          </p>
                        )}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={!uploadForm.watch("name") || !uploadForm.watch("pitchDeck")}
                  onClick={() => {
                    console.log('Submit button clicked');
                    const formData = uploadForm.getValues();
                    console.log('Form values:', { name: formData.name, hasFile: !!formData.pitchDeck });
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Processar com IA
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* Processing View */}
        {currentView === "processing" && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Processando Pitch Deck
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Nossa IA está analisando o documento e extraindo as informações...
            </p>
          </div>
        )}

        {/* Confirmation View */}
        {currentView === "confirm" && extractedData && (
          <div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Dados Extraídos - {fileName}
                  </CardTitle>
                  <CardDescription>
                    Revise as informações extraídas do pitch deck. Os campos com ícone 💡 têm sugestões inteligentes baseadas nos dados do sistema.
                  </CardDescription>
                </CardHeader>
              </Card>

              <ConfirmationFormContent
                extractedData={extractedData}
                confirmForm={confirmForm}
                statuses={statuses}
                onSubmit={handleConfirmSubmit}
                onEditField={handleEditField}
                isLoading={createStartupMutation.isPending}
              />
            </div>
          </div>
        )}

        </DialogContent>
      </Dialog>
    </SmartFormProvider>
  );
}

// Component wrapper to use SmartForm context
function ConfirmationFormContent({ 
  extractedData, 
  confirmForm, 
  statuses, 
  onSubmit, 
  onEditField, 
  isLoading 
}: {
  extractedData: any;
  confirmForm: any;
  statuses: any[];
  onSubmit: (data: any) => void;
  onEditField: (field: string) => void;
  isLoading: boolean;
}) {
  const { updateField, getContext } = useSmartForm();
  
  // Update context when form values change
  React.useEffect(() => {
    const formValues = confirmForm.getValues();
    Object.keys(formValues).forEach(key => {
      updateField(key, formValues[key]);
    });
  }, [confirmForm.watch(), updateField]);

  return (
    <Form {...confirmForm}>
      <form onSubmit={confirmForm.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={confirmForm.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Nome da Startup</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('nome')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <FormControl>
                  <Input {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Setor"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('sector', value);
                  }}
                  fieldType="sector"
                  context={getContext()}
                  placeholder="Ex: tecnologia, saúde, educação"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="business_model"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Modelo de Negócio"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('business_model', value);
                  }}
                  fieldType="business_model"
                  context={getContext()}
                  placeholder="Ex: SaaS, Marketplace, E-commerce"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="ceo_name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Nome do CEO</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('ceo_name')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <FormControl>
                  <Input {...field} placeholder="Nome do fundador/CEO" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="ceo_email"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Email do CEO</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('ceo_email')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <FormControl>
                  <Input {...field} type="email" placeholder="email@startup.com" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Estado"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('state', value);
                  }}
                  fieldType="state"
                  context={getContext()}
                  placeholder="Ex: SP, RJ, MG"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Cidade"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('city', value);
                  }}
                  fieldType="city"
                  context={getContext()}
                  placeholder="Ex: São Paulo, Rio de Janeiro"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Website"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('website', value);
                  }}
                  fieldType="website"
                  context={getContext()}
                  placeholder="https://exemplo.com"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={confirmForm.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <SmartAutoCompleteField
                label="Descrição"
                value={field.value || ''}
                onChange={(value) => {
                  field.onChange(value);
                  updateField('description', value);
                }}
                fieldType="description"
                context={getContext()}
                placeholder="Descreva a startup..."
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={confirmForm.control}
          name="status_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status Inicial</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Criar Startup
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
                  <FormField
                    control={confirmForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={confirmForm.control}
                    name="status_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statuses.map((status) => (
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

                <FormField
                  control={confirmForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={goBack}>
                    Voltar
                  </Button>
                  <Button type="button" variant="outline" onClick={handleClose}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={createStartupMutation.isPending}
                  >
                    {createStartupMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Criando...
                      </>
                    ) : (
                      "Criar Startup"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>
    </SmartFormProvider>
  );
}

// Component wrapper to use SmartForm context
function ConfirmationFormContent({ 
  extractedData, 
  confirmForm, 
  statuses, 
  onSubmit, 
  onEditField, 
  isLoading 
}: {
  extractedData: any;
  confirmForm: any;
  statuses: any[];
  onSubmit: (data: any) => void;
  onEditField: (field: string) => void;
  isLoading: boolean;
}) {
  const { updateField, getContext } = useSmartForm();
  
  // Update context when form values change
  React.useEffect(() => {
    const formValues = confirmForm.getValues();
    Object.keys(formValues).forEach(key => {
      updateField(key, formValues[key]);
    });
  }, [confirmForm.watch(), updateField]);

  return (
    <Form {...confirmForm}>
      <form onSubmit={confirmForm.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={confirmForm.control}
            name="nome"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Nome da Startup</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('nome')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <FormControl>
                  <Input {...field} disabled />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="sector"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Setor"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('sector', value);
                  }}
                  fieldType="sector"
                  context={getContext()}
                  placeholder="Ex: tecnologia, saúde, educação"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="business_model"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Modelo de Negócio"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('business_model', value);
                  }}
                  fieldType="business_model"
                  context={getContext()}
                  placeholder="Ex: SaaS, Marketplace, E-commerce"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Estado"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('state', value);
                  }}
                  fieldType="state"
                  context={getContext()}
                  placeholder="Ex: SP, RJ, MG"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="city"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Cidade"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('city', value);
                  }}
                  fieldType="city"
                  context={getContext()}
                  placeholder="Ex: São Paulo, Rio de Janeiro"
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={confirmForm.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <SmartAutoCompleteField
                  label="Website"
                  value={field.value || ''}
                  onChange={(value) => {
                    field.onChange(value);
                    updateField('website', value);
                  }}
                  fieldType="website"
                  context={getContext()}
                  placeholder="https://exemplo.com"
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={confirmForm.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <SmartAutoCompleteField
                label="Descrição"
                value={field.value || ''}
                onChange={(value) => {
                  field.onChange(value);
                  updateField('description', value);
                }}
                fieldType="description"
                context={getContext()}
                placeholder="Descreva a startup..."
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={confirmForm.control}
          name="status_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Status Inicial</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Criar Startup
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}