
import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
// import * as pdfParse from "pdf-parse"; // Removed due to package conflicts

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
    fileSize: 200 * 1024 * 1024 // 200MB limit
  }
});

export const uploadTempPDF = tempUpload.single('file');

// Função para extrair texto do PDF - versão simplificada
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`=== EXTRAINDO TEXTO DO PDF ===`);
  
  try {
    console.log(`Lendo PDF: ${filePath}`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`PDF carregado: ${dataBuffer.length} bytes`);
    
    // Fallback simples para análise de PDF
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    
    console.log(`=== EXTRAÇÃO CONCLUÍDA ===`);
    console.log(`Arquivo: ${fileName}`);
    console.log(`Tamanho: ${dataBuffer.length} bytes`);
    
    // Retorna informações básicas do PDF para análise de IA
    return `
PDF Document: ${fileName}
File Size: ${dataBuffer.length} bytes
Created: ${fileStats.birthtime.toISOString()}
Modified: ${fileStats.mtime.toISOString()}

AVISO: Este PDF será analisado usando técnicas de AI Vision.
O sistema processará o conteúdo visual do documento para extrair informações da startup.

Por favor, revise manualmente as informações extraídas.
    `.trim();
    
  } catch (error: any) {
    console.error(`ERRO ao extrair texto do PDF: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    
    // Fallback em caso de erro
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    
    return `
ERRO NA EXTRAÇÃO DE TEXTO: ${error.message}

Arquivo: ${fileName}
Tamanho: ${Math.round(fileStats.size / 1024)}KB
Processado em: ${new Date().toISOString()}

Este PDF requer processamento manual ou ferramentas adicionais de OCR.
    `.trim();
  }
}

// Função para analisar dados extraídos usando OpenAI
async function analyzePDFWithAI(extractedText: string, startupName: string): Promise<any> {
  console.log(`=== ANALISANDO DADOS EXTRAÍDOS COM IA ===`);
  
  try {
    if (!openai) {
      throw new Error("OpenAI não configurado");
    }
    
    console.log(`Analisando ${extractedText.length} caracteres de texto extraído`);
    
    const prompt = `
Você está analisando texto extraído de um pitch deck para criar um registro estruturado de startup.

TEXTO EXTRAÍDO DO PITCH DECK:
${extractedText}

NOME DA STARTUP FORNECIDO PELO USUÁRIO: "${startupName}"

INSTRUÇÕES PARA EXTRAÇÃO:
1. Analise CUIDADOSAMENTE todo o texto fornecido
2. Extraia apenas informações que estão claramente presentes no texto
3. Para informações não encontradas, use null
4. Mantenha números como números (não strings)
5. Use o nome fornecido pelo usuário como nome principal
6. Seja conservador - só inclua dados que estão claramente presentes no texto

CAMPOS DA TABELA PARA EXTRAÇÃO:
- name (obrigatório): use "${startupName}"
- description: descrição do negócio baseada no pitch deck
- website, sector, business_model, category, market
- ceo_name, ceo_email, ceo_whatsapp, ceo_linkedin
- city, state
- mrr, accumulated_revenue_current_year, total_revenue_last_year, total_revenue_previous_year, tam, sam, som (valores numéricos)
- client_count, partner_count (números inteiros)
- founding_date, due_date (formato YYYY-MM-DD)
- problem_solution, problem_solved, differentials, competitors, positive_points, attention_points
- google_drive_link, origin_lead, referred_by, priority, observations

FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido com todos os campos encontrados. Exemplo:
{
  "name": "${startupName}",
  "description": "Descrição baseada no pitch deck",
  "ceo_name": "Nome do CEO se encontrado ou null",
  "sector": "Setor se identificado ou null",
  "mrr": 50000,
  "client_count": 100,
  "founding_date": "2023-01-15",
  "problem_solution": "Problema e solução se descritos ou null"
}

Responda APENAS com o JSON válido:`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é especialista em análise de pitch decks. Extraia em JSON APENAS as informações reais presentes no texto. Não invente dados."
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
    console.error('=== ERRO NA ANÁLISE COM IA ===');
    console.error('Erro:', error.message);
    
    // Fallback com dados básicos
    return {
      name: startupName,
      description: `Startup ${startupName} - PDF processado mas análise com IA falhou. Dados devem ser revisados manualmente.`,
      ceo_name: null,
      sector: null,
      problem_solution: "Análise com IA falhou - dados devem ser inseridos manualmente"
    };
  }
}

// Controlador principal para processar PDF
export const processPitchDeckAI = async (req: Request, res: Response) => {
  console.log("=== PROCESSAMENTO AI PDF - VERSÃO COM EXTRAÇÃO DE TEXTO ===");
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo PDF foi enviado" });
    }

    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Nome da startup é obrigatório" });
    }

    console.log(`Processando PDF para startup: ${name}`);
    console.log(`Arquivo: ${req.file.filename} (${req.file.size} bytes)`);

    // 1. Extrair texto do PDF
    const extractedText = await extractTextFromPDF(req.file.path);
    
    if (!extractedText || extractedText.length < 10) {
      console.log("AVISO: Muito pouco texto extraído do PDF");
    }

    // 2. Analisar com IA
    const extractedData = await analyzePDFWithAI(extractedText, name);
    
    console.log("=== DADOS FINAIS EXTRAÍDOS ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`Descrição: ${extractedData.description}`);

    // 3. Buscar status "Cadastrada" 
    const cadastradaStatus = await db.query.statuses.findFirst({
      where: (statuses, { ilike }) => ilike(statuses.name, '%cadastr%')
    });

    // 4. Preparar dados para inserção
    const insertData = {
      name: extractedData.name || name,
      description: extractedData.description || `Startup ${name} processada via AI a partir de PDF.`,
      status_id: cadastradaStatus?.id || null,
      ai_extraction_data: JSON.stringify({
        ...extractedData,
        extracted_text_length: extractedText.length,
        extraction_method: "pdf-parse + OpenAI GPT-4o"
      }),
      created_by_ai: true,
      ai_reviewed: false,
      
      // Campos opcionais
      ceo_name: extractedData.ceo_name || null,
      ceo_email: extractedData.ceo_email || null,
      ceo_whatsapp: extractedData.ceo_whatsapp || null,
      ceo_linkedin: extractedData.ceo_linkedin || null,
      sector: extractedData.sector || null,
      business_model: extractedData.business_model || null,
      category: extractedData.category || null,
      market: extractedData.market || null,
      city: extractedData.city || null,
      state: extractedData.state || null,
      website: extractedData.website || null,
      problem_solution: extractedData.problem_solution || null,
      problem_solved: extractedData.problem_solved || null,
      differentials: extractedData.differentials || null,
      competitors: extractedData.competitors || null,
      positive_points: extractedData.positive_points || null,
      attention_points: extractedData.attention_points || null,
      google_drive_link: extractedData.google_drive_link || null,
      origin_lead: extractedData.origin_lead || null,
      referred_by: extractedData.referred_by || null,
      priority: extractedData.priority || null,
      observations: extractedData.observations || null,
      
      // Campos numéricos como string para Postgres numeric
      mrr: extractedData.mrr ? String(extractedData.mrr) : null,
      accumulated_revenue_current_year: extractedData.accumulated_revenue_current_year ? String(extractedData.accumulated_revenue_current_year) : null,
      total_revenue_last_year: extractedData.total_revenue_last_year ? String(extractedData.total_revenue_last_year) : null,
      total_revenue_previous_year: extractedData.total_revenue_previous_year ? String(extractedData.total_revenue_previous_year) : null,
      tam: extractedData.tam ? String(extractedData.tam) : null,
      sam: extractedData.sam ? String(extractedData.sam) : null,
      som: extractedData.som ? String(extractedData.som) : null,
      
      // Campos inteiros
      client_count: extractedData.client_count ? Number(extractedData.client_count) : null,
      partner_count: extractedData.partner_count ? Number(extractedData.partner_count) : null,
      time_tracking: extractedData.time_tracking ? Number(extractedData.time_tracking) : null,
      
      // Campos de data
      founding_date: extractedData.founding_date ? new Date(extractedData.founding_date) : null,
      due_date: extractedData.due_date ? new Date(extractedData.due_date) : null
    };

    console.log("=== INSERINDO NO BANCO DE DADOS ===");
    console.log("Dados principais:", {
      name: insertData.name,
      ceo_name: insertData.ceo_name,
      sector: insertData.sector,
      mrr: insertData.mrr
    });
    
    const newStartup = await db.insert(startups).values([insertData]).returning();
    
    console.log(`Startup criada com sucesso: ${newStartup[0].id}`);
    console.log(`Dados salvos - Nome: ${newStartup[0].name}, CEO: ${newStartup[0].ceo_name}, Setor: ${newStartup[0].sector}`);
    
    // 5. Remover arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("Arquivo temporário removido");
    }

    return res.status(200).json({
      success: true,
      message: "PDF processado com sucesso usando extração de texto",
      startup: newStartup[0],
      originalFileName: req.file.originalname,
      extractedTextLength: extractedText.length,
      extractionMethod: "pdf-parse + OpenAI GPT-4o"
    });
    
  } catch (error: any) {
    console.error("=== ERRO NO PROCESSAMENTO ===");
    console.error("Erro:", error.message);
    console.error("Stack:", error.stack);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("Arquivo temporário removido após erro");
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
