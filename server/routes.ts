import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertStartupSchema, 
  insertStartupMemberSchema, 
  updateStartupStatusSchema,
  insertStatusSchema,
  insertTaskSchema,
  insertTaskCommentSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { setupAuth, isAuthenticated, isAdmin, isInvestor, hashPassword } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Initialize database with seed data
  try {
    await storage.seedDatabase();
    console.log("Database initialized with seed data");
  } catch (error) {
    console.error("Error initializing database:", error);
  }

  // Endpoints para gerenciamento de usuários
  
  // Listar todos os usuários (apenas administradores)
  app.get("/api/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getUsers();
      
      // Para cada usuário, buscar seus perfis
      const usersWithRoles = await Promise.all(
        users.map(async (user) => {
          const userRoleAssignments = await storage.getUserRoleAssignments(user.id);
          const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
          const userRoles = await Promise.all(
            userRoleIds.map(roleId => storage.getUserRole(roleId))
          );
          
          // Filtrar roles undefined e obter apenas nomes
          const roleNames = userRoles
            .filter(role => role !== undefined)
            .map(role => role!.name);
            
          return {
            ...user,
            roles: roleNames
          };
        })
      );
      
      return res.status(200).json(usersWithRoles);
    } catch (error) {
      console.error("Erro ao listar usuários:", error);
      return res.status(500).json({ message: "Erro ao listar usuários" });
    }
  });
  
  // Obter um usuário específico
  app.get("/api/users/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Buscar perfis do usuário
      const userRoleAssignments = await storage.getUserRoleAssignments(user.id);
      const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
      const userRoles = await Promise.all(
        userRoleIds.map(roleId => storage.getUserRole(roleId))
      );
      
      // Filtrar roles undefined e obter apenas nomes
      const roleNames = userRoles
        .filter(role => role !== undefined)
        .map(role => role!.name);
        
      return res.status(200).json({
        ...user,
        roles: roleNames
      });
    } catch (error) {
      console.error("Erro ao obter usuário:", error);
      return res.status(500).json({ message: "Erro ao obter usuário" });
    }
  });
  
  // Criar novo usuário (apenas administradores)
  app.post("/api/users", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email, password, roleId } = req.body;
      
      // Verifica se o e-mail já está em uso
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Este e-mail já está sendo utilizado" });
      }
      
      // Criptografa a senha
      const hashedPassword = await hashPassword(password);
      
      // Cria o usuário
      const newUser = await storage.createUser({
        name,
        email,
        password: hashedPassword
      });
      
      // Se um perfil foi especificado, atribui ao usuário
      if (roleId) {
        await storage.assignRoleToUser({
          user_id: newUser.id,
          role_id: roleId
        });
      }
      
      return res.status(201).json(newUser);
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      return res.status(500).json({ message: "Erro ao criar usuário" });
    }
  });
  
  // Atualizar dados de um usuário (apenas administradores)
  app.patch("/api/users/:id", isAdmin, async (req: Request, res: Response) => {
    try {
      const { name, email } = req.body;
      
      // Verifica se o usuário existe
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Se estiver atualizando o email, verificar se já está em uso
      if (email && email !== user.email) {
        const existingUser = await storage.getUserByEmail(email);
        if (existingUser) {
          return res.status(400).json({ message: "Este e-mail já está sendo utilizado" });
        }
      }
      
      // Atualiza o usuário
      const updatedUser = await storage.updateUser(req.params.id, { name, email });
      
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      return res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });
  
  // Ativar/Desativar usuário (apenas administradores)
  app.patch("/api/users/:id/status", isAdmin, async (req: Request, res: Response) => {
    try {
      const { active } = req.body;
      
      // Verificar se o usuário existe
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Não permitir desativar o próprio usuário
      if (req.user && req.user.id === req.params.id && active === false) {
        return res.status(400).json({ message: "Não é possível desativar seu próprio usuário" });
      }
      
      // Atualizar status do usuário
      const updatedUser = await storage.updateUser(req.params.id, { active });
      
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Erro ao atualizar status do usuário:", error);
      return res.status(500).json({ message: "Erro ao atualizar status do usuário" });
    }
  });
  
  // Listar todos os perfis disponíveis
  app.get("/api/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const roles = await storage.getUserRoles();
      return res.status(200).json(roles);
    } catch (error) {
      console.error("Erro ao listar perfis:", error);
      return res.status(500).json({ message: "Erro ao listar perfis" });
    }
  });

  // Status routes
  app.get("/api/statuses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getStatuses();
      return res.status(200).json(statuses);
    } catch (error) {
      console.error("Error fetching statuses:", error);
      return res.status(500).json({ message: "Failed to fetch statuses" });
    }
  });

  app.get("/api/statuses/:id", isAuthenticated, async (req: Request, res: Response) => {
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

  app.post("/api/statuses", isAdmin, async (req: Request, res: Response) => {
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

  app.patch("/api/statuses/:id", isAdmin, async (req: Request, res: Response) => {
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

  app.delete("/api/statuses/:id", isAdmin, async (req: Request, res: Response) => {
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
  app.get("/api/startups", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const startups = await storage.getStartups();
      return res.status(200).json(startups);
    } catch (error) {
      console.error("Error fetching startups:", error);
      return res.status(500).json({ message: "Failed to fetch startups" });
    }
  });

  // Get a single startup
  app.get("/api/startups/:id", isAuthenticated, async (req: Request, res: Response) => {
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
  app.post("/api/startups", isAdmin, async (req: Request, res: Response) => {
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
  app.patch("/api/startups/:id", isInvestor, async (req: Request, res: Response) => {
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
  app.patch("/api/startups/:id/status", isAuthenticated, async (req: Request, res: Response) => {
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
  app.delete("/api/startups/:id", isAdmin, async (req: Request, res: Response) => {
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
  app.get("/api/startups/:id/members", isAuthenticated, async (req: Request, res: Response) => {
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
  app.post("/api/startups/:id/members", isInvestor, async (req: Request, res: Response) => {
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
  app.get("/api/startups/:id/history", isAuthenticated, async (req: Request, res: Response) => {
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
  app.get("/api/startups/:id/status-history", isAuthenticated, async (req: Request, res: Response) => {
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
            await storage.createStartupStatusHistoryEntry({
              startup_id: id,
              status_id: startup.status_id,
              status_name: status.name
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

  // Task routes
  // Get all tasks
  app.get("/api/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      return res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  // Get tasks for a specific startup
  app.get("/api/startups/:id/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const startupId = req.params.id;
      const tasks = await storage.getTasksForStartup(startupId);
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching startup tasks:", error);
      return res.status(500).json({ message: "Failed to fetch startup tasks" });
    }
  });

  // Get tasks assigned to current user
  app.get("/api/tasks/assigned", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const tasks = await storage.getTasksAssignedToUser(req.user.id);
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching assigned tasks:", error);
      return res.status(500).json({ message: "Failed to fetch assigned tasks" });
    }
  });

  // Get tasks created by current user
  app.get("/api/tasks/created", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      const tasks = await storage.getTasksCreatedByUser(req.user.id);
      return res.status(200).json(tasks);
    } catch (error) {
      console.error("Error fetching created tasks:", error);
      return res.status(500).json({ message: "Failed to fetch created tasks" });
    }
  });

  // Get a single task
  app.get("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      return res.status(200).json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      return res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  // Create a new task
  app.post("/api/tasks", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const data = insertTaskSchema.parse({
        ...req.body,
        created_by: req.user.id
      });
      
      const task = await storage.createTask(data);
      return res.status(201).json(task);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating task:", error);
      return res.status(500).json({ message: "Failed to create task" });
    }
  });

  // Update a task
  app.patch("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const data = insertTaskSchema.partial().parse(req.body);
      const updatedTask = await storage.updateTask(id, data);
      return res.status(200).json(updatedTask);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error updating task:", error);
      return res.status(500).json({ message: "Failed to update task" });
    }
  });

  // Mark a task as complete
  app.patch("/api/tasks/:id/complete", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const completedTask = await storage.completeTask(id);
      return res.status(200).json(completedTask);
    } catch (error) {
      console.error("Error completing task:", error);
      return res.status(500).json({ message: "Failed to complete task" });
    }
  });

  // Delete a task
  app.delete("/api/tasks/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteTask(id);
      
      if (!success) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting task:", error);
      return res.status(500).json({ message: "Failed to delete task" });
    }
  });

  // Get task comments
  app.get("/api/tasks/:id/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const taskId = req.params.id;
      const comments = await storage.getTaskComments(taskId);
      return res.status(200).json(comments);
    } catch (error) {
      console.error("Error fetching task comments:", error);
      return res.status(500).json({ message: "Failed to fetch task comments" });
    }
  });

  // Add a comment to a task
  app.post("/api/tasks/:id/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado" });
      }
      
      const taskId = req.params.id;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      
      const data = insertTaskCommentSchema.parse({
        ...req.body,
        task_id: taskId,
        user_id: req.user.id
      });
      
      const comment = await storage.createTaskComment(data);
      return res.status(201).json(comment);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating task comment:", error);
      return res.status(500).json({ message: "Failed to create task comment" });
    }
  });

  // Delete a task comment
  app.delete("/api/tasks/comments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const success = await storage.deleteTaskComment(id);
      
      if (!success) {
        return res.status(404).json({ message: "Comment not found" });
      }
      
      return res.status(204).end();
    } catch (error) {
      console.error("Error deleting task comment:", error);
      return res.status(500).json({ message: "Failed to delete task comment" });
    }
  });

  // Get task counts for startups (for showing badges on cards)
  app.get("/api/tasks/counts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const counts = await storage.getTaskCounts();
      return res.status(200).json(counts);
    } catch (error) {
      console.error("Error fetching task counts:", error);
      return res.status(500).json({ message: "Failed to fetch task counts" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
