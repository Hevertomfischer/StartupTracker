import { 
  users, 
  type User, 
  type InsertUser, 
  startups, 
  type Startup, 
  type InsertStartup,
  startupMembers,
  type StartupMember,
  type InsertStartupMember
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Startup operations
  getStartups(): Promise<Startup[]>;
  getStartup(id: number): Promise<Startup | undefined>;
  createStartup(startup: InsertStartup): Promise<Startup>;
  updateStartup(id: number, startup: Partial<InsertStartup>): Promise<Startup | undefined>;
  updateStartupStatus(id: number, status: string): Promise<Startup | undefined>;
  deleteStartup(id: number): Promise<boolean>;
  
  // Startup member operations
  getStartupMembers(startupId: number): Promise<StartupMember[]>;
  createStartupMember(member: InsertStartupMember): Promise<StartupMember>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private startups: Map<number, Startup>;
  private startupMembers: Map<number, StartupMember>;
  private currentUserId: number;
  private currentStartupId: number;
  private currentMemberId: number;

  constructor() {
    this.users = new Map();
    this.startups = new Map();
    this.startupMembers = new Map();
    this.currentUserId = 1;
    this.currentStartupId = 1;
    this.currentMemberId = 1;
    
    // Initialize with some sample data
    this.initSampleData();
  }

  // User operations
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Startup operations
  async getStartups(): Promise<Startup[]> {
    return Array.from(this.startups.values());
  }
  
  async getStartup(id: number): Promise<Startup | undefined> {
    return this.startups.get(id);
  }
  
  async createStartup(insertStartup: InsertStartup): Promise<Startup> {
    const id = this.currentStartupId++;
    const startup: Startup = { ...insertStartup, id };
    this.startups.set(id, startup);
    return startup;
  }
  
  async updateStartup(id: number, updateData: Partial<InsertStartup>): Promise<Startup | undefined> {
    const startup = this.startups.get(id);
    if (!startup) return undefined;
    
    const updatedStartup = { ...startup, ...updateData };
    this.startups.set(id, updatedStartup);
    return updatedStartup;
  }
  
  async updateStartupStatus(id: number, status: string): Promise<Startup | undefined> {
    return this.updateStartup(id, { status });
  }
  
  async deleteStartup(id: number): Promise<boolean> {
    return this.startups.delete(id);
  }
  
  // Startup member operations
  async getStartupMembers(startupId: number): Promise<StartupMember[]> {
    return Array.from(this.startupMembers.values()).filter(
      member => member.startupId === startupId
    );
  }
  
  async createStartupMember(insertMember: InsertStartupMember): Promise<StartupMember> {
    const id = this.currentMemberId++;
    const member: StartupMember = { ...insertMember, id };
    this.startupMembers.set(id, member);
    return member;
  }
  
  // Initialize sample data
  private initSampleData() {
    // Sample startups
    const sampleStartups: InsertStartup[] = [
      {
        name: "TechNova",
        description: "AI-powered predictive analytics platform for business intelligence",
        industry: "tech",
        status: "idea",
        fundingStage: "pre-seed",
        teamSize: 4,
        location: "San Francisco, CA",
        foundedDate: "January 2023",
      },
      {
        name: "EduMentor",
        description: "Personalized learning platform for K-12 students with adaptive curriculum",
        industry: "education",
        status: "idea",
        fundingStage: "pre-seed",
        teamSize: 3,
        location: "Boston, MA",
        foundedDate: "March 2023",
      },
      {
        name: "GreenHarvest",
        description: "Smart urban farming solution for sustainable food production",
        industry: "other",
        status: "idea",
        fundingStage: "bootstrapped",
        teamSize: 2,
        location: "Portland, OR",
        foundedDate: "February 2023",
      },
      {
        name: "HealthSync",
        description: "Remote patient monitoring platform with real-time analytics",
        industry: "health",
        status: "mvp",
        fundingStage: "seed",
        teamSize: 6,
        location: "Chicago, IL",
        foundedDate: "November 2022",
      },
      {
        name: "PayEase",
        description: "Cross-border payment solution with reduced fees and faster transfers",
        industry: "finance",
        status: "mvp",
        fundingStage: "seed",
        teamSize: 5,
        location: "New York, NY",
        foundedDate: "October 2022",
      },
      {
        name: "ShopSmart",
        description: "AI-powered shopping assistant with personalized recommendations",
        industry: "ecommerce",
        status: "traction",
        fundingStage: "series-a",
        teamSize: 12,
        location: "Seattle, WA",
        foundedDate: "July 2022",
      },
      {
        name: "DataVision",
        description: "Data visualization platform for complex business insights",
        industry: "tech",
        status: "traction",
        fundingStage: "series-a",
        teamSize: 15,
        location: "Austin, TX",
        foundedDate: "May 2022",
      },
      {
        name: "CloudSecure",
        description: "Enterprise-grade cloud security and compliance automation platform",
        industry: "tech",
        status: "scaling",
        fundingStage: "series-b",
        teamSize: 28,
        location: "San Jose, CA",
        foundedDate: "January 2022",
      }
    ];
    
    // Add startups to storage
    sampleStartups.forEach(startup => {
      const id = this.currentStartupId++;
      this.startups.set(id, { ...startup, id });
    });
    
    // Sample team members
    const teamMembers: InsertStartupMember[] = [
      { startupId: 1, name: "Michael Foster", role: "CEO & Co-founder", photoUrl: "https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
      { startupId: 1, name: "Lindsay Walton", role: "CTO & Co-founder", photoUrl: "https://images.unsplash.com/photo-1550525811-e5869dd03032?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
      { startupId: 2, name: "Emma Wilson", role: "CEO", photoUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2.25&w=256&h=256&q=80" },
      { startupId: 2, name: "Sarah Chen", role: "Head of Product", photoUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" },
      { startupId: 2, name: "Tom Cook", role: "CTO", photoUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" }
    ];
    
    // Add team members to storage
    teamMembers.forEach(member => {
      const id = this.currentMemberId++;
      this.startupMembers.set(id, { ...member, id });
    });
  }
}

export const storage = new MemStorage();
