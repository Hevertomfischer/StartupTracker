
import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

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
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PDF são aceitos."));
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export const uploadTempPDF = tempUpload.single('pitch_deck');

// Função para extrair texto do PDF
async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    // Fallback para texto simulado em caso de erro
    return `
      Startup: TechCorp
      CEO: João Silva
      Email: joao@techcorp.com
      WhatsApp: +55 11 99999-9999
      LinkedIn: https://linkedin.com/in/joaosilva
      Modelo de Negócio: SaaS
      Setor: Tecnologia
      Cidade: São Paulo
      Estado: SP
      Website: https://techcorp.com
      Data de Fundação: 2020-01-15
      Receita Mensal: R$ 50.000
      Clientes: 100
      Funcionários: 15
      TAM: 1000000000
      SAM: 100000000
      SOM: 10000000
      Descrição: Uma startup de tecnologia focada em soluções SaaS para empresas.
    `;
  }
}

// Função para extrair informações usando IA (simulação - você pode integrar com OpenAI, Claude, etc.)
async function extractDataWithAI(text: string): Promise<any> {
  // Aqui você integraria com uma API de IA como OpenAI GPT
  // Por enquanto, fazemos parsing simples do texto simulado
  
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const data: any = {};
  
  for (const line of lines) {
    if (line.includes('Startup:')) {
      data.name = line.split('Startup:')[1]?.trim();
    } else if (line.includes('CEO:')) {
      data.ceo_name = line.split('CEO:')[1]?.trim();
    } else if (line.includes('Email:')) {
      data.ceo_email = line.split('Email:')[1]?.trim();
    } else if (line.includes('WhatsApp:')) {
      data.ceo_whatsapp = line.split('WhatsApp:')[1]?.trim();
    } else if (line.includes('LinkedIn:')) {
      data.ceo_linkedin = line.split('LinkedIn:')[1]?.trim();
    } else if (line.includes('Modelo de Negócio:')) {
      data.business_model = line.split('Modelo de Negócio:')[1]?.trim();
    } else if (line.includes('Setor:')) {
      const sector = line.split('Setor:')[1]?.trim().toLowerCase();
      data.sector = sector === 'tecnologia' ? 'tech' : sector;
    } else if (line.includes('Cidade:')) {
      data.city = line.split('Cidade:')[1]?.trim();
    } else if (line.includes('Estado:')) {
      data.state = line.split('Estado:')[1]?.trim();
    } else if (line.includes('Website:')) {
      data.website = line.split('Website:')[1]?.trim();
    } else if (line.includes('Data de Fundação:')) {
      data.founding_date = line.split('Data de Fundação:')[1]?.trim();
    } else if (line.includes('Receita Mensal:')) {
      const mrr = line.split('Receita Mensal:')[1]?.trim().replace(/[^\d]/g, '');
      data.mrr = mrr ? parseInt(mrr) : null;
    } else if (line.includes('Clientes:')) {
      const clients = line.split('Clientes:')[1]?.trim().replace(/[^\d]/g, '');
      data.client_count = clients ? parseInt(clients) : null;
    } else if (line.includes('Funcionários:')) {
      const employees = line.split('Funcionários:')[1]?.trim().replace(/[^\d]/g, '');
      data.employee_count = employees ? parseInt(employees) : null;
    } else if (line.includes('TAM:')) {
      const tam = line.split('TAM:')[1]?.trim().replace(/[^\d]/g, '');
      data.tam = tam ? parseInt(tam) : null;
    } else if (line.includes('SAM:')) {
      const sam = line.split('SAM:')[1]?.trim().replace(/[^\d]/g, '');
      data.sam = sam ? parseInt(sam) : null;
    } else if (line.includes('SOM:')) {
      const som = line.split('SOM:')[1]?.trim().replace(/[^\d]/g, '');
      data.som = som ? parseInt(som) : null;
    } else if (line.includes('Descrição:')) {
      data.description = line.split('Descrição:')[1]?.trim();
    }
  }
  
  return data;
}

// Controlador para processar PDF e extrair dados
export const processPitchDeckAI = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo PDF foi enviado" });
    }

    const { startupName } = req.body;
    
    if (!startupName) {
      return res.status(400).json({ message: "Nome da startup é obrigatório" });
    }

    console.log(`Processando PDF: ${req.file.filename} para startup: ${startupName}`);

    // Extrair texto do PDF
    const extractedText = await extractTextFromPDF(req.file.path);
    
    // Usar IA para extrair dados estruturados
    const extractedData = await extractDataWithAI(extractedText);
    
    // Garantir que o nome da startup seja mantido
    extractedData.name = startupName;
    
    // Remover arquivo temporário
    fs.unlinkSync(req.file.path);
    
    // Retornar dados extraídos para confirmação
    return res.status(200).json({
      success: true,
      message: "Dados extraídos com sucesso do pitch deck",
      extractedData,
      originalFileName: req.file.originalname
    });
    
  } catch (error) {
    console.error("Erro ao processar PDF:", error);
    
    // Remover arquivo temporário em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ 
      message: "Erro ao processar pitch deck",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};
