import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const scannerModeSchema = z.object({
  mode: z.enum(['INCREMENT', 'DECREMENT', 'DETAILS']),
  quantity: z.number().min(1).default(1),
});

export type ScannerMode = z.infer<typeof scannerModeSchema>;

export const transactionActionSchema = z.enum(['ADD', 'DEDUCT', 'VIEW']);
export type TransactionAction = z.infer<typeof transactionActionSchema>;
