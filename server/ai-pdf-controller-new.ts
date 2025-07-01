import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";

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
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

export const uploadTempPDF = tempUpload.single('file');

// Função para converter PDF em base64 e enviar para OpenAI Vision
async function extractDataWithOpenAIVision(filePath: string): Promise<string | null> {
  console.log(`=== ENVIANDO PDF DIRETO PARA OPENAI VISION ===`);
  
  try {
    // Ler o arquivo PDF como buffer
    const pdfBuffer = fs.readFileSync(filePath);
    const pdfBase64 = pdfBuffer.toString('base64');
    
    console.log(`PDF convertido para base64: ${pdfBase64.length} caracteres`);
    
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
              text: `Analise este documento PDF e extraia todas as informações sobre a startup. 
              
              Procure especificamente por:
              - Nome da empresa/startup
              - Descrição do negócio e produto
              - Informações do CEO/fundador (nome, email, telefone, LinkedIn)
              - Modelo de negócio e setor
              - Métricas financeiras (MRR, receita, clientes)
              - Mercado (TAM, SAM, SOM)
              - Localização (cidade, estado)
              - Website e contatos
              - Problema que resolve e solução oferecida
              - Concorrentes e diferenciais
              - Equipe e parceiros
              
              Retorne um texto estruturado com todas as informações encontradas no documento.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${pdfBase64}`
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
    
    // Se Vision falhar, tentar análise básica do nome do arquivo
    const fileName = path.basename(filePath);
    console.log(`Usando nome do arquivo como fallback: ${fileName}`);
    
    return `Documento PDF analisado: ${fileName}. OpenAI Vision não conseguiu processar o conteúdo visual.`;
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
Analise este conteúdo extraído do pitch deck da startup "${startupName}" e estruture em formato JSON.

DADOS EXTRAÍDOS DO PDF PELA VISION:
${visionExtractedText}

Extraia APENAS informações presentes no texto acima:

{
  "name": "Nome da startup (use '${startupName}' se não encontrar)",
  "description": "Descrição do negócio",
  "ceo_name": "Nome do CEO/fundador",
  "ceo_email": "Email do CEO",
  "ceo_whatsapp": "WhatsApp",
  "ceo_linkedin": "LinkedIn",
  "business_model": "Modelo de negócio",
  "sector": "Setor",
  "category": "Categoria",
  "market": "Mercado alvo",
  "city": "Cidade",
  "state": "Estado",
  "website": "Website",
  "founding_date": "Data fundação (YYYY-MM-DD)",
  "mrr": "Receita recorrente mensal (apenas número)",
  "accumulated_revenue_current_year": "Receita acumulada ano atual",
  "total_revenue_last_year": "Receita ano passado",
  "tam": "Mercado total",
  "sam": "Mercado endereçável",
  "som": "Mercado obtível",
  "client_count": "Número de clientes",
  "partner_count": "Número de parceiros",
  "problem_solution": "Problema e solução",
  "differentials": "Diferenciais",
  "competitors": "Concorrentes",
  "positive_points": "Pontos positivos",
  "attention_points": "Pontos de atenção"
}

IMPORTANTE: Use APENAS dados extraídos pela Vision API. Não invente informações. Se um campo não estiver presente nos dados extraídos, use null.
`;

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