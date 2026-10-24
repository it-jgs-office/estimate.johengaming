/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Category, GameItem, MatchSource, Rarity, RecognizedItem } from '../types';
import { repository } from './repository';

/**
 * Normalize string for comparison: lowercase, remove punctuation, collapse spaces
 */
export function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy similarity score (0 to 1)
 */
export function stringSimilarity(s1: string, s2: string): number {
  const n1 = normalizeText(s1);
  const n2 = normalizeText(s2);
  if (n1 === n2) return 1.0;
  if (n1.includes(n2) || n2.includes(n1)) return 0.85;

  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(n1, n2);
  return 1 - dist / maxLen;
}

export interface MatchResult {
  found: boolean;
  item?: RecognizedItem;
  source?: MatchSource;
  confidence?: 'high' | 'medium' | 'manual' | 'needs_review';
  category?: Category;
  rarity?: Rarity;
  gameItem?: GameItem;
}

/**
 * Find matching Category in game
 */
export function findCategory(gameId: string, rawText: string): Category | undefined {
  const categories = repository.getCategoriesByGame(gameId);
  const norm = normalizeText(rawText);

  // 1. Exact name match
  for (const cat of categories) {
    if (normalizeText(cat.name) === norm) return cat;
  }

  // 2. Exact alias match
  for (const cat of categories) {
    for (const alias of cat.aliases) {
      if (normalizeText(alias) === norm) return cat;
    }
  }

  // 3. Substring match
  for (const cat of categories) {
    if (norm.split(' ').some((w) => normalizeText(cat.name) === w)) return cat;
    for (const alias of cat.aliases) {
      if (norm.split(' ').some((w) => normalizeText(alias) === w)) return cat;
    }
  }

  // 4. Fuzzy match
  for (const cat of categories) {
    if (stringSimilarity(cat.name, norm) > 0.75) return cat;
    for (const alias of cat.aliases) {
      if (stringSimilarity(alias, norm) > 0.8) return cat;
    }
  }

  return undefined;
}

/**
 * Find matching Rarity in game
 */
export function findRarity(gameId: string, rawText: string): Rarity | undefined {
  const rarities = repository.getRaritiesByGame(gameId);
  const norm = normalizeText(rawText);

  // 1. Exact name match
  for (const rar of rarities) {
    if (normalizeText(rar.name) === norm) return rar;
  }

  // 2. Exact alias match
  for (const rar of rarities) {
    for (const alias of rar.aliases) {
      if (normalizeText(alias) === norm) return rar;
    }
  }

  // 3. Word token match
  for (const rar of rarities) {
    if (norm.split(' ').some((w) => normalizeText(rar.name) === w)) return rar;
    for (const alias of rar.aliases) {
      if (norm.split(' ').some((w) => normalizeText(alias) === w)) return rar;
    }
  }

  // 4. Fuzzy match
  for (const rar of rarities) {
    if (stringSimilarity(rar.name, norm) > 0.75) return rar;
    for (const alias of rar.aliases) {
      if (stringSimilarity(alias, norm) > 0.8) return rar;
    }
  }

  return undefined;
}

/**
 * Core Matching Function following strict Priority Hierarchy:
 * Priority 1: Exact specific item name / alias
 * Priority 2: Exact category + rarity standard item
 * Priority 3: Fuzzy matches
 */
export function matchGameItem(
  gameId: string,
  rawCandidate: string,
  inheritedCategory?: Category,
  quantity: number = 1
): MatchResult {
  const allItems = repository.getItemsByGame(gameId).filter((i) => i.status === 'active');
  const categories = repository.getCategoriesByGame(gameId);
  const rarities = repository.getRaritiesByGame(gameId);
  const norm = normalizeText(rawCandidate);

  // --- PRIORITY 1: Check Specific Items (e.g., "Crimson Blade", "Nightfall Shotgun") ---
  const specificItems = allItems.filter((i) => i.type === 'specific');
  for (const item of specificItems) {
    const itemNameNorm = normalizeText(item.name);
    // Exact or contained in rawCandidate
    if (norm === itemNameNorm || norm.includes(itemNameNorm)) {
      const cat = categories.find((c) => c.id === item.categoryId);
      const rar = rarities.find((r) => r.id === item.rarityId);
      return {
        found: true,
        source: 'database',
        confidence: 'high',
        category: cat,
        rarity: rar,
        gameItem: item,
        item: {
          tempId: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          gameId,
          categoryId: item.categoryId,
          categoryName: cat?.name || 'Specific Skin',
          rarityId: item.rarityId,
          rarityName: rar?.name || 'Exclusive',
          itemId: item.id,
          itemName: item.name,
          itemType: 'specific',
          quantity,
          unitCurrency: item.estimatedCurrency,
          totalCurrency: item.estimatedCurrency * quantity,
          matchSource: 'database',
          confidence: 'high',
          originalRawText: rawCandidate,
        },
      };
    }

    // Check specific aliases
    for (const alias of item.aliases) {
      const aliasNorm = normalizeText(alias);
      if (norm === aliasNorm || norm.includes(aliasNorm)) {
        const cat = categories.find((c) => c.id === item.categoryId);
        const rar = rarities.find((r) => r.id === item.rarityId);
        return {
          found: true,
          source: 'alias',
          confidence: 'high',
          category: cat,
          rarity: rar,
          gameItem: item,
          item: {
            tempId: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            gameId,
            categoryId: item.categoryId,
            categoryName: cat?.name || 'Specific Skin',
            rarityId: item.rarityId,
            rarityName: rar?.name || 'Exclusive',
            itemId: item.id,
            itemName: item.name,
            itemType: 'specific',
            quantity,
            unitCurrency: item.estimatedCurrency,
            totalCurrency: item.estimatedCurrency * quantity,
            matchSource: 'alias',
            confidence: 'high',
            originalRawText: rawCandidate,
          },
        };
      }
    }
  }

  // --- PRIORITY 2: Check Category + Rarity Combination ---
  // Either from inheritedCategory or extracted from raw text
  let resolvedCategory = inheritedCategory;
  if (!resolvedCategory) {
    resolvedCategory = findCategory(gameId, rawCandidate);
  }

  const resolvedRarity = findRarity(gameId, rawCandidate);

  if (resolvedCategory && resolvedRarity) {
    // Find matching standard item for this category & rarity
    const standardItem = allItems.find(
      (i) =>
        i.type === 'standard' &&
        i.categoryId === resolvedCategory!.id &&
        i.rarityId === resolvedRarity.id
    );

    if (standardItem) {
      const displayName = `${resolvedCategory.name} ${resolvedRarity.name}`;
      return {
        found: true,
        source: 'database',
        confidence: 'high',
        category: resolvedCategory,
        rarity: resolvedRarity,
        gameItem: standardItem,
        item: {
          tempId: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          gameId,
          categoryId: resolvedCategory.id,
          categoryName: resolvedCategory.name,
          rarityId: resolvedRarity.id,
          rarityName: resolvedRarity.name,
          itemId: standardItem.id,
          itemName: displayName,
          itemType: 'standard',
          quantity,
          unitCurrency: standardItem.estimatedCurrency,
          totalCurrency: standardItem.estimatedCurrency * quantity,
          matchSource: 'database',
          confidence: 'high',
          originalRawText: rawCandidate,
        },
      };
    }
  }

  // --- PRIORITY 3: Fuzzy Specific Item Matching ---
  for (const item of specificItems) {
    const simName = stringSimilarity(norm, item.name);
    if (simName > 0.72) {
      const cat = categories.find((c) => c.id === item.categoryId);
      const rar = rarities.find((r) => r.id === item.rarityId);
      return {
        found: true,
        source: 'fuzzy',
        confidence: 'medium',
        category: cat,
        rarity: rar,
        gameItem: item,
        item: {
          tempId: `match-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          gameId,
          categoryId: item.categoryId,
          categoryName: cat?.name || 'Specific Skin',
          rarityId: item.rarityId,
          rarityName: rar?.name || 'Exclusive',
          itemId: item.id,
          itemName: item.name,
          itemType: 'specific',
          quantity,
          unitCurrency: item.estimatedCurrency,
          totalCurrency: item.estimatedCurrency * quantity,
          matchSource: 'fuzzy',
          confidence: 'medium',
          originalRawText: rawCandidate,
        },
      };
    }
  }

  // Not resolved
  return {
    found: false,
    category: resolvedCategory,
    rarity: resolvedRarity,
  };
}
