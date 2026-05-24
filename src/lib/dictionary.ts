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

const STORAGE_KEY = "polyglot.dictionary.v2";
const FAV_KEY = "polyglot.favorites.v2";
const EVENT = "polyglot:dictionary-change";
const FAV_EVENT = "polyglot:favorites-change";

// Start with an empty database — entries are added via the admin panel.
const seed: WordEntry[] = [];

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
// Accepts virtually any format. Each non-empty line = one entry.
// Tokens may be separated by any of:  . , ; | / \ [ ] ( ) tab, " - ", multiple spaces.
// Each token is classified by Unicode script:
//   - Han chars        → zh
//   - Cyrillic chars   → ru
//   - Latin chars      → first occurrence = uz, second = en
// Leading numbering ("1.", "10-", "3)", "12:") is stripped.
// Overly long tokens are trimmed to the first clause / 60 chars.
export function parseBulkText(text: string): Omit<WordEntry, "id" | "createdAt">[] {
  const out: Omit<WordEntry, "id" | "createdAt">[] = [];

  const stripSerial = (s: string) =>
    s.replace(/^[\s\d]*\d+\s*[.\-)\]:]+\s*/, "").trim();

  const trimLong = (s: string) => {
    let t = s.trim();
    const cut = t.split(/[.!?。！？\n\r]/)[0];
    if (cut) t = cut.trim();
    if (t.length > 60) t = t.slice(0, 60).trim();
    return t;
  };

  const clean = (s: string) => trimLong(stripSerial(s));

  const hasHan = (s: string) => /[\u3400-\u9fff\uf900-\ufaff]/.test(s);
  const hasCyr = (s: string) => /[\u0400-\u04ff]/.test(s);
  const hasLat = (s: string) => /[A-Za-zÀ-ÿʼ'`]/.test(s);

  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const rawLine of lines) {
    const line = stripSerial(rawLine);

    // 1) Try labeled format (uz: x, ru: y, en: z, zh: w) in any order.
    const labelRe = /\b(uz|ru|en|zh)\s*[:=]\s*([^,;|/\\\]\[\n\r]+?)(?=\s*(?:[,;|/\\\]\[]|\b(?:uz|ru|en|zh)\s*[:=]|$))/gi;
    const labeled: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = labelRe.exec(line)) !== null) {
      const key = m[1].toLowerCase();
      if (!labeled[key]) labeled[key] = clean(m[2]);
    }
    if (Object.keys(labeled).length >= 2) {
      out.push({
        uz: labeled.uz ?? "",
        ru: labeled.ru ?? "",
        en: labeled.en ?? "",
        zh: labeled.zh ?? "",
      });
      continue;
    }

    // 2) Fallback: split by any separator, classify each token by script.
    const tokens = line
      .split(/[.,;|/\\\]\[()\t]+|\s{2,}|\s+-\s+/)
      .map((t) => clean(t))
      .filter(Boolean);

    let uz = "", ru = "", en = "", zh = "";
    for (const tk of tokens) {
      if (!zh && hasHan(tk)) { zh = tk; continue; }
      if (!ru && hasCyr(tk)) { ru = tk; continue; }
      if (hasLat(tk)) {
        if (!uz) uz = tk;
        else if (!en) en = tk;
      }
    }

    if (!uz && !ru && !en && !zh) continue;
    out.push({ uz, ru, en, zh });
  }
  return out;
}
