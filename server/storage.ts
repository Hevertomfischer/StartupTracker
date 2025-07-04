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
  files,
  type File,
  type InsertFile,
  startupHistory,
  type StartupHistory,
  type InsertStartupHistory,
  startupStatusHistory,
  type StartupStatusHistory,
  type InsertStartupStatusHistory,
  // Novas importações para gerenciamento de usuários e permissões
  userRoles,
  type UserRole,
  type InsertUserRole,
  userRoleAssignments,
  type UserRoleAssignment,
  type InsertUserRoleAssignment,
  systemPages,
  type SystemPage,
  type InsertSystemPage,
  rolePagePermissions,
  // Importações para logs de workflow
  workflowLogs,
  type WorkflowLog,
  type InsertWorkflowLog,
  type RolePagePermission,
  type InsertRolePagePermission,
  // Importações para tarefas
  tasks,
  type Task,
  type InsertTask,
  taskComments,
  type TaskComment,
  type InsertTaskComment,
  // Importações para workflows
  workflows,
  type Workflow,
  type InsertWorkflow,
  workflowActions,
  type WorkflowAction,
  type InsertWorkflowAction,
  workflowConditions,
  type WorkflowCondition,
  type InsertWorkflowCondition
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InsertUser>): Promise<User | undefined>;
  deactivateUser(id: string): Promise<User | undefined>;

  // User Role operations
  getUserRoles(): Promise<UserRole[]>;
  getUserRole(id: string): Promise<UserRole | undefined>;
  createUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(id: string, role: Partial<InsertUserRole>): Promise<UserRole | undefined>;
  deleteUserRole(id: string): Promise<boolean>;

  // User Role Assignment operations
  getUserRoleAssignments(userId: string): Promise<UserRoleAssignment[]>;
  getUsersByRole(roleId: string): Promise<User[]>;
  assignRoleToUser(assignment: InsertUserRoleAssignment): Promise<UserRoleAssignment>;
  removeRoleFromUser(userId: string, roleId: string): Promise<boolean>;

  // System Page operations
  getSystemPages(): Promise<SystemPage[]>;
  getSystemPage(id: string): Promise<SystemPage | undefined>;
  createSystemPage(page: InsertSystemPage): Promise<SystemPage>;
  updateSystemPage(id: string, page: Partial<InsertSystemPage>): Promise<SystemPage | undefined>;
  deleteSystemPage(id: string): Promise<boolean>;

  // Role Page Permission operations
  getRolePagePermissions(roleId: string): Promise<RolePagePermission[]>;
  getPagePermissions(pageId: string): Promise<RolePagePermission[]>;
  assignPageToRole(permission: InsertRolePagePermission): Promise<RolePagePermission>;
  removePageFromRole(roleId: string, pageId: string): Promise<boolean>;

  // User Page Permission check
  getUserAccessiblePages(userId: string): Promise<SystemPage[]>;
  checkUserPageAccess(userId: string, pagePath: string): Promise<boolean>;

  // File operations
  createFile(file: any): Promise<any>;

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
  updateStartupStatus(id: string, status_id: string, userId?: string): Promise<Startup | undefined>;
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

  // Task operations
  getTasks(): Promise<Task[]>;
  getTasksForStartup(startupId: string): Promise<Task[]>;
  getTasksAssignedToUser(userId: string): Promise<Task[]>;
  getTasksCreatedByUser(userId: string): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  completeTask(id: string): Promise<Task | undefined>;
  deleteTask(id: string): Promise<boolean>;
  getTaskCounts(): Promise<{startupId: string, count: number}[]>;

  // Task comment operations
  getTaskComments(taskId: string): Promise<TaskComment[]>;
  createTaskComment(comment: InsertTaskComment): Promise<TaskComment>;
  deleteTaskComment(id: string): Promise<boolean>;

  //Workflow operations
  getWorkflows(): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(workflow: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, workflow: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<boolean>;
  
  // Workflow Actions
  getWorkflowActions(workflowId: string): Promise<any[]>;
  createWorkflowAction(action: any): Promise<any>;
  deleteWorkflowAction(id: string): Promise<boolean>;
  
  // Workflow Conditions
  getWorkflowConditions(workflowId: string): Promise<any[]>;
  createWorkflowCondition(condition: any): Promise<any>;
  deleteWorkflowCondition(id: string): Promise<boolean>;
  
  // Workflow Logs
  getWorkflowLogs(
    filters?: Record<string, any>,
    options?: { pageSize: number; page: number }
  ): Promise<WorkflowLog[]>;
  
  // Workflow Execution
  processStatusChangeWorkflows(startupId: string, statusId: string, userId?: string): Promise<void>;
  processAttributeChangeWorkflows(startupId: string, attributeName: string, newValue: any, userId?: string): Promise<void>;

  // Seed data
  seedDatabase(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.name));
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: string, userData: Partial<InsertUser>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...userData,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deactivateUser(id: string): Promise<User | undefined> {
    const [deactivatedUser] = await db
      .update(users)
      .set({ 
        active: false,
        updated_at: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return deactivatedUser;
  }

  // File operations
  async createFile(file: any): Promise<any> {
    const [newFile] = await db.insert(files).values(file).returning();
    return newFile;
  }

  // User Role operations
  async getUserRoles(): Promise<UserRole[]> {
    return await db.select().from(userRoles).orderBy(asc(userRoles.name));
  }

  async getUserRole(id: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.id, id));
    return role || undefined;
  }

  async createUserRole(role: InsertUserRole): Promise<UserRole> {
    const [newRole] = await db.insert(userRoles).values(role).returning();
    return newRole;
  }

  async updateUserRole(id: string, roleData: Partial<InsertUserRole>): Promise<UserRole | undefined> {
    const [updatedRole] = await db
      .update(userRoles)
      .set(roleData)
      .where(eq(userRoles.id, id))
      .returning();
    return updatedRole;
  }

  async deleteUserRole(id: string): Promise<boolean> {
    const result = await db.delete(userRoles).where(eq(userRoles.id, id));
    return result.count > 0;
  }

  // User Role Assignment operations
  async getUserRoleAssignments(userId: string): Promise<UserRoleAssignment[]> {
    return await db
      .select()
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.user_id, userId));
  }

  async getUsersByRole(roleId: string): Promise<User[]> {
    // Usando uma subconsulta para obter IDs de usuários com o papel especificado
    const userIds = await db
      .select({ userId: userRoleAssignments.user_id })
      .from(userRoleAssignments)
      .where(eq(userRoleAssignments.role_id, roleId));

    if (userIds.length === 0) return [];

    // Obtendo os detalhes completos dos usuários
    return await db
      .select()
      .from(users)
      .where(
        sql`${users.id} IN (${userIds.map(u => u.userId).join(',')})`
      )
      .orderBy(asc(users.name));
  }

  async assignRoleToUser(assignment: InsertUserRoleAssignment): Promise<UserRoleAssignment> {
    // Verificar se a associação já existe
    const existing = await db
      .select()
      .from(userRoleAssignments)
      .where(
        sql`${userRoleAssignments.user_id} = ${assignment.user_id} AND 
            ${userRoleAssignments.role_id} = ${assignment.role_id}`
      );

    if (existing.length > 0) {
      return existing[0];
    }

    // Criar nova associação
    const [newAssignment] = await db
      .insert(userRoleAssignments)
      .values(assignment)
      .returning();

    return newAssignment;
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<boolean> {
    const result = await db
      .delete(userRoleAssignments)
      .where(
        sql`${userRoleAssignments.user_id} = ${userId} AND 
            ${userRoleAssignments.role_id} = ${roleId}`
      );

    return result.count > 0;
  }

  // System Page operations
  async getSystemPages(): Promise<SystemPage[]> {
    return await db.select().from(systemPages).orderBy(asc(systemPages.name));
  }

  async getSystemPage(id: string): Promise<SystemPage | undefined> {
    const [page] = await db.select().from(systemPages).where(eq(systemPages.id, id));
    return page || undefined;
  }

  async createSystemPage(page: InsertSystemPage): Promise<SystemPage> {
    const [newPage] = await db.insert(systemPages).values(page).returning();
    return newPage;
  }

  async updateSystemPage(id: string, pageData: Partial<InsertSystemPage>): Promise<SystemPage | undefined> {
    const [updatedPage] = await db
      .update(systemPages)
      .set(pageData)
      .where(eq(systemPages.id, id))
      .returning();
    return updatedPage;
  }

  async deleteSystemPage(id: string): Promise<boolean> {
    const result = await db.delete(systemPages).where(eq(systemPages.id, id));
    return result.count > 0;
  }

  // Role Page Permission operations
  async getRolePagePermissions(roleId: string): Promise<RolePagePermission[]> {
    return await db
      .select()
      .from(rolePagePermissions)
      .where(eq(rolePagePermissions.role_id, roleId));
  }

  async getPagePermissions(pageId: string): Promise<RolePagePermission[]> {
    return await db
      .select()
      .from(rolePagePermissions)
      .where(eq(rolePagePermissions.page_id, pageId));
  }

  async assignPageToRole(permission: InsertRolePagePermission): Promise<RolePagePermission> {
    // Verificar se a permissão já existe
    const existing = await db
      .select()
      .from(rolePagePermissions)
      .where(
        sql`${rolePagePermissions.role_id} = ${permission.role_id} AND 
            ${rolePagePermissions.page_id} = ${permission.page_id}`
      );

    if (existing.length > 0) {
      return existing[0];
    }

    // Criar nova permissão
    const [newPermission] = await db
      .insert(rolePagePermissions)
      .values(permission)
      .returning();

    return newPermission;
  }

  async removePageFromRole(roleId: string, pageId: string): Promise<boolean> {
    const result = await db
      .delete(rolePagePermissions)
      .where(
        sql`${rolePagePermissions.role_id} = ${roleId} AND 
            ${rolePagePermissions.page_id} = ${pageId}`
      );

    return result.count > 0;
  }

  // User Page Permission check
  async getUserAccessiblePages(userId: string): Promise<SystemPage[]> {
    // Consulta para obter todos os papéis do usuário
    const userRoles = await this.getUserRoleAssignments(userId);

    if (userRoles.length === 0) {
      return []; // Usuário sem papéis não tem acesso a nenhuma página
    }

    // Array com os IDs dos papéis do usuário
    const roleIds = userRoles.map(assignment => assignment.role_id);

    // Consulta para obter todos os IDs de páginas associadas a esses papéis
    const pagePermissions = await db
      .select()
      .from(rolePagePermissions)
      .where(
        sql`${rolePagePermissions.role_id} IN (${roleIds.join(',')})`
      );

    if (pagePermissions.length === 0) {
      return []; // Nenhuma página associada aos papéis do usuário
    }

    // Array com os IDs das páginas acessíveis
    const pageIds = pagePermissions.map(permission => permission.page_id);

    // Consulta para obter os detalhes completos das páginas
    return await db
      .select()
      .from(systemPages)
      .where(
        sql`${systemPages.id} IN (${pageIds.join(',')})`
      )
      .orderBy(asc(systemPages.name));
  }

  async checkUserPageAccess(userId: string, pagePath: string): Promise<boolean> {
    // Primeiro, busca a página pelo seu caminho
    const [page] = await db
      .select()
      .from(systemPages)
      .where(eq(systemPages.path, pagePath));

    if (!page) {
      return false; // A página não existe
    }

    // Consulta para obter todos os papéis do usuário
    const userRoles = await this.getUserRoleAssignments(userId);

    if (userRoles.length === 0) {
      return false; // Usuário sem papéis não tem acesso
    }

    // Array com os IDs dos papéis do usuário
    const roleIds = userRoles.map(assignment => assignment.role_id);

    // Verificar se existe pelo menos uma permissão que associe um papel do usuário à página
    const [permission] = await db
      .select()
      .from(rolePagePermissions)
      .where(
        sql`${rolePagePermissions.page_id} = ${page.id} AND
            ${rolePagePermissions.role_id} IN (${roleIds.join(',')})`
      );

    return !!permission; // Retorna true se encontrou uma permissão, false caso contrário
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
            
            // Processar workflow para mudança de atributo
            try {
              console.log(`Iniciando processamento de workflows para mudança de atributo ${key}`);
              
              // Usar dynamic import para evitar dependência circular
              const { WorkflowEngine } = await import('./workflow-engine');
              const workflowEngine = new WorkflowEngine();
              // Não temos acesso ao req.user aqui, corrigiremos isso em routes.ts
              await workflowEngine.processAttributeChangeWorkflows(id, key, newValue);
            } catch (workflowError) {
              console.error(`Erro ao processar workflows para a mudança de atributo ${key}:`, workflowError);
              // Não falha a operação principal se o processamento de workflow falhar
            }
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

  async updateStartupStatus(id: string, status_id: string, userId?: string): Promise<Startup | undefined> {
    try {
      console.log(`Atualizando status da startup ${id} para ${status_id}, disparado pelo usuário ${userId || 'desconhecido'}`);

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
      
      // Processar workflows para mudança de status
      try {
        console.log(`Iniciando processamento de workflows para mudança de status...`);
        
        // Buscar workflows aplicáveis usando o banco de dados diretamente
        const activeWorkflows = await db
          .select()
          .from(workflows)
          .where(
            and(
              eq(workflows.is_active, true),
              eq(workflows.trigger_type, "status_change")
            )
          );
          
        // Verificar se tem workflows para processar
        if (activeWorkflows.length > 0) {
          console.log(`Encontrados ${activeWorkflows.length} workflows para status_change`);
          
          // Verificar cada workflow
          for (const workflow of activeWorkflows) {
            // Verificar se o status corresponde ao trigger_details
            const details = workflow.trigger_details as Record<string, any>;
            if (details?.status_id === status_id) {
              console.log(`Workflow elegível: ${workflow.name} (${workflow.id})`);
              
              // Usar dynamic import para resolver a dependência circular
              const { WorkflowEngine } = await import('./workflow-engine');
              const workflowEngine = new WorkflowEngine();
              
              // Passar o ID do usuário para o processamento de workflows
              await workflowEngine.processStatusChangeWorkflows(id, status_id, userId);
              break; // Processamos apenas uma vez
            }
          }
        }
      } catch (workflowError) {
        console.error(`Erro ao processar workflows para a mudança de status:`, workflowError);
        // Não falha a operação principal se o processamento de workflow falhar
      }
      
      return updatedStartup;
    } catch (error) {
      console.error(`Erro ao atualizar status da startup ${id}:`, error);
      throw error;
    }
  }

  async deleteStartup(id: string): Promise<boolean> {
    try {
      console.log(`Iniciando exclusão da startup ${id}`);
      
      // Verificar se a startup existe primeiro
      const startup = await db.select().from(startups).where(eq(startups.id, id));
      if (startup.length === 0) {
        console.log(`Startup ${id} não encontrada`);
        return false;
      }

      // Deletar em ordem para respeitar as foreign keys
      
      // 1. Deletar comentários de tasks relacionadas
      await db.execute(sql`
        DELETE FROM task_comments 
        WHERE task_id IN (
          SELECT id FROM tasks WHERE startup_id = ${id}
        )
      `);
      
      // 2. Deletar tasks da startup
      await db.execute(sql`DELETE FROM tasks WHERE startup_id = ${id}`);
      
      // 3. Deletar logs de workflow da startup
      await db.execute(sql`DELETE FROM workflow_logs WHERE startup_id = ${id}`);
      
      // 4. Deletar anexos da startup
      await db.execute(sql`DELETE FROM startup_attachments WHERE startup_id = ${id}`);
      
      // 5. Deletar histórico de status da startup
      await db.execute(sql`DELETE FROM startup_status_history WHERE startup_id = ${id}`);
      
      // 6. Deletar histórico geral da startup
      await db.execute(sql`DELETE FROM startup_history WHERE startup_id = ${id}`);
      
      // 7. Deletar membros da startup
      await db.execute(sql`DELETE FROM startup_members WHERE startup_id = ${id}`);
      
      // 8. Finalmente, deletar a startup
      await db.execute(sql`DELETE FROM startups WHERE id = ${id}`);

      console.log(`Exclusão da startup ${id} concluída com sucesso`);
      return true;
    } catch (error) {
      console.error("Error deleting startup:", error);
      throw error;
    }
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
    try {
      console.log(`Buscando histórico da startup ${startupId} no banco de dados`);

      const results = await db
        .select()
        .from(startupHistory)
        .where(eq(startupHistory.startup_id, startupId))
        .orderBy(desc(startupHistory.changed_at));

      console.log(`Encontrados ${results.length} registros de histórico para a startup ${startupId}`);
      return results;
    } catch (error) {
      console.error(`Erro ao buscar histórico da startup ${startupId}:`, error);
      return [];
    }
  }

  async createStartupHistoryEntry(entry: InsertStartupHistory): Promise<StartupHistory> {
    try {
      const [historyEntry] = await db
        .insert(startupHistory)
        .values(entry)
        .returning();

      console.log(`Novo registro de histórico criado: ${JSON.stringify(historyEntry)}`);
      return historyEntry;
    } catch (error) {
      console.error(`Erro ao criar registro de histórico:`, error);
      throw error;
    }
  }

  // Startup status history operations
  async getStartupStatusHistory(startupId: string): Promise<StartupStatusHistory[]> {
    try {
      console.log(`Buscando histórico de status da startup ${startupId} no banco de dados`);

      const results = await db
        .select()
        .from(startupStatusHistory)
        .where(eq(startupStatusHistory.startup_id, startupId))
        .orderBy(desc(startupStatusHistory.start_date));

      console.log(`Encontrados ${results.length} registros de histórico de status para a startup ${startupId}`);
      return results;
    } catch (error) {
      console.error(`Erro ao buscar histórico de status da startup ${startupId}:`, error);
      return [];
    }
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
  // Task operations
  async getTasks(): Promise<Task[]> {
    return await db.select().from(tasks).orderBy(desc(tasks.created_at));
  }

  async getTasksForStartup(startupId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.startup_id, startupId))
      .orderBy(desc(tasks.created_at));
  }

  async getTasksAssignedToUser(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.assigned_to, userId))
      .orderBy(desc(tasks.created_at));
  }

  async getTasksCreatedByUser(userId: string): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(eq(tasks.created_by, userId))
      .orderBy(desc(tasks.created_at));
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task || undefined;
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async updateTask(id: string, taskData: Partial<InsertTask>): Promise<Task | undefined> {
    const [updatedTask] = await db
      .update(tasks)
      .set({
        ...taskData,
        updated_at: new Date()
      })
      .where(eq(tasks.id, id))
      .returning();
    return updatedTask;
  }

  async completeTask(id: string): Promise<Task | undefined> {
    const now = new Date();
    const [completedTask] = await db
      .update(tasks)
      .set({
        status: "done",
        completed_at: now,
        updated_at: now
      })
      .where(eq(tasks.id, id))
      .returning();
    return completedTask;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await db.delete(tasks).where(eq(tasks.id, id));
    return result.count > 0;
  }

  async getTaskCounts(): Promise<{startupId: string, count: number}[]> {
    try {
      const result = await db.execute(sql`
        SELECT s.id as "startupId", COALESCE(COUNT(t.id), 0) as "count"
        FROM startups s
        LEFT JOIN tasks t ON s.id = t.startup_id
        GROUP BY s.id
      `);

      console.log("Task Counts - Database Raw Result:", result);

      // Converte o resultado explicitamente
      const counts: {startupId: string, count: number}[] = [];

      // @ts-ignore - Drizzle ORM tipagem
      for (const row of result) {
        if (row && typeof row.startupId === 'string') {
          counts.push({
            startupId: row.startupId,
            count: parseInt(row.count.toString())
          });
        }
      }

      console.log("Task Counts - Converted Result:", counts);

      return counts;
    } catch (error) {
      console.error("Error in getTaskCounts:", error);
      return [];
    }
  }

  // Task comment operations
  async getTaskComments(taskId: string): Promise<TaskComment[]> {
    return await db
      .select()
      .from(taskComments)
      .where(eq(taskComments.task_id, taskId))
      .orderBy(asc(taskComments.created_at));
  }

  async createTaskComment(comment: InsertTaskComment): Promise<TaskComment> {
    const [newComment] = await db.insert(taskComments).values(comment).returning();
    return newComment;
  }

  async deleteTaskComment(id: string): Promise<boolean> {
    const result = await db.delete(taskComments).where(eq(taskComments.id, id));
    return result.count > 0;
  }  

  // Workflow functions
  async getWorkflows(): Promise<Workflow[]> {
    return await db.select().from(workflows);
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const results = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return results[0];
  }

  async createWorkflow(workflow: InsertWorkflow): Promise<Workflow> {
    const results = await db
      .insert(workflows)
      .values(workflow)
      .returning();
    return results[0];
  }

  async updateWorkflow(id: string, workflowData: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const results = await db
      .update(workflows)
      .set(workflowData)
      .where(eq(workflows.id, id))
      .returning();
    return results[0];
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const result = await db
      .delete(workflows)
      .where(eq(workflows.id, id));
    return result.count > 0;
  }
  
  // Workflow Actions
  async getWorkflowActions(workflowId: string): Promise<any[]> {
    return await db
      .select()
      .from(workflowActions)
      .where(eq(workflowActions.workflow_id, workflowId))
      .orderBy(asc(workflowActions.order));
  }
  
  async createWorkflowAction(action: any): Promise<any> {
    const [result] = await db
      .insert(workflowActions)
      .values(action)
      .returning();
    return result;
  }
  
  async deleteWorkflowAction(id: string): Promise<boolean> {
    const result = await db
      .delete(workflowActions)
      .where(eq(workflowActions.id, id));
    return result.count > 0;
  }
  
  // Workflow Conditions
  async getWorkflowConditions(workflowId: string): Promise<any[]> {
    return await db
      .select()
      .from(workflowConditions)
      .where(eq(workflowConditions.workflow_id, workflowId));
  }
  
  async createWorkflowCondition(condition: any): Promise<any> {
    const [result] = await db
      .insert(workflowConditions)
      .values(condition)
      .returning();
    return result;
  }
  
  async deleteWorkflowCondition(id: string): Promise<boolean> {
    const result = await db
      .delete(workflowConditions)
      .where(eq(workflowConditions.id, id));
    return result.count > 0;
  }
  
  // Query workflow logs
  async getWorkflowLogs(
    filters: Record<string, any> = {}, 
    options: { pageSize: number; page: number } = { pageSize: 100, page: 1 }
  ): Promise<WorkflowLog[]> {
    try {
      const { pageSize, page } = options;
      const offset = (page - 1) * pageSize;
      
      // Construir a consulta usando uma abordagem mais clara
      let baseQuery = db.select().from(workflowLogs);
      
      // Função auxiliar para aplicar filtro e retornar nova query
      const applyFilter = (query: any, field: any, value: any) => {
        return query.where(eq(field, value));
      };
      
      // Aplicar filtros sequencialmente
      let finalQuery = baseQuery;
      
      if (filters.workflow_id) {
        finalQuery = applyFilter(finalQuery, workflowLogs.workflow_id, filters.workflow_id);
      }
      
      if (filters.startup_id) {
        finalQuery = applyFilter(finalQuery, workflowLogs.startup_id, filters.startup_id);
      }
      
      if (filters.status) {
        finalQuery = applyFilter(finalQuery, workflowLogs.status, filters.status);
      }
      
      if (filters.action_type) {
        finalQuery = applyFilter(finalQuery, workflowLogs.action_type, filters.action_type);
      }
      
      // Adicionar ordenação, limite e offset
      const logs = await finalQuery
        .orderBy(desc(workflowLogs.created_at))
        .limit(pageSize)
        .offset(offset);
      
      return logs;
    } catch (error) {
      console.error("Error fetching workflow logs:", error);
      return [];
    }
  }
  
  // Workflow Execution
  async processStatusChangeWorkflows(startupId: string, statusId: string, userId?: string): Promise<void> {
    try {
      console.log(`[Storage] Iniciando processamento de workflows para mudança de status: Startup ${startupId}, Status ${statusId}, UserId: ${userId || 'não informado'}`);
      
      // Usar dynamic import para evitar dependência circular
      const { WorkflowEngine } = await import('./workflow-engine');
      const workflowEngine = new WorkflowEngine();
      await workflowEngine.processStatusChangeWorkflows(startupId, statusId, userId);
      
      console.log(`[Storage] Processamento de workflows para mudança de status concluído`);
    } catch (error) {
      console.error(`[Storage] Erro ao processar workflows para mudança de status:`, error);
    }
  }

  async processAttributeChangeWorkflows(startupId: string, attributeName: string, newValue: any, userId?: string): Promise<void> {
    try {
      console.log(`[Storage] Iniciando processamento de workflows para mudança de atributo: Startup ${startupId}, Atributo ${attributeName}, UserId: ${userId || 'não informado'}`);
      
      // Usar dynamic import para evitar dependência circular
      const { WorkflowEngine } = await import('./workflow-engine');
      const workflowEngine = new WorkflowEngine();
      await workflowEngine.processAttributeChangeWorkflows(startupId, attributeName, newValue, userId);
      
      console.log(`[Storage] Processamento de workflows para mudança de atributo concluído`);
    } catch (error) {
      console.error(`[Storage] Erro ao processar workflows para mudança de atributo:`, error);
    }
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

    // Verificar se já temos perfis de usuário
    const existingRoles = await db.select().from(userRoles);
    if (existingRoles.length === 0) {
      console.log("Criando perfis de usuário padrão...");
      // Criar perfis padrão
      const roleValues = [
        { 
          name: "Administrador", 
          description: "Acesso completo ao sistema, incluindo gerenciamento de usuários e configurações" 
        },
        { 
          name: "Investidor", 
          description: "Pode visualizar e editar startups, adicionar membros de equipe, mas não pode excluir" 
        },
        { 
          name: "Associado", 
          description: "Acesso somente leitura às startups e seus dados" 
        }
      ];

      await db.insert(userRoles).values(roleValues);
      console.log("Perfis padrão criados com sucesso.");
    }

    // Verificar se já temos páginas do sistema
    const existingPages = await db.select().from(systemPages);
    if (existingPages.length === 0) {
      console.log("Criando páginas do sistema...");
      // Criar páginas padrão
      const pageValues = [
        { 
          name: "Dashboard", 
          path: "/", 
          description: "Página inicial com visão geral",
          icon: "dashboard"
        },
        { 
          name: "Gestão de Startups", 
          path: "/startups", 
          description: "Gerenciamento completo de startups",
          icon: "building"
        },
        { 
          name: "Configurações", 
          path: "/settings", 
          description: "Configurações do sistema",
          icon: "settings"
        },
        { 
          name: "Gerenciamento de Usuários", 
          path: "/users", 
          description: "Gerenciamento de usuários e permissões",
          icon: "users"
        }
      ];

      await db.insert(systemPages).values(pageValues);
      console.log("Páginas do sistema criadas com sucesso.");

      // Obter IDs dos perfis e páginas para associação
      const roles = await db.select().from(userRoles);
      const pages = await db.select().from(systemPages);

      if (roles.length > 0 && pages.length > 0) {
        console.log("Configurando permissões de acesso às páginas...");

        const adminRole = roles.find(role => role.name === "Administrador");
        const investorRole = roles.find(role => role.name === "Investidor");
        const associateRole = roles.find(role => role.name === "Associado");

        const dashboardPage = pages.find(page => page.path === "/");
        const startupsPage = pages.find(page => page.path === "/startups");
        const settingsPage = pages.find(page => page.path === "/settings");
        const usersPage = pages.find(page => page.path === "/users");

        // Acessos do Administrador - todas as páginas
        if (adminRole) {
          const adminPermissions = pages.map(page => ({
            role_id: adminRole.id,
            page_id: page.id
          }));

          await db.insert(rolePagePermissions).values(adminPermissions);
        }

        // Acessos do Investidor - dashboard e startups
        if (investorRole && dashboardPage && startupsPage) {
          await db.insert(rolePagePermissions).values([
            { role_id: investorRole.id, page_id: dashboardPage.id },
            { role_id: investorRole.id, page_id: startupsPage.id }
          ]);
        }

        // Acessos do Associado - somente dashboard e startups (leitura)
        if (associateRole && dashboardPage && startupsPage) {
          await db.insert(rolePagePermissions).values([
            { role_id: associateRole.id, page_id: dashboardPage.id },
            { role_id: associateRole.id, page_id: startupsPage.id }
          ]);
        }

        console.log("Permissões de acesso configuradas com sucesso.");
      }
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