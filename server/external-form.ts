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
  ceo_name: z.string().min(1, "Nome do CEO é obrigatório"),
  ceo_email: z.string().email("E-mail do CEO inválido"),
  ceo_whatsapp: z.string().min(1, "Whatsapp do CEO é obrigatório"),
  foundation_year: z.string().min(1, "Ano da fundação é obrigatório"),
  problem: z.string().min(1, "Problema que resolve é obrigatório"),
  solution: z.string().min(1, "Solução para o problema é obrigatório"),
  differentials: z.string().min(1, "Diferenciais da startup são obrigatórios"),
  mrr: z.string().min(1, "Faturamento do último mês é obrigatório"),
  business_model: z.string().min(1, "Modelo de negócio é obrigatório"),
  sector: z.string().optional(),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().min(1, "Estado é obrigatório"),
  website: z.string().optional(),
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

    // Validar dados do formulário
    const formData = externalFormSchema.parse(req.body);

    // Preparar dados para criação da startup
    const startupData = {
      id: uuidv4(),
      name: formData.name,
      ceo_name: formData.ceo_name,
      ceo_email: formData.ceo_email,
      ceo_whatsapp: formData.ceo_whatsapp,
      description: `${formData.problem}\n\n${formData.solution}\n\n${formData.differentials}`,
      mrr: parseInt(formData.mrr.replace(/\D/g, '')) || 0,
      business_model: formData.business_model,
      sector: formData.sector || null,
      city: formData.city,
      state: formData.state,
      website: formData.website || null,
      location: `${formData.city}, ${formData.state}`,
      foundation_date: new Date(`${formData.foundation_year}-01-01`).toISOString(),
      status_id: "e74a05a6-6612-49af-95a1-f42b035d5c4d", // Cadastrada (primeiro status)
      pitch_deck_id: req.file.filename,
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Usar o schema do Drizzle para validar os dados
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