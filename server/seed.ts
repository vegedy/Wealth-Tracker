/**
 * Seed data for demonstration purposes.
 * Creates sample areas, assets, holdings, and price points
 * so the app shows meaningful charts on first launch.
 */

import { storage } from "./storage";

export async function seedDatabase() {
  const existingAreas = await storage.getAllAreas();
  if (existingAreas.length > 0) return; // already seeded

  // ── Areas ──
  const tresor = await storage.createArea({ name: "Tresor", description: "Physische Edelmetalle im Tresor" });
  const tradeRepublic = await storage.createArea({ name: "Trade Republic", description: "Broker-Depot bei Trade Republic" });
  const tagesgeld = await storage.createArea({ name: "Tagesgeld", description: "Tagesgeld-Konto" });

  // ── Assets ──
  const gold = await storage.createAsset({
    name: "Gold 1g",
    category: "metal",
    symbol: "XAU",
    sourceType: "known_market_asset",
    metadata: JSON.stringify({ note: "Preis pro Gramm Gold in EUR" }),
  });
  const silver = await storage.createAsset({
    name: "Silber 1g",
    category: "metal",
    symbol: "XAG",
    sourceType: "known_market_asset",
    metadata: JSON.stringify({ note: "Preis pro Gramm Silber in EUR" }),
  });
  const alphabet = await storage.createAsset({
    name: "Alphabet (GOOGL)",
    category: "stock",
    symbol: "GOOGL",
    sourceType: "known_market_asset",
    metadata: JSON.stringify({ isin: "US02079K3059" }),
  });
  const amazon = await storage.createAsset({
    name: "Amazon (AMZN)",
    category: "stock",
    symbol: "AMZN",
    sourceType: "known_market_asset",
    metadata: JSON.stringify({ isin: "US0231351067" }),
  });
  const sammlermuenze = await storage.createAsset({
    name: "Sammlermünze Phoenix",
    category: "custom",
    symbol: null,
    sourceType: "custom_manual",
    metadata: JSON.stringify({ note: "Limitierte Sammlermünze, Wert manuell geschätzt" }),
  });
  const cashAsset = await storage.createAsset({
    name: "Euro Cash",
    category: "cash",
    symbol: null,
    sourceType: "cash",
    metadata: null,
  });

  // ── Holdings (containers: area + asset + unit) ──
  const holdGold = await storage.createHolding({ areaId: tresor.id, assetId: gold.id, quantity: 0, unit: "g", validFrom: "", validTo: null });
  const holdSilver = await storage.createHolding({ areaId: tresor.id, assetId: silver.id, quantity: 0, unit: "g", validFrom: "", validTo: null });
  const holdMuenze = await storage.createHolding({ areaId: tresor.id, assetId: sammlermuenze.id, quantity: 0, unit: "Stück", validFrom: "", validTo: null });
  const holdAlphabet = await storage.createHolding({ areaId: tradeRepublic.id, assetId: alphabet.id, quantity: 0, unit: "Stück", validFrom: "", validTo: null });
  const holdAmazon = await storage.createHolding({ areaId: tradeRepublic.id, assetId: amazon.id, quantity: 0, unit: "Stück", validFrom: "", validTo: null });
  const holdCash = await storage.createHolding({ areaId: tagesgeld.id, assetId: cashAsset.id, quantity: 0, unit: "EUR", validFrom: "", validTo: null });

  // ── HoldingEntries (quantity history) ──
  // Gold: 100g seit Juni 2025, im August nochmal 100g dazugekauft
  await storage.createHoldingEntry({ holdingId: holdGold.id, quantity: 100, validFrom: "2025-06-01", validTo: null, note: "Erstkauf 100g" });
  await storage.createHoldingEntry({ holdingId: holdGold.id, quantity: 100, validFrom: "2025-08-15", validTo: null, note: "Zukauf 100g" });

  // Silber: 1000g ab Juni
  await storage.createHoldingEntry({ holdingId: holdSilver.id, quantity: 1000, validFrom: "2025-06-15", validTo: null, note: "Kauf 1kg Silber" });

  // Sammlermünze: ab September
  await storage.createHoldingEntry({ holdingId: holdMuenze.id, quantity: 1, validFrom: "2025-09-01", validTo: null, note: "Erwerb Sammlermünze Phoenix" });

  // Alphabet: 3 Stück ab Juli, 1 Stück verkauft am 1. Dez
  await storage.createHoldingEntry({ holdingId: holdAlphabet.id, quantity: 3, validFrom: "2025-07-01", validTo: "2025-11-30", note: "Kauf 3 Stück GOOGL" });
  await storage.createHoldingEntry({ holdingId: holdAlphabet.id, quantity: 2, validFrom: "2025-12-01", validTo: null, note: "1 Stück GOOGL verkauft" });

  // Amazon: 1 ab August
  await storage.createHoldingEntry({ holdingId: holdAmazon.id, quantity: 1, validFrom: "2025-08-15", validTo: null, note: "Kauf 1 Stück AMZN" });

  // Cash: 5000 EUR ab Juni, auf 7500 EUR erhöht im Januar
  await storage.createHoldingEntry({ holdingId: holdCash.id, quantity: 5000, validFrom: "2025-06-01", validTo: "2025-12-31", note: "Anfangsbestand" });
  await storage.createHoldingEntry({ holdingId: holdCash.id, quantity: 7500, validFrom: "2026-01-01", validTo: null, note: "Aufstockung auf 7.500 EUR" });

  // ── Price Points (sample historical data in EUR) ──
  const months = [
    "2025-10-01", "2025-11-01", "2025-12-01",
    "2026-01-01", "2026-02-01", "2026-03-01", "2026-03-31",
  ];

  const goldPrices   = [82.50, 84.00, 85.20, 86.50, 87.80, 89.00, 89.50];
  const silverPrices = [0.92,  0.95,  0.97,  1.00,  1.02,  1.05,  1.06];
  const alphaPrices  = [148.00, 152.00, 158.00, 165.00, 162.00, 170.00, 168.00];
  const amznPrices   = [165.00, 170.00, 178.00, 185.00, 190.00, 195.00, 192.00];
  const muenzePrices = [500.00, 500.00, 520.00, 520.00, 530.00, 540.00, 550.00];

  for (let i = 0; i < months.length; i++) {
    await storage.createPricePoint({ assetId: gold.id,        timestamp: months[i] + "T12:00:00Z", pricePerUnit: goldPrices[i],   source: "manual" });
    await storage.createPricePoint({ assetId: silver.id,      timestamp: months[i] + "T12:00:00Z", pricePerUnit: silverPrices[i], source: "manual" });
    await storage.createPricePoint({ assetId: alphabet.id,    timestamp: months[i] + "T12:00:00Z", pricePerUnit: alphaPrices[i],  source: "manual" });
    await storage.createPricePoint({ assetId: amazon.id,      timestamp: months[i] + "T12:00:00Z", pricePerUnit: amznPrices[i],   source: "manual" });
    await storage.createPricePoint({ assetId: sammlermuenze.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: muenzePrices[i], source: "manual" });
  }

  console.log("✓ Database seeded with example data");
}
