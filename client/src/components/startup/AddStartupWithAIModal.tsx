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
import { Upload, FileText, CheckCircle, Loader2, Edit3, Brain, Image, Database } from "lucide-react";
import { Progress } from "@/components/ui/progress";
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
  const [isModalClosing, setIsModalClosing] = useState(false);
  
  // Progress tracking state
  const [processingStep, setProcessingStep] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [progress, setProgress] = useState(0);

  // Debug state changes
  useEffect(() => {
    console.log('STATE CHANGE:', { currentView, hasExtractedData: !!extractedData, fileName });
  }, [currentView, extractedData, fileName]);

  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Only reset state when modal is explicitly closed by user
  useEffect(() => {
    if (!open && !isModalClosing && currentView === "upload" && !extractedData) {
      closeTimeoutRef.current = setTimeout(() => {
        setCurrentView("upload");
        setExtractedData(null);
        setFileName("");
        setIsModalClosing(false);
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
  }, [open, currentView, extractedData, isModalClosing]);

  // Prevent modal from closing when we have extracted data or are in confirm/processing state
  const shouldKeepModalOpen = currentView === "confirm" || currentView === "processing" || !!extractedData;

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
    enabled: open || currentView === "confirm"
  });

  const processingSteps = [
    { icon: Upload, message: "Enviando arquivo PDF...", duration: 1000 },
    { icon: Image, message: "Convertendo páginas em imagens...", duration: 2000 },
    { icon: Brain, message: "Analisando conteúdo com IA...", duration: 3000 },
    { icon: Database, message: "Salvando dados extraídos...", duration: 1000 },
    { icon: CheckCircle, message: "Processamento concluído!", duration: 500 }
  ];

  const simulateProgress = () => {
    let currentProgressStep = 0;
    let totalDuration = 0;
    
    const stepDurations = processingSteps.map(step => step.duration);
    const totalTime = stepDurations.reduce((acc, duration) => acc + duration, 0);
    
    const updateProgress = () => {
      if (currentProgressStep < processingSteps.length) {
        const step = processingSteps[currentProgressStep];
        setProcessingStep(currentProgressStep);
        setProcessingMessage(step.message);
        
        const progressPercentage = (totalDuration / totalTime) * 100;
        setProgress(progressPercentage);
        
        setTimeout(() => {
          totalDuration += step.duration;
          currentProgressStep++;
          updateProgress();
        }, step.duration);
      }
    };
    
    updateProgress();
  };

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
        credentials: 'include',
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
    onMutate: () => {
      setCurrentView("processing");
      setProgress(0);
      setProcessingStep(0);
      simulateProgress();
    },
    onSuccess: (result) => {
      console.log('=== PDF MUTATION SUCCESS START ===');
      console.log('PDF processed successfully:', result);
      console.log('COMPLETE EXTRACTED DATA:', result.extractedData);

      // Complete progress and show success
      setProgress(100);
      setProcessingMessage("Processamento concluído!");

      // Set extracted data immediately
      setExtractedData(result.extractedData);
      setFileName(result.originalFileName || '');
      
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

      // Wait a moment before switching to confirmation view to show completion
      setTimeout(() => {
        console.log('=== SWITCHING TO CONFIRM VIEW ===');
        setCurrentView("confirm");
      }, 1000);

      // Invalidate startup cache to ensure new startup appears immediately
      queryClient.invalidateQueries({ queryKey: ['/api/startups'] });
      
      toast({
        title: "Startup criada com sucesso",
        description: "A startup foi criada e está disponível para revisão em 'Revisar IA'.",
      });
      
      console.log('=== PDF MUTATION SUCCESS END ===');
    },
    onError: (error) => {
      console.error('=== PDF MUTATION ERROR ===');
      console.error('Error details:', error);
      
      setCurrentView("upload");
      
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
    
    console.log('Triggering PDF mutation...');
    processPDFMutation.mutate(data);
    console.log('=== UPLOAD SUBMIT END ===');
  };

  const handleConfirmSubmit = (data: z.infer<typeof confirmationSchema>) => {
    // Ensure AI-generated startups are marked properly and get "Cadastrada" status
    const startupData = {
      ...data,
      created_by_ai: true,
      ai_reviewed: false,
      // status_id should already be set from the AI processing, but ensure it's there
      status_id: data.status_id || extractedData?.status_id
    };
    createStartupMutation.mutate(startupData);
  };

  const handleClose = () => {
    setIsModalClosing(true);
    uploadForm.reset();
    confirmForm.reset();
    setExtractedData(null);
    setCurrentView("upload");
    setFileName("");
    setProcessingStep(0);
    setProcessingMessage('');
    setProgress(0);
    onClose();
  };

  const goBack = () => {
    setCurrentView("upload");
    setExtractedData(null);
    setFileName("");
    uploadForm.reset();
  };

  // Keep modal open if there's extracted data or we're in confirm/processing state
  const isModalOpen = open || shouldKeepModalOpen;

  return (
    <SmartFormProvider>
      <Dialog 
        open={isModalOpen} 
        onOpenChange={(isOpen) => {
          console.log('onOpenChange called:', { isOpen, currentView, hasExtractedData: !!extractedData });
          // Block closing if we're in processing or confirm state or have extracted data
          if (!isOpen && shouldKeepModalOpen) {
            console.log('Preventing modal close - in confirmation, processing state, or has extracted data');
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
          <div className="flex flex-col space-y-8 py-8">
            {/* Progress Bar */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Processando PDF com IA</h3>
                <span className="text-sm text-gray-500">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full h-2" />
            </div>

            {/* Current Step Indicator */}
            <div className="flex items-center space-x-4 p-4 bg-blue-50 rounded-lg">
              {processingSteps[processingStep] && (
                <>
                  <div className="flex-shrink-0">
                    {React.createElement(processingSteps[processingStep].icon, {
                      className: "w-6 h-6 text-blue-600",
                    })}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-900">
                      {processingMessage}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                </>
              )}
            </div>

            {/* Steps Overview */}
            <div className="space-y-3">
              {processingSteps.map((step, index) => (
                <div 
                  key={index}
                  className={`flex items-center space-x-3 p-2 rounded transition-colors ${
                    index < processingStep 
                      ? 'bg-green-50 text-green-700' 
                      : index === processingStep 
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-400'
                  }`}
                >
                  <div className="flex-shrink-0">
                    {index < processingStep ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : index === processingStep ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      React.createElement(step.icon, {
                        className: "w-5 h-5",
                      })
                    )}
                  </div>
                  <span className="text-sm">{step.message.replace('...', '')}</span>
                </div>
              ))}
            </div>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                Este processo pode levar alguns minutos dependendo do tamanho do arquivo.
              </p>
            </div>
          </div>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs text-gray-500 p-2 bg-gray-50 rounded">
            Debug: currentView={currentView}, hasExtractedData={!!extractedData}
          </div>
        )}

        {/* Confirmation View */}
        {currentView === "confirm" && (
          <div>
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    Dados Extraídos - {fileName}
                  </CardTitle>
                  <CardDescription>
                    Revise e confirme as informações extraídas do pitch deck antes de salvar na base de dados. 
                    Os campos com ícone 💡 têm sugestões inteligentes baseadas nos dados do sistema.
                  </CardDescription>
                </CardHeader>
              </Card>

              <ConfirmationFormContent
                extractedData={extractedData}
                confirmForm={confirmForm}
                statuses={statuses}
                onSubmit={handleConfirmSubmit}
                onGoBack={goBack}
                onEditField={(field: string) => {
                  console.log('Editing field:', field);
                }}
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
  onGoBack,
  onEditField, 
  isLoading 
}: {
  extractedData: any;
  confirmForm: any;
  statuses: any[];
  onSubmit: (data: any) => void;
  onGoBack: () => void;
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
            name="name"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel>Nome da Startup</FormLabel>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditField('name')}
                  >
                    <Edit3 className="h-3 w-3" />
                  </Button>
                </div>
                <FormControl>
                  <Input {...field} />
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
          <Button type="button" variant="outline" onClick={onGoBack}>
            Voltar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
            Confirmar e Salvar Startup
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}