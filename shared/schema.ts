import { pgTable, text, serial, integer, boolean, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Status table
export const statuses = pgTable("statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#A5B4FC"),
  order: integer("order").notNull().default(0),
});

// Startups table with all the requested attributes
export const startups = pgTable("startups", {
  // Atributos principais
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  status_id: uuid("status_id").references(() => statuses.id),
  
  // Informações básicas
  description: text("description"),
  website: text("website"),
  sector: text("sector"),
  business_model: text("business_model"),
  category: text("category"),
  market: text("market"),
  
  // Informações do CEO
  ceo_name: text("ceo_name"),
  ceo_email: text("ceo_email"),
  ceo_whatsapp: text("ceo_whatsapp"),
  ceo_linkedin: text("ceo_linkedin"),
  
  // Localização
  city: text("city"),
  state: text("state"),
  
  // Métricas financeiras
  mrr: numeric("mrr"),
  client_count: integer("client_count"),
  accumulated_revenue_current_year: numeric("accumulated_revenue_current_year"),
  total_revenue_last_year: numeric("total_revenue_last_year"),
  total_revenue_previous_year: numeric("total_revenue_previous_year"),
  partner_count: integer("partner_count"),
  
  // Métricas de mercado
  tam: numeric("tam"),
  sam: numeric("sam"),
  som: numeric("som"),
  
  // Datas e prazos
  founding_date: timestamp("founding_date"),
  due_date: timestamp("due_date"),
  
  // Campos de análise
  problem_solution: text("problem_solution"),
  problem_solved: text("problem_solved"),
  differentials: text("differentials"),
  competitors: text("competitors"),
  positive_points: text("positive_points"),
  attention_points: text("attention_points"),
  scangels_value_add: text("scangels_value_add"),
  no_investment_reason: text("no_investment_reason"),
  
  // Outros campos
  assigned_to: uuid("assigned_to"),
  google_drive_link: text("google_drive_link"),
  origin_lead: text("origin_lead"),
  referred_by: text("referred_by"),
  priority: text("priority"),
  time_tracking: integer("time_tracking"),
  observations: text("observations"),
});

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
});

// Startup team members
export const startupMembers = pgTable("startup_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  startup_id: uuid("startup_id").notNull().references(() => startups.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  photo_url: text("photo_url"),
  email: text("email"),
  phone: text("phone"),
  linkedin: text("linkedin"),
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertStatusSchema = createInsertSchema(statuses).omit({
  id: true,
});

export const insertStartupSchema = createInsertSchema(startups).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  // Allow founding_date to be null
  founding_date: z.string().nullable().optional(),
});

export const insertStartupMemberSchema = createInsertSchema(startupMembers).omit({
  id: true,
});

export const updateStartupStatusSchema = z.object({
  id: z.string().uuid(),
  status_id: z.string().uuid(),
});

// TypeScript Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStatus = z.infer<typeof insertStatusSchema>;
export type Status = typeof statuses.$inferSelect;

export type InsertStartup = z.infer<typeof insertStartupSchema>;
export type Startup = typeof startups.$inferSelect;

export type InsertStartupMember = z.infer<typeof insertStartupMemberSchema>;
export type StartupMember = typeof startupMembers.$inferSelect;

// Status Enum (for default statuses)
export const StatusEnum = {
  NEW_LEAD: "new_lead",
  INITIAL_CONTACT: "initial_contact",
  MEETING_SCHEDULED: "meeting_scheduled",
  PROPOSAL_SENT: "proposal_sent",
  NEGOTIATION: "negotiation",
  CLOSED_WON: "closed_won",
  CLOSED_LOST: "closed_lost",
} as const;

// Priority Enum
export const PriorityEnum = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

// Sector/Industry Enum
export const SectorEnum = {
  TECH: "tech",
  HEALTH: "health",
  FINANCE: "finance",
  ECOMMERCE: "ecommerce",
  EDUCATION: "education",
  AGRITECH: "agritech",
  CLEANTECH: "cleantech",
  OTHER: "other",
} as const;
