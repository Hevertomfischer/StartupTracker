import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Create postgres connection
const connectionString = process.env.DATABASE_URL!;
const sql = postgres(connectionString, { max: 1 });

// Create drizzle client
export const db = drizzle(sql, { schema });