/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  EstimationCalculation,
  Game,
  PricingSetting,
  RecognizedItem,
  RoundingMode,
} from '../types';

/**
 * Apply rounding mode to calculated price in Rupiah
 */
export function applyRounding(amount: number, mode: RoundingMode): number {
  if (amount <= 0) return 0;
  switch (mode) {
    case 'nearest_1000':
      return Math.round(amount / 1000) * 1000;
    case 'up_1000':
      return Math.ceil(amount / 1000) * 1000;
    case 'up_5000':
      return Math.ceil(amount / 5000) * 5000;
    case 'up_10000':
      return Math.ceil(amount / 10000) * 10000;
    case 'none':
    default:
      return Math.round(amount);
  }
}

/**
 * Format number with Indonesian dot separators (e.g. 16000 -> "16.000")
 */
export function formatNumberID(num: number): string {
  return new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
}

/**
 * Format currency with symbol (e.g. 16000, "DM" -> "16.000 DM")
 */
export function formatGameCurrency(num: number, symbol: string = 'DM'): string {
  return `${formatNumberID(num)} ${symbol}`.trim();
}

/**
 * Format monetary amount in Indonesian Rupiah (e.g. 1132800 -> "Rp1.132.800")
 */
export function formatIDR(amount: number): string {
  return `Rp${formatNumberID(amount)}`;
}

/**
 * Core Pricing Calculation Engine
 * Centrally calculates Total Currency, Base Value, and Tier Prices
 */
export function calculateAccountValuation(
  items: RecognizedItem[],
  game: Game,
  setting?: PricingSetting
): EstimationCalculation {
  // 1. Total currency = SUM(itemCurrency * quantity)
  const totalCurrency = items.reduce((sum, item) => {
    const unit = Number(item.unitCurrency) || 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    return sum + unit * qty;
  }, 0);

  // 2. Conversion rate
  const rate = setting?.currencyRate ?? game.defaultConversionRate ?? 118;

  // 3. Percentage tiers
  const lowPct = setting?.lowPercentage ?? game.lowPercentage ?? 60;
  const medPct = setting?.mediumPercentage ?? game.mediumPercentage ?? 65;
  const highPct = setting?.highPercentage ?? game.highPercentage ?? 70;
  const rounding = setting?.roundingMode ?? 'none';

  // 4. Base Value = Total Currency * Conversion Rate
  const baseValue = Math.round(totalCurrency * rate);

  // 5. Tier calculations
  const rawLow = (baseValue * lowPct) / 100;
  const rawMed = (baseValue * medPct) / 100;
  const rawHigh = (baseValue * highPct) / 100;

  return {
    totalCurrency,
    currencyName: game.currencyName || 'Diamond',
    currencySymbol: game.currencySymbol || 'DM',
    conversionRate: rate,
    baseValue,
    lowPercentage: lowPct,
    mediumPercentage: medPct,
    highPercentage: highPct,
    roundingMode: rounding,
    lowPrice: applyRounding(rawLow, rounding),
    mediumPrice: applyRounding(rawMed, rounding),
    highPrice: applyRounding(rawHigh, rounding),
  };
}
