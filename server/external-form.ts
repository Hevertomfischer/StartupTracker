import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import { storage } from './storage';
import { insertStartupSchema } from '@shared/schema';
import { z } from 'zod';

// Configuração de armazenamento para o Multer
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuração do armazenamento para uploads
const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniquePrefix = uuidv4();
    cb(null, `${uniquePrefix}-${file.originalname}`);
  },
});

// Filtro para permitir apenas documentos
const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de arquivo não suportado. Apenas documentos são permitidos.'));
  }
};

// Configuração do upload
const upload = multer({
  storage: fileStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Schema para validação dos dados do formulário externo
const externalFormSchema = z.object({
  name: z.string().min(1, "Nome da startup é obrigatório"),
  ceo_name: z.string().min(3, "Nome do CEO deve ter pelo menos 3 caracteres"),
  ceo_email: z.string().email("Email do CEO inválido"),
  ceo_phone: z.string().min(10, "Telefone deve ter pelo menos 10 caracteres"),
  business_model: z.string().min(2, "Modelo de negócios deve ter pelo menos 2 caracteres"),
  industry: z.string().min(2, "Solução para o problema deve ter pelo menos 2 caracteres"),
  differentials: z.string().min(10, "Diferenciais da startup deve ter pelo menos 10 caracteres"),
  employee_count: z.coerce.number().int().min(1, "Número de funcionários deve ser pelo menos 1"),
  sector: z.string().min(2, "Setor deve ter pelo menos 2 caracteres"),
  city: z.string().min(2, "Cidade deve ter pelo menos 2 caracteres"),
  state: z.string().min(2, "Estado deve ter pelo menos 2 caracteres"),
  website: z.string().url("URL do website inválida").optional().or(z.literal("")),
  valuation: z.coerce.number().optional(),
});

// Middleware de upload para o pitch deck
export const uploadPitchDeck = upload.single('pitch_deck');

// Controlador para processar o formulário externo
export const handleExternalForm = async (req: Request, res: Response) => {
  try {
    // Verificar se o arquivo foi enviado
    if (!req.file) {
      return res.status(400).json({ message: 'O Pitch Deck é obrigatório.' });
    }

    // Debug: Ver o que está chegando no req.body
    console.log('Dados recebidos no req.body:', req.body);

    // Validar dados do formulário
    const formData = externalFormSchema.parse(req.body);

    // Preparar dados para criação da startup com todos os campos necessários
    const startupData = {
      name: formData.name,
      ceo_name: formData.ceo_name,
      ceo_email: formData.ceo_email,
      ceo_whatsapp: formData.ceo_phone,
      business_model: formData.business_model,
      problem_solution: formData.industry, // Solução para o problema
      differentials: formData.differentials,
      sector: formData.sector,
      employee_count: formData.employee_count,
      city: formData.city,
      state: formData.state,
      website: formData.website || null,
      founding_date: new Date().toISOString(),
      status_id: "e74a05a6-6612-49af-95a1-f42b035d5c4d", // Cadastrada (primeiro status)
      // Campos obrigatórios pelo schema - preenchidos com valores padrão
      description: `Problema: ${formData.business_model} | Solução: ${formData.industry} | Diferenciais: ${formData.differentials}`,
      investment_stage: "Não informado",
      mrr: 0,
      tam: formData.valuation || null,
    };

    // Usar o schema padrão agora que temos todos os campos necessários
    const parsedData = insertStartupSchema.parse(startupData);

    // Criar a startup no sistema
    const startup = await storage.createStartup(parsedData);

    // Registrar no histórico de status
    await storage.createStartupStatusHistoryEntry({
      startup_id: startup.id,
      status_id: startup.status_id!,
      status_name: "Cadastrada", // Nome do status para exibição
      start_date: new Date(),
      end_date: null,
    });

    return res.status(201).json({
      success: true,
      message: 'Startup cadastrada com sucesso!',
      startupId: startup.id
    });
  } catch (error) {
    console.error('Erro ao processar formulário externo:', error);
    
    // Verificar se é um erro de validação do Zod
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Erro de validação dos dados',
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Erro ao processar o cadastro da startup.'
    });
  }
};