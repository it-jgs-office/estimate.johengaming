/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActivityLog,
  ActivityModule,
  Category,
  CategoryRarityCost,
  Estimation,
  EstimationSession,
  Game,
  GameItem,
  GeneralSettings,
  ImportBatch,
  PricingSetting,
  Rarity,
  User,
  UserRole,
} from '../types';
import {
  SEED_ACTIVITY_LOGS,
  SEED_CATEGORIES,
  SEED_CATEGORY_RARITY_COSTS,
  SEED_ESTIMATIONS,
  SEED_GAMES,
  SEED_GENERAL_SETTINGS,
  SEED_ITEMS,
  SEED_PRICING_SETTINGS,
  SEED_RARITIES,
  SEED_USERS,
} from './seedData';

const STORAGE_KEYS = {
  GAMES: 'johen_games_v1',
  CATEGORIES: 'johen_categories_v1',
  RARITIES: 'johen_rarities_v1',
  CATEGORY_COSTS: 'johen_category_costs_v1',
  ITEMS: 'johen_items_v1',
  PRICING: 'johen_pricing_settings_v1',
  ESTIMATIONS: 'johen_estimations_v1',
  SESSIONS: 'johen_sessions_v1',
  ACTIVITY_LOGS: 'johen_activity_logs_v1',
  IMPORT_BATCHES: 'johen_import_batches_v1',
  USERS: 'johen_users_v1',
  CURRENT_USER_ID: 'johen_current_user_id_v1',
  SETTINGS: 'johen_general_settings_v1',
  AUTH_LOGGED_IN: 'johen_auth_logged_in_v1',
};

type Listener = () => void;

class Repository {
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.ensureInitialized();
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error('Error in repository listener:', err);
      }
    });
  }

  private read<T>(key: string, fallback: T): T {
    try {
      const data = localStorage.getItem(key);
      if (!data) return fallback;
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private write<T>(key: string, data: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      this.notify();
    } catch (err) {
      console.error('Failed to write to localStorage:', err);
    }
  }

  public ensureInitialized(): void {
    if (!localStorage.getItem(STORAGE_KEYS.GAMES)) {
      this.resetAllDataToSeed();
    }
  }

  public resetAllDataToSeed(): void {
    localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(SEED_GAMES));
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(SEED_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.RARITIES, JSON.stringify(SEED_RARITIES));
    localStorage.setItem(STORAGE_KEYS.CATEGORY_COSTS, JSON.stringify(SEED_CATEGORY_RARITY_COSTS));
    localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(SEED_ITEMS));
    localStorage.setItem(STORAGE_KEYS.PRICING, JSON.stringify(SEED_PRICING_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.ESTIMATIONS, JSON.stringify(SEED_ESTIMATIONS));
    localStorage.setItem(STORAGE_KEYS.ACTIVITY_LOGS, JSON.stringify(SEED_ACTIVITY_LOGS));
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(SEED_USERS));
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, JSON.stringify('USR-001'));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(SEED_GENERAL_SETTINGS));
    localStorage.setItem(STORAGE_KEYS.IMPORT_BATCHES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
    this.notify();
  }

  // --- USERS & AUTH ---
  public isAuthenticated(): boolean {
    return this.read<boolean>(STORAGE_KEYS.AUTH_LOGGED_IN, true);
  }

  public login(email: string, _password?: string): boolean {
    const user = this.getCurrentUser();
    const cleanEmail = (email || '').trim().toLowerCase();
    // Allow login if email matches admin@johengaming.internal or username 'admin'
    if (cleanEmail === user.email.toLowerCase() || cleanEmail === 'admin' || cleanEmail.includes('admin') || cleanEmail.includes('johen')) {
      this.write(STORAGE_KEYS.AUTH_LOGGED_IN, true);
      this.logActivity({
        action: 'LOGIN',
        module: 'AUTH',
        description: `Pengguna ${user.name} berhasil login ke portal internal Johen Gaming.`,
        status: 'success',
      });
      return true;
    }
    return false;
  }

  public logout(): void {
    const user = this.getCurrentUser();
    this.write(STORAGE_KEYS.AUTH_LOGGED_IN, false);
    this.logActivity({
      action: 'LOGOUT',
      module: 'AUTH',
      description: `Pengguna ${user.name} keluar (logout) dari portal aplikasi.`,
      status: 'success',
    });
  }

  public getUsers(): User[] {
    return this.read<User[]>(STORAGE_KEYS.USERS, SEED_USERS);
  }

  public getCurrentUser(): User {
    const users = this.getUsers();
    const currentId = this.read<string>(STORAGE_KEYS.CURRENT_USER_ID, 'USR-001');
    const found = users.find((u) => u.id === currentId);
    return found || users[0] || SEED_USERS[0];
  }

  public setCurrentUser(userId: string): void {
    this.write(STORAGE_KEYS.CURRENT_USER_ID, userId);
    const user = this.getUsers().find((u) => u.id === userId);
    if (user) {
      this.logActivity({
        action: 'LOGIN',
        module: 'AUTH',
        description: `Beralih pengguna aktif ke ${user.name} (${user.role}).`,
        status: 'success',
      });
    }
  }

  public saveUser(user: User): void {
    const list = this.getUsers();
    const idx = list.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      list[idx] = user;
    } else {
      list.push(user);
    }
    this.write(STORAGE_KEYS.USERS, list);
    this.logActivity({
      action: idx >= 0 ? 'UPDATE_USER' : 'ADD_USER',
      module: 'SETTINGS',
      description: `Menyimpan data pengguna ${user.name} (${user.role}).`,
      status: 'success',
    });
  }

  // --- GAMES ---
  public getGames(): Game[] {
    return this.read<Game[]>(STORAGE_KEYS.GAMES, SEED_GAMES);
  }

  public getGameById(id: string): Game | undefined {
    return this.getGames().find((g) => g.id === id);
  }

  public saveGame(game: Game): void {
    const list = this.getGames();
    const idx = list.findIndex((g) => g.id === game.id);
    const isNew = idx === -1;
    if (idx >= 0) {
      list[idx] = { ...game, updatedAt: new Date().toISOString() };
    } else {
      list.push({
        ...game,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this.write(STORAGE_KEYS.GAMES, list);

    // Ensure pricing setting exists for this game
    const pricing = this.getPricingSettingByGame(game.id);
    if (!pricing) {
      this.savePricingSetting({
        id: `PRICE-${game.slug.toUpperCase()}`,
        gameId: game.id,
        currencyRate: game.defaultConversionRate,
        lowPercentage: game.lowPercentage,
        mediumPercentage: game.mediumPercentage,
        highPercentage: game.highPercentage,
        roundingMode: 'none',
        defaultTier: 'medium',
        updatedAt: new Date().toISOString(),
      });
    }

    this.logActivity({
      action: isNew ? 'CREATE_GAME' : 'UPDATE_GAME',
      module: 'GAMES',
      description: `${isNew ? 'Menambahkan' : 'Memperbarui'} katalog game: ${game.name}.`,
      status: 'success',
    });
  }

  public deleteGame(id: string): boolean {
    const list = this.getGames();
    const game = list.find((g) => g.id === id);
    if (!game) return false;

    // Check if estimations or items exist
    const items = this.getItemsByGame(id);
    if (items.length > 0) {
      // Soft-deactivate for safety
      game.status = 'inactive';
      this.saveGame(game);
      this.logActivity({
        action: 'DEACTIVATE_GAME',
        module: 'GAMES',
        description: `Menonaktifkan game ${game.name} karena masih memiliki ${items.length} item.`,
        status: 'warning',
      });
      return true;
    }

    const filtered = list.filter((g) => g.id !== id);
    this.write(STORAGE_KEYS.GAMES, filtered);
    this.logActivity({
      action: 'DELETE_GAME',
      module: 'GAMES',
      description: `Menghapus game ${game.name}.`,
      status: 'success',
    });
    return true;
  }

  // --- CATEGORIES & RARITIES ---
  public getCategories(): Category[] {
    return this.read<Category[]>(STORAGE_KEYS.CATEGORIES, SEED_CATEGORIES);
  }

  public getCategoriesByGame(gameId: string): Category[] {
    return this.getCategories().filter((c) => c.gameId === gameId && c.status === 'active');
  }

  public saveCategory(category: Category): void {
    const list = this.getCategories();
    const idx = list.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      list[idx] = category;
    } else {
      list.push(category);
    }
    this.write(STORAGE_KEYS.CATEGORIES, list);
  }

  public getRarities(): Rarity[] {
    return this.read<Rarity[]>(STORAGE_KEYS.RARITIES, SEED_RARITIES);
  }

  public getRaritiesByGame(gameId: string): Rarity[] {
    return this.getRarities().filter((r) => r.gameId === gameId && r.status === 'active');
  }

  public saveRarity(rarity: Rarity): void {
    const list = this.getRarities();
    const idx = list.findIndex((r) => r.id === rarity.id);
    if (idx >= 0) {
      list[idx] = rarity;
    } else {
      list.push(rarity);
    }
    this.write(STORAGE_KEYS.RARITIES, list);
  }

  // --- GAME ITEMS ---
  public getItems(): GameItem[] {
    return this.read<GameItem[]>(STORAGE_KEYS.ITEMS, SEED_ITEMS);
  }

  public getItemsByGame(gameId: string): GameItem[] {
    return this.getItems().filter((i) => i.gameId === gameId);
  }

  public saveItem(item: GameItem): void {
    const list = this.getItems();
    const idx = list.findIndex((i) => i.id === item.id);
    const isNew = idx === -1;
    const now = new Date().toISOString();
    if (idx >= 0) {
      list[idx] = { ...item, updatedAt: now };
    } else {
      list.push({ ...item, createdAt: now, updatedAt: now });
    }
    this.write(STORAGE_KEYS.ITEMS, list);

    this.logActivity({
      action: isNew ? 'ADD_ITEM' : 'EDIT_ITEM',
      module: 'ITEMS',
      description: `${isNew ? 'Menambahkan' : 'Mengubah'} item: ${item.name} (${item.type}) - ${item.estimatedCurrency} currency.`,
      status: 'success',
    });
  }

  public deleteItem(id: string): boolean {
    const list = this.getItems();
    const item = list.find((i) => i.id === id);
    if (!item) return false;
    const filtered = list.filter((i) => i.id !== id);
    this.write(STORAGE_KEYS.ITEMS, filtered);

    this.logActivity({
      action: 'DELETE_ITEM',
      module: 'ITEMS',
      description: `Menghapus item database: ${item.name} (${item.type}).`,
      status: 'success',
    });
    return true;
  }

  public bulkDeleteItems(ids: string[]): number {
    const list = this.getItems();
    const toDeleteCount = list.filter((i) => ids.includes(i.id)).length;
    const filtered = list.filter((i) => !ids.includes(i.id));
    this.write(STORAGE_KEYS.ITEMS, filtered);

    this.logActivity({
      action: 'BULK_DELETE_ITEMS',
      module: 'ITEMS',
      description: `Menghapus ${toDeleteCount} item secara massal.`,
      status: 'success',
    });
    return toDeleteCount;
  }

  public saveItemsBatch(items: GameItem[]): void {
    const list = this.getItems();
    const map = new Map<string, GameItem>(list.map((i) => [i.id, i]));
    items.forEach((item) => {
      map.set(item.id, item);
    });
    this.write(STORAGE_KEYS.ITEMS, Array.from(map.values()));
  }

  // --- PRICING SETTINGS ---
  public getPricingSettings(): PricingSetting[] {
    return this.read<PricingSetting[]>(STORAGE_KEYS.PRICING, SEED_PRICING_SETTINGS);
  }

  public getPricingSettingByGame(gameId: string): PricingSetting | undefined {
    return this.getPricingSettings().find((p) => p.gameId === gameId);
  }

  public savePricingSetting(setting: PricingSetting): void {
    const list = this.getPricingSettings();
    const idx = list.findIndex((p) => p.gameId === setting.gameId);
    const updated = { ...setting, updatedAt: new Date().toISOString() };
    if (idx >= 0) {
      list[idx] = updated;
    } else {
      list.push(updated);
    }
    this.write(STORAGE_KEYS.PRICING, list);

    const game = this.getGameById(setting.gameId);
    this.logActivity({
      action: 'UPDATE_PRICING',
      module: 'PRICING',
      description: `Memperbarui konfigurasi harga game ${game?.name || setting.gameId}: Rate Rp${setting.currencyRate}, Tiers ${setting.lowPercentage}% / ${setting.mediumPercentage}% / ${setting.highPercentage}%.`,
      status: 'success',
    });
  }

  public resetPricingSettingToDefault(gameId: string): PricingSetting | undefined {
    const game = this.getGameById(gameId);
    if (!game) return undefined;
    const def = SEED_PRICING_SETTINGS.find((p) => p.gameId === gameId) || {
      id: `PRICE-${game.slug.toUpperCase()}`,
      gameId: game.id,
      currencyRate: game.defaultConversionRate,
      lowPercentage: game.lowPercentage,
      mediumPercentage: game.mediumPercentage,
      highPercentage: game.highPercentage,
      roundingMode: 'none',
      defaultTier: 'medium',
      updatedAt: new Date().toISOString(),
    };
    this.savePricingSetting(def);
    return def;
  }

  // --- ESTIMATIONS ---
  public getEstimations(): Estimation[] {
    return this.read<Estimation[]>(STORAGE_KEYS.ESTIMATIONS, SEED_ESTIMATIONS);
  }

  public getEstimationById(id: string): Estimation | undefined {
    return this.getEstimations().find((e) => e.id === id);
  }

  public getNextEstimationId(): string {
    const list = this.getEstimations();
    let max = 0;
    list.forEach((e) => {
      const match = e.id.match(/EST-(\d+)/);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    });
    const nextNum = max + 1;
    return `EST-${String(nextNum).padStart(6, '0')}`;
  }

  public saveEstimation(estimation: Estimation): void {
    const list = this.getEstimations();
    const idx = list.findIndex((e) => e.id === estimation.id);
    const now = new Date().toISOString();
    const record = {
      ...estimation,
      updatedAt: now,
      createdAt: estimation.createdAt || now,
    };
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.unshift(record); // Prepend newest
    }
    this.write(STORAGE_KEYS.ESTIMATIONS, list);

    this.logActivity({
      action: idx >= 0 ? 'UPDATE_ESTIMATION' : 'CREATE_ESTIMATION',
      module: 'ESTIMATION',
      description: `Menyimpan estimasi harga ${estimation.id} (${estimation.title}) total ${estimation.totalCurrency} currency.`,
      status: 'success',
    });
  }

  public deleteEstimation(id: string): boolean {
    const list = this.getEstimations();
    const target = list.find((e) => e.id === id);
    if (!target) return false;
    const filtered = list.filter((e) => e.id !== id);
    this.write(STORAGE_KEYS.ESTIMATIONS, filtered);

    this.logActivity({
      action: 'DELETE_ESTIMATION',
      module: 'ESTIMATION',
      description: `Menghapus catatan estimasi ${id} (${target.title}).`,
      status: 'warning',
    });
    return true;
  }

  // --- CHAT SESSIONS ---
  public getSessions(): EstimationSession[] {
    return this.read<EstimationSession[]>(STORAGE_KEYS.SESSIONS, []);
  }

  public getSessionById(id: string): EstimationSession | undefined {
    return this.getSessions().find((s) => s.id === id);
  }

  public saveSession(session: EstimationSession): void {
    const list = this.getSessions();
    const idx = list.findIndex((s) => s.id === session.id);
    if (idx >= 0) {
      list[idx] = session;
    } else {
      list.unshift(session);
    }
    this.write(STORAGE_KEYS.SESSIONS, list);
  }

  public deleteSession(id: string): void {
    const list = this.getSessions().filter((s) => s.id !== id);
    this.write(STORAGE_KEYS.SESSIONS, list);
  }

  // --- ACTIVITY LOGS ---
  public getActivityLogs(): ActivityLog[] {
    return this.read<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, SEED_ACTIVITY_LOGS);
  }

  public logActivity(entry: {
    action: string;
    module: ActivityModule;
    description: string;
    status?: 'success' | 'warning' | 'error';
  }): void {
    const currentUser = this.getCurrentUser();
    const newLog: ActivityLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action: entry.action,
      module: entry.module,
      description: entry.description,
      status: entry.status || 'success',
    };
    const list = this.getActivityLogs();
    list.unshift(newLog);
    // Keep last 250 logs
    if (list.length > 250) list.length = 250;
    this.write(STORAGE_KEYS.ACTIVITY_LOGS, list);
  }

  // --- IMPORT BATCHES ---
  public getImportBatches(): ImportBatch[] {
    return this.read<ImportBatch[]>(STORAGE_KEYS.IMPORT_BATCHES, []);
  }

  public logImportBatch(batch: ImportBatch): void {
    const list = this.getImportBatches();
    list.unshift(batch);
    this.write(STORAGE_KEYS.IMPORT_BATCHES, list);
    this.logActivity({
      action: 'IMPORT_DATABASE',
      module: 'IMPORT',
      description: `Impor database file ${batch.fileName}: ${batch.successfulRows} berhasil, ${batch.failedRows} gagal.`,
      status: batch.failedRows === 0 ? 'success' : 'warning',
    });
  }

  // --- GENERAL SETTINGS ---
  public getSettings(): GeneralSettings {
    return this.read<GeneralSettings>(STORAGE_KEYS.SETTINGS, SEED_GENERAL_SETTINGS);
  }

  public saveSettings(settings: GeneralSettings): void {
    this.write(STORAGE_KEYS.SETTINGS, settings);
    this.logActivity({
      action: 'UPDATE_SETTINGS',
      module: 'SETTINGS',
      description: 'Memperbarui pengaturan umum sistem & preferensi antarmuka.',
      status: 'success',
    });
  }
}

export const repository = new Repository();
