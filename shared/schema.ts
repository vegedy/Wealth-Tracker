import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ── Areas ──────────────────────────────────────────────────────────
export const areas = sqliteTable("areas", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const insertAreaSchema = createInsertSchema(areas).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;

// ── Assets ─────────────────────────────────────────────────────────
export const assets = sqliteTable("assets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull().default("custom"),
  // category: stock | etf | crypto | metal | cash | custom
  symbol: text("symbol"),
  sourceType: text("source_type").notNull().default("custom_manual"),
  // source_type: known_market_asset | custom_manual | cash
  metadata: text("metadata"), // JSON string
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const insertAssetSchema = createInsertSchema(assets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// ── Holdings ───────────────────────────────────────────────────────
export const holdings = sqliteTable("holdings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  areaId: integer("area_id").notNull(),
  assetId: integer("asset_id").notNull(),
  quantity: real("quantity").notNull(),
  unit: text("unit").notNull().default("Stück"),
  createdAt: text("created_at").notNull().default(""),
  updatedAt: text("updated_at").notNull().default(""),
});

export const insertHoldingSchema = createInsertSchema(holdings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertHolding = z.infer<typeof insertHoldingSchema>;
export type Holding = typeof holdings.$inferSelect;

// ── PricePoints ────────────────────────────────────────────────────
export const pricePoints = sqliteTable("price_points", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  assetId: integer("asset_id").notNull(),
  timestamp: text("timestamp").notNull(), // ISO 8601 UTC
  pricePerUnit: real("price_per_unit").notNull(), // EUR
  source: text("source").notNull().default("manual"),
  // source: yahoo | manual | cash_static
  createdAt: text("created_at").notNull().default(""),
});

export const insertPricePointSchema = createInsertSchema(pricePoints).omit({
  id: true,
  createdAt: true,
});
export type InsertPricePoint = z.infer<typeof insertPricePointSchema>;
export type PricePoint = typeof pricePoints.$inferSelect;

// ── Shared types for frontend ──────────────────────────────────────
export type SourceType = "known_market_asset" | "custom_manual" | "cash";
export type AssetCategory = "stock" | "etf" | "crypto" | "metal" | "cash" | "custom";

// Users table kept for template compatibility
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
