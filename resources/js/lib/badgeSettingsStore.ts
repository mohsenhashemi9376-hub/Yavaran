import { useEffect, useState } from 'react';
import { apiRequest } from './serverSync';
import { BadgeSettings, DEFAULT_BADGE_SETTINGS } from '../utils/studentBadges';

/** شرایط نشان‌ها یک بار از سرور خوانده و بین کامپوننت‌ها مشترک نگه داشته می‌شود */
let cache: BadgeSettings | null = null;
let inflight: Promise<BadgeSettings> | null = null;
const listeners = new Set<(s: BadgeSettings) => void>();

const load = (): Promise<BadgeSettings> => {
  if (!inflight) {
    inflight = apiRequest<BadgeSettings>('GET', '/api/badge-settings')
      .then((s) => { cache = s; return s; })
      .catch(() => DEFAULT_BADGE_SETTINGS)
      .finally(() => { inflight = null; });
  }
  return inflight;
};

export const saveBadgeSettings = async (next: BadgeSettings): Promise<BadgeSettings> => {
  const saved = await apiRequest<BadgeSettings>('POST', '/api/badge-settings', next);
  cache = saved;
  listeners.forEach((l) => l(saved));
  return saved;
};

export const useBadgeSettings = (): BadgeSettings => {
  const [settings, setSettings] = useState<BadgeSettings>(cache ?? DEFAULT_BADGE_SETTINGS);
  useEffect(() => {
    listeners.add(setSettings);
    if (!cache) void load().then(setSettings);
    return () => { listeners.delete(setSettings); };
  }, []);
  return settings;
};
