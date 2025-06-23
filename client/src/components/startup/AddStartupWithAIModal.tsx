import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { insertStartupSchema, SectorEnum, PriorityEnum, type Status } from "@shared/schema";
import { Loader2, X, Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [step, setStep] = useState<"upload" | "confirm" | "processing">("upload");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [originalFileName, setOriginalFileName] = useState<string>("");

  // Debug: Add test button to force confirmation screen
  const testConfirmation = () => {
    console.log('Testing confirmation screen...');
    const testData = {
      name: 'Test Company',
      ceo_name: 'Test CEO',
      ceo_email: 'test@example.com',
      description: 'Test description'
    };
    setExtractedData(testData);
    setOriginalFileName('test.pdf');
    setStep('confirm');
    console.log('Test data set:', testData);
  };

  // Reset modal state when closed
  useEffect(() => {
    if (!open) {
      setStep("upload");
      setExtractedData(null);
      setOriginalFileName("");
    }
  }, [open]);

  // Debug logging
  useEffect(() => {
    console.log('Modal state:', { step, extractedData: !!extractedData, open });
  }, [step, extractedData, open]);

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

  const basicForm = useForm<z.infer<typeof basicSchema>>({
    resolver: zodResolver(basicSchema),
    defaultValues: {
      name: "",
    },
  });

  const confirmForm = useForm<z.infer<typeof confirmationSchema>>({
    resolver: zodResolver(confirmationSchema),
    defaultValues: {
      name: "",
      description: "",
      sector: "tech",
      status_id: "",
      priority: "medium",
    },
  });

  // Mutation para processar PDF
  const processPDFMutation = useMutation({
    mutationFn: async (data: { name: string; pitchDeck: File }) => {
      console.log('Iniciando processamento PDF...', data);

      const formData = new FormData();
      formData.append('startupName', data.name);
      formData.append('file', data.pitchDeck);

      const response = await fetch('/api/startup/process-pitch-deck', {
        method: 'POST',
        body: formData,
      });

      console.log('Resposta recebida:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro na resposta:', errorText);
        throw new Error('Erro ao processar pitch deck');
      }

      const result = await response.json();
      console.log('Resultado do processamento:', result);
      return result;
    },
    onSuccess: (result) => {
      console.log('PDF processado com sucesso:', result);

      // Primeiro definir os dados extraídos
      setExtractedData(result.extractedData);
      setOriginalFileName(result.originalFileName);

      // Preencher formulário de confirmação com dados extraídos
      console.log('Preenchendo formulário com dados:', result.extractedData);
      Object.entries(result.extractedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          console.log(`Definindo ${key}:`, value);
          confirmForm.setValue(key as any, value);
        }
      });

      // Set default status if available
      if (statuses.length > 0 && !result.extractedData.status_id) {
        console.log('Definindo status padrão:', statuses[0].id);
        confirmForm.setValue('status_id', statuses[0].id);
      }

      console.log('Mudando para tela de confirmação...');
      
      // Mudar para o step de confirmação imediatamente
      setStep("confirm");
      console.log('Step alterado para confirm');

      toast({
        title: "Dados extraídos com sucesso",
        description: "Revise as informações antes de salvar a startup.",
      });
    },
    onError: (error) => {
      console.error('Erro ao processar PDF:', error);
      setStep("upload"); // Voltar para tela inicial em caso de erro

      toast({
        title: "Erro ao processar PDF",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    },
  });

  // Mutation para criar startup
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

  const handleClose = () => {
    console.log('Closing modal, resetting state...');
    basicForm.reset();
    confirmForm.reset();
    setStep("upload");
    setExtractedData(null);
    setOriginalFileName("");
    onClose();
  };

  const onBasicSubmit = (data: z.infer<typeof basicSchema>) => {
    console.log('Form submitted, setting processing step...', data);
    setStep("processing");
    console.log('Current step after setting processing:', step);
    processPDFMutation.mutate(data);
  };

  const onConfirmSubmit = (data: z.infer<typeof confirmationSchema>) => {
    createStartupMutation.mutate(data);
  };

  const goBack = () => {
    setStep("upload");
    setExtractedData(null);
    setOriginalFileName("");
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(isOpen) => {
        // Bloquear fechamento automático quando estiver na tela de confirmação
        if (!isOpen && step === "confirm" && extractedData) {
          console.log('Bloqueando fechamento automático na tela de confirmação');
          return;
        }
        
        // Só fechar se realmente for para fechar
        if (!isOpen) {
          handleClose();
        }
      }}
    >
      <DialogContent 
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          onPointerDownOutside={(e) => {
            // Prevenir fechamento ao clicar fora quando estiver na tela de confirmação
            if (step === "confirm" && extractedData) {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // Prevenir fechamento com ESC quando estiver na tela de confirmação
            if (step === "confirm" && extractedData) {
              e.preventDefault();
            }
          }}
        >
        <div className="absolute top-0 right-0 pt-4 pr-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              // Só permitir fechamento manual se não estiver na confirmação ou se for explícito
              if (step === "confirm" && extractedData) {
                const shouldClose = confirm("Tem certeza que deseja fechar? Os dados extraídos serão perdidos.");
                if (shouldClose) {
                  handleClose();
                }
              } else {
                handleClose();
              }
            }}
            className="h-6 w-6 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <DialogHeader>
          <DialogTitle className="text-lg font-medium text-gray-700">
            Adicionar Startup com IA
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-500">
            {step === "upload" && "Carregue o pitch deck para extrair informações automaticamente"}
            {step === "processing" && "Processando pitch deck com IA..."}
            {step === "confirm" && "Revise e confirme as informações extraídas"}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <Form {...basicForm}>
            <form onSubmit={basicForm.handleSubmit(onBasicSubmit)} className="space-y-6">
              <FormField
                control={basicForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome da Startup *</FormLabel>
                    <FormControl>
                      <Input placeholder="Digite o nome da startup" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={basicForm.control}
                name="pitchDeck"
                render={({ field: { onChange, ...field } }) => (
                  <FormItem>
                    <FormLabel>Pitch Deck (PDF) *</FormLabel>
                    <FormControl>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                        <Input
                          type="file"
                          accept=".pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
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
                        {basicForm.watch("pitchDeck") && (
                          <p className="mt-2 text-sm text-green-600">
                            ✓ {basicForm.watch("pitchDeck")?.name}
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
                <Button type="button" variant="secondary" onClick={testConfirmation}>
                  Testar Tela
                </Button>
                <Button type="submit" disabled={!basicForm.watch("name") || !basicForm.watch("pitchDeck")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Processar com IA
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {/* Step 2: Processing */}
        {step === "processing" && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
            <h3 className="text-lg font-medium mb-2">Processando Pitch Deck</h3>
            <p className="text-gray-600 text-center">
              Nossa IA está analisando o documento e extraindo as informações...
            </p>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === "confirm" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Dados Extraídos
                </CardTitle>
                <CardDescription>
                  Arquivo: {originalFileName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(extractedData).map(([key, value]) => {
                    if (value && key !== 'name') {
                      return (
                        <div key={key} className="flex justify-between">
                          <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                          <span className="text-gray-600 truncate ml-2">{String(value)}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </CardContent>
            </Card>

            <Form {...confirmForm}>
              <form onSubmit={confirmForm.handleSubmit(onConfirmSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={confirmForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Startup</FormLabel>
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
                        <FormLabel>Setor</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={SectorEnum.TECH}>Tecnologia</SelectItem>
                            <SelectItem value={SectorEnum.HEALTH}>Saúde</SelectItem>
                            <SelectItem value={SectorEnum.FINANCE}>Financeiro</SelectItem>
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={confirmForm.control}
                    name="ceo_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome do CEO</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
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
                        <FormLabel>Email do CEO</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={goBack}>
                    Voltar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createStartupMutation.isPending}
                  >
                    {createStartupMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar Startup"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}