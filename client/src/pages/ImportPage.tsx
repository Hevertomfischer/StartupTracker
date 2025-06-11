
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ArrowRight, 
  RotateCcw,
  AlertTriangle,
  Info,
  FileDown
} from "lucide-react";

interface FileAnalysis {
  success: boolean;
  headers: string[];
  preview: any[];
  total_rows: number;
  filename: string;
  available_fields: Record<string, { label: string; required: boolean; type: string }>;
  message?: string;
}

interface ImportError {
  row: number;
  field: string;
  value: any;
  error: string;
}

interface ImportWarning {
  row: number;
  field: string;
  value: any;
  warning: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported_count: number;
  total_rows: number;
  errors: ImportError[];
  warnings: ImportWarning[];
}

export default function ImportPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Debug logs para rastrear o estado
  console.log('ImportPage renderizado - currentStep:', currentStep, 'fileAnalysis:', !!fileAnalysis);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (validExtensions.includes(fileExtension)) {
        setSelectedFile(file);
        setFileAnalysis(null);
        setColumnMapping({});
        setImportResult(null);
        setCurrentStep(1);
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

  const analyzeFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo antes de analisar.",
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('import_file', selectedFile);

      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        body: formData,
      });

      const result: FileAnalysis = await response.json();

      if (result.success) {
        console.log('Análise bem-sucedida, configurando estado para mapeamento:', result);
        setFileAnalysis(result);
        
        // Inicializar mapeamento vazio
        const initialMapping: Record<string, string> = {};
        result.headers.forEach(header => {
          initialMapping[header] = '';
        });
        setColumnMapping(initialMapping);
        
        console.log('Alterando currentStep para 2');
        setCurrentStep(2);

        toast({
          title: "Arquivo analisado",
          description: `${result.headers.length} colunas detectadas em ${result.total_rows} linhas.`,
        });
      } else {
        toast({
          title: "Erro na análise",
          description: result.message || "Erro ao analisar arquivo",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na análise",
        description: "Erro interno do servidor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const updateColumnMapping = (fileColumn: string, dbField: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [fileColumn]: dbField
    }));
  };

  const validateMapping = (): boolean => {
    if (!fileAnalysis) return false;
    
    const mappedFields = Object.values(columnMapping).filter(field => field !== '');
    const requiredFields = Object.entries(fileAnalysis.available_fields)
      .filter(([_, config]) => config.required)
      .map(([field, _]) => field);
    
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      const missingLabels = missingRequired.map(field => 
        fileAnalysis.available_fields[field]?.label || field
      ).join(', ');
      
      toast({
        title: "Mapeamento incompleto",
        description: `Os campos obrigatórios não mapeados: ${missingLabels}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  };

  const processImport = async () => {
    if (!selectedFile || !fileAnalysis || !validateMapping()) {
      return;
    }

    setIsImporting(true);
    setCurrentStep(3);

    try {
      const formData = new FormData();
      formData.append('import_file', selectedFile);
      formData.append('columnMapping', JSON.stringify(columnMapping));
      formData.append('filename', fileAnalysis.filename);

      const response = await fetch('/api/import/startups', {
        method: 'POST',
        body: formData,
      });

      const result: ImportResult = await response.json();
      setImportResult(result);

      if (result.success) {
        toast({
          title: "Importação concluída",
          description: result.message,
        });
      } else {
        toast({
          title: "Importação com erros",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro na importação:', error);
      const errorResult: ImportResult = {
        success: false,
        message: "Erro interno do servidor. Tente novamente.",
        imported_count: 0,
        total_rows: 0,
        errors: [{ row: -1, field: 'system', value: '', error: 'Erro interno do servidor' }],
        warnings: []
      };
      setImportResult(errorResult);
      
      toast({
        title: "Erro na importação",
        description: "Erro interno do servidor. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadErrorReport = async () => {
    if (!importResult || importResult.errors.length === 0) return;

    try {
      const response = await fetch('/api/import/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ errors: importResult.errors }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'relatorio_erros_importacao.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Relatório baixado",
          description: "Relatório de erros baixado com sucesso.",
        });
      } else {
        throw new Error('Erro ao baixar relatório');
      }
    } catch (error) {
      toast({
        title: "Erro ao baixar relatório",
        description: "Não foi possível baixar o relatório de erros.",
        variant: "destructive",
      });
    }
  };

  const resetProcess = () => {
    setSelectedFile(null);
    setFileAnalysis(null);
    setColumnMapping({});
    setImportResult(null);
    setCurrentStep(1);
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
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

  // Indicador de progresso
  const StepIndicator = () => (
    <div className="flex items-center justify-center mb-8">
      <div className="flex items-center">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          1
        </div>
        <div className="mx-2 text-xs font-medium text-gray-600">Upload</div>
        <div className={`w-12 h-0.5 ${currentStep >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
        
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          2
        </div>
        <div className="mx-2 text-xs font-medium text-gray-600">Mapeamento</div>
        <div className={`w-12 h-0.5 ${currentStep >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
        
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          currentStep >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
        }`}>
          3
        </div>
        <div className="mx-2 text-xs font-medium text-gray-600">Importação</div>
      </div>
    </div>
  );

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importação de Startups</h1>
        <p className="text-muted-foreground">
          Importe dados de startups em lote através de arquivos Excel ou CSV
        </p>
      </div>

      <StepIndicator />

      {/* Etapa 1: Upload de Arquivo */}
      {currentStep === 1 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Template de Exemplo (Opcional)
              </CardTitle>
              <CardDescription>
                Baixe um template com exemplo de formato
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={downloadTemplate} className="w-full" variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Baixar Template
              </Button>
            </CardContent>
          </Card>

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
                    disabled={isAnalyzing}
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Arquivo: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                    </p>
                  )}
                </div>

                <Button 
                  onClick={analyzeFile} 
                  disabled={!selectedFile || isAnalyzing}
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Próximo: Mapeamento de Colunas
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Etapa 2: Mapeamento de Colunas */}
      {(() => {
        console.log('Verificando condições da Etapa 2:', { currentStep, hasFileAnalysis: !!fileAnalysis });
        return currentStep === 2 && fileAnalysis;
      })() && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Mapeamento de Colunas
                </CardTitle>
                <CardDescription>
                  Configure como as colunas serão mapeadas para os campos da startup
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetProcess}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Recomeçar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{fileAnalysis.filename}</strong> - {fileAnalysis.total_rows} linhas detectadas.
                  Campos marcados com <Badge variant="destructive" className="mx-1">*</Badge> são obrigatórios.
                </AlertDescription>
              </Alert>

              <ScrollArea className="h-96">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coluna do Arquivo</TableHead>
                      <TableHead>Mapear para Campo</TableHead>
                      <TableHead>Preview dos Dados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fileAnalysis.headers.map((header) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={columnMapping[header] || ''}
                            onValueChange={(value) => updateColumnMapping(header, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar campo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-- Não mapear --</SelectItem>
                              {Object.entries(fileAnalysis.available_fields).map(([field, config]) => (
                                <SelectItem key={field} value={field}>
                                  <div className="flex items-center gap-2">
                                    {config.label}
                                    {config.required && (
                                      <Badge variant="destructive" className="text-xs">*</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {fileAnalysis.preview[0]?.[header] && (
                            <div className="max-w-48 truncate">
                              {String(fileAnalysis.preview[0][header])}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Voltar
                </Button>
                <Button onClick={processImport}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Próximo: Importar Dados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 3: Resultado da Importação */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isImporting ? (
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              ) : importResult?.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              {isImporting ? 'Processando Importação...' : 'Resultado da Importação'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isImporting ? (
              <div className="text-center py-8">
                <div className="text-lg font-medium">Importando dados...</div>
                <div className="text-sm text-muted-foreground mt-2">
                  Por favor, aguarde enquanto processamos seu arquivo.
                </div>
              </div>
            ) : importResult && (
              <div className="space-y-6">
                <Alert variant={importResult.success ? "default" : "destructive"}>
                  <AlertDescription>{importResult.message}</AlertDescription>
                </Alert>

                {/* Estatísticas */}
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total Processadas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{importResult.total_rows}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-green-600">Importadas com Sucesso</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">{importResult.imported_count}</div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-red-600">Com Erro</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">{importResult.errors.length}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Erros */}
                {importResult.errors.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        Erros Encontrados ({importResult.errors.length})
                      </h3>
                      <Button onClick={downloadErrorReport} variant="outline" size="sm">
                        <FileDown className="h-4 w-4 mr-2" />
                        Baixar Relatório CSV
                      </Button>
                    </div>
                    
                    <ScrollArea className="h-48 border rounded">
                      <div className="p-4 space-y-2">
                        {importResult.errors.slice(0, 20).map((error, index) => (
                          <div key={index} className="text-sm p-2 bg-red-50 border border-red-200 rounded">
                            <span className="font-medium">Linha {error.row}:</span> {error.error}
                          </div>
                        ))}
                        {importResult.errors.length > 20 && (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            ... e mais {importResult.errors.length - 20} erros. Baixe o relatório completo.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                {/* Warnings */}
                {importResult.warnings && importResult.warnings.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                      Avisos ({importResult.warnings.length})
                    </h3>
                    
                    <ScrollArea className="h-32 border rounded">
                      <div className="p-4 space-y-2">
                        {importResult.warnings.slice(0, 10).map((warning, index) => (
                          <div key={index} className="text-sm p-2 bg-yellow-50 border border-yellow-200 rounded">
                            <span className="font-medium">Linha {warning.row}:</span> {warning.warning}
                          </div>
                        ))}
                        {importResult.warnings.length > 10 && (
                          <div className="text-sm text-muted-foreground text-center py-2">
                            ... e mais {importResult.warnings.length - 10} avisos.
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}

                <div className="flex justify-center">
                  <Button onClick={resetProcess}>
                    <Upload className="h-4 w-4 mr-2" />
                    Nova Importação
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Instruções */}
      <Card>
        <CardHeader>
          <CardTitle>Como Usar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div>
              <h4 className="font-semibold mb-2">1. Upload do Arquivo</h4>
              <p className="text-muted-foreground">
                Envie um arquivo Excel ou CSV com os dados das startups. 
                Não é necessário seguir um template específico.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">2. Mapeamento de Colunas</h4>
              <p className="text-muted-foreground">
                Associe cada coluna do seu arquivo aos campos correspondentes no sistema.
                Campos obrigatórios devem ser mapeados.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Validação e Importação</h4>
              <p className="text-muted-foreground">
                O sistema valida os dados e importa apenas registros válidos.
                Erros são relatados detalhadamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
