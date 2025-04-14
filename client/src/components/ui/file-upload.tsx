import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

interface FileUploadProps {
  endpoint: string;
  onUploadComplete?: (data: any) => void;
  onUploadError?: (error: Error) => void;
  accept?: string;
  maxSize?: number; // em bytes, ex: 5 * 1024 * 1024 para 5MB
  buttonText?: string;
  fieldName?: string;
  additionalData?: Record<string, string>;
}

export function FileUpload({
  endpoint,
  onUploadComplete,
  onUploadError,
  accept = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip",
  maxSize = 0, // 0 significa sem limite
  buttonText = "Escolher arquivo",
  fieldName = "file",
  additionalData = {},
}: FileUploadProps) {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append(fieldName, file);
      
      // Adicionar dados adicionais ao FormData
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Fazer upload com acompanhamento de progresso
      return new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(progress);
          }
        });
        
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (e) {
              reject(new Error("Erro ao processar resposta do servidor"));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              reject(new Error(errorResponse.message || "Erro no upload do arquivo"));
            } catch (e) {
              reject(new Error(`Erro no upload do arquivo: ${xhr.status}`));
            }
          }
        });
        
        xhr.addEventListener("error", () => {
          reject(new Error("Erro na conexão ao enviar arquivo"));
        });
        
        xhr.open("POST", endpoint);
        xhr.setRequestHeader("Accept", "application/json");
        xhr.withCredentials = true;
        xhr.send(formData);
      });
    },
    onSuccess: (data) => {
      setSelectedFile(null);
      setUploadProgress(0);
      toast({
        title: "Upload concluído",
        description: "Arquivo enviado com sucesso",
      });
      if (onUploadComplete) {
        onUploadComplete(data);
      }
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({
        title: "Erro no upload",
        description: error.message,
        variant: "destructive",
      });
      if (onUploadError) {
        onUploadError(error);
      }
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validar tamanho do arquivo apenas se houver um limite definido (maxSize > 0)
    if (maxSize > 0 && file.size > maxSize) {
      toast({
        title: "Arquivo muito grande",
        description: `O tamanho máximo permitido é ${formatFileSize(maxSize)}`,
        variant: "destructive",
      });
      return;
    }
    
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Formatador de tamanho de arquivo
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-2">
      <Input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      
      {selectedFile ? (
        <div className="border rounded-md p-4 bg-muted/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                {formatFileSize(selectedFile.size)}
              </Badge>
              <span className="text-sm font-medium truncate max-w-[200px]">
                {selectedFile.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearSelectedFile}
              disabled={uploadMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {uploadMutation.isPending ? (
            <div className="space-y-2">
              <Progress value={uploadProgress} className="h-1" />
              <div className="text-xs text-muted-foreground text-right">
                {uploadProgress}%
              </div>
            </div>
          ) : (
            <Button
              onClick={handleUpload}
              className="w-full"
              size="sm"
            >
              <Upload className="h-4 w-4 mr-2" />
              Enviar arquivo
            </Button>
          )}
        </div>
      ) : (
        <div className="border border-dashed rounded-md p-6 text-center">
          <Label 
            htmlFor="file-upload" 
            className="cursor-pointer flex flex-col items-center justify-center gap-2"
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm font-medium">{buttonText}</div>
            <div className="text-xs text-muted-foreground">
              {maxSize > 0 
                ? `Tamanho máximo: ${formatFileSize(maxSize)}` 
                : "Sem limite de tamanho"}
            </div>
          </Label>
        </div>
      )}
      
      {uploadMutation.isPending && (
        <div className="flex items-center justify-center text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin mr-1" />
          Enviando arquivo...
        </div>
      )}
    </div>
  );
}