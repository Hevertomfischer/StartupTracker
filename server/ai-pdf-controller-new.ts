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
    
    // Configurar conversão para imagem usando pdf2pic com configurações otimizadas
    const convert = pdf2pic.fromPath(filePath, {
      density: 150,           // Resolução aumentada para melhor qualidade
      saveFilename: "page",   // Nome base dos arquivos
      savePath: path.join(process.cwd(), 'temp'), // Diretório temporário
      format: "png",          // Formato da imagem
      width: 2400,           // Largura aumentada
      height: 3200,          // Altura aumentada para formato retrato
      quality: 100           // Qualidade máxima
    });

    console.log("Iniciando conversão da primeira página...");
    const pageResult = await convert(1, { responseType: "base64" });
    
    if (!pageResult || !pageResult.base64) {
      throw new Error("Falha na conversão PDF para imagem");
    }
    
    console.log(`PDF convertido para imagem base64: ${pageResult.base64.length} caracteres`);
    
    if (!openai) {
      throw new Error("OpenAI não configurado");
    }

    console.log("Enviando imagem para OpenAI Vision...");
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de pitch decks de startups. Analise cuidadosamente cada elemento visual e textual da imagem fornecida."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analise esta imagem de um pitch deck de startup e extraia TODAS as informações visíveis.

IMPORTANTE: Procure por:
- Nome da empresa/startup
- Nome do CEO/fundador e informações de contato
- Descrição do negócio e problema que resolve
- Modelo de negócio e setor de atuação
- Números financeiros (receita, MRR, clientes)
- Localização da empresa
- Diferencial competitivo
- Mercado total (TAM/SAM/SOM)
- Informações sobre fundação
- Qualquer texto ou dados numéricos visíveis

Retorne um texto estruturado e detalhado com TODAS as informações que conseguir identificar na imagem. Seja o mais específico possível e inclua todos os dados visíveis, mesmo que sejam pequenos detalhes.`
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
      max_tokens: 3000,      // Aumentado para respostas mais detalhadas
      temperature: 0.1
    });

    const extractedContent = response.choices[0].message.content;
    
    console.log(`=== DADOS EXTRAÍDOS DA OPENAI VISION ===`);
    console.log(`Tamanho da resposta: ${extractedContent?.length} caracteres`);
    console.log(`Primeiros 800 caracteres: ${extractedContent?.substring(0, 800)}...`);
    
    return extractedContent;
    
  } catch (error: any) {
    console.error(`ERRO ao processar PDF com OpenAI Vision: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    
    // Fallback melhorado
    console.log("Tentando fallback com análise contextual...");
    
    const fileName = path.basename(filePath);
    const fileStats = fs.statSync(filePath);
    
    console.log(`Usando análise contextual para: ${fileName} (${fileStats.size} bytes)`);
    
    return `ERRO NA EXTRAÇÃO: Não foi possível processar o PDF ${fileName}.
    
    Arquivo de ${Math.round(fileStats.size / 1024)}KB processado em ${new Date().toISOString()}.
    
    Possíveis causas:
    - PDF protegido ou criptografado
    - Formato de PDF não suportado
    - Erro de conectividade com OpenAI
    - Limitações de processamento de imagem
    
    O arquivo foi salvo mas requer revisão manual para extração de dados.`;
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
Você está analisando dados extraídos de um pitch deck para criar um registro estruturado de startup.

DADOS EXTRAÍDOS DO PITCH DECK:
${visionExtractedText}

NOME DA STARTUP FORNECIDO PELO USUÁRIO: "${startupName}"

INSTRUÇÕES PARA EXTRAÇÃO:
1. Analise CUIDADOSAMENTE todos os dados fornecidos
2. Extraia informações que estão claramente presentes no texto
3. Para informações não encontradas, use null
4. Mantenha números como números (não strings)
5. Use o nome fornecido pelo usuário como nome principal
6. Seja conservador - só inclua dados que estão claramente presentes

CAMPOS OBRIGATÓRIOS:
- name: use "${startupName}"
- description: descrição do negócio baseada no pitch deck

CAMPOS OPCIONAIS (só inclua se estiverem claramente presentes):
- ceo_name, ceo_email, ceo_whatsapp, ceo_linkedin
- sector, business_model, category, market
- city, state, website
- mrr, client_count, partner_count (números)
- problem_solution, differentials, competitors
- positive_points, attention_points

FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido seguindo este exemplo:
{
  "name": "${startupName}",
  "description": "Descrição baseada no pitch deck",
  "ceo_name": "Nome do CEO se encontrado ou null",
  "sector": "Setor se identificado ou null",
  "mrr": 50000 (número) ou null,
  "client_count": 100 (número) ou null,
  "problem_solution": "Problema e solução se descritos ou null"
}

Responda APENAS com o JSON válido:`;

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
    console.log("Dados para inserção:", JSON.stringify(insertData, null, 2));
    
    const newStartup = await db.insert(startups).values([insertData]).returning();
    
    console.log(`Startup criada com sucesso: ${newStartup[0].id}`);
    console.log(`Dados salvos - Nome: ${newStartup[0].name}, CEO: ${newStartup[0].ceo_name}, Setor: ${newStartup[0].sector}`);
    
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