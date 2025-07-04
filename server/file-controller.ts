import { Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { files, startupAttachments, startups } from "@shared/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

// Configuração do multer para armazenamento de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads");
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Gera um nome de arquivo único baseado no timestamp + UUID parcial
    const uniqueSuffix = Date.now() + "-" + uuidv4().substring(0, 8);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

// Filtro de arquivos para verificar se são tipos permitidos
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Tipos de arquivo permitidos 
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/zip',
    'application/x-zip-compressed',
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Tipo de arquivo não permitido. Apenas PDF, Word, Excel, PowerPoint, imagens e ZIP são aceitos."));
  }
};

// Configurando o middleware de upload
export const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  // Limite de tamanho de arquivo removido conforme solicitado
});

// Controlador para upload de arquivos gerais
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }
    
    const fileData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
    };
    
    const [insertedFile] = await db.insert(files).values(fileData).returning();
    
    return res.status(201).json({
      message: "Arquivo enviado com sucesso",
      file: insertedFile
    });
  } catch (error) {
    console.error("Erro ao fazer upload de arquivo:", error);
    return res.status(500).json({ 
      message: "Erro ao fazer upload de arquivo",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

// Controlador para upload de PitchDeck de startup
export const uploadPitchDeck = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }
    
    // Busca a startup para verificar se existe
    const [existingStartup] = await db.select()
      .from(startups)
      .where(eq(startups.id, startupId));
      
    if (!existingStartup) {
      return res.status(404).json({ message: "Startup não encontrada" });
    }
    
    const fileData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
    };
    
    // Insere o arquivo e obtém o ID
    const [insertedFile] = await db.insert(files).values(fileData).returning();
    
    // Atualiza a startup com o novo pitch_deck_id
    const [updatedStartup] = await db
      .update(startups)
      .set({ 
        pitch_deck_id: insertedFile.id,
        updated_at: new Date()
      })
      .where(eq(startups.id, startupId))
      .returning();
    
    return res.status(200).json({
      message: "PitchDeck enviado com sucesso",
      startup: updatedStartup,
      file: insertedFile
    });
  } catch (error) {
    console.error("Erro ao fazer upload de PitchDeck:", error);
    return res.status(500).json({ 
      message: "Erro ao fazer upload de PitchDeck",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

// Controlador para upload de anexos de startup
export const uploadStartupAttachment = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    const { description, document_type } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo foi enviado" });
    }
    
    // Busca a startup para verificar se existe
    const [existingStartup] = await db.select()
      .from(startups)
      .where(eq(startups.id, startupId));
      
    if (!existingStartup) {
      return res.status(404).json({ message: "Startup não encontrada" });
    }
    
    const fileData = {
      filename: req.file.filename,
      original_name: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`,
    };
    
    // Insere o arquivo e obtém o ID
    const [insertedFile] = await db.insert(files).values(fileData).returning();
    
    // Insere o anexo associado à startup
    const [insertedAttachment] = await db
      .insert(startupAttachments)
      .values({
        startup_id: startupId,
        file_id: insertedFile.id,
        description: description || null,
        document_type: document_type || null,
      })
      .returning();
    
    return res.status(201).json({
      message: "Anexo enviado com sucesso",
      attachment: insertedAttachment,
      file: insertedFile
    });
  } catch (error) {
    console.error("Erro ao fazer upload de anexo:", error);
    return res.status(500).json({ 
      message: "Erro ao fazer upload de anexo",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

// Controlador para obter todos os anexos de uma startup
export const getStartupAttachments = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    
    console.log(`Buscando anexos para startup ${startupId}`);
    
    // Busca a startup para verificar se existe
    const [existingStartup] = await db.select()
      .from(startups)
      .where(eq(startups.id, startupId));
      
    if (!existingStartup) {
      console.log(`Startup não encontrada: ${startupId}`);
      return res.status(404).json({ message: "Startup não encontrada" });
    }
    
    // Busca o PitchDeck
    let pitchDeck = null;
    if (existingStartup.pitch_deck_id) {
      const [pitchDeckFile] = await db.select()
        .from(files)
        .where(eq(files.id, existingStartup.pitch_deck_id));
        
      if (pitchDeckFile) {
        pitchDeck = pitchDeckFile;
        console.log(`PitchDeck encontrado: ${pitchDeckFile.id}`);
      }
    }
    
    // Busca todos os anexos da startup com joins para obter os detalhes do arquivo
    const attachmentsResult = await db
      .select({
        id: startupAttachments.id,
        description: startupAttachments.description,
        document_type: startupAttachments.document_type,
        created_at: startupAttachments.created_at,
        file_id: files.id,
        filename: files.filename,
        original_name: files.original_name,
        mimetype: files.mimetype,
        size: files.size,
        path: files.path,
      })
      .from(startupAttachments)
      .innerJoin(files, eq(startupAttachments.file_id, files.id))
      .where(eq(startupAttachments.startup_id, startupId));
    
    console.log(`Encontrados ${attachmentsResult.length} anexos para a startup ${startupId}`);
    
    const responseData = {
      pitchDeck,
      attachments: attachmentsResult
    };
    
    res.status(200).json(responseData);
  } catch (error) {
    console.error("Erro ao obter anexos:", error);
    res.status(500).json({ 
      message: "Erro ao obter anexos da startup",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

// Controlador para excluir um anexo
export const deleteAttachment = async (req: Request, res: Response) => {
  try {
    const { attachmentId } = req.params;
    
    // Busca o anexo para obter o fileId
    const [attachment] = await db.select()
      .from(startupAttachments)
      .where(eq(startupAttachments.id, attachmentId));
      
    if (!attachment) {
      return res.status(404).json({ message: "Anexo não encontrado" });
    }
    
    // Busca o arquivo para obter o caminho no sistema de arquivos
    const [fileInfo] = await db.select()
      .from(files)
      .where(eq(files.id, attachment.file_id));
    
    // Deleta o registro do anexo
    await db.delete(startupAttachments)
      .where(eq(startupAttachments.id, attachmentId));
    
    // Deleta o registro do arquivo
    await db.delete(files)
      .where(eq(files.id, attachment.file_id));
    
    // Se o arquivo existir no sistema de arquivos, exclui também
    if (fileInfo) {
      const filePath = path.join(process.cwd(), "uploads", fileInfo.filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }
    
    return res.status(200).json({
      message: "Anexo excluído com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir anexo:", error);
    return res.status(500).json({ 
      message: "Erro ao excluir anexo",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};

// Controlador para excluir o PitchDeck de uma startup
export const deletePitchDeck = async (req: Request, res: Response) => {
  try {
    const { startupId } = req.params;
    
    // Busca a startup para verificar se existe e obter o fileId
    const [existingStartup] = await db.select()
      .from(startups)
      .where(eq(startups.id, startupId));
      
    if (!existingStartup) {
      return res.status(404).json({ message: "Startup não encontrada" });
    }
    
    if (!existingStartup.pitch_deck_id) {
      return res.status(404).json({ message: "Esta startup não possui PitchDeck" });
    }
    
    // Busca o arquivo para obter o caminho no sistema de arquivos
    const [fileInfo] = await db.select()
      .from(files)
      .where(eq(files.id, existingStartup.pitch_deck_id));
    
    // Atualiza a startup para remover a referência ao PitchDeck
    await db.update(startups)
      .set({ 
        pitch_deck_id: null,
        updated_at: new Date()
      })
      .where(eq(startups.id, startupId));
    
    // Deleta o registro do arquivo
    if (existingStartup.pitch_deck_id) {
      await db.delete(files)
        .where(eq(files.id, existingStartup.pitch_deck_id));
    }
    
    // Se o arquivo existir no sistema de arquivos, exclui também
    if (fileInfo) {
      const filePath = path.join(process.cwd(), "uploads", fileInfo.filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    }
    
    return res.status(200).json({
      message: "PitchDeck excluído com sucesso"
    });
  } catch (error) {
    console.error("Erro ao excluir PitchDeck:", error);
    return res.status(500).json({ 
      message: "Erro ao excluir PitchDeck",
      error: error instanceof Error ? error.message : "Erro desconhecido"
    });
  }
};