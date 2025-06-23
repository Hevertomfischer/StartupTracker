import React, { useState, useEffect } from "react";
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
  
  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setCurrentView("upload");
        setExtractedData(null);
        setFileName("");
      }, 200);
    }
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
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('file', data.pitchDeck);
      
      const response = await fetch('/api/startup/process-pitch-deck', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Falha no processamento');
      }
      
      return response.json();
    },
    onSuccess: (result) => {
      console.log('PDF processed successfully:', result);
      console.log('Extracted data:', result.extractedData);
      console.log('Current view before switch:', currentView);
      
      // Store extracted data
      setExtractedData(result.extractedData);
      setFileName(result.originalFileName);
      
      console.log('Setting extracted data and switching to confirm view...');
      
      // Fill confirmation form
      Object.entries(result.extractedData).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          confirmForm.setValue(key as any, value);
        }
      });
      
      // Set default status
      if (statuses.length > 0 && !result.extractedData.status_id) {
        confirmForm.setValue('status_id', statuses[0].id);
        console.log('Set default status:', statuses[0].id);
      }
      
      // Switch to confirmation view
      setCurrentView("confirm");
      console.log('Current view after switch:', "confirm");
      
      // Force re-render
      setTimeout(() => {
        console.log('Force checking view state:', currentView);
        console.log('Extracted data state:', extractedData);
      }, 100);
      
      toast({
        title: "Dados extraídos com sucesso",
        description: "Revise as informações antes de salvar.",
      });
    },
    onError: (error) => {
      console.error('PDF processing error:', error);
      setCurrentView("upload");
      toast({
        title: "Erro ao processar PDF",
        description: "Falha no processamento. Tente novamente.",
        variant: "destructive",
      });
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

  const handleUploadSubmit = (data: z.infer<typeof basicSchema>) => {
    setCurrentView("processing");
    processPDFMutation.mutate(data);
  };

  const handleConfirmSubmit = (data: z.infer<typeof confirmationSchema>) => {
    createStartupMutation.mutate(data);
  };

  const handleClose = () => {
    uploadForm.reset();
    confirmForm.reset();
    onClose();
  };

  const goBack = () => {
    setCurrentView("upload");
    setExtractedData(null);
    setFileName("");
  };

  // Force modal to stay open when in confirm view
  const isModalOpen = open || currentView === "confirm";
  
  // Debug logging for view state
  console.log('Modal render - currentView:', currentView, 'extractedData:', !!extractedData, 'isModalOpen:', isModalOpen);

  return (
    <Dialog 
      open={isModalOpen} 
      onOpenChange={(isOpen) => {
        if (!isOpen && currentView === "confirm") {
          // Prevent closing during confirmation
          return;
        }
        if (!isOpen) {
          handleClose();
        }
      }}
    >
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
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Dados Extraídos
                </CardTitle>
                <CardDescription>
                  Arquivo: {fileName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {Object.entries(extractedData).map(([key, value]) => {
                    if (value === null || value === undefined || value === "") return null;
                    return (
                      <div key={key}>
                        <span className="font-medium">{key}:</span>
                        <span className="ml-2 text-gray-600">{String(value)}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Form {...confirmForm}>
              <form onSubmit={confirmForm.handleSubmit(handleConfirmSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
        )}
      </DialogContent>
    </Dialog>
  );
}