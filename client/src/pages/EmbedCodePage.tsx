import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Copy, Eye } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

// Adiciona a definição do tipo StartupFormEmbed ao objeto window
declare global {
  interface Window {
    StartupFormEmbed?: {
      createForm: (containerId: string, options: any) => void;
    };
  }
}

export default function EmbedCodePage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const previewRef = useRef<HTMLDivElement>(null);
  
  const [, setLocation] = useLocation();
  
  // Se o usuário não estiver autenticado, redirecionar para a página de autenticação
  if (!user) {
    setLocation("/auth");
    return null;
  }

  useEffect(() => {
    // Definir a URL base (ajuste conforme necessário para produção)
    setBaseUrl(window.location.origin);
  }, []);
  
  // Código de exemplo para incorporação do formulário
  const scriptCode = `<script src="${baseUrl}/embed.js"></script>`;
  
  const htmlCode = `<!-- Div onde o formulário será incorporado -->
<div id="startup-form-container"></div>

<!-- Script para carregar o formulário -->
<script src="${baseUrl}/embed.js"></script>
<script>
  document.addEventListener('DOMContentLoaded', function() {
    // Inicializar o formulário de startups
    StartupFormEmbed.createForm('startup-form-container', {
      baseUrl: '${baseUrl}',
      // Estilos personalizados (opcional)
      styles: {
        maxWidth: '100%',
        height: '800px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
      },
      // Callback após o envio do formulário (opcional)
      onSubmit: function(result) {
        console.log('Formulário enviado com sucesso!', result);
        // Você pode adicionar código personalizado aqui
      }
    });
  });
</script>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(type);
      toast({
        title: "Código copiado!",
        description: "O código foi copiado para a área de transferência.",
      });
      
      // Limpar o estado de cópia após 2 segundos
      setTimeout(() => setCopied(null), 2000);
    }).catch(err => {
      console.error('Erro ao copiar: ', err);
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o código.",
        variant: "destructive",
      });
    });
  };

  // Função para prévia do formulário
  const initializePreview = () => {
    if (previewRef.current && window.StartupFormEmbed) {
      // Limpar qualquer conteúdo anterior
      previewRef.current.innerHTML = '';
      
      // Criar o formulário
      window.StartupFormEmbed.createForm('embed-preview', {
        baseUrl: baseUrl,
        styles: {
          maxWidth: '100%',
          height: '600px'
        }
      });
    }
  };

  return (
    <div className="container py-10">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="text-2xl">Código de Incorporação do Formulário</CardTitle>
          <CardDescription>
            Use este código para incorporar o formulário de cadastro de startups em seu site.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="html" className="space-y-4">
            <TabsList>
              <TabsTrigger value="html">Código HTML Completo</TabsTrigger>
              <TabsTrigger value="script">Apenas Script</TabsTrigger>
              <TabsTrigger value="preview">Pré-visualização</TabsTrigger>
            </TabsList>
            
            <TabsContent value="html" className="space-y-4">
              <div className="relative">
                <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-sm">
                  <code>{htmlCode}</code>
                </pre>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(htmlCode, 'html')}
                >
                  <Copy className={`h-4 w-4 ${copied === 'html' ? 'text-green-500' : ''}`} />
                </Button>
              </div>
              
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200 text-amber-800">
                <h3 className="font-medium mb-2">Instruções:</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Copie o código HTML acima.</li>
                  <li>Cole-o em qualquer página do seu site onde deseja exibir o formulário.</li>
                  <li>Certifique-se de que o ID do container ("startup-form-container") seja único na página.</li>
                  <li>Você pode personalizar os estilos conforme necessário.</li>
                </ol>
              </div>
            </TabsContent>
            
            <TabsContent value="script" className="space-y-4">
              <div className="relative">
                <pre className="bg-secondary p-4 rounded-md overflow-x-auto text-sm">
                  <code>{scriptCode}</code>
                </pre>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="absolute top-2 right-2"
                  onClick={() => copyToClipboard(scriptCode, 'script')}
                >
                  <Copy className={`h-4 w-4 ${copied === 'script' ? 'text-green-500' : ''}`} />
                </Button>
              </div>
              
              <div className="rounded-md bg-amber-50 p-4 border border-amber-200 text-amber-800">
                <h3 className="font-medium mb-2">Instruções para instalação manual:</h3>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Adicione o script ao cabeçalho (head) do seu HTML.</li>
                  <li>Crie um elemento div com um ID único: <code>&lt;div id="seu-container-id"&gt;&lt;/div&gt;</code></li>
                  <li>Inicialize o formulário com JavaScript:
                    <pre className="bg-amber-100 p-2 mt-1 rounded text-xs overflow-x-auto">
                      {`StartupFormEmbed.createForm('seu-container-id', { baseUrl: '${baseUrl}' });`}
                    </pre>
                  </li>
                </ol>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-4">
              <Button 
                variant="outline" 
                className="mb-4"
                onClick={initializePreview}
              >
                <Eye className="mr-2 h-4 w-4" />
                Carregar Prévia
              </Button>
              
              <div
                id="embed-preview"
                ref={previewRef}
                className="min-h-[400px] bg-gray-50 rounded-lg border flex items-center justify-center"
              >
                <p className="text-gray-500">Clique em "Carregar Prévia" para visualizar o formulário.</p>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}