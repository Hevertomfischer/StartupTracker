import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/ui/file-upload";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { File, FileText, Trash2, FileX, Download, Image, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FileManagerProps {
  startupId: string;
}

interface FileData {
  id: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  path: string;
  created_at: string;
}

interface AttachmentData {
  id: string;
  description: string | null;
  document_type: string | null;
  created_at: string;
  file_id: string;
  filename: string;
  original_name: string;
  mimetype: string;
  size: number;
  path: string;
}

interface AttachmentsResponse {
  pitchDeck: FileData | null;
  attachments: AttachmentData[];
}

export function FileManager({ startupId }: FileManagerProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState("pitch-deck");
  
  const { data, isLoading, isError, error } = useQuery<AttachmentsResponse, Error>({
    queryKey: [`/api/startups/${startupId}/attachments`],
    queryFn: async () => {
      try {
        console.log(`Buscando anexos para startup: ${startupId}`);
        return await apiRequest("GET", `/api/startups/${startupId}/attachments`);
      } catch (err) {
        console.error('Erro ao buscar anexos:', err);
        throw err;
      }
    }
  });
  
  const deletePitchDeckMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/startups/${startupId}/pitch-deck`);
    },
    onSuccess: () => {
      toast({
        title: "PitchDeck excluído",
        description: "O arquivo foi removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/startups/${startupId}/attachments`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  const deleteAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      await apiRequest("DELETE", `/api/startups/attachments/${attachmentId}`);
    },
    onSuccess: () => {
      toast({
        title: "Anexo excluído",
        description: "O arquivo foi removido com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/startups/${startupId}/attachments`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Formatador de tamanho de arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };
  
  const getFileIcon = (mimetype: string) => {
    if (mimetype.includes('pdf')) return <FileText className="h-6 w-6 text-red-500" />;
    if (mimetype.includes('word') || mimetype.includes('document')) return <FileText className="h-6 w-6 text-blue-500" />;
    if (mimetype.includes('excel') || mimetype.includes('sheet')) return <FileText className="h-6 w-6 text-green-500" />;
    if (mimetype.includes('powerpoint') || mimetype.includes('presentation')) return <FileText className="h-6 w-6 text-orange-500" />;
    if (mimetype.includes('image')) return <Image className="h-6 w-6 text-purple-500" />;
    if (mimetype.includes('zip') || mimetype.includes('compressed')) return <Archive className="h-6 w-6 text-gray-500" />;
    return <File className="h-6 w-6 text-gray-400" />;
  };
  
  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/startups/${startupId}/attachments`] });
  };

  if (isLoading) {
    return <div className="p-8 text-center">Carregando arquivos...</div>;
  }

  if (isError) {
    return (
      <div className="p-8 text-center text-destructive">
        Erro ao carregar arquivos: {error.message}
      </div>
    );
  }

  return (
    <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
      <TabsList className="grid grid-cols-2 mb-4">
        <TabsTrigger value="pitch-deck">PitchDeck</TabsTrigger>
        <TabsTrigger value="attachments">Outros Anexos</TabsTrigger>
      </TabsList>
      
      {/* Tab de PitchDeck */}
      <TabsContent value="pitch-deck">
        <Card>
          <CardHeader>
            <CardTitle>PitchDeck da Startup</CardTitle>
            <CardDescription>
              Faça upload da apresentação principal da startup. Apenas um arquivo é permitido.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data?.pitchDeck ? (
              <div className="border rounded-md p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getFileIcon(data.pitchDeck.mimetype)}
                    <div>
                      <div className="font-medium truncate max-w-[300px]">
                        {data.pitchDeck.original_name}
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(data.pitchDeck.size)}
                        </Badge>
                        <span>
                          Enviado em {format(new Date(data.pitchDeck.created_at), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => data.pitchDeck && window.open(data.pitchDeck.path, '_blank')}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Baixar
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir PitchDeck</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir o PitchDeck? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deletePitchDeckMutation.mutate()}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            ) : (
              <FileUpload
                endpoint={`/api/startups/${startupId}/pitch-deck`}
                onUploadComplete={handleUploadComplete}
                accept=".pdf,.ppt,.pptx,.doc,.docx"
                maxSize={15 * 1024 * 1024} // 15MB
                buttonText="Escolher arquivo para PitchDeck"
              />
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      {/* Tab de Outros Anexos */}
      <TabsContent value="attachments">
        <Card>
          <CardHeader>
            <CardTitle>Anexos da Startup</CardTitle>
            <CardDescription>
              Gerencie documentos e arquivos adicionais relacionados à startup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <FileUpload
                endpoint={`/api/startups/${startupId}/attachments`}
                onUploadComplete={handleUploadComplete}
                buttonText="Adicionar novo anexo"
                additionalData={{ 
                  document_type: "Documento",
                  description: "Anexo da startup"
                }}
              />
            </div>
            
            <div className="space-y-4 mt-8">
              <h3 className="text-sm font-semibold text-muted-foreground">Anexos existentes</h3>
              
              {data?.attachments && data.attachments.length > 0 ? (
                <div className="grid gap-3">
                  {data.attachments.map((attachment) => (
                    <div key={attachment.id} className="border rounded-md p-3 bg-muted/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getFileIcon(attachment.mimetype)}
                          <div>
                            <div className="font-medium truncate max-w-[250px]">
                              {attachment.original_name}
                            </div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {formatFileSize(attachment.size)}
                              </Badge>
                              <span>
                                {format(new Date(attachment.created_at), 'dd/MM/yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => window.open(attachment.path, '_blank')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                          
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="h-4 w-4 mr-1" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir Anexo</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir este anexo? Esta ação não pode ser desfeita.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed rounded-md">
                  <FileX className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Nenhum anexo encontrado
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}