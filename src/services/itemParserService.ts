/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { RecognizedItem, UnknownItemPrompt } from '../types';
import { findCategory, matchGameItem, normalizeText } from './itemMatchingService';
import { repository } from './repository';

export interface ParseResult {
  action: 'replace' | 'add' | 'remove' | 'update_qty' | 'clear' | 'unknown_only';
  recognizedItems: RecognizedItem[];
  unknownItems: UnknownItemPrompt[];
  message: string;
}

/**
 * Extract integer quantity from a text fragment (e.g. "melee special 2x" -> 2)
 */
function extractQuantity(text: string): { cleanedText: string; quantity: number } {
  let qty = 1;
  let cleaned = text;

  // Patterns like "2x", "x 2", "2 pcs", "2 buah", "sebanyak 2"
  const patterns = [
    /\b(\d+)\s*(?:x|buah|pcs|item|unit)\b/i,
    /\b(?:x|sebanyak|sejumlah)\s*(\d+)\b/i,
    /\b(\d+)\s*$/i, // Trailing number at the end: "melee special 2"
  ];

  for (const regex of patterns) {
    const match = cleaned.match(regex);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > 0 && val < 500) {
        qty = val;
        cleaned = cleaned.replace(match[0], ' ').trim();
        break;
      }
    }
  }

  return { cleanedText: cleaned, quantity: qty };
}

/**
 * Clean conversational filler words in Indonesian/English
 */
function cleanConversationalPreamble(input: string): string {
  return input
    .replace(/\b(akun ff ada|akun ff|akun ada|saya punya|punya|ada|koleksi|spek akun|spek|tolong hitung|hitung|hitungkan|cek harga|tolong cek|bisa hitung|estimasi)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Split sentence by Indonesian/English conjunctions & delimiters: commas, newlines, 'terus', 'sama', 'dan', 'lalu', 'juga'
 */
function splitIntoItemTokens(line: string): string[] {
  // Normalize connectors to comma
  const unified = line
    .replace(/\b(dan|sama|terus|lalu|juga|serta|\+)\b/gi, ',')
    .replace(/;/g, ',');

  return unified
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Main Natural Language Parser
 */
export function parseConversationalAccountSpec(
  gameId: string,
  rawInput: string,
  currentDraft: RecognizedItem[] = []
): ParseResult {
  const trimmed = rawInput.trim();
  const lower = trimmed.toLowerCase();

  // 1. Check for CLEAR command
  if (
    /^(reset|clear|bersihkan|hapus semua|mulai ulang|kosongkan)\b/i.test(lower)
  ) {
    return {
      action: 'clear',
      recognizedItems: [],
      unknownItems: [],
      message: 'Draft estimasi telah dikosongkan. Silakan masukkan spesifikasi baru.',
    };
  }

  // 2. Check for REMOVE command ("Hapus shotgun special", "Buang melee heroic")
  const removeMatch = lower.match(/^(?:hapus|buang|remove|delete|hilangkan)\s+(.+)$/i);
  if (removeMatch && removeMatch[1]) {
    const targetText = removeMatch[1].trim();
    const match = matchGameItem(gameId, targetText, undefined, 1);
    if (match.found && match.item) {
      return {
        action: 'remove',
        recognizedItems: [match.item],
        unknownItems: [],
        message: `Menghapus ${match.item.itemName} dari daftar estimasi.`,
      };
    } else {
      // Fuzzy match by item name against current draft
      const targetNorm = normalizeText(targetText);
      const foundInDraft = currentDraft.find(
        (i) =>
          normalizeText(i.itemName).includes(targetNorm) ||
          targetNorm.includes(normalizeText(i.itemName))
      );
      if (foundInDraft) {
        return {
          action: 'remove',
          recognizedItems: [foundInDraft],
          unknownItems: [],
          message: `Menghapus ${foundInDraft.itemName} dari daftar estimasi.`,
        };
      }
    }
  }

  // 3. Check for UPDATE QUANTITY command ("Ganti melee heroic dari 2 jadi 3", "Ubah melee special jadi 4")
  const updateQtyMatch = lower.match(
    /(?:ganti|ubah|set)\s+(.+?)\s+(?:dari\s+\d+\s+)?(?:jadi|menjadi|ke)\s+(\d+)/i
  );
  if (updateQtyMatch && updateQtyMatch[1] && updateQtyMatch[2]) {
    const targetText = updateQtyMatch[1].trim();
    const newQty = parseInt(updateQtyMatch[2], 10);
    const match = matchGameItem(gameId, targetText, undefined, newQty);
    if (match.found && match.item) {
      match.item.quantity = newQty;
      match.item.totalCurrency = match.item.unitCurrency * newQty;
      return {
        action: 'update_qty',
        recognizedItems: [match.item],
        unknownItems: [],
        message: `Mengubah jumlah ${match.item.itemName} menjadi ${newQty}x.`,
      };
    }
  }

  // 4. Check for ADD command ("Tambahkan shotgun special 2", "Tambah melee special 1")
  let isAddCommand = false;
  let contentToParse = trimmed;
  const addMatch = lower.match(/^(?:tambahkan|tambah|add|\+)\s+(.+)$/i);
  if (addMatch && addMatch[1]) {
    isAddCommand = true;
    contentToParse = addMatch[1];
  }

  // Standard Parsing for items
  const recognizedItems: RecognizedItem[] = [];
  const unknownItems: UnknownItemPrompt[] = [];

  // Split by line to support colon category structures
  const lines = contentToParse.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  let activeCategory = undefined;

  for (const line of lines) {
    // Check if line has a colon indicating Category Header (e.g. "Melee: special, heroic")
    if (line.includes(':')) {
      const parts = line.split(':');
      const categoryHeader = parts[0].trim();
      const itemsListText = parts.slice(1).join(':').trim();

      const matchedCat = findCategory(gameId, categoryHeader);
      if (matchedCat) {
        activeCategory = matchedCat;
      }

      const itemTokens = splitIntoItemTokens(itemsListText);
      for (const token of itemTokens) {
        processToken(token, matchedCat || activeCategory);
      }
    } else {
      // Line without colon, e.g. "Mele spesial 1 heroik 1 terus sg spesial 2" or "Hitung Crimson Blade, shotgun special"
      const cleanedLine = cleanConversationalPreamble(line);
      const itemTokens = splitIntoItemTokens(cleanedLine);

      for (const token of itemTokens) {
        processToken(token, activeCategory);
      }
    }
  }

  function processToken(rawToken: string, inheritedCategory?: any) {
    if (!rawToken || rawToken.trim().length === 0) return;
    const { cleanedText, quantity } = extractQuantity(rawToken);

    // If cleanedText is empty or trivial, skip
    if (cleanedText.length < 2) return;

    // First try exact / alias / category matching
    const match = matchGameItem(gameId, cleanedText, inheritedCategory, quantity);

    if (match.found && match.item) {
      // If category was found from item, keep as active context
      if (match.category) {
        activeCategory = match.category;
      }
      recognizedItems.push(match.item);
    } else {
      // Check if this token had a category or rarity guess
      const cat = match.category || findCategory(gameId, cleanedText) || inheritedCategory;
      unknownItems.push({
        rawText: rawToken.trim(),
        categoryGuess: cat?.name,
        quantity,
      });
    }
  }

  // Determine final action
  if (recognizedItems.length === 0 && unknownItems.length > 0) {
    return {
      action: 'unknown_only',
      recognizedItems: [],
      unknownItems,
      message: `Saya menemukan ${unknownItems.length} item yang belum tersedia di database. Mohon masukkan estimasi mata uang game untuk melanjutkan.`,
    };
  }

  return {
    action: isAddCommand ? 'add' : 'replace',
    recognizedItems,
    unknownItems,
    message: isAddCommand
      ? `Berhasil menambahkan ${recognizedItems.length} item baru ke dalam draft.`
      : `Berhasil! Saya menemukan ${recognizedItems.length} item dari database.${
          unknownItems.length > 0
            ? ` (${unknownItems.length} item perlu konfirmasi manual)`
            : ''
        }`,
  };
}

/**
 * Merge newly parsed items into draft based on the action
 */
export function applyParsedItemsToDraft(
  currentDraft: RecognizedItem[],
  parseResult: ParseResult
): RecognizedItem[] {
  const { action, recognizedItems } = parseResult;

  if (action === 'clear') {
    return [];
  }

  if (action === 'remove') {
    if (recognizedItems.length === 0) return currentDraft;
    const toRemoveId = recognizedItems[0].itemId || recognizedItems[0].tempId;
    const toRemoveName = normalizeText(recognizedItems[0].itemName);
    return currentDraft.filter((item) => {
      if (toRemoveId && item.itemId === toRemoveId) return false;
      if (normalizeText(item.itemName) === toRemoveName) return false;
      return true;
    });
  }

  if (action === 'update_qty') {
    if (recognizedItems.length === 0) return currentDraft;
    const target = recognizedItems[0];
    const targetName = normalizeText(target.itemName);
    return currentDraft.map((item) => {
      if (
        (target.itemId && item.itemId === target.itemId) ||
        normalizeText(item.itemName) === targetName
      ) {
        return {
          ...item,
          quantity: target.quantity,
          totalCurrency: item.unitCurrency * target.quantity,
        };
      }
      return item;
    });
  }

  if (action === 'add') {
    const updated = [...currentDraft];
    for (const newItem of recognizedItems) {
      // If exact same item exists in draft, increment quantity
      const existingIdx = updated.findIndex(
        (i) =>
          (newItem.itemId && i.itemId === newItem.itemId) ||
          normalizeText(i.itemName) === normalizeText(newItem.itemName)
      );
      if (existingIdx >= 0) {
        const current = updated[existingIdx];
        const newQty = current.quantity + newItem.quantity;
        updated[existingIdx] = {
          ...current,
          quantity: newQty,
          totalCurrency: current.unitCurrency * newQty,
        };
      } else {
        updated.push(newItem);
      }
    }
    return updated;
  }

  // Default: 'replace'
  // When replacing, if multiple identical items are recognized in the same message, sum their quantities
  const map = new Map<string, RecognizedItem>();
  for (const item of recognizedItems) {
    const key = item.itemId || `${item.categoryName}_${item.rarityName}_${item.itemName}`;
    if (map.has(key)) {
      const existing = map.get(key)!;
      const newQty = existing.quantity + item.quantity;
      map.set(key, {
        ...existing,
        quantity: newQty,
        totalCurrency: existing.unitCurrency * newQty,
      });
    } else {
      map.set(key, { ...item });
    }
  }

  return Array.from(map.values());
}
