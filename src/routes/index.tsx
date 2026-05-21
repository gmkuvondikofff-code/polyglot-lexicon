import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, BookOpen, Sparkles, Shield, Heart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WordCard } from "@/components/WordCard";
import { useDictionary, useFavorites, type Lang } from "@/lib/dictionary";

export const Route = createFileRoute("/")({
  component: Index,
});

const LANGS: { key: "all" | Lang; label: string }[] = [
  { key: "all", label: "All" },
  { key: "uz", label: "UZ" },
  { key: "ru", label: "RU" },
  { key: "en", label: "EN" },
  { key: "zh", label: "ZH" },
];

function Index() {
  const entries = useDictionary();
  const { favorites } = useFavorites();
  const [query, setQuery] = useState("");
  const [lang, setLang] = useState<"all" | Lang>("all");
  const [onlyFavs, setOnlyFavs] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (onlyFavs && !favorites.includes(e.id)) return false;
      if (!q) return true;
      if (lang === "all") {
        return (
          e.uz.toLowerCase().includes(q) ||
          e.ru.toLowerCase().includes(q) ||
          e.en.toLowerCase().includes(q) ||
          e.zh.toLowerCase().includes(q)
        );
      }
      return e[lang].toLowerCase().includes(q);
    });
  }, [entries, query, lang, onlyFavs, favorites]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-500/30 via-sky-500/30 to-rose-500/30 ring-1 ring-border">
              <BookOpen className="size-4" />
            </div>
            <span className="text-base">Polyglot</span>
            <span className="hidden text-xs text-muted-foreground sm:inline">· UZ · RU · EN · ZH</span>
          </Link>
          <Link to="/admin">
            <Button variant="ghost" size="sm" className="gap-2">
              <Shield className="size-4" />
              Admin
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero / Search */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-50"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(16,185,129,0.15), transparent 60%), radial-gradient(40% 40% at 80% 30%, rgba(244,63,94,0.12), transparent 60%), radial-gradient(40% 40% at 20% 30%, rgba(56,189,248,0.12), transparent 60%)",
          }}
        />
        <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:py-16">
          <Badge variant="outline" className="mb-4 gap-1.5 border-border/70 bg-card/50">
            <Sparkles className="size-3" /> Four languages, one search
          </Badge>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Search any word in <span className="text-emerald-400">Uzbek</span>,{" "}
            <span className="text-sky-400">Russian</span>, <span className="text-amber-400">English</span>, or{" "}
            <span className="text-rose-400">Chinese</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            Instant cross-language lookup with pronunciation, copy, and favorites.
          </p>

          <div className="relative mt-8">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search any word… (e.g. salom, книга, water, 水)"
              className="h-14 rounded-2xl border-border/70 bg-card/60 pl-12 pr-4 text-base shadow-lg backdrop-blur"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {LANGS.map((l) => (
              <button
                key={l.key}
                onClick={() => setLang(l.key)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  lang === l.key
                    ? "border-primary/60 bg-primary text-primary-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={() => setOnlyFavs((v) => !v)}
              className={`ml-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                onlyFavs
                  ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                  : "border-border bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <Heart className={`size-3 ${onlyFavs ? "fill-amber-400 text-amber-400" : ""}`} />
              Favorites
            </button>
          </div>
        </div>
      </section>

      {/* Results */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {results.length} {results.length === 1 ? "entry" : "entries"}
            {query && <> for “{query}”</>}
          </p>
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center">
            <p className="text-muted-foreground">No matches. Try a different word or language.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {results.map((e) => (
              <WordCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-8 text-center text-xs text-muted-foreground">
        Polyglot · A multilingual mini-dictionary
      </footer>
    </div>
  );
}
