import { 
  users, 
  type User, 
  type InsertUser, 
  startups, 
  type Startup, 
  type InsertStartup,
  startupMembers,
  type StartupMember,
  type InsertStartupMember,
  statuses,
  type Status,
  type InsertStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Status operations
  getStatuses(): Promise<Status[]>;
  getStatus(id: string): Promise<Status | undefined>;
  createStatus(status: InsertStatus): Promise<Status>;
  updateStatus(id: string, status: Partial<InsertStatus>): Promise<Status | undefined>;
  deleteStatus(id: string): Promise<boolean>;
  
  // Startup operations
  getStartups(): Promise<Startup[]>;
  getStartup(id: string): Promise<Startup | undefined>;
  createStartup(startup: InsertStartup): Promise<Startup>;
  updateStartup(id: string, startup: Partial<InsertStartup>): Promise<Startup | undefined>;
  updateStartupStatus(id: string, status_id: string): Promise<Startup | undefined>;
  deleteStartup(id: string): Promise<boolean>;
  
  // Startup member operations
  getStartupMembers(startupId: string): Promise<StartupMember[]>;
  createStartupMember(member: InsertStartupMember): Promise<StartupMember>;
  
  // Seed data
  seedDatabase(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Status operations
  async getStatuses(): Promise<Status[]> {
    return await db.select().from(statuses).orderBy(asc(statuses.order));
  }
  
  async getStatus(id: string): Promise<Status | undefined> {
    const [status] = await db.select().from(statuses).where(eq(statuses.id, id));
    return status || undefined;
  }
  
  async createStatus(status: InsertStatus): Promise<Status> {
    const [newStatus] = await db.insert(statuses).values(status).returning();
    return newStatus;
  }
  
  async updateStatus(id: string, statusData: Partial<InsertStatus>): Promise<Status | undefined> {
    const [updatedStatus] = await db
      .update(statuses)
      .set(statusData)
      .where(eq(statuses.id, id))
      .returning();
    return updatedStatus;
  }
  
  async deleteStatus(id: string): Promise<boolean> {
    const result = await db.delete(statuses).where(eq(statuses.id, id));
    return result.count > 0;
  }
  
  // Startup operations
  async getStartups(): Promise<Startup[]> {
    return await db.select().from(startups).orderBy(desc(startups.created_at));
  }
  
  async getStartup(id: string): Promise<Startup | undefined> {
    const [startup] = await db.select().from(startups).where(eq(startups.id, id));
    return startup || undefined;
  }
  
  async createStartup(insertStartup: InsertStartup): Promise<Startup> {
    // Set updated_at to now
    const startupWithTimestamp = {
      ...insertStartup,
      updated_at: new Date()
    };
    
    const [startup] = await db
      .insert(startups)
      .values(startupWithTimestamp)
      .returning();
    return startup;
  }
  
  async updateStartup(id: string, updateData: Partial<InsertStartup>): Promise<Startup | undefined> {
    // Always update the updated_at timestamp
    const dataWithTimestamp = {
      ...updateData,
      updated_at: new Date()
    };
    
    const [updatedStartup] = await db
      .update(startups)
      .set(dataWithTimestamp)
      .where(eq(startups.id, id))
      .returning();
    return updatedStartup;
  }
  
  async updateStartupStatus(id: string, status_id: string): Promise<Startup | undefined> {
    return this.updateStartup(id, { status_id });
  }
  
  async deleteStartup(id: string): Promise<boolean> {
    const result = await db.delete(startups).where(eq(startups.id, id));
    return result.count > 0;
  }
  
  // Startup member operations
  async getStartupMembers(startupId: string): Promise<StartupMember[]> {
    return await db
      .select()
      .from(startupMembers)
      .where(eq(startupMembers.startup_id, startupId));
  }
  
  async createStartupMember(insertMember: InsertStartupMember): Promise<StartupMember> {
    const [member] = await db
      .insert(startupMembers)
      .values(insertMember)
      .returning();
    return member;
  }
  
  // Seed data
  async seedDatabase(): Promise<void> {
    // Check if we already have status data
    const existingStatuses = await db.select().from(statuses);
    if (existingStatuses.length === 0) {
      // Seed status data
      await db.insert(statuses).values([
        { name: "New Lead", color: "#A5B4FC", order: 0 },
        { name: "Initial Contact", color: "#93C5FD", order: 1 },
        { name: "Meeting Scheduled", color: "#60A5FA", order: 2 },
        { name: "Proposal Sent", color: "#EAB308", order: 3 },
        { name: "Negotiation", color: "#F97316", order: 4 },
        { name: "Closed Won", color: "#22C55E", order: 5 },
        { name: "Closed Lost", color: "#EF4444", order: 6 }
      ]);
    }
    
    // Check if we already have startup data
    const existingStartups = await db.select().from(startups);
    if (existingStartups.length === 0) {
      // Get status ids first
      const allStatuses = await db.select().from(statuses);
      
      if (allStatuses.length > 0) {
        // Get status ids
        const newLeadStatusId = allStatuses[0].id;
        const initialContactStatusId = allStatuses[1].id;
        const meetingScheduledStatusId = allStatuses[2].id;
        const proposalSentStatusId = allStatuses[3].id;
        
        // Create demo startups
        const demoStartups = [
          {
            name: "TechNova",
            description: "AI-powered predictive analytics platform for business intelligence",
            sector: "tech",
            status_id: newLeadStatusId,
            ceo_name: "Michael Chen",
            ceo_email: "michael@technova.ai",
            city: "São Paulo",
            state: "SP"
          },
          {
            name: "EduMentor",
            description: "Plataforma de aprendizado personalizado com currículo adaptativo",
            sector: "education",
            status_id: initialContactStatusId,
            ceo_name: "Ana Silva",
            ceo_email: "ana@edumentor.com.br",
            city: "Rio de Janeiro",
            state: "RJ"
          },
          {
            name: "Agritech Solutions",
            description: "Soluções tecnológicas para agricultura sustentável",
            sector: "agritech",
            status_id: meetingScheduledStatusId,
            ceo_name: "Carlos Oliveira",
            ceo_email: "carlos@agritech.com.br",
            city: "Curitiba",
            state: "PR"
          },
          {
            name: "FinPay",
            description: "Soluções de pagamento digital para pequenas empresas",
            sector: "finance",
            status_id: proposalSentStatusId,
            ceo_name: "Maria Santos",
            ceo_email: "maria@finpay.com.br",
            city: "Belo Horizonte",
            state: "MG"
          }
        ];
        
        for (const startup of demoStartups) {
          await db.insert(startups).values(startup);
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
