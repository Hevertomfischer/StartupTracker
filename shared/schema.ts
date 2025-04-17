import { pgTable, text, serial, integer, boolean, timestamp, uuid, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Status table
export const statuses = pgTable("statuses", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#A5B4FC"),
  order: integer("order").notNull().default(0),
});

// Arquivos table para armazenar informações de arquivos
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  filename: text("filename").notNull(),
  original_name: text("original_name").notNull(),
  mimetype: text("mimetype").notNull(),
  size: integer("size").notNull(),
  path: text("path").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
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
  
  // Arquivos
  pitch_deck_id: uuid("pitch_deck_id").references(() => files.id, { onDelete: "set null" }),
  
  // Outros campos
  assigned_to: uuid("assigned_to"),
  google_drive_link: text("google_drive_link"),
  origin_lead: text("origin_lead"),
  referred_by: text("referred_by"),
  priority: text("priority"),
  time_tracking: integer("time_tracking"),
  observations: text("observations"),
});

// Tabela de anexos de startups
export const startupAttachments = pgTable("startup_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  startup_id: uuid("startup_id").notNull().references(() => startups.id, { onDelete: "cascade" }),
  file_id: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  description: text("description"),
  document_type: text("document_type"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  active: boolean("active").notNull().default(true),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

// Tabela para armazenar perfis de usuários
export const userRoles = pgTable("user_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  description: text("description"),
  created_at: timestamp("created_at").defaultNow(),
});

// Tabela de relacionamento entre usuários e perfis (muitos-para-muitos)
export const userRoleAssignments = pgTable("user_role_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  user_id: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role_id: uuid("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").defaultNow(),
});

// Tabela para armazenar páginas/recursos do sistema
export const systemPages = pgTable("system_pages", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  path: text("path").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  created_at: timestamp("created_at").defaultNow(),
});

// Tabela de permissões de acesso (quais perfis podem acessar quais páginas)
export const rolePagePermissions = pgTable("role_page_permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  role_id: uuid("role_id").notNull().references(() => userRoles.id, { onDelete: "cascade" }),
  page_id: uuid("page_id").notNull().references(() => systemPages.id, { onDelete: "cascade" }),
  created_at: timestamp("created_at").defaultNow(),
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
  captable_percentage: numeric("captable_percentage").default("0").notNull(),
  observations: text("observations"),
});

// Startup history table to track changes
export const startupHistory = pgTable("startup_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  startup_id: uuid("startup_id").notNull().references(() => startups.id),
  field_name: text("field_name").notNull(),
  old_value: text("old_value"),
  new_value: text("new_value").notNull(),
  changed_at: timestamp("changed_at").defaultNow().notNull(),
  changed_by: uuid("changed_by").references(() => users.id),
});

// Startup status history table to track time spent in each status
export const startupStatusHistory = pgTable("startup_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  startup_id: uuid("startup_id").notNull().references(() => startups.id),
  status_id: uuid("status_id").notNull().references(() => statuses.id),
  status_name: text("status_name").notNull(),
  start_date: timestamp("start_date").defaultNow().notNull(),
  end_date: timestamp("end_date"),
  duration_minutes: integer("duration_minutes"),
});

// Tabela de tarefas
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  startup_id: uuid("startup_id").references(() => startups.id, { onDelete: "set null" }),
  assigned_to: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  created_by: uuid("created_by").references(() => users.id),
  priority: text("priority").notNull().default("medium"), 
  status: text("status").notNull().default("todo"),
  due_date: timestamp("due_date"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
  completed_at: timestamp("completed_at"),
});

// Tabela de comentários em tarefas
export const taskComments = pgTable("task_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  task_id: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  user_id: uuid("user_id").notNull().references(() => users.id),
  comment: text("comment").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Zod Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
});

export const insertStatusSchema = createInsertSchema(statuses).omit({
  id: true,
});

export const insertFileSchema = createInsertSchema(files).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertStartupAttachmentSchema = createInsertSchema(startupAttachments).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertStartupSchema = createInsertSchema(startups).omit({
  id: true,
  created_at: true,
  updated_at: true,
}).extend({
  // Allow founding_date to be null
  founding_date: z.string().nullable().optional(),
  // Ensure numeric fields can be strings or numbers
  mrr: z.union([z.string(), z.number()]).nullable().optional(),
  accumulated_revenue_current_year: z.union([z.string(), z.number()]).nullable().optional(),
  total_revenue_last_year: z.union([z.string(), z.number()]).nullable().optional(),
  total_revenue_previous_year: z.union([z.string(), z.number()]).nullable().optional(),
  tam: z.union([z.string(), z.number()]).nullable().optional(),
  sam: z.union([z.string(), z.number()]).nullable().optional(),
  som: z.union([z.string(), z.number()]).nullable().optional(),
  // Ensure integer fields can be strings or numbers
  client_count: z.union([z.string(), z.number()]).nullable().optional(),
  partner_count: z.union([z.string(), z.number()]).nullable().optional(),
});

export const insertStartupMemberSchema = createInsertSchema(startupMembers).omit({
  id: true,
}).extend({
  captable_percentage: z.union([z.string(), z.number()]).transform(val => 
    typeof val === 'string' ? Number(val) || 0 : val
  ).default(0),
});

export const updateStartupStatusSchema = z.object({
  id: z.string().uuid(),
  status_id: z.string().uuid(),
});

export const insertStartupHistorySchema = createInsertSchema(startupHistory).omit({
  id: true,
  changed_at: true,
});

export const insertStartupStatusHistorySchema = createInsertSchema(startupStatusHistory).omit({
  id: true,
  duration_minutes: true,
});

// Schemas para gestão de usuários e permissões
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  created_at: true,
});

export const insertUserRoleAssignmentSchema = createInsertSchema(userRoleAssignments).omit({
  id: true,
  created_at: true,
});

export const insertSystemPageSchema = createInsertSchema(systemPages).omit({
  id: true,
  created_at: true,
});

export const insertRolePagePermissionSchema = createInsertSchema(rolePagePermissions).omit({
  id: true,
  created_at: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  created_at: true,
  updated_at: true,
  completed_at: true,
}).extend({
  // Aceita string ISO de data e converte para Date
  due_date: z.string().transform(str => str ? new Date(str) : undefined).optional(),
});

export const insertTaskCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  created_at: true,
});

// Workflow tables
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description"),
  is_active: boolean("is_active").notNull().default(true),
  trigger_type: text("trigger_type").notNull(), // status_change, attribute_change, record_creation
  trigger_details: jsonb("trigger_details").notNull().default({}),
  created_by: uuid("created_by").references(() => users.id),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowActions = pgTable("workflow_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflow_id: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  action_type: text("action_type").notNull(), // send_email, update_attribute, create_task
  action_name: text("action_name").notNull(), // Nome descritivo da ação
  action_details: jsonb("action_details").notNull(),
  order: integer("order").notNull().default(0),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const workflowConditions = pgTable("workflow_conditions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflow_id: uuid("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  field_name: text("field_name").notNull(),
  operator: text("operator").notNull(), // equals, not_equals, contains, greater_than, less_than
  value: text("value").notNull(),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Tabela para registrar logs de workflow
export const workflowLogs = pgTable("workflow_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflow_id: uuid("workflow_id").references(() => workflows.id, { onDelete: "set null" }),
  workflow_action_id: uuid("workflow_action_id").references(() => workflowActions.id, { onDelete: "set null" }),
  startup_id: uuid("startup_id").references(() => startups.id, { onDelete: "set null" }),
  action_type: text("action_type"),
  status: text("status").notNull(), // success, error, info, warning
  message: text("message").notNull(),
  details: jsonb("details"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

// Workflow schemas
export const insertWorkflowSchema = createInsertSchema(workflows).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertWorkflowActionSchema = createInsertSchema(workflowActions).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const insertWorkflowConditionSchema = createInsertSchema(workflowConditions).omit({
  id: true,
  created_at: true,
});

export const insertWorkflowLogSchema = createInsertSchema(workflowLogs).omit({
  id: true,
  created_at: true,
});

// TypeScript Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect & {
  roles?: string[]; // Adicionamos a propriedade roles para armazenar os perfis do usuário
};

export type InsertStatus = z.infer<typeof insertStatusSchema>;
export type Status = typeof statuses.$inferSelect;

export type InsertFile = z.infer<typeof insertFileSchema>;
export type File = typeof files.$inferSelect;

export type InsertStartupAttachment = z.infer<typeof insertStartupAttachmentSchema>;
export type StartupAttachment = typeof startupAttachments.$inferSelect;

export type InsertStartup = z.infer<typeof insertStartupSchema>;
export type Startup = typeof startups.$inferSelect;

export type InsertStartupMember = z.infer<typeof insertStartupMemberSchema>;
export type StartupMember = typeof startupMembers.$inferSelect;

export type InsertStartupHistory = z.infer<typeof insertStartupHistorySchema>;
export type StartupHistory = typeof startupHistory.$inferSelect;

export type InsertStartupStatusHistory = z.infer<typeof insertStartupStatusHistorySchema>;
export type StartupStatusHistory = typeof startupStatusHistory.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertUserRoleAssignment = z.infer<typeof insertUserRoleAssignmentSchema>;
export type UserRoleAssignment = typeof userRoleAssignments.$inferSelect;

export type InsertSystemPage = z.infer<typeof insertSystemPageSchema>;
export type SystemPage = typeof systemPages.$inferSelect;

export type InsertRolePagePermission = z.infer<typeof insertRolePagePermissionSchema>;
export type RolePagePermission = typeof rolePagePermissions.$inferSelect;

export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type TaskComment = typeof taskComments.$inferSelect;

export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

export type InsertWorkflowAction = z.infer<typeof insertWorkflowActionSchema>;
export type WorkflowAction = typeof workflowActions.$inferSelect;

export type InsertWorkflowCondition = z.infer<typeof insertWorkflowConditionSchema>;
export type WorkflowCondition = typeof workflowConditions.$inferSelect;

export type InsertWorkflowLog = z.infer<typeof insertWorkflowLogSchema>;
export type WorkflowLog = typeof workflowLogs.$inferSelect;

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

// Status do Log de Workflow
export const WorkflowLogStatusEnum = {
  SUCCESS: "success",
  ERROR: "error",
  INFO: "info",
  WARNING: "warning",
} as const;

// Task Status Enum
export const TaskStatusEnum = {
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled"
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

// User Role Enum
export const UserRoleEnum = {
  ADMIN: "admin",
  INVESTOR: "investor",
  ASSOCIATE: "associate",
} as const;

// Relations

// Define relations

export const filesRelations = relations(files, ({ many, one }) => ({
  attachments: many(startupAttachments),
}));

export const startupAttachmentsRelations = relations(startupAttachments, ({ one }) => ({
  startup: one(startups, {
    fields: [startupAttachments.startup_id],
    references: [startups.id],
  }),
  file: one(files, {
    fields: [startupAttachments.file_id],
    references: [files.id],
  }),
}));

export const startupsRelations = relations(startups, ({ many, one }) => ({
  history: many(startupHistory),
  statusHistory: many(startupStatusHistory),
  members: many(startupMembers),
  tasks: many(tasks),
  attachments: many(startupAttachments),
  pitchDeck: one(files, {
    fields: [startups.pitch_deck_id],
    references: [files.id],
  }),
}));

export const startupHistoryRelations = relations(startupHistory, ({ one }) => ({
  startup: one(startups, {
    fields: [startupHistory.startup_id],
    references: [startups.id],
  }),
}));

export const startupStatusHistoryRelations = relations(startupStatusHistory, ({ one }) => ({
  startup: one(startups, {
    fields: [startupStatusHistory.startup_id],
    references: [startups.id],
  }),
  status: one(statuses, {
    fields: [startupStatusHistory.status_id],
    references: [statuses.id],
  }),
}));

// Relações para as novas tabelas de gerenciamento de usuários e permissões
export const usersRelations = relations(users, ({ many }) => ({
  roleAssignments: many(userRoleAssignments),
  assignedTasks: many(tasks, { relationName: "assignedTasks" }),
  createdTasks: many(tasks, { relationName: "createdTasks" }),
  taskComments: many(taskComments),
}));

export const userRolesRelations = relations(userRoles, ({ many }) => ({
  userAssignments: many(userRoleAssignments),
  pagePermissions: many(rolePagePermissions),
}));

export const userRoleAssignmentsRelations = relations(userRoleAssignments, ({ one }) => ({
  user: one(users, {
    fields: [userRoleAssignments.user_id],
    references: [users.id],
  }),
  role: one(userRoles, {
    fields: [userRoleAssignments.role_id],
    references: [userRoles.id],
  }),
}));

export const systemPagesRelations = relations(systemPages, ({ many }) => ({
  rolePermissions: many(rolePagePermissions),
}));

export const rolePagePermissionsRelations = relations(rolePagePermissions, ({ one }) => ({
  role: one(userRoles, {
    fields: [rolePagePermissions.role_id],
    references: [userRoles.id],
  }),
  page: one(systemPages, {
    fields: [rolePagePermissions.page_id],
    references: [systemPages.id],
  }),
}));

// Relações para tarefas
export const tasksRelations = relations(tasks, ({ one, many }) => ({
  startup: one(startups, {
    fields: [tasks.startup_id],
    references: [startups.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assigned_to],
    references: [users.id],
    relationName: "assignedTasks",
  }),
  createdBy: one(users, {
    fields: [tasks.created_by],
    references: [users.id],
    relationName: "createdTasks",
  }),
  comments: many(taskComments),
}));

// Relações para comentários de tarefas
export const taskCommentsRelations = relations(taskComments, ({ one }) => ({
  task: one(tasks, {
    fields: [taskComments.task_id],
    references: [tasks.id],
  }),
  user: one(users, {
    fields: [taskComments.user_id],
    references: [users.id],
  }),
}));

// Relações para workflows
export const workflowsRelations = relations(workflows, ({ many, one }) => ({
  actions: many(workflowActions),
  conditions: many(workflowConditions),
  createdBy: one(users, {
    fields: [workflows.created_by],
    references: [users.id],
  }),
}));

export const workflowActionsRelations = relations(workflowActions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowActions.workflow_id],
    references: [workflows.id],
  }),
}));

export const workflowConditionsRelations = relations(workflowConditions, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowConditions.workflow_id],
    references: [workflows.id],
  }),
}));

export const workflowLogsRelations = relations(workflowLogs, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowLogs.workflow_id],
    references: [workflows.id],
  }),
  workflowAction: one(workflowActions, {
    fields: [workflowLogs.workflow_action_id],
    references: [workflowActions.id],
  }),
  startup: one(startups, {
    fields: [workflowLogs.startup_id],
    references: [startups.id],
  }),
}));
