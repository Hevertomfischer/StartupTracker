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

// Mapeamento de colunas do arquivo para campos da startup
interface StartupMapping {
  // Campos obrigatórios
  name?: string;
  ceo_name?: string;
  ceo_email?: string;
  
  // Campos opcionais
  ceo_whatsapp?: string;
  business_model?: string;
  problem_solution?: string;
  differentials?: string;
  sector?: string;
  employee_count?: string;
  city?: string;
  state?: string;
  website?: string;
  investment_stage?: string;
  mrr?: string;
  tam?: string;
  sam?: string;
  som?: string;
  description?: string;
  
  // Status será sempre "Cadastrada" por padrão
}

const defaultColumnMapping: Record<string, keyof StartupMapping> = {
  // Variações para nome da startup
  'nome': 'name',
  'nome_startup': 'name',
  'startup': 'name',
  'empresa': 'name',
  'razao_social': 'name',
  
  // Variações para CEO
  'ceo': 'ceo_name',
  'fundador': 'ceo_name',
  'diretor': 'ceo_name',
  'responsavel': 'ceo_name',
  
  // Variações para email
  'email': 'ceo_email',
  'email_ceo': 'ceo_email',
  'contato': 'ceo_email',
  
  // Variações para telefone
  'telefone': 'ceo_whatsapp',
  'whatsapp': 'ceo_whatsapp',
  'celular': 'ceo_whatsapp',
  'phone': 'ceo_whatsapp',
  
  // Variações para modelo de negócio
  'modelo_negocio': 'business_model',
  'negocio': 'business_model',
  'atividade': 'business_model',
  
  // Variações para setor
  'setor': 'sector',
  'segmento': 'sector',
  'area': 'sector',
  'industria': 'sector',
  
  // Variações para funcionários
  'funcionarios': 'employee_count',
  'colaboradores': 'employee_count',
  'equipe': 'employee_count',
  'team_size': 'employee_count',
  
  // Variações para localização
  'cidade': 'city',
  'municipio': 'city',
  'estado': 'state',
  'uf': 'state',
  
  // Variações para website
  'site': 'website',
  'url': 'website',
  'homepage': 'website',
  
  // Variações para descrição
  'descricao': 'description',
  'sobre': 'description',
  'resumo': 'description',
  
  // Variações para métricas
  'receita': 'mrr',
  'faturamento': 'mrr',
  'valuation': 'tam',
  'valor': 'tam'
};

function normalizeColumnName(columnName: string): string {
  return columnName
    .toLowerCase()
    .trim()
    .replace(/[áàâãä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôõö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function mapColumns(headers: string[]): Record<string, keyof StartupMapping> {
  const mapping: Record<string, keyof StartupMapping> = {};
  
  headers.forEach(header => {
    const normalizedHeader = normalizeColumnName(header);
    if (defaultColumnMapping[normalizedHeader]) {
      mapping[header] = defaultColumnMapping[normalizedHeader];
    }
  });
  
  return mapping;
}

function processRow(row: any, columnMapping: Record<string, keyof StartupMapping>): Partial<StartupMapping> {
  const processedRow: Partial<StartupMapping> = {};
  
  Object.entries(row).forEach(([originalColumn, value]) => {
    const mappedField = columnMapping[originalColumn];
    if (mappedField && value !== undefined && value !== null && value !== '') {
      processedRow[mappedField] = String(value).trim();
    }
  });
  
  return processedRow;
}

function validateRow(row: Partial<StartupMapping>, index: number): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!row.name || row.name.trim() === '') {
    errors.push(`Linha ${index + 2}: Nome da startup é obrigatório`);
  }
  
  if (!row.ceo_name || row.ceo_name.trim() === '') {
    errors.push(`Linha ${index + 2}: Nome do CEO é obrigatório`);
  }
  
  if (!row.ceo_email || row.ceo_email.trim() === '') {
    errors.push(`Linha ${index + 2}: Email do CEO é obrigatório`);
  } else if (!/\S+@\S+\.\S+/.test(row.ceo_email)) {
    errors.push(`Linha ${index + 2}: Email inválido`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export const uploadImportFile = upload.single('import_file');

export const processImportFile = async (req: Request, res: Response) => {
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
      // Processar CSV
      const csvText = file.buffer.toString('utf-8');
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        delimiter: ';' // Padrão brasileiro
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
      // Processar Excel
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

    // Mapear colunas
    const headers = Object.keys(data[0]);
    const columnMapping = mapColumns(headers);
    
    console.log('Colunas detectadas:', headers);
    console.log('Mapeamento aplicado:', columnMapping);

    // Processar e validar dados
    const processedData: Partial<StartupMapping>[] = [];
    const validationErrors: string[] = [];
    
    data.forEach((row, index) => {
      const processedRow = processRow(row, columnMapping);
      const validation = validateRow(processedRow, index);
      
      if (validation.isValid) {
        processedData.push(processedRow);
      } else {
        validationErrors.push(...validation.errors);
      }
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erros de validação encontrados',
        errors: validationErrors,
        preview: data.slice(0, 5) // Primeiras 5 linhas para preview
      });
    }

    // Converter para formato do banco
    const startupsToCreate = processedData.map(row => ({
      name: row.name!,
      ceo_name: row.ceo_name || '',
      ceo_email: row.ceo_email || '',
      ceo_whatsapp: row.ceo_whatsapp || null,
      business_model: row.business_model || null,
      problem_solution: row.problem_solution || null,
      differentials: row.differentials || null,
      sector: row.sector || null,
      employee_count: row.employee_count ? parseInt(row.employee_count) : null,
      city: row.city || null,
      state: row.state || null,
      website: row.website || null,
      status_id: "e74a05a6-6612-49af-95a1-f42b035d5c4d", // Status "Cadastrada"
      description: row.description || `Startup importada: ${row.name}`,
      investment_stage: row.investment_stage || "Não informado",
      mrr: row.mrr ? parseFloat(row.mrr) : 0,
      tam: row.tam ? parseFloat(row.tam) : null,
      sam: row.sam ? parseFloat(row.sam) : null,
      som: row.som ? parseFloat(row.som) : null,
    }));

    // Salvar no banco de dados
    const createdStartups = [];
    const creationErrors = [];
    
    for (let i = 0; i < startupsToCreate.length; i++) {
      try {
        const startup = await storage.createStartup(startupsToCreate[i]);
        
        // Criar entrada no histórico de status
        await storage.createStartupStatusHistoryEntry({
          startup_id: startup.id,
          status_id: startup.status_id!,
          status_name: "Cadastrada",
          start_date: new Date(),
          end_date: null,
        });
        
        createdStartups.push(startup);
      } catch (error) {
        creationErrors.push(`Erro ao criar startup "${startupsToCreate[i].name}": ${error}`);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Importação concluída! ${createdStartups.length} startups foram cadastradas.`,
      imported_count: createdStartups.length,
      total_rows: data.length,
      errors: creationErrors.length > 0 ? creationErrors : undefined,
      column_mapping: columnMapping
    });

  } catch (error) {
    console.error('Erro no processamento do arquivo:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno do servidor ao processar o arquivo'
    });
  }
};

export const getImportTemplate = async (req: Request, res: Response) => {
  try {
    const templateData = [
      {
        'Nome da Startup': 'Exemplo Tech',
        'Nome do CEO': 'João Silva',
        'Email do CEO': 'joao@exemplo.com',
        'Telefone/WhatsApp': '(11) 99999-9999',
        'Modelo de Negócio': 'SaaS B2B',
        'Setor': 'Tecnologia',
        'Número de Funcionários': '10',
        'Cidade': 'São Paulo',
        'Estado': 'SP',
        'Website': 'https://exemplo.com',
        'Descrição': 'Startup focada em soluções tecnológicas',
        'Estágio de Investimento': 'Seed',
        'MRR (R$)': '50000',
        'Valuation (R$)': '1000000'
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Configurar largura das colunas
    const columnWidths = [
      { wch: 20 }, // Nome da Startup
      { wch: 20 }, // Nome do CEO
      { wch: 25 }, // Email do CEO
      { wch: 18 }, // Telefone
      { wch: 15 }, // Modelo de Negócio
      { wch: 15 }, // Setor
      { wch: 12 }, // Funcionários
      { wch: 15 }, // Cidade
      { wch: 8 },  // Estado
      { wch: 25 }, // Website
      { wch: 30 }, // Descrição
      { wch: 18 }, // Estágio
      { wch: 12 }, // MRR
      { wch: 15 }  // Valuation
    ];
    
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template Startups');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=template_startups.xlsx');
    
    return res.send(buffer);
    
  } catch (error) {
    console.error('Erro ao gerar template:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao gerar template'
    });
  }
};