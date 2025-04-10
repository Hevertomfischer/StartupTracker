import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertStartupSchema, 
  insertStartupMemberSchema, 
  updateStartupStatusSchema,
  insertStatusSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize database with seed data
  try {
    await storage.seedDatabase();
    console.log("Database initialized with seed data");
  } catch (error) {
    console.error("Error initializing database:", error);
  }

  // Status routes
  app.get("/api/statuses", async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getStatuses();
      return res.status(200).json(statuses);
    } catch (error) {
      console.error("Error fetching statuses:", error);
      return res.status(500).json({ message: "Failed to fetch statuses" });
    }
  });

  app.get("/api/statuses/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const status = await storage.getStatus(id);
      if (!status) {
        return res.status(404).json({ message: "Status not found" });
      }
      return res.status(200).json(status);
    } catch (error) {
      console.error(`Error fetching status:`, error);
      return res.status(500).json({ message: "Failed to fetch status" });
    }
  });

  app.post("/api/statuses", async (req: Request, res: Response) => {
    try {
      const data = insertStatusSchema.parse(req.body);
      const status = await storage.createStatus(data);
      return res.status(201).json(status);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating status:", error);
      return res.status(500).json({ message: "Failed to create status" });
    }
  });

  app.patch("/api/statuses/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const data = insertStatusSchema.partial().parse(req.body);
      const status = await storage.updateStatus(id, data);
      if (!status) {
        return res.status(404).json({ message: "Status not found" });
      }
      return res.status(200).json(status);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating status:", error);
      return res.status(500).json({ message: "Failed to update status" });
    }
  });

  app.delete("/api/statuses/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteStatus(id);
      if (!success) {
        return res.status(404).json({ message: "Status not found" });
      }
      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting status:", error);
      return res.status(500).json({ message: "Failed to delete status" });
    }
  });

  // Get all startups
  app.get("/api/startups", async (req: Request, res: Response) => {
    try {
      const startups = await storage.getStartups();
      return res.status(200).json(startups);
    } catch (error) {
      console.error("Error fetching startups:", error);
      return res.status(500).json({ message: "Failed to fetch startups" });
    }
  });

  // Get a single startup
  app.get("/api/startups/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      const startup = await storage.getStartup(id);
      if (!startup) {
        return res.status(404).json({ message: "Startup not found" });
      }

      return res.status(200).json(startup);
    } catch (error) {
      console.error(`Error fetching startup:`, error);
      return res.status(500).json({ message: "Failed to fetch startup" });
    }
  });

  // Create a new startup
  app.post("/api/startups", async (req: Request, res: Response) => {
    try {
      const data = insertStartupSchema.parse(req.body);
      const startup = await storage.createStartup(data);
      return res.status(201).json(startup);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating startup:", error);
      return res.status(500).json({ message: "Failed to create startup" });
    }
  });

  // Update a startup
  app.patch("/api/startups/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      
      const startup = await storage.getStartup(id);
      if (!startup) {
        return res.status(404).json({ message: "Startup not found" });
      }

      const data = insertStartupSchema.partial().parse(req.body);
      const updatedStartup = await storage.updateStartup(id, data);
      return res.status(200).json(updatedStartup);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating startup:", error);
      return res.status(500).json({ message: "Failed to update startup" });
    }
  });

  // Update startup status (special endpoint for Kanban drag and drop)
  app.patch("/api/startups/:id/status", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const { status_id } = req.body;
      
      console.log(`Updating startup ${id} status to ${status_id}`);
      console.log('Request body:', req.body);
      
      // Validar o formato dos IDs
      const data = updateStartupStatusSchema.parse({ 
        id, 
        status_id 
      });
      
      // Verificar se o startup existe
      const startup = await storage.getStartup(id);
      if (!startup) {
        console.error(`Startup with ID ${id} not found`);
        return res.status(404).json({ message: "Startup not found" });
      }

      // Verificar se o status existe
      const status = await storage.getStatus(status_id);
      if (!status) {
        console.error(`Status with ID ${status_id} not found`);
        return res.status(404).json({ message: "Status not found" });
      }
      
      // Atualizar o status
      const updatedStartup = await storage.updateStartupStatus(id, data.status_id);
      console.log('Successfully updated startup status:', updatedStartup);
      return res.status(200).json(updatedStartup);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.error('Validation error:', validationError);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating startup status:", error);
      return res.status(500).json({ message: "Failed to update startup status" });
    }
  });

  // Delete a startup
  app.delete("/api/startups/:id", async (req: Request, res: Response) => {
    try {
      const id = req.params.id;

      const success = await storage.deleteStartup(id);
      if (!success) {
        return res.status(404).json({ message: "Startup not found" });
      }

      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting startup:", error);
      return res.status(500).json({ message: "Failed to delete startup" });
    }
  });

  // Get startup members
  app.get("/api/startups/:id/members", async (req: Request, res: Response) => {
    try {
      const startupId = req.params.id;
      
      const members = await storage.getStartupMembers(startupId);
      return res.status(200).json(members);
    } catch (error) {
      console.error("Error fetching startup members:", error);
      return res.status(500).json({ message: "Failed to fetch startup members" });
    }
  });

  // Add startup member
  app.post("/api/startups/:id/members", async (req: Request, res: Response) => {
    try {
      const startupId = req.params.id;
      
      // Check if startup exists
      const startup = await storage.getStartup(startupId);
      if (!startup) {
        return res.status(404).json({ message: "Startup not found" });
      }

      const data = insertStartupMemberSchema.parse({
        ...req.body,
        startup_id: startupId
      });

      const member = await storage.createStartupMember(data);
      return res.status(201).json(member);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating startup member:", error);
      return res.status(500).json({ message: "Failed to create startup member" });
    }
  });
  
  // Startup history routes
  app.get("/api/startups/:id/history", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`Buscando histórico para startup ID: ${id}`);
      
      // Se não existir nenhum registro de histórico, vamos criar um para teste
      let history = await storage.getStartupHistory(id);
      
      // Se não tiver histórico, cria um registro para teste
      if (history.length === 0) {
        console.log(`Nenhum histórico encontrado para a startup ${id}, criando dados de teste`);
        
        // Buscar a startup
        const startup = await storage.getStartup(id);
        if (startup) {
          // Criar um registro de histórico para teste
          await storage.createStartupHistoryEntry({
            startup_id: id,
            field_name: "name",
            old_value: "Nome anterior",
            new_value: startup.name || "Nome atual"
          });
          
          // Buscar novamente
          history = await storage.getStartupHistory(id);
        }
      }
      
      console.log(`Histórico encontrado: ${history?.length || 0} registros`);
      return res.status(200).json(history || []);
    } catch (error) {
      console.error("Error fetching startup history:", error);
      return res.status(500).json({ message: "Failed to fetch startup history", error: error instanceof Error ? error.message : String(error) });
    }
  });
  
  // Startup status history routes
  app.get("/api/startups/:id/status-history", async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      console.log(`Buscando histórico de status para startup ID: ${id}`);
      
      // Se não existir nenhum registro de histórico de status, vamos criar um para teste
      let statusHistory = await storage.getStartupStatusHistory(id);
      
      // Se não tiver histórico de status, cria um registro para teste
      if (statusHistory.length === 0) {
        console.log(`Nenhum histórico de status encontrado para a startup ${id}, criando dados de teste`);
        
        // Buscar a startup
        const startup = await storage.getStartup(id);
        if (startup && startup.status_id) {
          // Buscar o status
          const status = await storage.getStatus(startup.status_id);
          if (status) {
            // Criar um registro de histórico de status para teste
            const now = new Date();
            const startDate = new Date(now.getTime() - (24 * 60 * 60 * 1000)); // 1 dia atrás
            
            await storage.createStartupStatusHistoryEntry({
              startup_id: id,
              status_id: startup.status_id,
              status_name: status.name,
              start_date: startDate
            });
            
            // Buscar novamente
            statusHistory = await storage.getStartupStatusHistory(id);
          }
        }
      }
      
      console.log(`Histórico de status encontrado: ${statusHistory?.length || 0} registros`);
      return res.status(200).json(statusHistory || []);
    } catch (error) {
      console.error("Error fetching startup status history:", error);
      return res.status(500).json({ message: "Failed to fetch startup status history", error: error instanceof Error ? error.message : String(error) });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
