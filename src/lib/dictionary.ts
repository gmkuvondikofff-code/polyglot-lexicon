import { useEffect, useState, useSyncExternalStore } from "react";

export type Lang = "uz" | "ru" | "en" | "zh";

export interface WordEntry {
  id: string;
  uz: string;
  ru: string;
  en: string;
  zh: string;
  createdAt: number;
}

const STORAGE_KEY = "polyglot.dictionary.v1";
const FAV_KEY = "polyglot.favorites.v1";
const EVENT = "polyglot:dictionary-change";
const FAV_EVENT = "polyglot:favorites-change";

const seed: WordEntry[] = [
  { id: "1", uz: "Salom", ru: "Привет", en: "Hello", zh: "你好", createdAt: Date.now() },
  { id: "2", uz: "Rahmat", ru: "Спасибо", en: "Thank you", zh: "谢谢", createdAt: Date.now() },
  { id: "3", uz: "Kitob", ru: "Книга", en: "Book", zh: "书", createdAt: Date.now() },
  { id: "4", uz: "Suv", ru: "Вода", en: "Water", zh: "水", createdAt: Date.now() },
  { id: "5", uz: "Do'st", ru: "Друг", en: "Friend", zh: "朋友", createdAt: Date.now() },
  { id: "6", uz: "Maktab", ru: "Школа", en: "School", zh: "学校", createdAt: Date.now() },
  { id: "7", uz: "Sevgi", ru: "Любовь", en: "Love", zh: "爱", createdAt: Date.now() },
  { id: "8", uz: "Quyosh", ru: "Солнце", en: "Sun", zh: "太阳", createdAt: Date.now() },
];

function read(): WordEntry[] {
  if (typeof window === "undefined") return seed;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as WordEntry[];
  } catch {
    return seed;
  }
}

function write(entries: WordEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDictionary() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const entries = useSyncExternalStore(
    subscribe,
    () => {
      // re-read so updates propagate
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ?? "";
    },
    () => "",
  );
  // Parse fresh each render after hydration
  const list: WordEntry[] = hydrated ? read() : seed;
  // eslint suppress unused
  void entries;
  return list;
}

export const dictionaryActions = {
  add(entry: Omit<WordEntry, "id" | "createdAt">) {
    const list = read();
    list.unshift({ ...entry, id: crypto.randomUUID(), createdAt: Date.now() });
    write(list);
  },
  addMany(entries: Omit<WordEntry, "id" | "createdAt">[]) {
    const list = read();
    const now = Date.now();
    for (const e of entries) {
      list.unshift({ ...e, id: crypto.randomUUID(), createdAt: now });
    }
    write(list);
  },
  remove(id: string) {
    write(read().filter((e) => e.id !== id));
  },
  removeMany(ids: string[]) {
    const set = new Set(ids);
    write(read().filter((e) => !set.has(e.id)));
  },
  update(id: string, patch: Partial<WordEntry>) {
    write(read().map((e) => (e.id === id ? { ...e, ...patch } : e)));
  },
  reset() {
    write(seed);
  },
};

// --- Favorites ---

function readFav(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FAV_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function writeFav(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAV_KEY, JSON.stringify(ids));
  window.dispatchEvent(new CustomEvent(FAV_EVENT));
}

export function useFavorites() {
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => {
    setFavs(readFav());
    const handler = () => setFavs(readFav());
    window.addEventListener(FAV_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(FAV_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);
  return {
    favorites: favs,
    isFavorite: (id: string) => favs.includes(id),
    toggle: (id: string) => {
      const cur = readFav();
      writeFav(cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
  };
}

// --- AI-like parsing simulator ---
// Accepts formats:
//   uz | ru | en | zh   (pipe-separated, one per line)
//   uz, ru, en, zh
//   uz - ru - en - zh
//   uz: foo ru: bar en: baz zh: 你
export function parseBulkText(text: string): Omit<WordEntry, "id" | "createdAt">[] {
  const out: Omit<WordEntry, "id" | "createdAt">[] = [];
  // Strip leading serial markers like "1.", "10-", "3)", "12:" plus whitespace
  const cleanToken = (s: string) => s.replace(/^\s*\d+\s*[\.\-\)\:]\s*/, "").trim();

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    // also strip a serial from the start of the whole line (e.g. "1. uz | ru | en | zh")
    .map((l) => l.replace(/^\s*\d+\s*[\.\-\)\:]\s*/, ""))
    .filter(Boolean);

  for (const line of lines) {
    const labeled = /uz\s*[:=]\s*(.+?)\s*[,;|]\s*ru\s*[:=]\s*(.+?)\s*[,;|]\s*en\s*[:=]\s*(.+?)\s*[,;|]\s*zh\s*[:=]\s*(.+)/i.exec(
      line,
    );
    if (labeled) {
      out.push({
        uz: cleanToken(labeled[1]),
        ru: cleanToken(labeled[2]),
        en: cleanToken(labeled[3]),
        zh: cleanToken(labeled[4]),
      });
      continue;
    }
    const parts = line.split(/\s*[|;\t]\s*|\s+-\s+|\s*,\s*/).filter(Boolean);
    if (parts.length >= 4) {
      out.push({
        uz: cleanToken(parts[0]),
        ru: cleanToken(parts[1]),
        en: cleanToken(parts[2]),
        zh: cleanToken(parts[3]),
      });
    }
  }
  return out;
}
