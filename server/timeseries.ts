/**
 * Time Series Calculation Service
 *
 * Responsible for:
 * 1. Piecewise linear interpolation of asset prices
 * 2. Merging uneven time grids to a daily resolution
 * 3. Aggregating area totals and overall totals in EUR
 * 4. Calculating percentage distributions
 *
 * INTERPOLATION LOGIC:
 * - For cash assets (source_type = "cash"): price is always 1.00 EUR/unit, no interpolation needed.
 * - For assets with multiple price points: linear interpolation between known points.
 *   Given two adjacent points (t1, p1) and (t2, p2), the price at time t is:
 *     p(t) = p1 + (p2 - p1) * (t - t1) / (t2 - t1)
 * - For assets with a single price point: that value is used as a constant.
 * - For timestamps before the first known point: the first known price is used (flat extrapolation).
 * - For timestamps after the last known point: the last known price is used (flat extrapolation).
 *
 * All values are in EUR.
 */

import type { Area, Asset, Holding, PricePoint } from "../shared/schema";

export interface TimeSeriesPoint {
  date: string; // YYYY-MM-DD
  value: number; // EUR
}

export interface AreaTimeSeries {
  areaId: number;
  areaName: string;
  series: TimeSeriesPoint[];
}

export interface AssetDistribution {
  assetId: number;
  assetName: string;
  value: number; // EUR
  percent: number;
}

export interface AreaDistribution {
  areaId: number;
  areaName: string;
  value: number; // EUR
  percent: number;
}

/**
 * Interpolate price at a given date from sorted price points.
 * Returns EUR price per unit.
 */
export function interpolatePrice(
  date: string,
  pricePoints: PricePoint[],
  isCash: boolean
): number {
  if (isCash) return 1.0;
  if (pricePoints.length === 0) return 0;
  if (pricePoints.length === 1) return pricePoints[0].pricePerUnit;

  const targetMs = new Date(date + "T12:00:00Z").getTime();
  const first = pricePoints[0];
  const last = pricePoints[pricePoints.length - 1];

  const firstMs = new Date(first.timestamp).getTime();
  const lastMs = new Date(last.timestamp).getTime();

  // Flat extrapolation outside known range
  if (targetMs <= firstMs) return first.pricePerUnit;
  if (targetMs >= lastMs) return last.pricePerUnit;

  // Find the two surrounding points
  for (let i = 0; i < pricePoints.length - 1; i++) {
    const t1 = new Date(pricePoints[i].timestamp).getTime();
    const t2 = new Date(pricePoints[i + 1].timestamp).getTime();
    if (targetMs >= t1 && targetMs <= t2) {
      const p1 = pricePoints[i].pricePerUnit;
      const p2 = pricePoints[i + 1].pricePerUnit;
      if (t2 === t1) return p1;
      const ratio = (targetMs - t1) / (t2 - t1);
      return p1 + (p2 - p1) * ratio;
    }
  }

  return last.pricePerUnit;
}

/**
 * Generate an array of date strings (YYYY-MM-DD) between from and to (inclusive).
 */
export function generateDateRange(from: string, to: string): string[] {
  const dates: string[] = [];
  const start = new Date(from + "T00:00:00Z");
  const end = new Date(to + "T00:00:00Z");
  const d = new Date(start);
  while (d <= end) {
    dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Compute time series for the total value of one area.
 */
export function computeAreaTimeSeries(
  area: Area,
  holdingsInArea: Holding[],
  assetsMap: Map<number, Asset>,
  pricePointsMap: Map<number, PricePoint[]>,
  dateRange: string[]
): TimeSeriesPoint[] {
  return dateRange.map((date) => {
    let totalValue = 0;
    for (const h of holdingsInArea) {
      const asset = assetsMap.get(h.assetId);
      if (!asset) continue;
      const isCash = asset.sourceType === "cash";
      const pps = pricePointsMap.get(h.assetId) || [];
      const pricePerUnit = interpolatePrice(date, pps, isCash);
      totalValue += h.quantity * pricePerUnit;
    }
    return { date, value: Math.round(totalValue * 100) / 100 };
  });
}

/**
 * Compute total portfolio time series across all areas.
 */
export function computeTotalTimeSeries(
  areaSeries: AreaTimeSeries[]
): TimeSeriesPoint[] {
  if (areaSeries.length === 0) return [];
  const dateMap = new Map<string, number>();
  for (const as of areaSeries) {
    for (const pt of as.series) {
      dateMap.set(pt.date, (dateMap.get(pt.date) || 0) + pt.value);
    }
  }
  return Array.from(dateMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }));
}

/**
 * Compute percentage distribution of areas at a given date.
 */
export function computeAreaDistribution(
  areas: Area[],
  holdingsMap: Map<number, Holding[]>,
  assetsMap: Map<number, Asset>,
  pricePointsMap: Map<number, PricePoint[]>,
  date: string
): AreaDistribution[] {
  const results: AreaDistribution[] = [];
  let total = 0;

  for (const area of areas) {
    const holdingsInArea = holdingsMap.get(area.id) || [];
    let areaValue = 0;
    for (const h of holdingsInArea) {
      const asset = assetsMap.get(h.assetId);
      if (!asset) continue;
      const isCash = asset.sourceType === "cash";
      const pps = pricePointsMap.get(h.assetId) || [];
      const pricePerUnit = interpolatePrice(date, pps, isCash);
      areaValue += h.quantity * pricePerUnit;
    }
    results.push({ areaId: area.id, areaName: area.name, value: Math.round(areaValue * 100) / 100, percent: 0 });
    total += areaValue;
  }

  for (const r of results) {
    r.percent = total > 0 ? Math.round((r.value / total) * 10000) / 100 : 0;
  }

  return results;
}

/**
 * Compute percentage distribution of assets within one area at a given date.
 */
export function computeAssetDistributionInArea(
  holdingsInArea: Holding[],
  assetsMap: Map<number, Asset>,
  pricePointsMap: Map<number, PricePoint[]>,
  date: string
): AssetDistribution[] {
  const results: AssetDistribution[] = [];
  let total = 0;

  for (const h of holdingsInArea) {
    const asset = assetsMap.get(h.assetId);
    if (!asset) continue;
    const isCash = asset.sourceType === "cash";
    const pps = pricePointsMap.get(h.assetId) || [];
    const pricePerUnit = interpolatePrice(date, pps, isCash);
    const value = h.quantity * pricePerUnit;
    results.push({ assetId: h.assetId, assetName: asset.name, value: Math.round(value * 100) / 100, percent: 0 });
    total += value;
  }

  for (const r of results) {
    r.percent = total > 0 ? Math.round((r.value / total) * 10000) / 100 : 0;
  }

  return results;
}
