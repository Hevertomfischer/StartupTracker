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
      
      const data = updateStartupStatusSchema.parse({ 
        id, 
        status_id: req.body.status_id 
      });
      
      const startup = await storage.getStartup(id);
      if (!startup) {
        return res.status(404).json({ message: "Startup not found" });
      }

      const updatedStartup = await storage.updateStartupStatus(id, data.status_id);
      return res.status(200).json(updatedStartup);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
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

  const httpServer = createServer(app);
  return httpServer;
}
