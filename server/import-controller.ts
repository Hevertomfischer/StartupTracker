
import { Request, Response } from "express";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import multer from 'multer';
import { storage } from "./storage";

// Configuração do multer para upload de arquivos
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos Excel (.xlsx, .xls) e CSV são permitidos'));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  }
});

// Interface para resultado de validação
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Interface para resultado da importação
interface ImportResult {
  success: boolean;
  message: string;
  imported_count: number;
  total_rows: number;
  errors: Array<{
    row: number;
    field: string;
    value: any;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    value: any;
    warning: string;
  }>;
}

// Mapeamento de campos obrigatórios
const REQUIRED_FIELDS = ['name', 'ceo_name', 'ceo_email'];

// Campos disponíveis para mapeamento com seus tipos e validações
const AVAILABLE_FIELDS = {
  // Campos obrigatórios
  'name': { label: 'Nome da Startup', required: true, type: 'string' },
  'ceo_name': { label: 'Nome do CEO', required: true, type: 'string' },
  'ceo_email': { label: 'Email do CEO', required: true, type: 'email' },
  
  // Campos opcionais
  'description': { label: 'Descrição', required: false, type: 'string' },
  'website': { label: 'Website', required: false, type: 'url' },
  'sector': { label: 'Setor', required: false, type: 'string' },
  'business_model': { label: 'Modelo de Negócio', required: false, type: 'string' },
  'category': { label: 'Categoria', required: false, type: 'string' },
  'market': { label: 'Mercado', required: false, type: 'string' },
  'ceo_whatsapp': { label: 'WhatsApp do CEO', required: false, type: 'string' },
  'ceo_linkedin': { label: 'LinkedIn do CEO', required: false, type: 'url' },
  'city': { label: 'Cidade', required: false, type: 'string' },
  'state': { label: 'Estado', required: false, type: 'string' },
  'mrr': { label: 'MRR (R$)', required: false, type: 'number' },
  'client_count': { label: 'Quantidade de Clientes', required: false, type: 'number' },
  'accumulated_revenue_current_year': { label: 'Receita Acumulada Ano Atual', required: false, type: 'number' },
  'total_revenue_last_year': { label: 'Receita Total Ano Passado', required: false, type: 'number' },
  'total_revenue_previous_year': { label: 'Receita Total Ano Anterior', required: false, type: 'number' },
  'partner_count': { label: 'Quantidade de Sócios', required: false, type: 'number' },
  'tam': { label: 'TAM (R$)', required: false, type: 'number' },
  'sam': { label: 'SAM (R$)', required: false, type: 'number' },
  'som': { label: 'SOM (R$)', required: false, type: 'number' },
  'founding_date': { label: 'Data de Fundação', required: false, type: 'date' },
  'due_date': { label: 'Data de Vencimento', required: false, type: 'date' },
  'problem_solution': { label: 'Problema/Solução', required: false, type: 'string' },
  'problem_solved': { label: 'Problema Resolvido', required: false, type: 'string' },
  'differentials': { label: 'Diferenciais', required: false, type: 'string' },
  'competitors': { label: 'Concorrentes', required: false, type: 'string' },
  'positive_points': { label: 'Pontos Positivos', required: false, type: 'string' },
  'attention_points': { label: 'Pontos de Atenção', required: false, type: 'string' },
  'scangels_value_add': { label: 'Valor Agregado SCAngels', required: false, type: 'string' },
  'no_investment_reason': { label: 'Motivo Não Investimento', required: false, type: 'string' },
  'google_drive_link': { label: 'Link Google Drive', required: false, type: 'url' },
  'origin_lead': { label: 'Origem Lead', required: false, type: 'string' },
  'referred_by': { label: 'Indicado Por', required: false, type: 'string' },
  'priority': { label: 'Prioridade', required: false, type: 'string' },
  'observations': { label: 'Observações', required: false, type: 'string' }
};

function validateField(fieldName: string, value: any, rowIndex: number): ValidationResult {
  const result: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  if (!AVAILABLE_FIELDS[fieldName]) {
    return result;
  }
  
  const fieldConfig = AVAILABLE_FIELDS[fieldName];
  
  // Verificar se campo obrigatório está vazio
  if (fieldConfig.required && (!value || String(value).trim() === '')) {
    result.isValid = false;
    result.errors.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} é obrigatório`);
    return result;
  }
  
  // Se valor está vazio e não é obrigatório, não validar
  if (!value || String(value).trim() === '') {
    return result;
  }
  
  const strValue = String(value).trim();
  
  // Validações por tipo
  switch (fieldConfig.type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strValue)) {
        result.isValid = false;
        result.errors.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} deve ser um email válido`);
      }
      break;
      
    case 'url':
      try {
        new URL(strValue);
      } catch {
        if (!strValue.startsWith('http://') && !strValue.startsWith('https://')) {
          result.warnings.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} pode não ser uma URL válida (considere adicionar http:// ou https://)`);
        } else {
          result.errors.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} deve ser uma URL válida`);
          result.isValid = false;
        }
      }
      break;
      
    case 'number':
      const numValue = parseFloat(strValue.replace(/[^\d.,\-]/g, '').replace(',', '.'));
      if (isNaN(numValue)) {
        result.warnings.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} não é um número válido, será ignorado`);
      }
      break;
      
    case 'date':
      const dateValue = new Date(strValue);
      if (isNaN(dateValue.getTime())) {
        result.warnings.push(`Linha ${rowIndex + 2}: ${fieldConfig.label} não é uma data válida, será ignorado`);
      }
      break;
  }
  
  return result;
}

function processRowData(row: any, columnMapping: Record<string, string>, rowIndex: number): {
  data: any;
  validation: ValidationResult;
} {
  const processedData: any = {};
  const validation: ValidationResult = { isValid: true, errors: [], warnings: [] };
  
  // Processar cada mapeamento
  Object.entries(columnMapping).forEach(([fileColumn, dbField]) => {
    if (dbField && dbField !== '' && row[fileColumn] !== undefined && row[fileColumn] !== null) {
      const fieldValidation = validateField(dbField, row[fileColumn], rowIndex);
      
      // Agregar erros e warnings
      validation.errors.push(...fieldValidation.errors);
      validation.warnings.push(...fieldValidation.warnings);
      
      if (!fieldValidation.isValid) {
        validation.isValid = false;
      }
      
      // Processar valor se válido
      if (fieldValidation.isValid || !AVAILABLE_FIELDS[dbField]?.required) {
        const value = String(row[fileColumn]).trim();
        
        switch (AVAILABLE_FIELDS[dbField]?.type) {
          case 'number':
            const numValue = parseFloat(value.replace(/[^\d.,\-]/g, '').replace(',', '.'));
            processedData[dbField] = isNaN(numValue) ? null : numValue;
            break;
            
          case 'date':
            const dateValue = new Date(value);
            processedData[dbField] = isNaN(dateValue.getTime()) ? null : dateValue;
            break;
            
          default:
            processedData[dbField] = value;
        }
      }
    }
  });
  
  // Verificar campos obrigatórios
  REQUIRED_FIELDS.forEach(field => {
    if (!processedData[field] || String(processedData[field]).trim() === '') {
      validation.isValid = false;
      validation.errors.push(`Linha ${rowIndex + 2}: ${AVAILABLE_FIELDS[field].label} é obrigatório`);
    }
  });
  
  return { data: processedData, validation };
}

export const uploadImportFile = upload.single('import_file');

export const analyzeImportFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const file = req.file;
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    let data: any[] = [];
    
    if (fileExtension === '.csv') {
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';'
      });
      
      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Erro ao processar CSV',
          errors: parseResult.errors
        });
      }
      
      data = parseResult.data;
    } else {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    if (data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'O arquivo está vazio ou não contém dados válidos'
      });
    }

    const headers = Object.keys(data[0]);
    const preview = data.slice(0, 5);
    
    console.log('Colunas detectadas:', headers);

    return res.status(200).json({
      success: true,
      headers,
      preview,
      total_rows: data.length,
      filename: file.originalname,
      available_fields: AVAILABLE_FIELDS
    });

  } catch (error) {
    console.error('Erro ao analisar arquivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao analisar o arquivo'
    });
  }
};

export const processImportFile = async (req: Request, res: Response) => {
  try {
    const { columnMapping, filename } = req.body;
    
    if (!columnMapping || !filename) {
      return res.status(400).json({
        success: false,
        message: 'Mapeamento de colunas e nome do arquivo são obrigatórios'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Nenhum arquivo foi enviado'
      });
    }

    const file = req.file;
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    let data: any[] = [];
    
    if (fileExtension === '.csv') {
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';'
      });
      
      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Erro ao processar CSV',
          errors: parseResult.errors
        });
      }
      
      data = parseResult.data;
    } else {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet);
    }

    console.log('Iniciando processamento da importação...');
    console.log('Column Mapping recebido:', columnMapping);
    console.log('Primeiras 2 linhas dos dados:', data.slice(0, 2));

    const importResult: ImportResult = {
      success: true,
      message: '',
      imported_count: 0,
      total_rows: data.length,
      errors: [],
      warnings: []
    };

    const validStartups: any[] = [];
    
    // Processar cada linha
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      console.log(`Processando linha ${i + 1}:`, row);
      const { data: processedData, validation } = processRowData(row, columnMapping, i);
      console.log(`Dados processados linha ${i + 1}:`, processedData);
      console.log(`Validação linha ${i + 1}:`, validation);
      
      if (validation.isValid) {
        // Adicionar campos padrão
        const startupData = {
          ...processedData,
          status_id: "e74a05a6-6612-49af-95a1-f42b035d5c4d", // Status "Cadastrada"
          description: processedData.description || `Startup importada: ${processedData.name}`,
          investment_stage: processedData.investment_stage || "Não informado"
        };
        
        validStartups.push(startupData);
      } else {
        // Adicionar erros
        validation.errors.forEach(error => {
          const errorParts = error.split(': ');
          const rowInfo = errorParts[0];
          const fieldAndError = errorParts[1] || error;
          
          importResult.errors.push({
            row: i + 2,
            field: fieldAndError.split(' ')[0] || 'unknown',
            value: '',
            error: fieldAndError
          });
        });
      }
      
      // Adicionar warnings
      validation.warnings.forEach(warning => {
        const warningParts = warning.split(': ');
        const rowInfo = warningParts[0];
        const fieldAndWarning = warningParts[1] || warning;
        
        importResult.warnings.push({
          row: i + 2,
          field: fieldAndWarning.split(' ')[0] || 'unknown',
          value: '',
          warning: fieldAndWarning
        });
      });
    }

    // Salvar startups válidas no banco
    for (const startupData of validStartups) {
      try {
        const startup = await storage.createStartup(startupData);
        
        // Criar entrada no histórico de status
        await storage.createStartupStatusHistoryEntry({
          startup_id: startup.id,
          status_id: startup.status_id!,
          status_name: "Cadastrada",
          start_date: new Date(),
          end_date: null,
        });
        
        importResult.imported_count++;
      } catch (error) {
        console.error('Erro ao criar startup:', error);
        importResult.errors.push({
          row: -1,
          field: 'database',
          value: startupData.name || 'Unknown',
          error: `Erro ao salvar startup: ${error}`
        });
      }
    }

    // Definir mensagem final
    if (importResult.imported_count === data.length) {
      importResult.message = `Importação concluída com sucesso! ${importResult.imported_count} startups foram cadastradas.`;
    } else if (importResult.imported_count > 0) {
      importResult.message = `Importação parcial: ${importResult.imported_count} de ${data.length} startups foram cadastradas. ${importResult.errors.length} registros com erro.`;
    } else {
      importResult.success = false;
      importResult.message = `Nenhuma startup foi importada. Todos os ${data.length} registros apresentaram erro.`;
    }

    return res.status(200).json(importResult);

  } catch (error) {
    console.error('Erro no processamento do arquivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao processar o arquivo',
      imported_count: 0,
      total_rows: 0,
      errors: [{ row: -1, field: 'system', value: '', error: error.toString() }],
      warnings: []
    });
  }
};

export const downloadErrorReport = async (req: Request, res: Response) => {
  try {
    const { errors } = req.body;
    
    if (!errors || !Array.isArray(errors)) {
      return res.status(400).json({
        success: false,
        message: 'Lista de erros é obrigatória'
      });
    }

    // Criar CSV com erros
    const csvHeaders = ['Linha', 'Campo', 'Valor', 'Erro'];
    const csvRows = errors.map(error => [
      error.row,
      error.field,
      error.value,
      error.error
    ]);
    
    const csvContent = [
      csvHeaders.join(';'),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n');
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio_erros_importacao.csv');
    res.setHeader('Content-Length', Buffer.byteLength(csvContent, 'utf8'));
    
    return res.send('\uFEFF' + csvContent); // BOM para UTF-8
    
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar relatório de erros'
    });
  }
};


