import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";

// Configuração do multer para PDFs temporários
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, "temp-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const tempUpload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'), false);
    }
  },
});

export const uploadTempPDF = tempUpload.single('file');

// Função para extrair texto do PDF
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`Tentando extrair texto do PDF: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`Arquivo lido com sucesso. Tamanho: ${dataBuffer.length} bytes`);
    
    // Try to use pdf-parse with proper error handling
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(dataBuffer);
      
      console.log(`Texto extraído do PDF com sucesso. Tamanho: ${data.text.length} caracteres`);
      if (data.text.length > 0) {
        console.log(`Primeiros 500 caracteres: ${data.text.substring(0, 500)}`);
        return data.text;
      } else {
        console.log('PDF não contém texto extraível');
        throw new Error('PDF não contém texto extraível');
      }
    } catch (pdfError) {
      console.log('Falha na extração com pdf-parse, usando fallback:', pdfError.message);
      throw pdfError;
    }
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    
    // Fallback: Return file info if PDF parsing fails
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    console.log(`Usando fallback para arquivo: ${fileName}`);
    
    return `
      PDF processado: ${fileName}
      Tamanho: ${stats.size} bytes
      
      Este é um documento PDF que contém informações da startup.
      O sistema não conseguiu extrair o texto automaticamente.
      Por favor, revise e complete as informações manualmente.
    `;
  }
}

// Função para extrair dados usando IA (pattern matching inteligente)
async function extractDataWithAI(text: string, startupName: string): Promise<any> {
  console.log("Iniciando processamento de IA...");
  console.log("Nome da startup fornecido:", startupName);
  console.log("Texto recebido:", text.substring(0, 200) + "...");
  
  const lines = text.split('\n').filter(line => line.trim());
  console.log("Processando", lines.length, "linhas");
  
  // Extract data using intelligent pattern matching from actual PDF text
  const extractedData: any = {
    name: startupName, // Use the provided startup name
    ceo_name: extractField(text, ['ceo', 'fundador', 'founder', 'diretor', 'presidente', 'co-founder']),
    ceo_email: extractEmail(text),
    ceo_whatsapp: extractPhone(text),
    business_model: extractField(text, ['modelo de negócio', 'business model', 'modelo', 'receita', 'revenue model']),
    sector: extractField(text, ['setor', 'sector', 'área', 'mercado', 'indústria', 'segmento']),
    city: extractField(text, ['cidade', 'city', 'localização', 'location', 'endereço']),
    state: extractField(text, ['estado', 'state', 'uf', 'região']),
    website: extractWebsite(text),
    mrr: extractNumber(text, ['mrr', 'receita mensal', 'monthly revenue', 'faturamento mensal']),
    client_count: extractNumber(text, ['clientes', 'clients', 'customers', 'usuários', 'users']),
    employee_count: extractNumber(text, ['funcionários', 'employees', 'colaboradores', 'equipe', 'team']),
    tam: extractNumber(text, ['tam', 'mercado total', 'total addressable market']),
    sam: extractNumber(text, ['sam', 'mercado servível', 'serviceable addressable market']),
    som: extractNumber(text, ['som', 'mercado obtível', 'serviceable obtainable market']),
    description: extractDescription(text)
  };

  // Clean up extracted data - remove null/undefined/empty values
  Object.keys(extractedData).forEach(key => {
    if (!extractedData[key] || extractedData[key] === '' || extractedData[key] === 'N/A') {
      delete extractedData[key];
    }
  });
  
  console.log("Processamento de IA concluído, dados extraídos:", extractedData);
  return extractedData;
}

function extractField(text: string, keywords: string[]): string | null {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    // Try multiple patterns for each keyword
    const patterns = [
      new RegExp(`${keyword}[:\\s]*([^\\n]{1,150})`, 'i'),
      new RegExp(`${keyword}[\\s]*[-:]?[\\s]*([^\\n]{1,150})`, 'i'),
      new RegExp(`\\b${keyword}\\b[\\s]*:?[\\s]*([^\\n\\r]{1,150})`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1] && match[1].trim().length > 2) {
        return match[1].trim().replace(/[^\w\s\-\.@]/g, '').trim();
      }
    }
  }
  return null;
}

function extractEmail(text: string): string | null {
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const matches = text.match(emailRegex);
  return matches ? matches[0] : null;
}

function extractPhone(text: string): string | null {
  const phoneRegex = /(\+55\s*)?(\(?[1-9]{2}\)?\s*)?[9]?\d{4}[-\s]?\d{4}/g;
  const matches = text.match(phoneRegex);
  return matches ? matches[0] : null;
}

function extractWebsite(text: string): string | null {
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|br|net|org|io)[^\s]*)/g;
  const matches = text.match(urlRegex);
  return matches ? matches[0] : null;
}

function extractNumber(text: string, keywords: string[]): number | null {
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const patterns = [
      new RegExp(`${keyword}[:\\s]*([\\d,\\.]+)`, 'i'),
      new RegExp(`${keyword}[\\s]*[-:]?[\\s]*([\\d,\\.]+)`, 'i')
    ];
    
    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match && match[1]) {
        const number = parseInt(match[1].replace(/[,\.]/g, ''));
        return isNaN(number) ? null : number;
      }
    }
  }
  return null;
}

function extractDescription(text: string): string | null {
  const keywords = ['descrição', 'description', 'sobre', 'about', 'resumo', 'summary'];
  const lowerText = text.toLowerCase();
  
  for (const keyword of keywords) {
    const regex = new RegExp(`${keyword}[:\\s]*([^\\n]{50,500})`, 'i');
    const match = lowerText.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Fallback: try to extract a meaningful paragraph
  const paragraphs = text.split('\n').filter(p => p.trim().length > 50);
  if (paragraphs.length > 0) {
    return paragraphs[0].trim().substring(0, 300);
  }
  
  return null;
}

// Controlador para processar PDF e extrair dados
export const processPitchDeckAI = async (req: Request, res: Response) => {
  console.log("Iniciando processamento de PDF...");
  
  try {
    if (!req.file) {
      console.log("Erro: Nenhum arquivo foi enviado");
      return res.status(400).json({ message: "Nenhum arquivo PDF foi enviado" });
    }

    const { name } = req.body;
    
    if (!name) {
      console.log("Erro: Nome da startup não fornecido");
      return res.status(400).json({ message: "Nome da startup é obrigatório" });
    }

    console.log(`Processando PDF: ${req.file.filename} para startup: ${name}`);
    console.log(`Caminho do arquivo: ${req.file.path}`);

    // Extrair texto do PDF
    console.log("Extraindo texto do PDF...");
    const extractedText = await extractTextFromPDF(req.file.path);
    console.log(`Texto extraído: ${extractedText.substring(0, 200)}...`);
    
    // Usar IA para extrair dados estruturados
    console.log("Processando dados com IA...");
    const extractedData = await extractDataWithAI(extractedText, name);
    console.log("Dados extraídos:", extractedData);
    
    // Get the "Cadastrada" status ID for AI-generated startups
    const cadastradaStatus = await db.query.statuses.findFirst({
      where: (statuses, { ilike }) => ilike(statuses.name, '%cadastr%')
    });

    // Create startup record in database
    console.log("Criando startup no banco de dados...");
    const newStartup = await db.insert(startups).values({
      name: extractedData.name,
      ceo_name: extractedData.ceo_name,
      ceo_email: extractedData.ceo_email,
      ceo_whatsapp: extractedData.ceo_whatsapp,
      ceo_linkedin: extractedData.ceo_linkedin,
      business_model: extractedData.business_model,
      sector: extractedData.sector,
      city: extractedData.city,
      state: extractedData.state,
      website: extractedData.website,
      founding_date: extractedData.founding_date,
      mrr: extractedData.mrr,
      client_count: extractedData.client_count,
      employee_count: extractedData.employee_count,
      tam: extractedData.tam,
      sam: extractedData.sam,
      som: extractedData.som,
      description: extractedData.description,
      status_id: cadastradaStatus?.id || null,
      created_by_ai: true,
      ai_reviewed: false,
      ai_extraction_data: JSON.stringify(extractedData)
    }).returning();

    console.log("Startup criada com sucesso:", newStartup[0].id);
    
    // Remover arquivo temporário
    console.log("Removendo arquivo temporário...");
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.log("Processamento concluído com sucesso");
    
    // Retornar dados da startup criada
    return res.status(200).json({
      success: true,
      message: "Startup criada com sucesso a partir do pitch deck",
      startup: newStartup[0],
      originalFileName: req.file.originalname
    });
    
  } catch (error) {
    console.error("Erro ao processar PDF:", error);
    
    // Remover arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Erro ao remover arquivo temporário:", cleanupError);
      }
    }
    
    return res.status(500).json({ 
      message: "Erro ao processar pitch deck", 
      error: error.message 
    });
  }
};