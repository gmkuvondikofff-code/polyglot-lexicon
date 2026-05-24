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
// Works with or without separators. Each non-empty line = one entry.
// Strategy: scan the line for runs of each Unicode script.
//   - Han runs       → zh
//   - Cyrillic runs  → ru
//   - Latin runs     → first = uz, second = en
// Labeled format (uz:.. ru:.. en:.. zh:..) is detected first.
// Leading numbering ("1.", "10-", "3)") and stray punctuation are stripped.
// Tokens longer than 60 chars or containing sentence punctuation are trimmed.
// Each entry MUST have all 4 translations — otherwise it's reported as invalid.
export type ParsedEntry = Omit<WordEntry, "id" | "createdAt">;
export interface ParseResult {
  entries: ParsedEntry[];
  invalid: { line: string; missing: Lang[] }[];
}

const HAN_RE = /[\u3400-\u9fff\uf900-\ufaff]+(?:[\s\u3000][\u3400-\u9fff\uf900-\ufaff]+)*/g;
const CYR_RE = /[\u0400-\u04ff]+(?:[\s'`\-][\u0400-\u04ff]+)*/g;
const LAT_RE = /[A-Za-zÀ-ÿʼ'`]+(?:[\s\-'`ʼ][A-Za-zÀ-ÿʼ'`]+)*/g;

function tidy(s: string): string {
  let t = s.replace(/^[\s\d]*\d+\s*[.\-)\]:]+\s*/, "").trim();
  const cut = t.split(/[.!?。！？\n\r]/)[0];
  if (cut) t = cut.trim();
  t = t.replace(/^[\s,;:|/\\\]\[().\-]+|[\s,;:|/\\\]\[().\-]+$/g, "").trim();
  if (t.length > 60) t = t.slice(0, 60).trim();
  return t;
}

export function parseBulkText(text: string): ParsedEntry[] {
  return parseBulk(text).entries;
}

export function parseBulk(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const invalid: { line: string; missing: Lang[] }[] = [];

  const lines = text
    .split(/\r?\n+/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[\s\d]*\d+\s*[.\-)\]:]+\s*/, "");
    let uz = "", ru = "", en = "", zh = "";

    // 1) Labeled format anywhere in line.
    const labelRe = /\b(uz|ru|en|zh)\s*[:=]\s*([^,;|/\\\]\[\n\r]+?)(?=\s*(?:[,;|/\\\]\[]|\b(?:uz|ru|en|zh)\s*[:=]|$))/gi;
    const labeled: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = labelRe.exec(line)) !== null) {
      const key = m[1].toLowerCase();
      if (!labeled[key]) labeled[key] = tidy(m[2]);
    }
    if (Object.keys(labeled).length >= 2) {
      uz = labeled.uz ?? "";
      ru = labeled.ru ?? "";
      en = labeled.en ?? "";
      zh = labeled.zh ?? "";
    } else {
      // 2) Script-based extraction — works even without any separator.
      const han = line.match(HAN_RE) ?? [];
      const cyr = line.match(CYR_RE) ?? [];
      // Remove already-claimed ranges before Latin scan so labels like "uz"/"ru"/"en"/"zh" don't bleed in.
      const latSource = line
        .replace(HAN_RE, " ")
        .replace(CYR_RE, " ");
      const lat = (latSource.match(LAT_RE) ?? []).map(tidy).filter(Boolean);

      zh = tidy(han[0] ?? "");
      ru = tidy(cyr[0] ?? "");
      uz = lat[0] ?? "";
      en = lat[1] ?? "";
    }

    const missing: Lang[] = [];
    if (!uz) missing.push("uz");
    if (!ru) missing.push("ru");
    if (!en) missing.push("en");
    if (!zh) missing.push("zh");

    if (missing.length > 0) {
      invalid.push({ line: rawLine, missing });
    } else {
      entries.push({ uz, ru, en, zh });
    }
  }

  return { entries, invalid };
}
