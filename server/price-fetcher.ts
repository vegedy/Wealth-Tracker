/**
 * Price Fetcher Service
 *
 * Fetches historical and current prices for known_market_asset assets
 * using the yahoo-finance2 library. All prices are converted to EUR.
 *
 * Supported symbols:
 * - Stocks: Append ".DE" for Frankfurt or use USD ticker (auto-converts via EUR=X)
 * - Gold per gram: "GC=F" (gold futures per troy oz, divided by 31.1035)
 * - Silver per gram: "SI=F" (silver futures per troy oz, divided by 31.1035)
 * - Or use EURUSD=X for conversion
 *
 * Yahoo Finance ticker conventions for EUR-denominated prices:
 * - AAPL → USD price (needs EUR conversion)
 * - SAP.DE → EUR price (Frankfurt)
 * - GC=F → Gold futures in USD per troy oz
 * - SI=F → Silver futures in USD per troy oz
 */

import { storage } from "./storage";
import type { Asset } from "../shared/schema";

// Dynamic import for yahoo-finance2 v3 (ESM module, requires instantiation)
let yahooFinance: any = null;

async function getYahooFinance() {
  if (!yahooFinance) {
    try {
      const mod = await import("yahoo-finance2");
      const YahooFinance = mod.default || mod;
      // v3 requires instantiation with `new`
      if (typeof YahooFinance === "function") {
        yahooFinance = new YahooFinance();
      } else if (YahooFinance.YahooFinance) {
        yahooFinance = new YahooFinance.YahooFinance();
      } else {
        yahooFinance = YahooFinance;
      }
    } catch (err) {
      console.error("Failed to load yahoo-finance2:", err);
      throw err;
    }
  }
  return yahooFinance;
}

const TROY_OZ_TO_GRAMS = 31.1035;

/**
 * Map our internal symbols to Yahoo Finance tickers and metadata.
 */
function getYahooTicker(asset: Asset): { ticker: string; divisor: number; needsEurConversion: boolean } | null {
  const sym = (asset.symbol || "").toUpperCase().trim();
  if (!sym) return null;

  // Precious metals
  if (sym === "XAU" || sym === "GOLD") {
    return { ticker: "GC=F", divisor: TROY_OZ_TO_GRAMS, needsEurConversion: true };
  }
  if (sym === "XAG" || sym === "SILVER") {
    return { ticker: "SI=F", divisor: TROY_OZ_TO_GRAMS, needsEurConversion: true };
  }

  // EUR-denominated tickers (German exchanges)
  if (sym.endsWith(".DE") || sym.endsWith(".F") || sym.endsWith(".PA") || sym.endsWith(".AS") || sym.endsWith(".MI")) {
    return { ticker: sym, divisor: 1, needsEurConversion: false };
  }

  // Crypto (usually in USD)
  if (sym.endsWith("-USD") || sym.endsWith("-EUR")) {
    const needsConversion = sym.endsWith("-USD");
    return { ticker: sym, divisor: 1, needsEurConversion: needsConversion };
  }

  // Default: US stock ticker → needs EUR conversion
  return { ticker: sym, divisor: 1, needsEurConversion: true };
}

/**
 * Fetch current USD/EUR exchange rate.
 */
async function fetchEurRate(): Promise<number> {
  try {
    const yf = await getYahooFinance();
    const quote = await yf.quote("EURUSD=X");
    return quote?.regularMarketPrice || 0.92; // fallback
  } catch {
    console.warn("Could not fetch EUR/USD rate, using fallback 0.92");
    return 0.92;
  }
}

/**
 * Fetch historical prices for a single asset and store as PricePoints.
 * Returns the number of new price points added.
 */
export async function fetchPricesForAsset(asset: Asset): Promise<{ added: number; error?: string }> {
  if (asset.sourceType !== "known_market_asset") {
    return { added: 0 };
  }

  const mapping = getYahooTicker(asset);
  if (!mapping) {
    return { added: 0, error: `Kein Ticker-Mapping für Symbol "${asset.symbol}"` };
  }

  try {
    const yf = await getYahooFinance();

    // Determine date range: from last known price point, or 1 year ago
    const existingPoints = await storage.getPricePointsByAsset(asset.id);
    const lastTimestamp = existingPoints.length > 0
      ? existingPoints[existingPoints.length - 1].timestamp
      : null;

    const period1 = lastTimestamp
      ? new Date(new Date(lastTimestamp).getTime() + 86400000).toISOString().slice(0, 10) // day after last
      : new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10); // 1 year ago

    const period2 = new Date().toISOString().slice(0, 10);

    // Skip if we're already up to date
    if (period1 >= period2) {
      return { added: 0 };
    }

    // Fetch historical data
    const result = await yf.chart(mapping.ticker, {
      period1,
      period2,
      interval: "1d",
    });

    if (!result?.quotes || result.quotes.length === 0) {
      return { added: 0, error: `Keine Daten von Yahoo Finance für ${mapping.ticker}` };
    }

    // Get EUR conversion rate if needed
    let eurRate = 1;
    if (mapping.needsEurConversion) {
      eurRate = await fetchEurRate();
    }

    let added = 0;
    for (const q of result.quotes) {
      if (!q.close || !q.date) continue;

      const priceUsd = q.close / mapping.divisor;
      const priceEur = mapping.needsEurConversion ? priceUsd * eurRate : priceUsd;
      const timestamp = new Date(q.date).toISOString();

      await storage.createPricePoint({
        assetId: asset.id,
        timestamp,
        pricePerUnit: Math.round(priceEur * 10000) / 10000,
        source: "yahoo",
      });
      added++;
    }

    return { added };
  } catch (err: any) {
    const message = err?.message || String(err);
    console.error(`Price fetch failed for ${asset.name} (${asset.symbol}):`, message);
    return { added: 0, error: `Fehler beim Abrufen: ${message}` };
  }
}

/**
 * Fetch prices for ALL known_market_asset assets.
 * Called on server start and can be triggered via API.
 */
export async function fetchAllMarketPrices(): Promise<{ results: { assetName: string; added: number; error?: string }[] }> {
  const allAssets = await storage.getAllAssets();
  const marketAssets = allAssets.filter((a) => a.sourceType === "known_market_asset");

  const results: { assetName: string; added: number; error?: string }[] = [];

  for (const asset of marketAssets) {
    const result = await fetchPricesForAsset(asset);
    results.push({ assetName: asset.name, ...result });
  }

  return { results };
}
