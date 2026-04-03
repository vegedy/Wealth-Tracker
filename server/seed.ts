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

  // ── Holdings ──
  // Tresor: 200g Gold, 1000g (1kg) Silber, Sammlermünze
  await storage.createHolding({ areaId: tresor.id, assetId: gold.id, quantity: 200, unit: "g" });
  await storage.createHolding({ areaId: tresor.id, assetId: silver.id, quantity: 1000, unit: "g" });
  await storage.createHolding({ areaId: tresor.id, assetId: sammlermuenze.id, quantity: 1, unit: "Stück" });

  // Trade Republic: 3 Alphabet, 1 Amazon
  await storage.createHolding({ areaId: tradeRepublic.id, assetId: alphabet.id, quantity: 3, unit: "Stück" });
  await storage.createHolding({ areaId: tradeRepublic.id, assetId: amazon.id, quantity: 1, unit: "Stück" });

  // Tagesgeld: 5000 EUR Cash
  await storage.createHolding({ areaId: tagesgeld.id, assetId: cashAsset.id, quantity: 5000, unit: "EUR" });

  // ── Price Points (sample historical data in EUR) ──
  // We'll add monthly price points for the last 6 months

  const months = [
    "2025-10-01", "2025-11-01", "2025-12-01",
    "2026-01-01", "2026-02-01", "2026-03-01", "2026-03-31",
  ];

  // Gold price per gram EUR (approx)
  const goldPrices = [82.50, 84.00, 85.20, 86.50, 87.80, 89.00, 89.50];
  // Silver price per gram EUR (approx)
  const silverPrices = [0.92, 0.95, 0.97, 1.00, 1.02, 1.05, 1.06];
  // Alphabet share price EUR (approx)
  const alphaPrices = [148.00, 152.00, 158.00, 165.00, 162.00, 170.00, 168.00];
  // Amazon share price EUR (approx)
  const amznPrices = [165.00, 170.00, 178.00, 185.00, 190.00, 195.00, 192.00];
  // Sammlermünze (manual, custom)
  const muenzePrices = [500.00, 500.00, 520.00, 520.00, 530.00, 540.00, 550.00];

  for (let i = 0; i < months.length; i++) {
    await storage.createPricePoint({ assetId: gold.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: goldPrices[i], source: "manual" });
    await storage.createPricePoint({ assetId: silver.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: silverPrices[i], source: "manual" });
    await storage.createPricePoint({ assetId: alphabet.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: alphaPrices[i], source: "manual" });
    await storage.createPricePoint({ assetId: amazon.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: amznPrices[i], source: "manual" });
    await storage.createPricePoint({ assetId: sammlermuenze.id, timestamp: months[i] + "T12:00:00Z", pricePerUnit: muenzePrices[i], source: "manual" });
  }

  console.log("✓ Database seeded with example data");
}
