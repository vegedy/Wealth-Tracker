import {
  type User, type InsertUser, users,
  type Area, type InsertArea, areas,
  type Asset, type InsertAsset, assets,
  type Holding, type InsertHolding, holdings,
  type HoldingEntry, type InsertHoldingEntry, holdingEntries,
  type PricePoint, type InsertPricePoint, pricePoints,
} from "../shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";

const dbPath = process.env.DB_PATH ?? "data.db";
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

// Auto-create tables if they don't exist
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS areas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'custom',
    symbol TEXT,
    source_type TEXT NOT NULL DEFAULT 'custom_manual',
    metadata TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    area_id INTEGER NOT NULL,
    asset_id INTEGER NOT NULL,
    quantity REAL NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'Stück',
    valid_from TEXT NOT NULL DEFAULT '',
    valid_to TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS holding_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    holding_id INTEGER NOT NULL,
    quantity REAL NOT NULL,
    valid_from TEXT NOT NULL,
    valid_to TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS price_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    price_per_unit REAL NOT NULL,
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL DEFAULT ''
  );
`);

// Migrations for existing databases
try { sqlite.exec(`ALTER TABLE holdings ADD COLUMN valid_from TEXT NOT NULL DEFAULT ''`); } catch {}
try { sqlite.exec(`ALTER TABLE holdings ADD COLUMN valid_to TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE holdings ADD COLUMN quantity REAL NOT NULL DEFAULT 0`); } catch {}

// Migrate existing holdings to holding_entries (one-time, idempotent)
// For each holding that has quantity > 0 but no entry yet, create one entry.
try {
  const existingHoldings: any[] = sqlite.prepare(
    `SELECT h.id, h.quantity, h.valid_from, h.valid_to
     FROM holdings h
     WHERE h.quantity != 0
       AND NOT EXISTS (SELECT 1 FROM holding_entries e WHERE e.holding_id = h.id)`
  ).all();

  if (existingHoldings.length > 0) {
    const ts = new Date().toISOString();
    const insert = sqlite.prepare(
      `INSERT INTO holding_entries (holding_id, quantity, valid_from, valid_to, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const h of existingHoldings) {
      insert.run(h.id, h.quantity, h.valid_from || "", h.valid_to || null, "Migriert aus Legacy-Daten", ts);
    }
    console.log(`✓ Migrated ${existingHoldings.length} legacy holdings to holding_entries`);
  }
} catch (e: any) {
  // Table might not exist yet — that's fine, will be created above
  if (!e.message?.includes("no such table")) {
    console.warn("Migration warning:", e.message);
  }
}

export const db = drizzle(sqlite);

function now() {
  return new Date().toISOString();
}

export interface IStorage {
  // Users (template compat)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Areas
  getAllAreas(): Promise<Area[]>;
  getArea(id: number): Promise<Area | undefined>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: number, area: Partial<InsertArea>): Promise<Area | undefined>;
  deleteArea(id: number): Promise<void>;

  // Assets
  getAllAssets(): Promise<Asset[]>;
  getAsset(id: number): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: number, asset: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: number): Promise<void>;

  // Holdings (containers)
  getAllHoldings(): Promise<Holding[]>;
  getHoldingsByArea(areaId: number): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<void>;

  // HoldingEntries (quantity history)
  getEntriesByHolding(holdingId: number): Promise<HoldingEntry[]>;
  getAllHoldingEntries(): Promise<HoldingEntry[]>;
  createHoldingEntry(entry: InsertHoldingEntry): Promise<HoldingEntry>;
  updateHoldingEntry(id: number, entry: Partial<InsertHoldingEntry>): Promise<HoldingEntry | undefined>;
  deleteHoldingEntry(id: number): Promise<void>;
  closeHoldingEntry(id: number, validTo: string): Promise<HoldingEntry | undefined>;

  // PricePoints
  getPricePointsByAsset(assetId: number): Promise<PricePoint[]>;
  getPricePointsByAssetInRange(assetId: number, from: string, to: string): Promise<PricePoint[]>;
  getLatestPricePoint(assetId: number): Promise<PricePoint | undefined>;
  createPricePoint(pp: InsertPricePoint): Promise<PricePoint>;
  deletePricePoint(id: number): Promise<void>;

  // Bulk ops for import/export
  getAllPricePoints(): Promise<PricePoint[]>;
  clearAll(): Promise<void>;
  bulkImport(data: {
    areas: InsertArea[];
    assets: InsertAsset[];
    holdings: InsertHolding[];
    holdingEntries: InsertHoldingEntry[];
    pricePoints: InsertPricePoint[];
  }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ── Users ──
  async getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  async createUser(u: InsertUser) {
    return db.insert(users).values(u).returning().get();
  }

  // ── Areas ──
  async getAllAreas() {
    return db.select().from(areas).all();
  }
  async getArea(id: number) {
    return db.select().from(areas).where(eq(areas.id, id)).get();
  }
  async createArea(a: InsertArea) {
    const ts = now();
    return db.insert(areas).values({ ...a, createdAt: ts, updatedAt: ts }).returning().get();
  }
  async updateArea(id: number, a: Partial<InsertArea>) {
    const existing = await this.getArea(id);
    if (!existing) return undefined;
    return db.update(areas).set({ ...a, updatedAt: now() }).where(eq(areas.id, id)).returning().get();
  }
  async deleteArea(id: number) {
    // delete holding entries first, then holdings, then area
    const hs = await this.getHoldingsByArea(id);
    for (const h of hs) {
      db.delete(holdingEntries).where(eq(holdingEntries.holdingId, h.id)).run();
    }
    db.delete(holdings).where(eq(holdings.areaId, id)).run();
    db.delete(areas).where(eq(areas.id, id)).run();
  }

  // ── Assets ──
  async getAllAssets() {
    return db.select().from(assets).all();
  }
  async getAsset(id: number) {
    return db.select().from(assets).where(eq(assets.id, id)).get();
  }
  async createAsset(a: InsertAsset) {
    const ts = now();
    return db.insert(assets).values({ ...a, createdAt: ts, updatedAt: ts }).returning().get();
  }
  async updateAsset(id: number, a: Partial<InsertAsset>) {
    const existing = await this.getAsset(id);
    if (!existing) return undefined;
    return db.update(assets).set({ ...a, updatedAt: now() }).where(eq(assets.id, id)).returning().get();
  }
  async deleteAsset(id: number) {
    // delete all holdings (and their entries) for this asset
    const hs = db.select().from(holdings).where(eq(holdings.assetId, id)).all();
    for (const h of hs) {
      db.delete(holdingEntries).where(eq(holdingEntries.holdingId, h.id)).run();
    }
    db.delete(holdings).where(eq(holdings.assetId, id)).run();
    db.delete(pricePoints).where(eq(pricePoints.assetId, id)).run();
    db.delete(assets).where(eq(assets.id, id)).run();
  }

  // ── Holdings (containers) ──
  async getAllHoldings() {
    return db.select().from(holdings).all();
  }
  async getHoldingsByArea(areaId: number) {
    return db.select().from(holdings).where(eq(holdings.areaId, areaId)).all();
  }
  async getHolding(id: number) {
    return db.select().from(holdings).where(eq(holdings.id, id)).get();
  }
  async createHolding(h: InsertHolding) {
    const ts = now();
    // Strip validFrom/validTo from container — those live on entries now
    return db.insert(holdings).values({ ...h, createdAt: ts, updatedAt: ts }).returning().get();
  }
  async updateHolding(id: number, h: Partial<InsertHolding>) {
    const existing = await this.getHolding(id);
    if (!existing) return undefined;
    return db.update(holdings).set({ ...h, updatedAt: now() }).where(eq(holdings.id, id)).returning().get();
  }
  async deleteHolding(id: number) {
    db.delete(holdingEntries).where(eq(holdingEntries.holdingId, id)).run();
    db.delete(holdings).where(eq(holdings.id, id)).run();
  }

  // ── HoldingEntries ──
  async getEntriesByHolding(holdingId: number) {
    return db.select().from(holdingEntries)
      .where(eq(holdingEntries.holdingId, holdingId))
      .orderBy(asc(holdingEntries.validFrom))
      .all();
  }
  async getAllHoldingEntries() {
    return db.select().from(holdingEntries).orderBy(asc(holdingEntries.validFrom)).all();
  }
  async createHoldingEntry(entry: InsertHoldingEntry) {
    const ts = now();
    return db.insert(holdingEntries).values({ ...entry, createdAt: ts }).returning().get();
  }
  async updateHoldingEntry(id: number, entry: Partial<InsertHoldingEntry>) {
    const existing = db.select().from(holdingEntries).where(eq(holdingEntries.id, id)).get();
    if (!existing) return undefined;
    return db.update(holdingEntries).set(entry).where(eq(holdingEntries.id, id)).returning().get();
  }
  async deleteHoldingEntry(id: number) {
    db.delete(holdingEntries).where(eq(holdingEntries.id, id)).run();
  }
  async closeHoldingEntry(id: number, validTo: string) {
    const existing = db.select().from(holdingEntries).where(eq(holdingEntries.id, id)).get();
    if (!existing) return undefined;
    return db.update(holdingEntries).set({ validTo }).where(eq(holdingEntries.id, id)).returning().get();
  }

  // ── PricePoints ──
  async getPricePointsByAsset(assetId: number) {
    return db.select().from(pricePoints).where(eq(pricePoints.assetId, assetId)).orderBy(asc(pricePoints.timestamp)).all();
  }
  async getPricePointsByAssetInRange(assetId: number, from: string, to: string) {
    return db.select().from(pricePoints)
      .where(and(eq(pricePoints.assetId, assetId), gte(pricePoints.timestamp, from), lte(pricePoints.timestamp, to)))
      .orderBy(asc(pricePoints.timestamp)).all();
  }
  async getLatestPricePoint(assetId: number) {
    return db.select().from(pricePoints).where(eq(pricePoints.assetId, assetId)).orderBy(desc(pricePoints.timestamp)).limit(1).get();
  }
  async createPricePoint(pp: InsertPricePoint) {
    const ts = now();
    return db.insert(pricePoints).values({ ...pp, createdAt: ts }).returning().get();
  }
  async deletePricePoint(id: number) {
    db.delete(pricePoints).where(eq(pricePoints.id, id)).run();
  }

  // ── Bulk ──
  async getAllPricePoints() {
    return db.select().from(pricePoints).orderBy(asc(pricePoints.timestamp)).all();
  }

  async clearAll() {
    db.delete(holdingEntries).run();
    db.delete(pricePoints).run();
    db.delete(holdings).run();
    db.delete(assets).run();
    db.delete(areas).run();
  }

  async bulkImport(data: {
    areas: InsertArea[];
    assets: InsertAsset[];
    holdings: InsertHolding[];
    holdingEntries: InsertHoldingEntry[];
    pricePoints: InsertPricePoint[];
  }) {
    const ts = now();
    for (const a of data.areas) {
      db.insert(areas).values({ ...a, createdAt: ts, updatedAt: ts }).run();
    }
    for (const a of data.assets) {
      db.insert(assets).values({ ...a, createdAt: ts, updatedAt: ts }).run();
    }
    for (const h of data.holdings) {
      db.insert(holdings).values({ ...h, createdAt: ts, updatedAt: ts }).run();
    }
    for (const e of data.holdingEntries || []) {
      db.insert(holdingEntries).values({ ...e, createdAt: ts }).run();
    }
    for (const pp of data.pricePoints) {
      db.insert(pricePoints).values({ ...pp, createdAt: ts }).run();
    }
  }
}

export const storage = new DatabaseStorage();
