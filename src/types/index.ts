/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'SUPER_ADMIN' | 'STAFF';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface Game {
  id: string;
  name: string;
  slug: string;
  icon: string;
  currencyName: string;
  currencySymbol: string;
  defaultConversionRate: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  gameId: string;
  name: string;
  aliases: string[];
  status: 'active' | 'inactive';
}

export interface Rarity {
  id: string;
  gameId: string;
  name: string;
  aliases: string[];
  status: 'active' | 'inactive';
}

export interface CategoryRarityCost {
  id: string;
  gameId: string;
  categoryId: string;
  rarityId: string;
  estimatedCurrency: number;
  updatedAt: string;
}

export type ItemType = 'standard' | 'specific';

export interface GameItem {
  id: string;
  gameId: string;
  categoryId: string;
  rarityId: string;
  name: string; // If 'standard', name is 'Standard'
  type: ItemType;
  estimatedCurrency: number;
  aliases: string[];
  description?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type RoundingMode =
  | 'none'
  | 'nearest_1000'
  | 'up_1000'
  | 'up_5000'
  | 'up_10000';

export interface PricingSetting {
  id: string;
  gameId: string;
  currencyRate: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  roundingMode: RoundingMode;
  defaultTier: 'low' | 'medium' | 'high';
  updatedAt: string;
}

export type MatchSource = 'database' | 'alias' | 'fuzzy' | 'manual';
export type ConfidenceStatus = 'high' | 'medium' | 'manual' | 'needs_review';

export interface RecognizedItem {
  tempId: string;
  gameId: string;
  categoryId?: string;
  categoryName: string;
  rarityId?: string;
  rarityName: string;
  itemId?: string;
  itemName: string;
  itemType: 'standard' | 'specific' | 'manual';
  quantity: number;
  unitCurrency: number;
  totalCurrency: number;
  matchSource: MatchSource;
  confidence: ConfidenceStatus;
  isManual?: boolean;
  originalRawText?: string;
}

export interface EstimationCalculation {
  totalCurrency: number;
  currencyName: string;
  currencySymbol: string;
  conversionRate: number;
  baseValue: number;
  lowPercentage: number;
  mediumPercentage: number;
  highPercentage: number;
  roundingMode: RoundingMode;
  lowPrice: number;
  mediumPrice: number;
  highPrice: number;
}

export interface Estimation {
  id: string; // e.g. EST-000001
  gameId: string;
  userId: string;
  userName: string;
  title: string;
  accountIdentifier?: string;
  originalSpecification: string;
  totalCurrency: number;
  conversionRateSnapshot: number;
  lowPercentageSnapshot: number;
  mediumPercentageSnapshot: number;
  highPercentageSnapshot: number;
  baseValue: number;
  lowPrice: number;
  mediumPrice: number;
  highPrice: number;
  notes?: string;
  itemsSnapshot: RecognizedItem[];
  createdAt: string;
  updatedAt: string;
}

export interface UnknownItemPrompt {
  rawText: string;
  categoryGuess?: string;
  rarityGuess?: string;
  quantity?: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  parsedItems?: RecognizedItem[];
  calculation?: EstimationCalculation;
  hasUnknownItems?: boolean;
  unknownItemsList?: UnknownItemPrompt[];
  actionType?: 'item_detected' | 'item_added' | 'item_removed' | 'item_updated' | 'general' | 'error';
}

export interface EstimationSession {
  id: string;
  title: string;
  gameId: string;
  messages: ChatMessage[];
  currentItems: RecognizedItem[];
  updatedAt: string;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  timestamp: string;
  totalRows: number;
  successfulRows: number;
  failedRows: number;
  userId: string;
  userName: string;
  mode: 'skip_duplicates' | 'update_existing' | 'import_new_only';
}

export type ActivityModule =
  | 'GAMES'
  | 'ITEMS'
  | 'ESTIMATION'
  | 'PRICING'
  | 'IMPORT'
  | 'AUTH'
  | 'SETTINGS';

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: ActivityModule;
  description: string;
  status: 'success' | 'warning' | 'error';
}

export interface GeneralSettings {
  appName: string;
  accentColor: 'blue' | 'indigo' | 'emerald' | 'violet' | 'amber';
  themeMode: 'light' | 'dark' | 'system';
  compactTable: boolean;
  currencyFormat: 'idr' | 'full';
  defaultGameId: string;
  confirmDelete: boolean;
}
