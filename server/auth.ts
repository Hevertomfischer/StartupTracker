import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, UserRoleEnum } from "@shared/schema";
import createMemoryStore from "memorystore";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionStore = new MemoryStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "your-secret-key",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      secure: process.env.NODE_ENV === "production",
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy({
      usernameField: 'username', // Campo padrão do Passport
      passwordField: 'password'
    }, async (username, password, done) => {
      try {
        console.log("Estratégia Local - Tentando autenticar com:", username);
        // Suporta login tanto com username quanto email
        const user = await storage.getUserByEmail(username);
        
        if (!user) {
          console.log("Estratégia Local - Usuário não encontrado");
          return done(null, false, { message: "Usuário não encontrado" });
        }
        
        const passwordMatch = await comparePasswords(password, user.password);
        if (!passwordMatch) {
          console.log("Estratégia Local - Senha incorreta");
          return done(null, false, { message: "Senha incorreta" });
        }
        
        console.log("Estratégia Local - Autenticação bem-sucedida:", user.email);
        return done(null, user);
      } catch (err) {
        console.error("Estratégia Local - Erro:", err);
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("Registro - Corpo da requisição:", req.body);
      
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        console.log("Registro - Email já existe:", req.body.email);
        return res.status(400).json({ 
          message: "Este e-mail já está cadastrado. Por favor, utilize outro e-mail ou faça login com sua conta existente." 
        });
      }

      const hashedPassword = await hashPassword(req.body.password);
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
      });
      
      console.log("Registro - Usuário criado com sucesso:", { id: user.id, email: user.email });

      // Atribuir o perfil de Associado por padrão para novos usuários
      try {
        // Buscar o perfil de Associado
        const roles = await storage.getUserRoles();
        const associateRole = roles.find(role => role.name === "Associado");
        
        if (associateRole) {
          // Atribuir o perfil ao usuário
          await storage.assignRoleToUser({
            user_id: user.id,
            role_id: associateRole.id
          });
          
          console.log(`Atribuído perfil 'Associado' ao novo usuário ${user.id}`);
        }
      } catch (error) {
        console.error("Erro ao atribuir perfil ao novo usuário:", error);
      }
      
      req.login(user, (err) => {
        if (err) {
          console.error("Registro - Erro no login automático:", err);
          return next(err);
        }
        console.log("Registro - Login automático realizado com sucesso");
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Registro - Erro:", error);
      next(error);
    }
  });

  app.post("/api/login", async (req, res, next) => {
    console.log("Login - Tentativa com email:", req.body.email || req.body.username);
    
    try {
      const authResult = await new Promise<{ user?: SelectUser, err?: any, info?: any }>((resolve) => {
        passport.authenticate("local", (err: any, user: SelectUser | false, info: any) => {
          resolve({ user: user || undefined, err, info });
        })(req, res, next);
      });
      
      if (authResult.err) {
        console.error("Login - Erro de autenticação:", authResult.err);
        return next(authResult.err);
      }
      
      if (!authResult.user) {
        console.log("Login - Usuário não encontrado ou senha incorreta");
        return res.status(401).json({ 
          message: authResult.info?.message === "Usuário não encontrado" 
            ? "E-mail não encontrado. Por favor, verifique se o e-mail está correto ou crie uma nova conta." 
            : "Senha incorreta. Por favor, verifique sua senha e tente novamente."
        });
      }
      
      // Autenticar o usuário
      await new Promise<void>((resolve, reject) => {
        req.login(authResult.user, (err) => {
          if (err) {
            console.error("Login - Erro ao fazer login:", err);
            reject(err);
            return;
          }
          resolve();
        });
      });
      
      console.log("Login - Sucesso para usuário:", { id: authResult.user.id, email: authResult.user.email });
      
      try {
        // Buscar os perfis do usuário para incluir na resposta
        const userRoleAssignments = await storage.getUserRoleAssignments(authResult.user.id);
        const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
        const userRoles = await Promise.all(
          userRoleIds.map(roleId => storage.getUserRole(roleId))
        );
        
        // Filtrar undefined e obter apenas nomes para resposta
        const roleNames = userRoles
          .filter(role => role !== undefined)
          .map(role => role!.name);
        
        // Incluir perfis na resposta
        return res.status(200).json({
          ...authResult.user,
          roles: roleNames
        });
      } catch (error) {
        console.error("Erro ao buscar perfis do usuário:", error);
        return res.status(200).json(authResult.user);
      }
    } catch (error) {
      console.error("Erro durante o processo de login:", error);
      return res.status(500).json({ message: "Erro interno durante o processo de login." });
    }
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", async (req, res) => {
    console.log("GET /api/user - isAuthenticated:", req.isAuthenticated());
    if (req.isAuthenticated()) {
      console.log("GET /api/user - Usuário autenticado:", { id: req.user.id, email: req.user.email });
      
      try {
        // Buscar os perfis do usuário
        const userRoleAssignments = await storage.getUserRoleAssignments(req.user.id);
        const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
        const userRoles = await Promise.all(
          userRoleIds.map(roleId => storage.getUserRole(roleId))
        );
        
        // Filtrar undefined e obter apenas nomes
        const roleNames = userRoles
          .filter(role => role !== undefined)
          .map(role => role!.name);
        
        // Incluir perfis na resposta
        return res.json({
          ...req.user,
          roles: roleNames
        });
      } catch (error) {
        console.error("Erro ao buscar perfis do usuário:", error);
        return res.json(req.user);
      }
    } else {
      console.log("GET /api/user - Usuário não autenticado");
      return res.status(401).json({ message: "Usuário não autenticado. Por favor, faça login para continuar." });
    }
  });
  
  // Endpoint para obter os perfis do usuário autenticado
  app.get("/api/user/roles", isAuthenticated, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Usuário não autenticado." });
      }
      
      // Buscar os perfis do usuário
      const userRoleAssignments = await storage.getUserRoleAssignments(req.user.id);
      const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
      const userRoles = await Promise.all(
        userRoleIds.map(roleId => storage.getUserRole(roleId))
      );
      
      // Filtrar undefined
      const roles = userRoles.filter(role => role !== undefined);
      
      return res.json(roles);
    } catch (error) {
      console.error("Erro ao buscar perfis do usuário:", error);
      return res.status(500).json({ message: "Erro interno ao buscar perfis do usuário." });
    }
  });
}

/**
 * Middleware para verificar se o usuário está autenticado
 */
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Autenticação necessária. Por favor, faça login para acessar este recurso." });
}

/**
 * Middleware para verificar se o usuário possui um dos perfis especificados
 */
export function hasRole(roleNames: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Autenticação necessária. Por favor, faça login para acessar este recurso." });
    }
    
    try {
      // Obtém as atribuições de perfil do usuário
      const userRoleAssignments = await storage.getUserRoleAssignments(req.user.id);
      
      if (userRoleAssignments.length === 0) {
        return res.status(403).json({ message: "Acesso negado. Você não possui nenhum perfil atribuído." });
      }
      
      // Obtém os perfis do usuário
      const userRoleIds = userRoleAssignments.map(assignment => assignment.role_id);
      const userRoles = await Promise.all(
        userRoleIds.map(roleId => storage.getUserRole(roleId))
      );
      
      // Filtra roles undefined e obtém nomes
      const userRoleNames = userRoles
        .filter(role => role !== undefined)
        .map(role => role!.name);
      
      // Verifica se o usuário possui pelo menos um dos perfis necessários
      const hasRequiredRole = roleNames.some(roleName => 
        userRoleNames.includes(roleName)
      );
      
      if (hasRequiredRole) {
        return next();
      }
      
      res.status(403).json({ message: "Acesso negado. Você não possui permissões suficientes para acessar este recurso." });
    } catch (error) {
      console.error("Erro ao verificar perfis do usuário:", error);
      res.status(500).json({ message: "Erro interno ao verificar permissões de acesso." });
    }
  };
}

/**
 * Middleware para verificar se o usuário é administrador
 */
export function isAdmin(req: Request, res: Response, next: NextFunction) {
  return hasRole(["Administrador"])(req, res, next);
}

/**
 * Middleware para verificar se o usuário é investidor (ou administrador)
 */
export function isInvestor(req: Request, res: Response, next: NextFunction) {
  return hasRole(["Administrador", "Investidor"])(req, res, next);
}

/**
 * Middleware para verificar se o usuário tem acesso a uma página específica
 */
export function hasPageAccess(pagePath: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Autenticação necessária. Por favor, faça login para acessar este recurso." });
    }
    
    try {
      // Verifica se o usuário tem acesso à página solicitada
      const hasAccess = await storage.checkUserPageAccess(req.user.id, pagePath);
      
      if (hasAccess) {
        return next();
      }
      
      return res.status(403).json({ message: "Acesso negado. Você não possui permissão para acessar esta página." });
    } catch (error) {
      console.error(`Erro ao verificar acesso à página ${pagePath}:`, error);
      return res.status(500).json({ message: "Erro interno ao verificar permissões de acesso." });
    }
  };
}