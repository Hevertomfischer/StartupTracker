
import { Request, Response } from "express";
import { db } from "./db.js";
import { startups } from "../shared/schema.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import OpenAI from "openai";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

// Função para extrair texto usando múltiplas estratégias
async function extractTextFromPDF(filePath: string): Promise<string> {
  console.log(`=== INICIANDO EXTRAÇÃO ROBUSTA DO PDF ===`);
  console.log(`Arquivo: ${filePath}`);
  
  try {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }
    
    const fileStats = fs.statSync(filePath);
    console.log(`Tamanho do arquivo: ${Math.round(fileStats.size / 1024)}KB`);
    
    let extractedText = "";
    let extractionMethod = "";
    
    // ESTRATÉGIA 1: Usar Python script diretamente (mais confiável)
    try {
      console.log("=== ESTRATÉGIA 1: SCRIPT PYTHON ===");
      
      const pythonScript = path.join(process.cwd(), 'server', 'pdf-extractor-python.py');
      if (!fs.existsSync(pythonScript)) {
        console.log("Script Python não encontrado, criando...");
        // O script já existe, vamos usá-lo
      }
      
      const command = `python3 "${pythonScript}" "${filePath}" "TempStartup"`;
      console.log(`Executando: ${command}`);
      
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      
      if (stderr && !stderr.includes('UserWarning')) {
        console.log(`Python stderr (avisos): ${stderr}`);
      }
      
      if (stdout && stdout.trim()) {
        try {
          const pythonResult = JSON.parse(stdout);
          if (pythonResult.extracted_text && pythonResult.extracted_text.length > 100) {
            extractedText = pythonResult.extracted_text;
            extractionMethod = "Python pdfplumber + OCR";
            console.log(`✅ Python extraiu ${extractedText.length} caracteres`);
            console.log(`Amostra: ${extractedText.substring(0, 200)}...`);
            return extractedText;
          }
        } catch (parseError) {
          console.log(`Erro ao parsear resultado Python: ${parseError}`);
        }
      }
      
    } catch (pythonError: any) {
      console.log(`❌ Estratégia Python falhou: ${pythonError.message}`);
    }
    
    // ESTRATÉGIA 2: Usar pdftotext (poppler-utils)
    try {
      console.log("=== ESTRATÉGIA 2: PDFTOTEXT ===");
      
      const { stdout } = await execAsync(`pdftotext "${filePath}" -`);
      
      if (stdout && stdout.trim().length > 50) {
        extractedText = stdout.trim();
        extractionMethod = "pdftotext";
        console.log(`✅ pdftotext extraiu ${extractedText.length} caracteres`);
        console.log(`Amostra: ${extractedText.substring(0, 200)}...`);
        return extractedText;
      }
      
    } catch (pdftotextError: any) {
      console.log(`❌ pdftotext falhou: ${pdftotextError.message}`);
    }
    
    // ESTRATÉGIA 3: Converter para imagens e usar OCR
    try {
      console.log("=== ESTRATÉGIA 3: PDF PARA IMAGENS + OCR ===");
      
      const tempDir = path.dirname(filePath);
      const baseName = path.basename(filePath, '.pdf');
      
      // Converter PDF para imagens usando pdftoppm
      await execAsync(`pdftoppm "${filePath}" "${tempDir}/${baseName}" -png -f 1 -l 5`);
      
      // Buscar arquivos de imagem gerados
      const imageFiles = fs.readdirSync(tempDir).filter(file => 
        file.startsWith(baseName) && file.endsWith('.png')
      );
      
      console.log(`Geradas ${imageFiles.length} imagens`);
      
      let ocrText = "";
      for (const imageFile of imageFiles.slice(0, 3)) { // Limitar a 3 páginas
        const imagePath = path.join(tempDir, imageFile);
        try {
          const { stdout } = await execAsync(`tesseract "${imagePath}" stdout -l por+eng`);
          if (stdout && stdout.trim()) {
            ocrText += `\n=== PÁGINA ${imageFile} ===\n${stdout.trim()}\n`;
          }
          
          // Limpar arquivo de imagem
          fs.unlinkSync(imagePath);
        } catch (ocrError) {
          console.log(`Erro OCR em ${imageFile}: ${ocrError}`);
        }
      }
      
      if (ocrText.trim().length > 50) {
        extractedText = ocrText.trim();
        extractionMethod = "PDF para imagens + Tesseract OCR";
        console.log(`✅ OCR extraiu ${extractedText.length} caracteres`);
        console.log(`Amostra: ${extractedText.substring(0, 200)}...`);
        return extractedText;
      }
      
    } catch (ocrError: any) {
      console.log(`❌ Estratégia OCR falhou: ${ocrError.message}`);
    }
    
    // ESTRATÉGIA 4: Análise direta com OpenAI Vision (para PDFs pequenos)
    if (fileStats.size < 10 * 1024 * 1024) { // Menos de 10MB
      try {
        console.log("=== ESTRATÉGIA 4: OPENAI VISION DIRECT ===");
        
        // Converter primeira página para base64
        const tempDir = path.dirname(filePath);
        const baseName = path.basename(filePath, '.pdf');
        const imagePath = `${tempDir}/${baseName}-vision.png`;
        
        await execAsync(`pdftoppm "${filePath}" "${tempDir}/${baseName}-vision" -png -f 1 -l 1 -scale-to 1500`);
        
        if (fs.existsSync(imagePath)) {
          const imageBuffer = fs.readFileSync(imagePath);
          const base64Image = imageBuffer.toString('base64');
          
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Extraia todo o texto visível desta página de pitch deck. Mantenha a formatação e estrutura. Retorne apenas o texto extraído."
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
          
          // Limpar arquivo de imagem
          fs.unlinkSync(imagePath);
          
          if (visionText && visionText.trim().length > 50) {
            extractedText = visionText.trim();
            extractionMethod = "OpenAI Vision API";
            console.log(`✅ Vision API extraiu ${extractedText.length} caracteres`);
            console.log(`Amostra: ${extractedText.substring(0, 200)}...`);
            return extractedText;
          }
        }
        
      } catch (visionError: any) {
        console.log(`❌ Vision API falhou: ${visionError.message}`);
      }
    }
    
    // Se todas as estratégias falharam, criar conteúdo baseado em metadados
    console.log("❌ TODAS AS ESTRATÉGIAS FALHARAM");
    const fileName = path.basename(filePath);
    
    extractedText = `
DOCUMENTO PDF ANALISADO: ${fileName}
TAMANHO: ${Math.round(fileStats.size / 1024)}KB
DATA DE PROCESSAMENTO: ${new Date().toISOString()}

INFORMAÇÕES DISPONÍVEIS:
- Este é um pitch deck em formato PDF
- Documento requer revisão manual para extração completa
- O sistema não conseguiu extrair texto automaticamente
- Recomenda-se análise manual do conteúdo

PRÓXIMOS PASSOS:
1. Revisar o pitch deck manualmente
2. Completar as informações da startup no sistema
3. Verificar se o PDF não está protegido ou corrompido
    `.trim();
    
    extractionMethod = "Metadados do arquivo (fallback)";
    
    return extractedText;
    
  } catch (error: any) {
    console.error(`ERRO GERAL na extração: ${error.message}`);
    throw new Error(`Falha crítica na extração do PDF: ${error.message}`);
  }
}

// Função melhorada para analisar dados extraídos usando OpenAI
async function analyzePDFWithAI(extractedText: string, startupName: string): Promise<any> {
  console.log(`=== ANÁLISE AVANÇADA COM IA ===`);
  console.log(`Startup: ${startupName}`);
  console.log(`Texto para análise: ${extractedText.length} caracteres`);
  
  try {
    if (!openai) {
      throw new Error("OpenAI não configurado - verificar OPENAI_API_KEY");
    }
    
    // Criar prompt mais específico e detalhado
    const prompt = `
Você é um especialista em análise de pitch decks de startups brasileiras. Analise o texto extraído abaixo e extraia informações precisas para preencher um banco de dados.

NOME DA STARTUP FORNECIDO: "${startupName}"

TEXTO EXTRAÍDO DO PITCH DECK:
"""
${extractedText}
"""

INSTRUÇÕES PARA EXTRAÇÃO:
1. Analise CUIDADOSAMENTE todo o conteúdo fornecido
2. Extraia apenas informações que estão CLARAMENTE presentes no texto
3. Para informações não encontradas, use null
4. Seja PRECISO com números e valores
5. Mantenha o nome da startup como fornecido pelo usuário
6. Procure por padrões típicos de pitch decks (problema, solução, mercado, tração, etc.)

CAMPOS PARA EXTRAÇÃO:
- name: "${startupName}" (OBRIGATÓRIO - usar nome fornecido)
- description: descrição do negócio/produto
- ceo_name: nome do CEO, founder ou líder
- ceo_email: email do CEO se mencionado
- sector: setor/indústria (ex: fintech, healthtech, edtech)
- business_model: modelo de negócio (B2B, B2C, marketplace, etc.)
- city, state: localização da empresa
- website: site da empresa se mencionado
- mrr: receita recorrente mensal (apenas números)
- client_count: número de clientes (apenas números)
- founding_date: data de fundação se mencionada (formato YYYY-MM-DD)
- problem_solution: descrição do problema e solução
- differentials: diferenciais competitivos
- competitors: principais concorrentes mencionados
- market: descrição do mercado-alvo
- tam, sam, som: valores de mercado se mencionados (apenas números)

FORMATO DE RESPOSTA:
Retorne APENAS um JSON válido com os campos encontrados. Exemplo:
{
  "name": "${startupName}",
  "description": "Descrição extraída do pitch deck",
  "ceo_name": "Nome do CEO se encontrado",
  "sector": "Setor identificado",
  "business_model": "Modelo de negócio",
  "city": "Cidade",
  "state": "Estado",
  "mrr": 25000,
  "client_count": 150,
  "problem_solution": "Problema e solução descritos",
  "differentials": "Diferenciais mencionados",
  "competitors": "Concorrentes listados",
  "market": "Mercado alvo descrito"
}

RESPONDA APENAS COM O JSON VÁLIDO:`;

    console.log("Enviando para OpenAI...");
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Você é um especialista em análise de pitch decks. Extraia informações precisas e retorne apenas JSON válido com os dados encontrados no texto."
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
    
    // Garantir que o nome da startup seja preservado
    extractedData.name = startupName;
    
    console.log("=== DADOS EXTRAÍDOS PELA IA ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`Descrição: ${extractedData.description ? extractedData.description.substring(0, 100) + '...' : 'Não encontrada'}`);
    console.log(`CEO: ${extractedData.ceo_name || 'Não encontrado'}`);
    console.log(`Setor: ${extractedData.sector || 'Não identificado'}`);
    console.log(`Modelo de negócio: ${extractedData.business_model || 'Não especificado'}`);
    console.log(`MRR: ${extractedData.mrr || 'Não informado'}`);
    console.log(`Clientes: ${extractedData.client_count || 'Não informado'}`);
    
    return extractedData;
    
  } catch (error: any) {
    console.error('=== ERRO NA ANÁLISE COM IA ===');
    console.error('Erro completo:', error);
    
    // Fallback mais robusto com dados básicos
    const fallbackData = {
      name: startupName,
      description: `Startup ${startupName} processada via AI. O texto extraído contém ${extractedText.length} caracteres mas a análise com IA falhou. Dados devem ser revisados manualmente.`,
      ceo_name: null,
      sector: null,
      business_model: null,
      city: null,
      state: null,
      website: null,
      mrr: null,
      client_count: null,
      problem_solution: "Análise com IA falhou - dados devem ser inseridos manualmente",
      differentials: null,
      competitors: null,
      market: null,
      ai_extraction_error: error.message
    };
    
    console.log("Usando dados de fallback:", fallbackData);
    return fallbackData;
  }
}

// Controlador principal para processar PDF
export const processPitchDeckAI = async (req: Request, res: Response) => {
  console.log("=== PROCESSAMENTO AI PDF - VERSÃO ROBUSTA MELHORADA ===");
  
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo PDF foi enviado" });
    }

    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ message: "Nome da startup é obrigatório" });
    }

    const startupName = name.trim();
    console.log(`Processando PDF para startup: "${startupName}"`);
    console.log(`Arquivo: ${req.file.filename} (${Math.round(req.file.size / 1024)}KB)`);

    // 1. Extrair texto do PDF usando múltiplas estratégias
    console.log("=== INICIANDO EXTRAÇÃO DE TEXTO ===");
    const extractedText = await extractTextFromPDF(req.file.path);
    
    console.log(`=== TEXTO EXTRAÍDO (${extractedText.length} caracteres) ===`);
    if (extractedText.length > 300) {
      console.log(`Primeiros 300 caracteres: ${extractedText.substring(0, 300)}...`);
    } else {
      console.log(`Texto completo: ${extractedText}`);
    }

    // 2. Analisar com IA
    console.log("=== INICIANDO ANÁLISE COM IA ===");
    const extractedData = await analyzePDFWithAI(extractedText, startupName);
    
    console.log("=== DADOS FINAIS EXTRAÍDOS ===");
    console.log(`Nome: ${extractedData.name}`);
    console.log(`Descrição: ${extractedData.description || 'Não encontrada'}`);
    console.log(`CEO: ${extractedData.ceo_name || 'Não encontrado'}`);
    console.log(`Setor: ${extractedData.sector || 'Não identificado'}`);
    console.log(`Website: ${extractedData.website || 'Não informado'}`);

    // 3. Buscar status "Cadastrada" 
    const cadastradaStatus = await db.query.statuses.findFirst({
      where: (statuses, { ilike }) => ilike(statuses.name, '%cadastr%')
    });

    // 4. Preparar dados para inserção
    const insertData = {
      name: extractedData.name || startupName,
      description: extractedData.description || `Startup ${startupName} processada via AI a partir de PDF.`,
      status_id: cadastradaStatus?.id || null,
      ai_extraction_data: JSON.stringify({
        ...extractedData,
        extracted_text_length: extractedText.length,
        extraction_timestamp: new Date().toISOString(),
        file_size_kb: Math.round(req.file.size / 1024)
      }),
      created_by_ai: true,
      ai_reviewed: false,
      
      // Campos extraídos
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
      
      // Campos numéricos
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
      mrr: insertData.mrr,
      description_length: insertData.description?.length
    });
    
    const newStartup = await db.insert(startups).values([insertData]).returning();
    
    console.log(`✅ Startup criada com sucesso: ${newStartup[0].id}`);
    console.log(`Dados salvos - Nome: ${newStartup[0].name}, CEO: ${newStartup[0].ceo_name}, Setor: ${newStartup[0].sector}`);
    
    // 5. Remover arquivo temporário
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("Arquivo temporário removido");
    }

    return res.status(200).json({
      success: true,
      message: `PDF processado com sucesso para a startup "${startupName}"`,
      startup: newStartup[0],
      originalFileName: req.file.originalname,
      extractedTextLength: extractedText.length,
      extractionSummary: {
        name: extractedData.name,
        hasDescription: !!extractedData.description,
        hasCEO: !!extractedData.ceo_name,
        hasSector: !!extractedData.sector,
        hasRevenue: !!extractedData.mrr,
        hasClients: !!extractedData.client_count
      },
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
      error: error.message,
      details: "Verifique se todas as dependências estão instaladas e se o arquivo PDF não está corrompido"
    });
  }
};
