import { Copy, Volume2, Star, StarOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import type { Lang, WordEntry } from "@/lib/dictionary";
import { useFavorites } from "@/lib/dictionary";

const langMeta: Record<Lang, { label: string; locale: string; color: string }> = {
  uz: { label: "UZ", locale: "uz-UZ", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  ru: { label: "RU", locale: "ru-RU", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  en: { label: "EN", locale: "en-US", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  zh: { label: "ZH", locale: "zh-CN", color: "bg-rose-500/15 text-rose-300 border-rose-500/30" },
};

function speak(text: string, locale: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    toast.error("Speech synthesis not supported");
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = locale;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied", { description: text });
  } catch {
    toast.error("Copy failed");
  }
}

export function WordCard({ entry }: { entry: WordEntry }) {
  const { isFavorite, toggle } = useFavorites();
  const fav = isFavorite(entry.id);

  return (
    <Card className="group relative overflow-hidden border-border/60 bg-card/60 backdrop-blur transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <CardContent className="p-4 sm:p-5">
        <button
          onClick={() => toggle(entry.id)}
          className="absolute right-3 top-3 text-muted-foreground transition hover:text-amber-400"
          aria-label="Favorite"
        >
          {fav ? <Star className="size-4 fill-amber-400 text-amber-400" /> : <StarOff className="size-4" />}
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(langMeta) as Lang[]).map((lang) => {
            const meta = langMeta[lang];
            const value = entry[lang];
            return (
              <div
                key={lang}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/50 bg-background/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <Badge variant="outline" className={`mb-1.5 ${meta.color}`}>
                    {meta.label}
                  </Badge>
                  <p className="truncate text-base font-medium">{value}</p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-70 transition group-hover:opacity-100">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => speak(value, meta.locale)}
                    aria-label="Pronounce"
                  >
                    <Volume2 className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={() => copy(value)}
                    aria-label="Copy"
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
