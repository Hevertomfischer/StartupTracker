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
    const result = await db.execute(sql`
      SELECT startup_id as "startupId", COUNT(*) as "count"
      FROM tasks
      WHERE startup_id IS NOT NULL
      GROUP BY startup_id
    `);
    return result.rows as {startupId: string, count: number}[];
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