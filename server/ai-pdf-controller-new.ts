import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';
import { v4 as uuidv4 } from 'uuid';
import { insertStartupSchema } from '@shared/schema';
import { ZodError } from 'zod';
import { fromZodError } from 'zod-validation-error';
import OpenAI from 'openai';
import pdf from 'pdf-parse';

// Configuração do multer para upload temporário
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `temp-${uniqueSuffix}.pdf`);
  }
});

export const uploadTempPDF = multer({
  storage: tempStorage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos!'));
    }
  }
});

// Configuração da OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Função para extrair texto do PDF
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    console.log(`Iniciando extração de texto do PDF: ${filePath}`);

    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);

    console.log(`Texto extraído com sucesso. Tamanho: ${data.text.length} caracteres`);
    console.log(`Primeiros 200 caracteres: ${data.text.substring(0, 200)}...`);

    return data.text;
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw new Error(`Falha na extração de texto do PDF: ${error.message}`);
  }
}

// Função para processar dados com OpenAI
async function processWithOpenAI(text: string, companyName?: string): Promise<any> {
  try {
    console.log('Iniciando processamento com OpenAI...');
    console.log(`Texto para processar (${text.length} caracteres)`);

    const prompt = `
Você é um especialista em análise de documentos de startups. Analise cuidadosamente o pitch deck fornecido e extraia as informações disponíveis para preencher os campos da base de dados.

INSTRUÇÕES IMPORTANTES:
1. Extraia APENAS informações que estão claramente presentes no documento
2. Para campos não encontrados, use null
3. Para valores numéricos, use apenas números (sem símbolos de moeda)
4. Para datas, use formato ISO (YYYY-MM-DD)
5. Seja preciso e conservador nas extrações

CAMPOS DA BASE DE DADOS:
- name: Nome da startup
- description: Descrição da startup/produto
- website: Site da empresa
- sector: Setor de atuação
- business_model: Modelo de negócio
- category: Categoria da startup
- market: Mercado alvo
- ceo_name: Nome do CEO/Fundador
- ceo_email: Email do CEO
- ceo_whatsapp: WhatsApp do CEO
- ceo_linkedin: LinkedIn do CEO
- city: Cidade
- state: Estado
- mrr: Receita recorrente mensal (apenas número)
- accumulated_revenue_current_year: Receita acumulada ano atual
- total_revenue_last_year: Receita total ano passado
- total_revenue_previous_year: Receita total ano anterior
- tam: Total Addressable Market (apenas número)
- sam: Serviceable Addressable Market (apenas número)
- som: Serviceable Obtainable Market (apenas número)
- client_count: Número de clientes (apenas número)
- partner_count: Número de parceiros (apenas número)
- founding_date: Data de fundação (YYYY-MM-DD)
- problem_solution: Problema que resolve
- problem_solved: Problema solucionado
- differentials: Diferenciais competitivos
- competitors: Concorrentes
- positive_points: Pontos positivos
- attention_points: Pontos de atenção
- priority: Prioridade
- observations: Observações gerais

CONTEÚDO DO PITCH DECK:
${text}

${companyName ? `NOME DA EMPRESA INFORMADO: ${companyName}` : ''}

Retorne apenas um JSON válido com os dados extraídos:`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em análise de documentos de startups. Extraia informações precisas e retorne apenas JSON válido.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 4000
    });

    const extractedData = JSON.parse(response.choices[0].message.content);
    console.log('Dados extraídos pela OpenAI:', extractedData);

    return extractedData;
  } catch (error) {
    console.error('Erro no processamento OpenAI:', error);
    throw new Error(`Falha no processamento com OpenAI: ${error.message}`);
  }
}

// Função para processar startup com IA
export async function processPitchDeckAI(req: Request, res: Response) {
  console.log('=== INICIANDO PROCESSAMENTO COM IA ===');

  try {
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      console.error('Nenhum arquivo foi enviado');
      return res.status(400).json({ 
        success: false, 
        error: 'Nenhum arquivo PDF foi enviado' 
      });
    }

    console.log('Arquivo recebido:', {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: req.file.path
    });

    // Verificar se a chave da OpenAI existe
    if (!process.env.OPENAI_API_KEY) {
      console.error('Chave da OpenAI não configurada');
      return res.status(500).json({ 
        success: false, 
        error: 'Chave da OpenAI não configurada' 
      });
    }

    // Extrair o nome da empresa do corpo da requisição
    const companyName = req.body.name || req.body.companyName;
    console.log('Nome da empresa informado:', companyName);

    // Extrair texto do PDF
    const extractedText = await extractTextFromPDF(req.file.path);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Não foi possível extrair texto do PDF');
    }

    // Processar com OpenAI
    const aiExtractedData = await processWithOpenAI(extractedText, companyName);

    // Usar o nome fornecido pelo usuário se disponível
    if (companyName) {
      aiExtractedData.name = companyName;
    }

    // Limpar dados extraídos
    const cleanedData = cleanExtractedData(aiExtractedData);

    console.log('Dados finais após limpeza:', cleanedData);

    // Remover arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('Arquivo temporário removido');
    }

    // Retornar dados extraídos
    return res.status(200).json({
      success: true,
      extractedData: cleanedData,
      textLength: extractedText.length
    });

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===');
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);

    // Remover arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Arquivo temporário removido após erro');
      } catch (cleanupError) {
        console.error('Erro ao remover arquivo temporário:', cleanupError);
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'Sem detalhes'
    });
  }
}

// Função para limpar dados extraídos
function cleanExtractedData(data: any): any {
  const cleaned: any = {};

  // Campos de texto
  const textFields = [
    'name', 'description', 'website', 'sector', 'business_model', 'category', 
    'market', 'ceo_name', 'ceo_email', 'ceo_whatsapp', 'ceo_linkedin', 
    'city', 'state', 'problem_solution', 'problem_solved', 'differentials',
    'competitors', 'positive_points', 'attention_points', 'priority', 'observations'
  ];

  // Campos numéricos
  const numericFields = [
    'mrr', 'accumulated_revenue_current_year', 'total_revenue_last_year',
    'total_revenue_previous_year', 'tam', 'sam', 'som', 'client_count', 'partner_count'
  ];

  // Campos de data
  const dateFields = ['founding_date'];

  // Processar campos de texto
  textFields.forEach(field => {
    if (data[field] && typeof data[field] === 'string' && data[field].trim()) {
      cleaned[field] = data[field].trim();
    } else {
      cleaned[field] = null;
    }
  });

  // Processar campos numéricos
  numericFields.forEach(field => {
    if (data[field] !== null && data[field] !== undefined) {
      const num = parseFloat(String(data[field]).replace(/[^\d.-]/g, ''));
      cleaned[field] = isNaN(num) ? null : num;
    } else {
      cleaned[field] = null;
    }
  });

  // Processar campos de data
  dateFields.forEach(field => {
    if (data[field] && typeof data[field] === 'string') {
      const dateStr = data[field].trim();
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        cleaned[field] = dateStr;
      } else {
        cleaned[field] = null;
      }
    } else {
      cleaned[field] = null;
    }
  });

  return cleaned;
}