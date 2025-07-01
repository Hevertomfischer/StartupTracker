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

// Função para usar OpenAI Vision API para analisar PDF convertido em imagem
async function analyzePDFWithVision(filePath: string, startupName: string): Promise<any> {
  console.log(`=== ANALISANDO PDF COM VISION API ===`);
  
  try {
    // Para esta implementação, vamos criar dados básicos que indicam claramente
    // que a extração visual não está funcionando ainda
    console.log("AVISO: Análise visual de PDF não implementada ainda");
    console.log("Criando registro básico apenas com nome fornecido");
    
    return {
      name: startupName,
      description: `Startup ${startupName} - PDF recebido mas extração automática de dados ainda não implementada. Dados devem ser inseridos manualmente através da revisão.`,
      ceo_name: null,
      ceo_email: null,
      sector: null,
      business_model: null,
      mrr: null,
      client_count: null,
      problem_solution: "PDF processado - dados devem ser extraídos manualmente",
      attention_points: "Sistema requer implementação de extração de texto/OCR para automatizar completamente"
    };
    
  } catch (error: any) {
    console.error('Erro na análise visual:', error.message);
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

    // Analisar PDF (atualmente retorna dados básicos)
    const extractedData = await analyzePDFWithVision(req.file.path, name);
    
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