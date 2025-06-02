import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, ArrowRight, RotateCcw } from "lucide-react";

interface FileAnalysis {
  success: boolean;
  headers: string[];
  preview: any[];
  total_rows: number;
  filename: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  imported_count?: number;
  total_rows?: number;
  errors?: string[];
  column_mapping?: Record<string, string>;
}

// Campos disponíveis para mapeamento
const availableFields = [
  { value: '', label: '-- Não mapear --' },
  { value: 'name', label: 'Nome da Startup *' },
  { value: 'ceo_name', label: 'Nome do CEO *' },
  { value: 'ceo_email', label: 'Email do CEO *' },
  { value: 'ceo_whatsapp', label: 'WhatsApp do CEO' },
  { value: 'business_model', label: 'Modelo de Negócio' },
  { value: 'problem_solution', label: 'Problema/Solução' },
  { value: 'differentials', label: 'Diferenciais' },
  { value: 'sector', label: 'Setor' },
  { value: 'employee_count', label: 'Número de Funcionários' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'website', label: 'Website' },
  { value: 'investment_stage', label: 'Estágio de Investimento' },
  { value: 'mrr', label: 'MRR (R$)' },
  { value: 'tam', label: 'TAM (R$)' },
  { value: 'sam', label: 'SAM (R$)' },
  { value: 'som', label: 'SOM (R$)' },
  { value: 'description', label: 'Descrição' },
];

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [fileAnalysis, setFileAnalysis] = useState<FileAnalysis | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

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
        setFileAnalysis(result);
        
        // Inicializar mapeamento vazio
        const initialMapping: Record<string, string> = {};
        result.headers.forEach(header => {
          initialMapping[header] = '';
        });
        setColumnMapping(initialMapping);

        toast({
          title: "Arquivo analisado",
          description: `${result.headers.length} colunas detectadas em ${result.total_rows} linhas.`,
        });
      } else {
        toast({
          title: "Erro na análise",
          description: "Erro ao analisar arquivo",
          variant: "destructive",
        });
      }
    } catch (error) {
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
    const mappedFields = Object.values(columnMapping).filter(field => field !== '');
    const requiredFields = ['name', 'ceo_name', 'ceo_email'];
    
    for (const required of requiredFields) {
      if (!mappedFields.includes(required)) {
        toast({
          title: "Mapeamento incompleto",
          description: `O campo obrigatório "${availableFields.find(f => f.value === required)?.label}" deve ser mapeado.`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const processImport = async () => {
    if (!selectedFile || !fileAnalysis) {
      return;
    }

    if (!validateMapping()) {
      return;
    }

    setIsImporting(true);

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
        
        // Limpar formulário após sucesso
        setSelectedFile(null);
        setFileAnalysis(null);
        setColumnMapping({});
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
        title: "Erro na importação",
        description: "Erro interno do servidor. Tente novamente.",
        variant: "destructive",
      });
      setImportResult({
        success: false,
        message: "Erro interno do servidor. Tente novamente."
      });
    } finally {
      setIsImporting(false);
    }
  };

  const resetProcess = () => {
    setSelectedFile(null);
    setFileAnalysis(null);
    setColumnMapping({});
    setImportResult(null);
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

      {/* Etapa 1: Upload e Template */}
      {!fileAnalysis && (
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
                    disabled={isAnalyzing}
                  />
                  {selectedFile && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Arquivo selecionado: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
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
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Analisar Arquivo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Etapa 2: Mapeamento de Colunas */}
      {fileAnalysis && !importResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5" />
                  Mapeamento de Colunas
                </CardTitle>
                <CardDescription>
                  Configure como as colunas do arquivo serão mapeadas para os campos da startup
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
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Arquivo: <strong>{fileAnalysis.filename}</strong> - {fileAnalysis.total_rows} linhas detectadas.
                  Os campos marcados com * são obrigatórios.
                </AlertDescription>
              </Alert>

              <div className="overflow-x-auto">
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
                              {availableFields.map((field) => (
                                <SelectItem key={field.value} value={field.value}>
                                  {field.label}
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
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetProcess}>
                  Cancelar
                </Button>
                <Button 
                  onClick={processImport} 
                  disabled={isImporting}
                  className="min-w-32"
                >
                  {isImporting ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Startups
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

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

              <div className="flex justify-end">
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
              <h4 className="font-semibold mb-2">2. Análise do arquivo</h4>
              <p className="text-muted-foreground">
                Envie seu arquivo (Excel ou CSV) para análise. O sistema detectará automaticamente as colunas disponíveis.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-2">3. Mapeamento manual</h4>
              <p className="text-muted-foreground">
                Configure manualmente como cada coluna do seu arquivo será mapeada para os campos da startup.
                Você tem controle total sobre quais colunas usar.
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