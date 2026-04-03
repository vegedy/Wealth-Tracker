import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { seedDatabase } from "./seed";
import {
  computeAreaTimeSeries,
  computeTotalTimeSeries,
  computeAreaDistribution,
  computeAssetDistributionInArea,
  generateDateRange,
  type AreaTimeSeries,
} from "./timeseries";
import { fetchAllMarketPrices, fetchPricesForAsset } from "./price-fetcher";
import type { Asset, Holding, PricePoint } from "../shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed on first launch
  await seedDatabase();

  // Fetch market prices in background (non-blocking)
  fetchAllMarketPrices()
    .then((r) => {
      const fetched = r.results.filter((x) => x.added > 0);
      if (fetched.length > 0) {
        console.log(`✓ Market prices updated: ${fetched.map((x) => `${x.assetName} (+${x.added})`).join(", ")}`);
      }
      const errors = r.results.filter((x) => x.error);
      if (errors.length > 0) {
        console.warn(`⚠ Price fetch errors: ${errors.map((x) => `${x.assetName}: ${x.error}`).join(", ")}`);
      }
    })
    .catch((err) => console.warn("Market price fetch failed:", err?.message));

  // ═══════════════════════════════════════════════════════════════════
  // Areas CRUD
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/areas", async (_req, res) => {
    const data = await storage.getAllAreas();
    res.json(data);
  });

  app.get("/api/areas/:id", async (req, res) => {
    const area = await storage.getArea(Number(req.params.id));
    if (!area) return res.status(404).json({ message: "Area not found" });
    res.json(area);
  });

  app.post("/api/areas", async (req, res) => {
    const area = await storage.createArea(req.body);
    res.status(201).json(area);
  });

  app.patch("/api/areas/:id", async (req, res) => {
    const area = await storage.updateArea(Number(req.params.id), req.body);
    if (!area) return res.status(404).json({ message: "Area not found" });
    res.json(area);
  });

  app.delete("/api/areas/:id", async (req, res) => {
    await storage.deleteArea(Number(req.params.id));
    res.status(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Assets CRUD
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/assets", async (_req, res) => {
    const data = await storage.getAllAssets();
    res.json(data);
  });

  app.get("/api/assets/:id", async (req, res) => {
    const asset = await storage.getAsset(Number(req.params.id));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  });

  app.post("/api/assets", async (req, res) => {
    const asset = await storage.createAsset(req.body);
    res.status(201).json(asset);
  });

  app.patch("/api/assets/:id", async (req, res) => {
    const asset = await storage.updateAsset(Number(req.params.id), req.body);
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    res.json(asset);
  });

  app.delete("/api/assets/:id", async (req, res) => {
    await storage.deleteAsset(Number(req.params.id));
    res.status(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Holdings CRUD
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/holdings", async (_req, res) => {
    const data = await storage.getAllHoldings();
    res.json(data);
  });

  app.get("/api/holdings/area/:areaId", async (req, res) => {
    const data = await storage.getHoldingsByArea(Number(req.params.areaId));
    res.json(data);
  });

  app.post("/api/holdings", async (req, res) => {
    const holding = await storage.createHolding(req.body);
    res.status(201).json(holding);
  });

  app.patch("/api/holdings/:id", async (req, res) => {
    const holding = await storage.updateHolding(Number(req.params.id), req.body);
    if (!holding) return res.status(404).json({ message: "Holding not found" });
    res.json(holding);
  });

  app.delete("/api/holdings/:id", async (req, res) => {
    await storage.deleteHolding(Number(req.params.id));
    res.status(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════
  // PricePoints
  // ═══════════════════════════════════════════════════════════════════
  app.get("/api/price-points/asset/:assetId", async (req, res) => {
    const data = await storage.getPricePointsByAsset(Number(req.params.assetId));
    res.json(data);
  });

  app.post("/api/price-points", async (req, res) => {
    const pp = await storage.createPricePoint(req.body);
    res.status(201).json(pp);
  });

  app.delete("/api/price-points/:id", async (req, res) => {
    await storage.deletePricePoint(Number(req.params.id));
    res.status(204).send();
  });

  // ═══════════════════════════════════════════════════════════════════
  // Time Series & Distribution API
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /api/timeseries?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Returns area-level and total portfolio time series.
   */
  app.get("/api/timeseries", async (req, res) => {
    const from = (req.query.from as string) || "2025-01-01";
    const to = (req.query.to as string) || new Date().toISOString().slice(0, 10);
    const dateRange = generateDateRange(from, to);

    const allAreas = await storage.getAllAreas();
    const allAssets = await storage.getAllAssets();
    const allHoldings = await storage.getAllHoldings();
    const allPricePoints = await storage.getAllPricePoints();

    const assetsMap = new Map<number, Asset>();
    for (const a of allAssets) assetsMap.set(a.id, a);

    const holdingsMap = new Map<number, Holding[]>();
    for (const h of allHoldings) {
      const arr = holdingsMap.get(h.areaId) || [];
      arr.push(h);
      holdingsMap.set(h.areaId, arr);
    }

    const pricePointsMap = new Map<number, PricePoint[]>();
    for (const pp of allPricePoints) {
      const arr = pricePointsMap.get(pp.assetId) || [];
      arr.push(pp);
      pricePointsMap.set(pp.assetId, arr);
    }

    const areaSeries: AreaTimeSeries[] = allAreas.map((area) => ({
      areaId: area.id,
      areaName: area.name,
      series: computeAreaTimeSeries(area, holdingsMap.get(area.id) || [], assetsMap, pricePointsMap, dateRange),
    }));

    const totalSeries = computeTotalTimeSeries(areaSeries);

    res.json({ areaSeries, totalSeries });
  });

  /**
   * GET /api/distribution/areas?date=YYYY-MM-DD
   * Returns percentage distribution of areas at a given date.
   */
  app.get("/api/distribution/areas", async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const allAreas = await storage.getAllAreas();
    const allAssets = await storage.getAllAssets();
    const allHoldings = await storage.getAllHoldings();
    const allPricePoints = await storage.getAllPricePoints();

    const assetsMap = new Map<number, Asset>();
    for (const a of allAssets) assetsMap.set(a.id, a);

    const holdingsMap = new Map<number, Holding[]>();
    for (const h of allHoldings) {
      const arr = holdingsMap.get(h.areaId) || [];
      arr.push(h);
      holdingsMap.set(h.areaId, arr);
    }

    const pricePointsMap = new Map<number, PricePoint[]>();
    for (const pp of allPricePoints) {
      const arr = pricePointsMap.get(pp.assetId) || [];
      arr.push(pp);
      pricePointsMap.set(pp.assetId, arr);
    }

    const distribution = computeAreaDistribution(allAreas, holdingsMap, assetsMap, pricePointsMap, date);
    res.json(distribution);
  });

  /**
   * GET /api/distribution/area/:areaId?date=YYYY-MM-DD
   * Returns percentage distribution of assets within an area.
   */
  app.get("/api/distribution/area/:areaId", async (req, res) => {
    const areaId = Number(req.params.areaId);
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const allAssets = await storage.getAllAssets();
    const holdingsInArea = await storage.getHoldingsByArea(areaId);
    const allPricePoints = await storage.getAllPricePoints();

    const assetsMap = new Map<number, Asset>();
    for (const a of allAssets) assetsMap.set(a.id, a);

    const pricePointsMap = new Map<number, PricePoint[]>();
    for (const pp of allPricePoints) {
      const arr = pricePointsMap.get(pp.assetId) || [];
      arr.push(pp);
      pricePointsMap.set(pp.assetId, arr);
    }

    const distribution = computeAssetDistributionInArea(holdingsInArea, assetsMap, pricePointsMap, date);
    res.json(distribution);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Price Fetching
  // ═══════════════════════════════════════════════════════════════════

  /**
   * POST /api/prices/fetch-all
   * Manually trigger price fetch for all market assets.
   */
  app.post("/api/prices/fetch-all", async (_req, res) => {
    const result = await fetchAllMarketPrices();
    res.json(result);
  });

  /**
   * POST /api/prices/fetch/:assetId
   * Fetch prices for a single asset.
   */
  app.post("/api/prices/fetch/:assetId", async (req, res) => {
    const asset = await storage.getAsset(Number(req.params.assetId));
    if (!asset) return res.status(404).json({ message: "Asset not found" });
    const result = await fetchPricesForAsset(asset);
    res.json(result);
  });

  /**
   * GET /api/prices/status
   * Returns price availability status for all assets.
   */
  app.get("/api/prices/status", async (_req, res) => {
    const allAssets = await storage.getAllAssets();
    const statuses = [];
    for (const asset of allAssets) {
      const latest = await storage.getLatestPricePoint(asset.id);
      const totalPoints = (await storage.getPricePointsByAsset(asset.id)).length;
      statuses.push({
        assetId: asset.id,
        assetName: asset.name,
        sourceType: asset.sourceType,
        symbol: asset.symbol,
        hasPriceData: asset.sourceType === "cash" || totalPoints > 0,
        latestPrice: asset.sourceType === "cash" ? 1.0 : (latest?.pricePerUnit || null),
        latestDate: asset.sourceType === "cash" ? "immer" : (latest?.timestamp?.slice(0, 10) || null),
        totalPoints: asset.sourceType === "cash" ? -1 : totalPoints,
      });
    }
    res.json(statuses);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Import / Export
  // ═══════════════════════════════════════════════════════════════════

  /**
   * GET /api/export
   * Download full database as JSON.
   */
  app.get("/api/export", async (_req, res) => {
    const allAreas = await storage.getAllAreas();
    const allAssets = await storage.getAllAssets();
    const allHoldings = await storage.getAllHoldings();
    const allPricePoints = await storage.getAllPricePoints();

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      currency: "EUR",
      areas: allAreas,
      assets: allAssets,
      holdings: allHoldings,
      pricePoints: allPricePoints,
    };

    res.setHeader("Content-Disposition", "attachment; filename=wealth-tracker-export.json");
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  });

  /**
   * POST /api/import
   * Import JSON data. Query param ?mode=replace (default) or ?mode=append.
   */
  app.post("/api/import", async (req, res) => {
    const mode = (req.query.mode as string) || "replace";
    const data = req.body;

    // Validate structure
    if (!data || !Array.isArray(data.areas) || !Array.isArray(data.assets) ||
        !Array.isArray(data.holdings) || !Array.isArray(data.pricePoints)) {
      return res.status(400).json({
        message: "Ungültiges Format. Erwartet: { areas: [], assets: [], holdings: [], pricePoints: [] }",
      });
    }

    try {
      if (mode === "replace") {
        await storage.clearAll();
      }
      await storage.bulkImport({
        areas: data.areas.map((a: any) => ({ name: a.name, description: a.description || null })),
        assets: data.assets.map((a: any) => ({
          name: a.name,
          category: a.category || "custom",
          symbol: a.symbol || null,
          sourceType: a.sourceType || a.source_type || "custom_manual",
          metadata: a.metadata || null,
        })),
        holdings: data.holdings.map((h: any) => ({
          areaId: h.areaId || h.area_id,
          assetId: h.assetId || h.asset_id,
          quantity: h.quantity,
          unit: h.unit || "Stück",
          validFrom: h.validFrom || h.valid_from || "",
          validTo: h.validTo || h.valid_to || null,
        })),
        pricePoints: data.pricePoints.map((pp: any) => ({
          assetId: pp.assetId || pp.asset_id,
          timestamp: pp.timestamp,
          pricePerUnit: pp.pricePerUnit || pp.price_per_unit,
          source: pp.source || "manual",
        })),
      });
      res.json({ message: mode === "replace" ? "Daten erfolgreich importiert (ersetzt)" : "Daten erfolgreich hinzugefügt" });
    } catch (err: any) {
      res.status(500).json({ message: "Import fehlgeschlagen: " + err.message });
    }
  });

  return httpServer;
}
