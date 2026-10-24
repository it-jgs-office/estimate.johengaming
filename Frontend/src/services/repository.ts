/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  ActivityLog,
  ActivityModule,
  Category,
  Estimation,
  EstimationSession,
  Game,
  GameItem,
  GeneralSettings,
  ImportBatch,
  PricingSetting,
  Rarity,
  User,
} from '../types';
import { api, clearApiToken, getApiToken, setApiToken } from './api';

const STORAGE_KEYS = {
  GAMES: 'johen_games_v1',
  CATEGORIES: 'johen_categories_v1',
  RARITIES: 'johen_rarities_v1',
  ITEMS: 'johen_items_v1',
  PRICING: 'johen_pricing_settings_v1',
  ESTIMATIONS: 'johen_estimations_v1',
  SESSIONS: 'johen_sessions_v1',
  ACTIVITY_LOGS: 'johen_activity_logs_v1',
  IMPORT_BATCHES: 'johen_import_batches_v1',
  USERS: 'johen_users_v1',
  CURRENT_USER_ID: 'johen_current_user_id_v1',
  SETTINGS: 'johen_general_settings_v1',
};

const EMPTY_USER: User = {
  id: '', name: '', email: '', role: 'STAFF', status: 'inactive', createdAt: '',
};

type Listener = () => void;

class Repository {
  private listeners: Set<Listener> = new Set();

  constructor() {
    this.clearLegacyDummyData();
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
    // Data aplikasi berasal dari API Laravel. Tidak ada seed data di browser.
  }

  public resetAllDataToSeed(): void {
    this.clearLegacyDummyData();
    this.notify();
  }

  private clearLegacyDummyData(): void {
    if (localStorage.getItem('johen_api_migrated_v2')) return;
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    localStorage.setItem('johen_api_migrated_v2', '1');
  }

  public async hydrate(): Promise<void> {
    if (!getApiToken()) return;
    try {
      const data = await api<Record<string, unknown>>('/bootstrap');
      const mapping: Record<string, keyof typeof STORAGE_KEYS> = {
        games: 'GAMES', categories: 'CATEGORIES', rarities: 'RARITIES', items: 'ITEMS',
        pricingSettings: 'PRICING', estimations: 'ESTIMATIONS', sessions: 'SESSIONS',
        activityLogs: 'ACTIVITY_LOGS', importBatches: 'IMPORT_BATCHES',
      };
      Object.entries(mapping).forEach(([source, key]) => localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data[source] || [])));
      if (data.user) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify([data.user]));
        localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, JSON.stringify((data.user as User).id));
      }
      this.notify();
    } catch {
      clearApiToken();
      this.notify();
    }
  }

  // --- USERS & AUTH ---
  public isAuthenticated(): boolean {
    return Boolean(getApiToken());
  }

  public async login(email: string, password: string): Promise<boolean> {
    try {
      const response = await api<{ token: string; user: User }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      setApiToken(response.token);
      this.write(STORAGE_KEYS.USERS, [response.user]);
      this.write(STORAGE_KEYS.CURRENT_USER_ID, response.user.id);
      await this.hydrate();
      return true;
    } catch {
      return false;
    }
  }

  public logout(): void {
    void api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    clearApiToken();
    this.notify();
  }

  public getUsers(): User[] {
    return this.read<User[]>(STORAGE_KEYS.USERS, []);
  }

  public getCurrentUser(): User {
    const users = this.getUsers();
    const currentId = this.read<string>(STORAGE_KEYS.CURRENT_USER_ID, '');
    const found = users.find((u) => u.id === currentId);
    return found || users[0] || EMPTY_USER;
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
    return this.read<Game[]>(STORAGE_KEYS.GAMES, []);
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

  public async deleteGame(id: string): Promise<boolean> {
    const list = this.getGames();
    const game = list.find((g) => g.id === id);
    if (!game) return false;

    await api(`/catalog/games/${id}`, { method: 'DELETE' });

    this.write(STORAGE_KEYS.GAMES, list.filter((g) => g.id !== id));
    this.write(STORAGE_KEYS.CATEGORIES, this.getCategories().filter((category) => category.gameId !== id));
    this.write(STORAGE_KEYS.RARITIES, this.getRarities().filter((rarity) => rarity.gameId !== id));
    this.write(STORAGE_KEYS.ITEMS, this.getItems().filter((item) => item.gameId !== id));
    this.write(STORAGE_KEYS.PRICING, this.getPricingSettings().filter((setting) => setting.gameId !== id));
    this.write(STORAGE_KEYS.ESTIMATIONS, this.getEstimations().filter((estimation) => estimation.gameId !== id));
    this.write(STORAGE_KEYS.SESSIONS, this.getSessions().filter((session) => session.gameId !== id));
    this.logActivity({
      action: 'DELETE_GAME',
      module: 'GAMES',
      description: `Menghapus game ${game.name} beserta seluruh data terkait.`,
      status: 'success',
    });
    return true;
  }

  // --- CATEGORIES & RARITIES ---
  public getCategories(): Category[] {
    return this.read<Category[]>(STORAGE_KEYS.CATEGORIES, []);
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
    return this.read<Rarity[]>(STORAGE_KEYS.RARITIES, []);
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
    return this.read<GameItem[]>(STORAGE_KEYS.ITEMS, []);
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
    const serverId = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(item.id) ? item.id : undefined;
    void api<{ item: GameItem }>('/catalog/items', {
      method: 'POST',
      body: JSON.stringify({ id: serverId, gameId: item.gameId, categoryId: item.categoryId, rarityId: item.rarityId, estimatedCurrency: item.estimatedCurrency }),
    }).then(({ item: saved }) => {
      const current = this.getItems();
      const position = current.findIndex((entry) => entry.id === item.id || entry.id === saved.id);
      if (position >= 0) current[position] = saved;
      else current.push(saved);
      this.write(STORAGE_KEYS.ITEMS, current);
    }).catch(() => undefined);

    this.logActivity({
      action: isNew ? 'ADD_ITEM' : 'EDIT_ITEM',
      module: 'ITEMS',
      description: `${isNew ? 'Menambahkan' : 'Mengubah'} item: ${item.name} - ${item.estimatedCurrency} currency.`,
      status: 'success',
    });
  }

  public deleteItem(id: string): boolean {
    const list = this.getItems();
    const item = list.find((i) => i.id === id);
    if (!item) return false;
    const filtered = list.filter((i) => i.id !== id);
    this.write(STORAGE_KEYS.ITEMS, filtered);
    if (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) {
      void api(`/catalog/items/${id}`, { method: 'DELETE' }).catch(() => undefined);
    }

    this.logActivity({
      action: 'DELETE_ITEM',
      module: 'ITEMS',
      description: `Menghapus item database: ${item.name}.`,
      status: 'success',
    });
    return true;
  }

  public bulkDeleteItems(ids: string[]): number {
    const list = this.getItems();
    const toDeleteCount = list.filter((i) => ids.includes(i.id)).length;
    const filtered = list.filter((i) => !ids.includes(i.id));
    this.write(STORAGE_KEYS.ITEMS, filtered);
    ids.filter((id) => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)).forEach((id) => {
      void api(`/catalog/items/${id}`, { method: 'DELETE' }).catch(() => undefined);
    });

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
    return this.read<PricingSetting[]>(STORAGE_KEYS.PRICING, []);
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
    void api<{ pricingSetting: PricingSetting }>('/catalog/pricing', {
      method: 'PUT',
      body: JSON.stringify(setting),
    }).then(({ pricingSetting }) => {
      const current = this.getPricingSettings();
      const position = current.findIndex((entry) => entry.gameId === pricingSetting.gameId);
      if (position >= 0) current[position] = pricingSetting;
      else current.push(pricingSetting);
      this.write(STORAGE_KEYS.PRICING, current);
      void this.hydrate();
    }).catch(() => undefined);

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
    const def = {
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
    return this.read<Estimation[]>(STORAGE_KEYS.ESTIMATIONS, []);
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
    void api<{ estimation: Estimation }>('/estimations', {
      method: 'POST',
      body: JSON.stringify(estimation),
    }).then(({ estimation: saved }) => {
      const current = this.getEstimations();
      const position = current.findIndex((entry) => entry.id === saved.id);
      if (position >= 0) current[position] = saved;
      else current.unshift(saved);
      this.write(STORAGE_KEYS.ESTIMATIONS, current);
    }).catch(() => undefined);

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
    void api(`/estimations/${id}`, { method: 'DELETE' }).catch(() => undefined);

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
    void api<{ session: EstimationSession }>('/sessions', {
      method: 'POST',
      body: JSON.stringify(session),
    }).then(({ session: saved }) => {
      const current = this.getSessions();
      const index = current.findIndex((entry) => entry.id === session.id || entry.id === saved.id);
      if (index >= 0) current[index] = saved;
      else current.unshift(saved);
      this.write(STORAGE_KEYS.SESSIONS, current);
    }).catch(() => undefined);
  }

  public deleteSession(id: string): void {
    const list = this.getSessions().filter((s) => s.id !== id);
    this.write(STORAGE_KEYS.SESSIONS, list);
    void api(`/sessions/${id}`, { method: 'DELETE' }).catch(() => undefined);
  }

  // --- ACTIVITY LOGS ---
  public getActivityLogs(): ActivityLog[] {
    return this.read<ActivityLog[]>(STORAGE_KEYS.ACTIVITY_LOGS, []);
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
    return this.read<GeneralSettings>(STORAGE_KEYS.SETTINGS, {
      appName: 'Johen Gaming', accentColor: 'blue', themeMode: 'light', compactTable: false,
      currencyFormat: 'idr', defaultGameId: '', confirmDelete: true,
    });
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
