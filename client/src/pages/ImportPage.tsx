import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X } from "lucide-react";

interface ImportResult {
  success: boolean;
  message: string;
  imported_count?: number;
  total_rows?: number;
  errors?: string[];
  column_mapping?: Record<string, string>;
}

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (validExtensions.includes(fileExtension)) {
        setSelectedFile(file);
        setImportResult(null);
      } else {
        toast({
          title: "Formato inválido",
          description: "Apenas arquivos Excel (.xlsx, .xls) e CSV são aceitos.",
          variant: "destructive",
        });
        event.target.value = '';
      }
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/import/template');
      
      if (!response.ok) {
        throw new Error('Erro ao baixar template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template_startups.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Template baixado",
        description: "Use este arquivo como modelo para importar suas startups.",
      });
    } catch (error) {
      toast({
        title: "Erro ao baixar template",
        description: "Não foi possível baixar o arquivo de template.",
        variant: "destructive",
      });
    }
  };

  const uploadFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('import_file', selectedFile);

      // Simular progresso
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      const response = await fetch('/api/import/startups', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.success) {
        toast({
          title: "Importação concluída",
          description: result.message,
        });
        setSelectedFile(null);
        // Reset input file
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        toast({
          title: "Erro na importação",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro no upload",
        description: "Erro interno do servidor. Tente novamente.",
        variant: "destructive",
      });
      setImportResult({
        success: false,
        message: "Erro interno do servidor. Tente novamente."
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const clearResult = () => {
    setImportResult(null);
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importação de Startups</h1>
        <p className="text-muted-foreground">
          Importe dados de startups em lote através de arquivos Excel ou CSV
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Card de Template */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Template de Importação
            </CardTitle>
            <CardDescription>
              Baixe o template com os campos necessários e exemplos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>O template contém:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Campos obrigatórios e opcionais</li>
                  <li>Formato correto dos dados</li>
                  <li>Exemplo de preenchimento</li>
                </ul>
              </div>
              <Button onClick={downloadTemplate} className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card de Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Envie seu arquivo Excel (.xlsx, .xls) ou CSV
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file-input">Selecionar Arquivo</Label>
                <Input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Arquivo selecionado: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Processando arquivo...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button 
                onClick={uploadFile} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Processando...
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Importar Startups
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resultado da Importação */}
      {importResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                {importResult.success ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                Resultado da Importação
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={clearResult}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription>
              Detalhes do processo de importação
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert variant={importResult.success ? "default" : "destructive"}>
                <AlertDescription>
                  {importResult.message}
                </AlertDescription>
              </Alert>

              {importResult.success && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Estatísticas</Label>
                    <div className="text-sm space-y-1">
                      <p>Startups importadas: <span className="font-semibold">{importResult.imported_count}</span></p>
                      <p>Total de linhas processadas: <span className="font-semibold">{importResult.total_rows}</span></p>
                    </div>
                  </div>

                  {importResult.column_mapping && (
                    <div className="space-y-2">
                      <Label>Mapeamento de Colunas</Label>
                      <div className="text-sm space-y-1 max-h-32 overflow-y-auto">
                        {Object.entries(importResult.column_mapping).map(([original, mapped]) => (
                          <p key={original} className="flex justify-between">
                            <span className="text-muted-foreground">{original}</span>
                            <span className="font-medium">{mapped}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <Label>Erros Encontrados</Label>
                  <div className="text-sm space-y-1 max-h-32 overflow-y-auto bg-red-50 p-3 rounded">
                    {importResult.errors.map((error, index) => (
                      <p key={index} className="text-red-700">{error}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Instruções de Uso</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Prepare seus dados</h4>
              <p className="text-muted-foreground">
                Baixe o template e preencha com os dados das startups. Os campos obrigatórios são:
                Nome da Startup, Nome do CEO e Email do CEO.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Formatos aceitos</h4>
              <p className="text-muted-foreground">
                Arquivos Excel (.xlsx, .xls) e CSV são aceitos. Para CSV, use ponto e vírgula (;) como separador.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Mapeamento automático</h4>
              <p className="text-muted-foreground">
                O sistema reconhece automaticamente variações nos nomes das colunas (ex: "nome", "startup", "empresa" 
                são mapeados para o campo Nome da Startup).
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">4. Status das startups</h4>
              <p className="text-muted-foreground">
                Todas as startups importadas receberão automaticamente o status "Cadastrada" e aparecerão no kanban board.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}