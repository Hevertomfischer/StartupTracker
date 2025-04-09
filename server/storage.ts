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
  type InsertStatus,
  startupHistory,
  type StartupHistory,
  type InsertStartupHistory,
  startupStatusHistory,
  type StartupStatusHistory,
  type InsertStartupStatusHistory
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
  
  // Startup history operations
  getStartupHistory(startupId: string): Promise<StartupHistory[]>;
  createStartupHistoryEntry(entry: InsertStartupHistory): Promise<StartupHistory>;
  
  // Startup status history operations
  getStartupStatusHistory(startupId: string): Promise<StartupStatusHistory[]>;
  createStartupStatusHistoryEntry(entry: InsertStartupStatusHistory): Promise<StartupStatusHistory>;
  updateStartupStatusHistoryEntry(id: string, endDate: Date): Promise<StartupStatusHistory | undefined>;
  
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
    try {
      // Busca a startup antes da atualização para comparar os campos
      const oldStartup = await this.getStartup(id);
      if (!oldStartup) {
        console.log(`Startup não encontrada: ${id}`);
        return undefined;
      }
      
      console.log(`Atualizando startup ${id} com dados:`, updateData);
      
      // Always update the updated_at timestamp
      const dataWithTimestamp = {
        ...updateData,
        updated_at: new Date()
      };
      
      // Registra o histórico para cada campo que está sendo alterado
      for (const [key, newValue] of Object.entries(updateData)) {
        // Ignoramos o status_id pois ele é tratado separadamente no updateStartupStatus
        if (key === 'status_id' || key === 'updated_at') continue;
        
        const oldValue = (oldStartup as any)[key];
        
        // Só registra se o valor realmente mudou
        if (newValue !== oldValue && (newValue || oldValue)) {
          console.log(`Registrando alteração no campo ${key}:`, { oldValue, newValue });
          
          try {
            const now = new Date();
            await db.insert(startupHistory).values({
              startup_id: id,
              field_name: key,
              old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : 'Não definido',
              new_value: newValue !== null && newValue !== undefined ? String(newValue) : 'Não definido',
              changed_at: now
            });
            console.log(`Alteração registrada para o campo ${key}`);
          } catch (error) {
            console.error(`Erro ao registrar histórico para o campo ${key}:`, error);
          }
        }
      }
      
      const [updatedStartup] = await db
        .update(startups)
        .set(dataWithTimestamp)
        .where(eq(startups.id, id))
        .returning();
      
      console.log(`Startup ${id} atualizada com sucesso`);
      return updatedStartup;
    } catch (error) {
      console.error(`Erro ao atualizar startup ${id}:`, error);
      throw error;
    }
  }
  
  async updateStartupStatus(id: string, status_id: string): Promise<Startup | undefined> {
    try {
      console.log(`Atualizando status da startup ${id} para ${status_id}`);
      
      // Busca a startup antes da atualização para obter o status anterior
      const oldStartup = await this.getStartup(id);
      if (!oldStartup) {
        console.log(`Startup não encontrada: ${id}`);
        return undefined;
      }
      
      // Busca os detalhes dos status (anterior e novo)
      const oldStatus = oldStartup.status_id ? await this.getStatus(oldStartup.status_id) : null;
      const newStatus = await this.getStatus(status_id);
      
      if (!newStatus) {
        console.error(`Status não encontrado: ${status_id}`);
        return undefined;
      }
      
      console.log(`Alterando status de ${oldStatus?.name || 'Nenhum'} para ${newStatus.name}`);
      
      // Se havia status anterior, fecha o registro de tempo no histórico
      if (oldStatus) {
        // Busca o último registro de histórico de status aberto para esta startup
        const statusHistoryEntries = await this.getStartupStatusHistory(id);
        const openEntry = statusHistoryEntries.find(entry => !entry.end_date && entry.status_id === oldStatus.id);
        
        if (openEntry) {
          // Fecha o registro com a data atual
          const now = new Date();
          console.log(`Fechando registro de status anterior (${openEntry.id}) com timestamp ${now.toISOString()}`);
          await this.updateStartupStatusHistoryEntry(openEntry.id, now);
        } else {
          console.log(`Nenhum registro aberto encontrado para o status anterior ${oldStatus.id}`);
        }
      }
      
      // Cria um novo registro de histórico de status
      const now = new Date();
      try {
        console.log(`Criando novo registro no histórico de status para ${newStatus.name}`);
        await db.insert(startupStatusHistory).values({
          startup_id: id,
          status_id: status_id,
          status_name: newStatus.name,
          start_date: now
        });
      } catch (error) {
        console.error(`Erro ao criar registro de histórico de status:`, error);
      }
      
      // Registra a mudança no histórico geral
      try {
        console.log(`Registrando alteração de status no histórico geral`);
        await db.insert(startupHistory).values({
          startup_id: id,
          field_name: 'status_id',
          old_value: oldStatus ? `${oldStatus.name} (${oldStatus.id})` : 'Nenhum',
          new_value: `${newStatus.name} (${newStatus.id})`
        });
      } catch (error) {
        console.error(`Erro ao registrar alteração de status no histórico geral:`, error);
      }
      
      // Atualiza o status da startup sem registrar no histórico novamente
      const [updatedStartup] = await db
        .update(startups)
        .set({ 
          status_id: status_id,
          updated_at: now
        })
        .where(eq(startups.id, id))
        .returning();
      
      console.log(`Status da startup ${id} atualizado com sucesso`);
      return updatedStartup;
    } catch (error) {
      console.error(`Erro ao atualizar status da startup ${id}:`, error);
      throw error;
    }
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
  
  // Startup history operations
  async getStartupHistory(startupId: string): Promise<StartupHistory[]> {
    return await db
      .select()
      .from(startupHistory)
      .where(eq(startupHistory.startup_id, startupId))
      .orderBy(desc(startupHistory.changed_at));
  }
  
  async createStartupHistoryEntry(entry: InsertStartupHistory): Promise<StartupHistory> {
    const [historyEntry] = await db
      .insert(startupHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }
  
  // Startup status history operations
  async getStartupStatusHistory(startupId: string): Promise<StartupStatusHistory[]> {
    return await db
      .select()
      .from(startupStatusHistory)
      .where(eq(startupStatusHistory.startup_id, startupId))
      .orderBy(desc(startupStatusHistory.start_date));
  }
  
  async createStartupStatusHistoryEntry(entry: InsertStartupStatusHistory): Promise<StartupStatusHistory> {
    const [historyEntry] = await db
      .insert(startupStatusHistory)
      .values(entry)
      .returning();
    return historyEntry;
  }
  
  async updateStartupStatusHistoryEntry(id: string, endDate: Date): Promise<StartupStatusHistory | undefined> {
    // Calcular a duração em minutos
    const [entry] = await db.select().from(startupStatusHistory).where(eq(startupStatusHistory.id, id));
    
    if (!entry) {
      return undefined;
    }
    
    const startDate = new Date(entry.start_date);
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    
    // Atualizar o registro com a data de fim e duração
    const [updatedEntry] = await db
      .update(startupStatusHistory)
      .set({ 
        end_date: endDate,
        duration_minutes: durationMinutes
      })
      .where(eq(startupStatusHistory.id, id))
      .returning();
      
    return updatedEntry;
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
          // Insere a startup
          const [newStartup] = await db.insert(startups).values(startup).returning();
          
          // Cria um registro inicial no histórico de status
          if (newStartup && newStartup.status_id) {
            const status = await this.getStatus(newStartup.status_id);
            if (status) {
              await db.insert(startupStatusHistory).values({
                startup_id: newStartup.id,
                status_id: newStartup.status_id,
                status_name: status.name,
                start_date: newStartup.created_at
              });
            }
          }
        }
      }
    }
  }
}

export const storage = new DatabaseStorage();
