
import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

// Função para processar PDF usando Python
async function processPDFWithPython(filePath: string, startupName: string): Promise<any> {
  console.log("=== PROCESSANDO COM PYTHON ===");
  
  try {
    const pythonScript = path.join(process.cwd(), 'server', 'pdf-extractor-python.py');
    const command = `python3 "${pythonScript}" "${filePath}" "${startupName}"`;
    
    console.log(`Executando: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr) {
      console.log(`Python stderr: ${stderr}`);
    }
    
    const result = JSON.parse(stdout);
    console.log("✅ Python processou com sucesso");
    console.log(`Texto extraído: ${result.text_length} caracteres`);
    console.log(`Método: ${result.extraction_method}`);
    
    return result;
    
  } catch (error: any) {
    console.error("❌ Erro ao processar com Python:", error.message);
    throw error;
  }
}

// Controlador principal
export const processPitchDeckHybrid = async (req: Request, res: Response) => {
  console.log("=== PROCESSAMENTO HÍBRIDO AI PDF ===");
  
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

    // Processar com Python
    const pythonResult = await processPDFWithPython(req.file.path, name);
    
    if (pythonResult.error) {
      throw new Error(`Erro no processamento Python: ${pythonResult.error}`);
    }

    const extractedData = pythonResult.analysis;
    const extractedText = pythonResult.extracted_text;
    
    console.log("=== DADOS EXTRAÍDOS ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`CEO: ${extractedData.ceo_name}`);
    console.log(`Setor: ${extractedData.sector}`);
    console.log(`Descrição: ${extractedData.description?.substring(0, 100)}...`);

    // Buscar status "Cadastrada" 
    const cadastradaStatus = await db.query.statuses.findFirst({
      where: (statuses, { ilike }) => ilike(statuses.name, '%cadastr%')
    });

    // Preparar dados para inserção
    const insertData = {
      name: extractedData.name || name,
      description: extractedData.description || `Startup ${name} processada via Python + AI.`,
      status_id: cadastradaStatus?.id || null,
      ai_extraction_data: JSON.stringify({
        ...extractedData,
        extracted_text_length: pythonResult.text_length,
        extraction_method: pythonResult.extraction_method,
        processor: "Python + OpenAI"
      }),
      created_by_ai: true,
      ai_reviewed: false,
      
      // Campos extraídos
      ceo_name: extractedData.ceo_name || null,
      sector: extractedData.sector || null,
      business_model: extractedData.business_model || null,
      city: extractedData.city || null,
      state: extractedData.state || null,
      website: extractedData.website || null,
      problem_solution: extractedData.problem_solution || null,
      differentials: extractedData.differentials || null,
      competitors: extractedData.competitors || null,
      market: extractedData.market || null,
      
      // Campos numéricos
      mrr: extractedData.mrr ? String(extractedData.mrr) : null,
      client_count: extractedData.client_count ? Number(extractedData.client_count) : null,
    };

    console.log("=== INSERINDO NO BANCO ===");
    const newStartup = await db.insert(startups).values([insertData]).returning();
    
    console.log(`✅ Startup criada: ${newStartup[0].id}`);
    
    // Limpar arquivo temporário
    if (fs.existsSync(req.file.path)) {
      await fs.promises.unlink(req.file.path);
      console.log("Arquivo temporário removido");
    }

    return res.status(200).json({
      success: true,
      message: "PDF processado com sucesso usando Python + AI",
      startup: newStartup[0],
      originalFileName: req.file.originalname,
      extractedTextLength: pythonResult.text_length,
      extractionMethod: pythonResult.extraction_method,
      extractedData: extractedData
    });
    
  } catch (error: any) {
    console.error("=== ERRO NO PROCESSAMENTO HÍBRIDO ===");
    console.error("Erro:", error.message);
    
    // Limpar arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        await fs.promises.unlink(req.file.path);
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
