import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import { eq } from "drizzle-orm";
import OpenAI from "openai";
import { fromPath } from "pdf2pic";

// Initialize OpenAI client
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

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

// Função para extrair informações do PDF (simplificada)
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`Processando PDF: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    
    console.log(`Arquivo PDF processado com sucesso: ${fileName} (${stats.size} bytes)`);
    
    // Convert PDF to images and use OpenAI Vision for analysis
    try {
      console.log(`Convertendo PDF para imagens para análise com OpenAI Vision: ${fileName}`);
      
      const convert = fromPath(filePath, {
        density: 100,           // Output DPI
        saveFilename: "page",   // File name prefix
        savePath: path.dirname(filePath), // Save to temp directory
        format: "png",          // Output format
        width: 1200,           // Width in pixels
        height: 1600           // Height in pixels
      });
      
      // Convert first few pages to images
      const maxPages = 3; // Limit to first 3 pages for analysis
      const pageImages = [];
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        try {
          const result = await convert(pageNum, { responseType: "base64" });
          if (result.base64) {
            pageImages.push(result.base64);
            console.log(`Página ${pageNum} convertida para imagem`);
          }
        } catch (pageError) {
          console.error(`Erro ao converter página ${pageNum}:`, pageError);
          break; // Stop if we can't convert a page
        }
      }
      
      if (pageImages.length > 0) {
        console.log(`${pageImages.length} páginas convertidas para análise`);
        
        // Use OpenAI Vision to analyze the first page
        const firstPageBase64 = pageImages[0];
        
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Analise esta imagem de um pitch deck de startup e extraia TODAS as informações visíveis no texto.
                  
                  Procure especificamente por:
                  - Nome da empresa/startup
                  - Nome do CEO/fundador
                  - Email do CEO
                  - Telefone/WhatsApp
                  - Setor/área de atuação
                  - Modelo de negócio
                  - Website/URL
                  - Localização (cidade, estado)
                  - Métricas (MRR, clientes, funcionários)
                  - Descrição do que a empresa faz
                  
                  Extraia APENAS informações que você pode ver claramente na imagem.
                  Retorne em formato de texto estruturado com todos os dados encontrados.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/png;base64,${firstPageBase64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        });
        
        const extractedText = visionResponse.choices[0].message.content || '';
        console.log(`Texto extraído via OpenAI Vision: ${extractedText.substring(0, 500)}...`);
        
        return extractedText;
        
      } else {
        console.log('Não foi possível converter nenhuma página do PDF');
        return `PDF Document: ${fileName} - Could not convert pages for analysis`;
      }
      
    } catch (pdfError) {
      console.error('Erro ao processar PDF:', pdfError);
      const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown error';
      return `PDF Document: ${fileName} - Error processing: ${errorMessage}`;
    }

    // Fallback to basic file info
    return `
      PDF Document: ${fileName}
      File Size: ${stats.size} bytes
      Processed: ${new Date().toISOString()}
      
      This PDF contains startup information that needs to be reviewed manually.
      Please use the AI review system to complete the startup details.
    `;
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Falha ao processar o arquivo PDF: ${errorMessage}`);
  }
}

// Função para criar dados básicos da startup
async function extractDataWithAI(text: string, startupName: string): Promise<any> {
  console.log("Criando registro básico da startup...");
  console.log("Nome da startup:", startupName);
  
  // Extract potential data using regex patterns and keyword search
  const textLower = text.toLowerCase();
  const extractedData: any = {
    name: startupName,
    description: `Startup processada via AI a partir de PDF. Documento contém informações que precisam ser revisadas manualmente.`
  };
  
  // Use OpenAI to extract structured data from the PDF text
  try {
    console.log('Usando OpenAI para extrair dados estruturados...');
    
    const prompt = `
Analise o seguinte texto extraído de um pitch deck de startup e extraia as informações estruturadas.
Retorne APENAS um objeto JSON válido com os campos encontrados no documento.

IMPORTANTE: Extraia informações REAIS do texto fornecido. Não invente dados.

Campos a procurar:
- ceo_name: Nome do CEO/fundador (procure por "CEO", "Founder", "Fundador")
- ceo_email: Email do CEO/fundador (formato email válido)
- ceo_whatsapp: WhatsApp do CEO (número de telefone)
- ceo_linkedin: LinkedIn do CEO (URL ou perfil)
- sector: Setor da empresa (tecnologia, fintech, saúde, etc.)
- business_model: Modelo de negócio (SaaS, marketplace, etc.)
- website: Site da empresa (URL)
- city: Cidade da empresa
- state: Estado da empresa
- mrr: MRR (Monthly Recurring Revenue) em número
- client_count: Número de clientes atual
- employee_count: Número de funcionários/colaboradores
- description: Descrição clara da empresa baseada no texto (máximo 500 caracteres)

REGRAS:
1. Se um campo não for encontrado no texto, NÃO inclua no JSON
2. Extraia apenas informações que estão explicitamente no texto
3. Para números (mrr, client_count, employee_count), use apenas valores numéricos
4. Para description, resuma o que a empresa faz baseado no texto real

Texto do PDF:
${text}

Responda apenas com o JSON válido:`;

    // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de documentos de startups. Extraia informações precisas do texto fornecido e retorne apenas JSON válido."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1
    });

    const responseContent = response.choices[0].message.content;
    if (!responseContent) {
      throw new Error('OpenAI returned empty response');
    }
    
    const aiExtractedData = JSON.parse(responseContent);
    console.log('Dados extraídos pela OpenAI:', aiExtractedData);
    
    // Merge AI-extracted data with base data
    Object.assign(extractedData, aiExtractedData);
    
  } catch (aiError) {
    console.error('Erro ao usar OpenAI para extração:', aiError);
    // Fallback to basic regex extraction if OpenAI fails
    console.log('Usando extração básica como fallback...');
    
    // Try to extract CEO name
    const ceoPatterns = [
      /ceo[:\s]+([a-záàâãéèêíïóôõöúçñ\s]+)/i,
      /founder[:\s]+([a-záàâãéèêíïóôõöúçñ\s]+)/i,
      /fundador[:\s]+([a-záàâãéèêíïóôõöúçñ\s]+)/i,
    ];
    
    for (const pattern of ceoPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        extractedData.ceo_name = match[1].trim().split('\n')[0].substring(0, 100);
        break;
      }
    }
    
    // Try to extract email
    const emailMatch = text.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      extractedData.ceo_email = emailMatch[1];
    }
  }
  
  console.log("Dados básicos criados:", extractedData);
  return extractedData;
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

    // Create startup record in database with extracted data
    console.log("Criando startup no banco de dados...");
    
    // Build insert object with only valid schema fields
    const insertData: any = {
      name: extractedData.name || name,
      description: extractedData.description || `Startup processada via AI a partir de PDF.`,
      status_id: cadastradaStatus?.id || null,
      created_by_ai: true,
      ai_reviewed: false,
      ai_extraction_data: JSON.stringify(extractedData)
    };
    
    // Add optional fields only if they exist in extracted data
    if (extractedData.ceo_name) insertData.ceo_name = extractedData.ceo_name;
    if (extractedData.ceo_email) insertData.ceo_email = extractedData.ceo_email;
    if (extractedData.ceo_whatsapp) insertData.ceo_whatsapp = extractedData.ceo_whatsapp;
    if (extractedData.ceo_linkedin) insertData.ceo_linkedin = extractedData.ceo_linkedin;
    if (extractedData.business_model) insertData.business_model = extractedData.business_model;
    if (extractedData.sector) insertData.sector = extractedData.sector;
    if (extractedData.city) insertData.city = extractedData.city;
    if (extractedData.state) insertData.state = extractedData.state;
    if (extractedData.website) insertData.website = extractedData.website;
    if (extractedData.founding_date) insertData.founding_date = extractedData.founding_date;
    if (extractedData.mrr) insertData.mrr = extractedData.mrr;
    if (extractedData.client_count) insertData.client_count = extractedData.client_count;
    
    console.log("Dados para inserção:", insertData);
    
    const newStartup = await db.insert(startups).values(insertData).returning();

    console.log("Startup criada com sucesso:", newStartup[0].id);
    console.log("Dados salvos:", {
      name: newStartup[0].name,
      ceo_name: newStartup[0].ceo_name,
      sector: newStartup[0].sector,
      website: newStartup[0].website
    });
    
    // Move PDF to uploads directory and save as pitch deck
    console.log("Salvando PDF como pitch deck da startup...");
    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const originalFileName = req.file.originalname;
    const fileExtension = path.extname(originalFileName);
    const newFileName = `${newStartup[0].id}-pitch-deck${fileExtension}`;
    const finalPath = path.join(uploadsDir, newFileName);
    
    // Move file from temp to uploads
    fs.renameSync(req.file.path, finalPath);
    
    // For now, just log the file was moved successfully
    console.log(`PDF salvo como: ${finalPath}`);
    
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
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      message: "Erro ao processar pitch deck", 
      error: errorMessage 
    });
  }
};