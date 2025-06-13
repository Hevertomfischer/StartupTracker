import { useCallback } from "react";
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
import { usePersistentImportState } from "@/hooks/use-persistent-import-state";
import { 
  Upload, 
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

export default function ImportPage() {
  const { state, updateState, resetState, componentId } = usePersistentImportState();
  const { toast } = useToast();

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (validExtensions.includes(fileExtension)) {
        console.log('Arquivo selecionado:', file.name);
        updateState({
          selectedFile: file,
          fileAnalysis: null,
          columnMapping: {},
          importResult: null,
          currentStep: 'upload'
        });
      } else {
        toast({
          title: "Formato inválido",
          description: "Apenas arquivos Excel (.xlsx, .xls) e CSV são aceitos.",
          variant: "destructive",
        });
        event.target.value = '';
      }
    }
  }, [updateState, toast]);

  const analyzeFile = useCallback(async () => {
    if (!state.selectedFile) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo antes de analisar.",
        variant: "destructive",
      });
      return;
    }

    console.log('Iniciando análise do arquivo:', state.selectedFile.name);
    updateState({ isAnalyzing: true });

    try {
      const formData = new FormData();
      formData.append('import_file', state.selectedFile);

      console.log('Enviando requisição para /api/import/analyze');
      const response = await fetch('/api/import/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: any = await response.json();
      console.log('Análise recebida do servidor:', result);

      if (result.success && result.headers && result.headers.length > 0) {
        console.log('=== Definindo análise do arquivo ===', result);
        
        // Preparar mapeamento inicial
        const initialMapping: Record<string, string> = {};
        result.headers.forEach((header: string) => {
          initialMapping[header] = '';
        });

        // Atualizar todos os estados de uma vez
        updateState({
          fileAnalysis: result,
          columnMapping: initialMapping,
          currentStep: 'mapping',
          isAnalyzing: false
        });

        toast({
          title: "Arquivo analisado com sucesso",
          description: `${result.headers.length} colunas detectadas em ${result.total_rows} linhas.`,
        });
      } else {
        throw new Error(result.message || "Resultado de análise inválido");
      }
    } catch (error) {
      console.error('Erro na análise:', error);
      toast({
        title: "Erro na análise",
        description: error instanceof Error ? error.message : "Erro interno do servidor",
        variant: "destructive",
      });
      updateState({
        fileAnalysis: null,
        columnMapping: {},
        isAnalyzing: false
      });
    }
  }, [state.selectedFile, updateState, toast]);

  const updateColumnMapping = useCallback((fileColumn: string, dbField: string) => {
    updateState({
      columnMapping: { ...state.columnMapping, [fileColumn]: dbField }
    });
  }, [state.columnMapping, updateState]);

  const validateMapping = useCallback((): boolean => {
    if (!state.fileAnalysis) return false;
    
    const mappedFields = Object.values(state.columnMapping).filter(field => field !== '');
    const requiredFields = Object.entries(state.fileAnalysis.available_fields)
      .filter(([_, config]: [string, any]) => config.required)
      .map(([field, _]) => field);
    
    const missingRequired = requiredFields.filter(field => !mappedFields.includes(field));
    
    if (missingRequired.length > 0) {
      const missingLabels = missingRequired.map(field => 
        state.fileAnalysis!.available_fields[field]?.label || field
      ).join(', ');
      
      toast({
        title: "Mapeamento incompleto",
        description: `Campos obrigatórios não mapeados: ${missingLabels}`,
        variant: "destructive",
      });
      return false;
    }

    return true;
  }, [state.fileAnalysis, state.columnMapping, toast]);

  const processImport = useCallback(async () => {
    if (!state.selectedFile || !state.fileAnalysis || !validateMapping()) {
      return;
    }

    updateState({ isImporting: true, currentStep: 'processing' });

    try {
      const formData = new FormData();
      formData.append('import_file', state.selectedFile);
      formData.append('columnMapping', JSON.stringify(state.columnMapping));
      formData.append('filename', state.fileAnalysis.filename);

      const response = await fetch('/api/import/startups', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      updateState({
        importResult: result,
        currentStep: 'results',
        isImporting: false
      });

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
      const errorResult = {
        success: false,
        message: "Erro interno do servidor. Tente novamente.",
        imported_count: 0,
        total_rows: 0,
        errors: [{ row: -1, field: 'system', value: '', error: 'Erro interno do servidor' }],
        warnings: []
      };
      
      updateState({
        importResult: errorResult,
        currentStep: 'results',
        isImporting: false
      });
      
      toast({
        title: "Erro na importação",
        description: "Erro interno do servidor. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [state.selectedFile, state.fileAnalysis, state.columnMapping, validateMapping, updateState, toast]);

  const downloadErrorReport = useCallback(async () => {
    if (!state.importResult || state.importResult.errors.length === 0) return;

    try {
      const response = await fetch('/api/import/error-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ errors: state.importResult.errors }),
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
  }, [state.importResult, toast]);

  const resetProcess = useCallback(() => {
    console.log('=== Resetando processo de importação ===');
    resetState();
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }, [resetState]);

  const goBackToMapping = useCallback(() => {
    updateState({ currentStep: 'mapping', importResult: null });
  }, [updateState]);

  // Indicador de progresso
  const StepIndicator = () => {
    const getStepNumber = (step: string): number => {
      switch (step) {
        case 'upload': return 1;
        case 'mapping': return 2;
        case 'processing':
        case 'results': return 3;
        default: return 1;
      }
    };

    const currentStepNumber = getStepNumber(state.currentStep);

    return (
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStepNumber >= 1 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            1
          </div>
          <div className="mx-2 text-xs font-medium text-gray-600">Upload</div>
          <div className={`w-12 h-0.5 ${currentStepNumber >= 2 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStepNumber >= 2 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            2
          </div>
          <div className="mx-2 text-xs font-medium text-gray-600">Mapeamento</div>
          <div className={`w-12 h-0.5 ${currentStepNumber >= 3 ? 'bg-blue-500' : 'bg-gray-200'}`}></div>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            currentStepNumber >= 3 ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            3
          </div>
          <div className="mx-2 text-xs font-medium text-gray-600">Importação</div>
        </div>
      </div>
    );
  };

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Importação de Startups</h1>
        <p className="text-muted-foreground">
          Importe dados de startups em lote através de arquivos Excel ou CSV
        </p>
      </div>

      <StepIndicator />

      {/* Debug Info */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="p-4">
          <div className="text-sm">
            <strong>Debug ({componentId}):</strong> Step={state.currentStep}, File={state.selectedFile?.name || 'null'}, 
            Analysis={state.fileAnalysis ? 'present' : 'null'}, 
            Headers={state.fileAnalysis?.headers?.length || 0}
          </div>
        </CardContent>
      </Card>

      {/* Etapa 1: Upload de Arquivo */}
      {state.currentStep === 'upload' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Arquivo
            </CardTitle>
            <CardDescription>
              Envie seu arquivo Excel (.xlsx, .xls) ou CSV com os dados das startups
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
                  disabled={state.isAnalyzing}
                />
                {state.selectedFile && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Arquivo: {state.selectedFile.name} ({Math.round(state.selectedFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              <Button 
                onClick={analyzeFile} 
                disabled={!state.selectedFile || state.isAnalyzing}
                className="w-full"
              >
                {state.isAnalyzing ? (
                  <>
                    <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Analisando arquivo...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Analisar e Próximo
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 2: Mapeamento de Colunas */}
      {state.currentStep === 'mapping' && state.fileAnalysis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Mapeamento de Colunas
            </CardTitle>
            <CardDescription>
              Configure como as colunas do arquivo serão mapeadas para os campos do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>{state.fileAnalysis.filename}</strong> - {state.fileAnalysis.total_rows} linhas detectadas.
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
                    {state.fileAnalysis.headers.map((header: string) => (
                      <TableRow key={header}>
                        <TableCell className="font-medium">{header}</TableCell>
                        <TableCell>
                          <Select
                            value={state.columnMapping[header] || ''}
                            onValueChange={(value) => updateColumnMapping(header, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecionar campo..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">-- Não mapear --</SelectItem>
                              {Object.entries(state.fileAnalysis.available_fields).map(([field, config]: [string, any]) => (
                                <SelectItem key={field} value={field}>
                                  <div className="flex items-center gap-2">
                                    {config.label}
                                    {config.required && (
                                      <Badge variant="destructive" className="h-4 text-xs">*</Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm text-muted-foreground truncate">
                            {state.fileAnalysis.preview[0]?.[header] || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <div className="flex justify-between">
                <Button variant="outline" onClick={resetProcess}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Recomeçar
                </Button>
                <Button onClick={processImport}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Importar Dados
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 3: Processamento */}
      {state.currentStep === 'processing' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full" />
              Importando Dados
            </CardTitle>
            <CardDescription>
              Processando e validando os dados das startups...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center p-8">
              <div className="text-center">
                <div className="animate-spin mx-auto mb-4 h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                <p className="text-muted-foreground">
                  Importando dados, por favor aguarde...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Etapa 4: Resultados */}
      {state.currentStep === 'results' && state.importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {state.importResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              Resultado da Importação
            </CardTitle>
            <CardDescription>
              {state.importResult.message}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {state.importResult.imported_count}
                  </div>
                  <div className="text-sm text-muted-foreground">Importadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {state.importResult.total_rows}
                  </div>
                  <div className="text-sm text-muted-foreground">Total de Linhas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {state.importResult.errors.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Erros</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {state.importResult.warnings.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Avisos</div>
                </div>
              </div>

              {state.importResult.errors.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Erros Encontrados
                  </h4>
                  <ScrollArea className="h-32 border rounded p-2">
                    {state.importResult.errors.slice(0, 10).map((error: any, index: number) => (
                      <div key={index} className="text-sm mb-1">
                        <span className="font-medium">Linha {error.row}:</span> {error.error}
                      </div>
                    ))}
                    {state.importResult.errors.length > 10 && (
                      <div className="text-sm text-muted-foreground">
                        ... e mais {state.importResult.errors.length - 10} erros
                      </div>
                    )}
                  </ScrollArea>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={downloadErrorReport}
                  >
                    <FileDown className="h-4 w-4 mr-2" />
                    Baixar Relatório de Erros
                  </Button>
                </div>
              )}

              {state.importResult.warnings.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Avisos
                  </h4>
                  <ScrollArea className="h-32 border rounded p-2">
                    {state.importResult.warnings.slice(0, 10).map((warning: any, index: number) => (
                      <div key={index} className="text-sm mb-1">
                        <span className="font-medium">Linha {warning.row}:</span> {warning.warning}
                      </div>
                    ))}
                    {state.importResult.warnings.length > 10 && (
                      <div className="text-sm text-muted-foreground">
                        ... e mais {state.importResult.warnings.length - 10} avisos
                      </div>
                    )}
                  </ScrollArea>
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" onClick={goBackToMapping}>
                  Voltar ao Mapeamento
                </Button>
                <Button onClick={resetProcess}>
                  <Upload className="h-4 w-4 mr-2" />
                  Nova Importação
                </Button>
              </div>
            </div>
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
                O sistema analisará automaticamente a estrutura do arquivo.
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
              <h4 className="font-semibold mb-2">3. Importação</h4>
              <p className="text-muted-foreground">
                Revise o mapeamento e confirme a importação. 
                O sistema validará os dados e criará as startups.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}