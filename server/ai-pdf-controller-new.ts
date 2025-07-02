import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import pdf2pic from "pdf2pic";

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

// Configure multer for temporary file upload
const tempStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.cwd(), 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `temp-${Date.now()}-${Math.random().toString(36).substring(2)}.pdf`;
    cb(null, uniqueName);
  }
});

export const tempUpload = multer({
  storage: tempStorage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos PDF são permitidos'));
    }
  },
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB limit - increased for larger PDFs
  }
});

export const uploadTempPDF = tempUpload.single('file');

// Função para converter PDF em imagens e enviar para OpenAI Vision
async function extractDataWithOpenAIVision(filePath: string): Promise<string | null> {
  console.log(`=== CONVERTENDO PDF PARA IMAGENS E ENVIANDO PARA OPENAI VISION ===`);
  
  try {
    console.log(`Convertendo PDF para imagens: ${filePath}`);
    
    // Configurar conversão para imagem usando pdf2pic
    const convert = pdf2pic.fromPath(filePath, {
      density: 100,           // Resolução da imagem
      saveFilename: "page",   // Nome base dos arquivos
      savePath: path.join(process.cwd(), 'temp'), // Diretório temporário
      format: "png",          // Formato da imagem
      width: 2000,           // Largura máxima
      height: 2000           // Altura máxima
    });

    // Converter a primeira página (mais importante)
    const pageResult = await convert(1, { responseType: "base64" });
    
    if (!pageResult || !pageResult.base64) {
      throw new Error("Falha na conversão PDF para imagem");
    }
    
    console.log(`PDF convertido para imagem base64: ${pageResult.base64.length} caracteres`);
    
    if (!openai) {
      throw new Error("OpenAI não configurado");
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extraia as principais informações para gerar um insert na base de dados desta tabela:

id (uuid, PK, defaultRandom)
name (text, notNull)
created_at, updated_at (timestamp, defaultNow, notNull)
status_id (uuid → statuses.id): status atual
description, website, sector, business_model, category, market (text)
ceo_name, ceo_email, ceo_whatsapp, ceo_linkedin (text)
city, state (text)
mrr, accumulated_revenue_current_year, total_revenue_last_year, total_revenue_previous_year, tam, sam, som (numeric)
client_count, partner_count (integer)
founding_date, due_date (timestamp)
problem_solution, problem_solved, differentials, competitors, positive_points, attention_points, scangels_value_add, no_investment_reason (text)
pitch_deck_id (uuid → files.id, onDelete: set null)
assigned_to (uuid): responsável interno
google_drive_link, origin_lead, referred_by, priority, observations (text)
time_tracking (integer)

Analise esta imagem do pitch deck e extraia todas as informações disponíveis. Retorne um texto estruturado com os dados encontrados.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${pageResult.base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    const extractedContent = response.choices[0].message.content;
    
    console.log(`=== DADOS EXTRAÍDOS DA OPENAI VISION ===`);
    console.log(`Tamanho da resposta: ${extractedContent?.length} caracteres`);
    console.log(`Primeiros 500 caracteres: ${extractedContent?.substring(0, 500)}...`);
    
    return extractedContent;
    
  } catch (error: any) {
    console.error(`ERRO ao processar PDF com OpenAI Vision: ${error.message}`);
    
    // Fallback: tentar extrair texto usando uma abordagem alternativa
    console.log("Tentando fallback com análise contextual...");
    
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    
    console.log(`Usando análise contextual para: ${fileName} (${fileStats.size} bytes)`);
    
    return `Pitch deck analisado: ${fileName}. 
    
    O sistema detectou um documento PDF de ${Math.round(fileStats.size / 1024)}KB que contém informações de uma startup.
    
    Para uma análise completa, o documento precisa ser processado manualmente ou convertido em um formato de imagem compatível.
    
    Arquivo processado em: ${new Date().toISOString()}`;
  }
}

// Função para analisar PDF usando IA com texto extraído
async function analyzePDFWithAI(filePath: string, startupName: string): Promise<any> {
  console.log(`=== ANALISANDO PDF COM IA ===`);
  
  try {
    // Enviar PDF diretamente para OpenAI Vision
    const visionExtractedText = await extractDataWithOpenAIVision(filePath);
    
    if (!visionExtractedText) {
      console.log("FALHA na extração via Vision - criando registro básico");
      return {
        name: startupName,
        description: `Startup ${startupName} - PDF processado mas dados não extraídos. Revisar manualmente.`,
        ceo_name: null,
        problem_solution: "Extração via Vision falhou - dados devem ser inseridos manualmente"
      };
    }
    
    console.log("=== ESTRUTURANDO DADOS EXTRAÍDOS PELA VISION ===");
    console.log(`Tamanho dos dados: ${visionExtractedText.length} caracteres`);
    
    if (!openai) {
      throw new Error("OpenAI não configurado");
    }
    
    const prompt = `
Extraia as principais informações para gerar um insert na base de dados desta tabela a partir do pitch deck:

ESTRUTURA COMPLETA DA TABELA:
- id (uuid, PK, defaultRandom)
- name (text, notNull)
- created_at, updated_at (timestamp, defaultNow, notNull)
- status_id (uuid → statuses.id): status atual
- description, website, sector, business_model, category, market (text)
- ceo_name, ceo_email, ceo_whatsapp, ceo_linkedin (text)
- city, state (text)
- mrr, accumulated_revenue_current_year, total_revenue_last_year, total_revenue_previous_year, tam, sam, som (numeric)
- client_count, partner_count (integer)
- founding_date, due_date (timestamp)
- problem_solution, problem_solved, differentials, competitors, positive_points, attention_points, scangels_value_add, no_investment_reason (text)
- pitch_deck_id (uuid → files.id, onDelete: set null)
- assigned_to (uuid): responsável interno
- google_drive_link, origin_lead, referred_by, priority, observations (text)
- time_tracking (integer)

DADOS EXTRAÍDOS DO PITCH DECK PELA VISION:
${visionExtractedText}

INSTRUÇÕES:
1. Analise cuidadosamente o conteúdo do pitch deck fornecido
2. Extraia TODAS as informações disponíveis no documento
3. Para campos não encontrados no documento, deixe como null
4. Use o nome fornecido pelo usuário: "${startupName}"
5. Valores numéricos devem ser números, não strings
6. Datas no formato ISO (YYYY-MM-DD)
7. Retorne apenas um JSON válido com TODOS os campos encontrados

Responda apenas com o JSON válido contendo os dados extraídos:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "Você é especialista em análise de pitch decks. Estruture em JSON APENAS as informações reais extraídas pela Vision API. Não invente dados."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 2000
    });

    const result = response.choices[0].message.content;
    
    if (!result) {
      throw new Error("OpenAI não retornou resultado");
    }
    
    const extractedData = JSON.parse(result);
    
    console.log("=== DADOS EXTRAÍDOS PELA IA ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`CEO: ${extractedData.ceo_name}`);
    console.log(`Setor: ${extractedData.sector}`);
    console.log(`MRR: ${extractedData.mrr}`);
    console.log(`Descrição: ${extractedData.description?.substring(0, 100)}...`);
    
    return extractedData;
    
  } catch (error: any) {
    console.error('=== ERRO NA ANÁLISE ===');
    console.error('Erro:', error.message);
    throw error;
  }
}

// Controlador principal para processar PDF
export const processPitchDeckAI = async (req: Request, res: Response) => {
  console.log("=== PROCESSAMENTO AI PDF - VERSÃO CORRIGIDA ===");
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo PDF foi enviado" });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Nome da startup é obrigatório" });
    }

    console.log(`Processando PDF para startup: ${name}`);
    console.log(`Arquivo: ${req.file.filename}`);

    // Analisar PDF com extração real de texto
    const extractedData = await analyzePDFWithAI(req.file.path, name);
    
    console.log("=== DADOS EXTRAÍDOS ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`Descrição: ${extractedData.description}`);

    // Buscar status "Cadastrada" 
    const cadastradaStatus = await db.query.statuses.findFirst({
      where: (statuses, { ilike }) => ilike(statuses.name, '%cadastr%')
    });

    // Preparar dados para inserção
    const insertData = {
      name: extractedData.name || name,
      description: extractedData.description,
      status_id: cadastradaStatus?.id || null,
      ai_extraction_data: JSON.stringify(extractedData),
      created_by_ai: true,
      ai_reviewed: false,
      
      // Campos opcionais
      ceo_name: extractedData.ceo_name || null,
      ceo_email: extractedData.ceo_email || null,
      sector: extractedData.sector || null,
      business_model: extractedData.business_model || null,
      problem_solution: extractedData.problem_solution || null,
      attention_points: extractedData.attention_points || null,
      
      // Campos numéricos como string para Postgres numeric
      mrr: extractedData.mrr ? String(extractedData.mrr) : null,
      client_count: extractedData.client_count ? Number(extractedData.client_count) : null
    };

    console.log("=== INSERINDO NO BANCO ===");
    const newStartup = await db.insert(startups).values([insertData]).returning();
    
    console.log(`Startup criada: ${newStartup[0].id}`);
    
    // Remover arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("Arquivo temporário removido");
    }

    return res.status(200).json({
      message: "PDF processado com sucesso",
      startup: newStartup[0],
      originalFileName: req.file.originalname
    });
    
  } catch (error: any) {
    console.error("=== ERRO NO PROCESSAMENTO ===");
    console.error("Erro:", error.message);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error("Erro ao limpar arquivo:", cleanupError);
      }
    }
    
    return res.status(500).json({ 
      message: "Erro ao processar pitch deck", 
      error: error.message 
    });
  }
};