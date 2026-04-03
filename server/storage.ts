import {
  type User, type InsertUser, users,
  type Area, type InsertArea, areas,
  type Asset, type InsertAsset, assets,
  type Holding, type InsertHolding, holdings,
  type PricePoint, type InsertPricePoint, pricePoints,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
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

  // Holdings
  getAllHoldings(): Promise<Holding[]>;
  getHoldingsByArea(areaId: number): Promise<Holding[]>;
  getHolding(id: number): Promise<Holding | undefined>;
  createHolding(holding: InsertHolding): Promise<Holding>;
  updateHolding(id: number, holding: Partial<InsertHolding>): Promise<Holding | undefined>;
  deleteHolding(id: number): Promise<void>;

  // PricePoints
  getPricePointsByAsset(assetId: number): Promise<PricePoint[]>;
  getPricePointsByAssetInRange(assetId: number, from: string, to: string): Promise<PricePoint[]>;
  getLatestPricePoint(assetId: number): Promise<PricePoint | undefined>;
  createPricePoint(pp: InsertPricePoint): Promise<PricePoint>;
  deletePricePoint(id: number): Promise<void>;

  // Bulk ops for import/export
  getAllPricePoints(): Promise<PricePoint[]>;
  clearAll(): Promise<void>;
  bulkImport(data: { areas: InsertArea[]; assets: InsertAsset[]; holdings: InsertHolding[]; pricePoints: InsertPricePoint[] }): Promise<void>;
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
    // delete holdings in this area first
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
    // delete associated holdings and pricepoints
    db.delete(holdings).where(eq(holdings.assetId, id)).run();
    db.delete(pricePoints).where(eq(pricePoints.assetId, id)).run();
    db.delete(assets).where(eq(assets.id, id)).run();
  }

  // ── Holdings ──
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
    return db.insert(holdings).values({ ...h, createdAt: ts, updatedAt: ts }).returning().get();
  }
  async updateHolding(id: number, h: Partial<InsertHolding>) {
    const existing = await this.getHolding(id);
    if (!existing) return undefined;
    return db.update(holdings).set({ ...h, updatedAt: now() }).where(eq(holdings.id, id)).returning().get();
  }
  async deleteHolding(id: number) {
    db.delete(holdings).where(eq(holdings.id, id)).run();
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
    db.delete(pricePoints).run();
    db.delete(holdings).run();
    db.delete(assets).run();
    db.delete(areas).run();
  }

  async bulkImport(data: { areas: InsertArea[]; assets: InsertAsset[]; holdings: InsertHolding[]; pricePoints: InsertPricePoint[] }) {
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
    for (const pp of data.pricePoints) {
      db.insert(pricePoints).values({ ...pp, createdAt: ts }).run();
    }
  }
}

export const storage = new DatabaseStorage();
