import { Game } from '../types';

export const getGameIconPath = (game: Pick<Game, 'name' | 'slug'>): string | null => {
  const identifier = `${game.slug} ${game.name}`.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (identifier.includes('freefire')) return '/icon-freefire.webp';
  if (identifier.includes('mobilelegends')) return '/icon-mobilelegends.webp';
  if (identifier.includes('valorant')) return '/icon-valorant.webp';
  if (identifier.includes('roblox')) return '/icon-roblox.webp';
  if (identifier.includes('pubg')) return '/icon-pubg.webp';
  if (identifier.includes('efootball')) return '/icon-efootball.webp';
  if (identifier.includes('fcmobile') || identifier.includes('fcfootball')) return '/icon-fcmobile.webp';

  return null;
};
