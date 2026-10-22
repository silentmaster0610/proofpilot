import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
// Versioned, per-user aggregate keeps approvals and their evidence atomic.
export const workspaces = sqliteTable("workspaces", {
  userId: text("user_id").primaryKey(),
  data: text("data").notNull(),
  version: integer("version").notNull().default(0),
  updatedAt: text("updated_at").notNull(),
});
export const automationTokens = sqliteTable("automation_tokens", {
  userId: text("user_id").primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  createdAt: text("created_at").notNull(),
});
