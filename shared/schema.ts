import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const startups = pgTable("startups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  industry: text("industry").notNull(),
  status: text("status").notNull().default("idea"),
  fundingStage: text("funding_stage").notNull(),
  teamSize: integer("team_size").notNull(),
  location: text("location"),
  foundedDate: text("founded_date"),
});

export const startupMembers = pgTable("startup_members", {
  id: serial("id").primaryKey(),
  startupId: integer("startup_id").notNull().references(() => startups.id),
  name: text("name").notNull(),
  role: text("role").notNull(),
  photoUrl: text("photo_url"),
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertStartupSchema = createInsertSchema(startups).omit({
  id: true,
});

export const insertStartupMemberSchema = createInsertSchema(startupMembers).omit({
  id: true,
});

export const updateStartupStatusSchema = z.object({
  id: z.number(),
  status: z.string(),
});

// TypeScript Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertStartup = z.infer<typeof insertStartupSchema>;
export type Startup = typeof startups.$inferSelect;

export type InsertStartupMember = z.infer<typeof insertStartupMemberSchema>;
export type StartupMember = typeof startupMembers.$inferSelect;

// Status and Industry Enums
export const StatusEnum = {
  IDEA: "idea",
  MVP: "mvp",
  TRACTION: "traction",
  SCALING: "scaling",
} as const;

export const IndustryEnum = {
  TECH: "tech",
  HEALTH: "health",
  FINANCE: "finance",
  ECOMMERCE: "ecommerce",
  EDUCATION: "education",
  OTHER: "other",
} as const;

export const FundingStageEnum = {
  BOOTSTRAPPED: "bootstrapped",
  PRE_SEED: "pre-seed",
  SEED: "seed",
  SERIES_A: "series-a",
  SERIES_B: "series-b",
  SERIES_C: "series-c",
} as const;
