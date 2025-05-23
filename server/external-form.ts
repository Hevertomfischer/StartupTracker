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
    console.log('=== PROCESSANDO FORMULÁRIO EXTERNO ===');
    console.log('Body recebido:', req.body);
    console.log('Arquivo recebido:', req.file ? 'SIM' : 'NÃO');

    // Resposta de teste simples primeiro
    return res.status(201).json({
      success: true,
      message: 'Teste: Dados recebidos com sucesso!',
      data: req.body,
      file: req.file ? req.file.filename : null
    });

  } catch (error) {
    console.error('Erro no teste:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro no teste.'
    });
  }
};