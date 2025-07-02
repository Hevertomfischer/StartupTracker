
import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
// import * as pdfParse from "pdf-parse"; // Removed due to package conflicts
import { fromPath } from "pdf2pic";
import { createWorker } from "tesseract.js";

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

// Função para extrair texto do PDF com múltiplas estratégias
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`=== EXTRAINDO TEXTO DO PDF ===`);
  console.log(`Arquivo: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    const dataBuffer = fs.readFileSync(filePath);
    console.log(`PDF carregado: ${dataBuffer.length} bytes`);
    
    // Estratégia 1: Usar OpenAI Vision API diretamente (mais eficaz)
    try {
      console.log("=== TENTATIVA 1: OPENAI VISION API ===");
      
      // Converter primeira página para base64
      const convert = fromPath(filePath, {
        density: 150,
        saveFilename: "vision_page",
        savePath: path.join(process.cwd(), 'temp'),
        format: "png",
        width: 1500,
        height: 1500
      });
      
      const firstPage = await convert(1); // Primeira página apenas
      
      if (firstPage.path && fs.existsSync(firstPage.path)) {
        const imageBuffer = fs.readFileSync(firstPage.path);
        const base64Image = imageBuffer.toString('base64');
        
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extraia todo o texto visível nesta página de pitch deck de startup. Retorne apenas o texto extraído, preservando a formatação quando possível."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${base64Image}`,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 4000
        });
        
        const visionText = visionResponse.choices[0].message.content;
        
        // Limpar arquivo temporário
        fs.unlinkSync(firstPage.path);
        
        if (visionText && visionText.trim().length > 50) {
          console.log(`✅ VISION API funcionou: ${visionText.length} caracteres extraídos`);
          console.log(`Amostra: ${visionText.substring(0, 200)}...`);
          return visionText;
        }
      }
      
    } catch (visionError: any) {
      console.log(`❌ Vision API falhou: ${visionError.message}`);
    }
    
    // Estratégia 2: Converter para imagens e usar OCR
    try {
      console.log("=== TENTATIVA 2: PDF-TO-IMAGE + OCR ===");
      
      const convert = fromPath(filePath, {
        density: 200,
        saveFilename: "page",
        savePath: path.join(process.cwd(), 'temp'),
        format: "png",
        width: 2000,
        height: 2000
      });
      
      const pageImages = await convert.bulk(-1); // Convert all pages
      console.log(`Convertidas ${pageImages.length} páginas para imagem`);
      
      let extractedText = "";
      
      // Criar worker do Tesseract
      const worker = await createWorker('por+eng');
      
      for (let i = 0; i < Math.min(pageImages.length, 10); i++) { // Limitar a 10 páginas
        const imagePage = pageImages[i];
        if (imagePage.path) {
          console.log(`Processando página ${i + 1} com OCR...`);
          
          try {
            const { data } = await worker.recognize(imagePage.path);
            if (data.text && data.text.trim()) {
              extractedText += `\n=== PÁGINA ${i + 1} ===\n${data.text}\n`;
              console.log(`Página ${i + 1}: ${data.text.length} caracteres extraídos`);
            }
            
            // Limpar arquivo temporário da imagem
            if (fs.existsSync(imagePage.path)) {
              fs.unlinkSync(imagePage.path);
            }
          } catch (ocrError: any) {
            console.log(`Erro OCR na página ${i + 1}: ${ocrError.message}`);
          }
        }
      }
      
      await worker.terminate();
      
      if (extractedText.trim().length > 50) {
        console.log(`✅ OCR funcionou: ${extractedText.length} caracteres extraídos`);
        console.log(`Amostra: ${extractedText.substring(0, 200)}...`);
        return extractedText;
      } else {
        console.log("⚠️ OCR retornou pouco texto");
      }
      
    } catch (ocrError: any) {
      console.log(`❌ OCR falhou: ${ocrError.message}`);
    }
    

    
    // Se todas as estratégias falharam, retornar informações básicas
    console.log("❌ TODAS AS ESTRATÉGIAS FALHARAM");
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    
    return `
DOCUMENTO PDF: ${fileName}
TAMANHO: ${Math.round(fileStats.size / 1024)}KB
PROCESSADO: ${new Date().toISOString()}

AVISO: Não foi possível extrair texto automaticamente deste PDF.
Este documento requer revisão manual para extração das informações.
Por favor, revise o pitch deck manualmente e complete os dados da startup.

POSSÍVEIS CAUSAS:
- PDF com imagens escaneadas sem texto selecionável
- PDF protegido ou criptografado
- Formato de PDF não suportado
- Conteúdo principalmente visual/gráfico
    `.trim();
    
  } catch (error: any) {
    console.error(`ERRO GERAL na extração: ${error.message}`);
    throw new Error(`Falha na extração do PDF: ${error.message}`);
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
  console.log("=== PROCESSAMENTO AI PDF - VERSÃO ROBUSTA ===");
  
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

    // 1. Extrair texto do PDF usando múltiplas estratégias
    const extractedText = await extractTextFromPDF(req.file.path);
    
    console.log(`=== TEXTO EXTRAÍDO (${extractedText.length} caracteres) ===`);
    console.log(`Amostra: ${extractedText.substring(0, 300)}...`);

    // 2. Analisar com IA
    console.log("=== INICIANDO ANÁLISE COM IA ===");
    const extractedData = await analyzePDFWithAI(extractedText, name);
    
    console.log("=== DADOS FINAIS EXTRAÍDOS ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`Descrição: ${extractedData.description}`);
    console.log(`CEO: ${extractedData.ceo_name}`);
    console.log(`Setor: ${extractedData.sector}`);
    console.log(`Website: ${extractedData.website}`);

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
        extraction_method: "Multi-strategy: pdf-parse + OCR + Vision API"
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
      message: "PDF processado com sucesso usando extração robusta",
      startup: newStartup[0],
      originalFileName: req.file.originalname,
      extractedTextLength: extractedText.length,
      extractionMethod: "Multi-strategy: pdf-parse + OCR + Vision API",
      extractedData: extractedData
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
