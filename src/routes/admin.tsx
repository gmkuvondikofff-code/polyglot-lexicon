import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Shield,
  ArrowLeft,
  LogOut,
  Sparkles,
  Loader2,
  Trash2,
  Search,
  CheckCircle2,
  Mail,
  Lock,
  KeyRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { authConfig, isAuthenticated, setAuthenticated } from "@/lib/auth-config";
import {
  dictionaryActions,
  parseBulkText,
  useDictionary,
  type WordEntry,
} from "@/lib/dictionary";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  if (!authed) return <LoginFlow onSuccess={() => setAuthed(true)} />;
  return <Dashboard onLogout={() => setAuthed(false)} />;
}

/* ---------------- Login + 2FA ---------------- */

function LoginFlow({ onSuccess }: { onSuccess: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  function submitStep1(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      if (email.trim().toLowerCase() === authConfig.email && password === authConfig.password) {
        toast.success("Credentials accepted", { description: "Verification code sent." });
        setStep(2);
      } else {
        toast.error("Invalid email or password");
      }
    }, 600);
  }

  function submitStep2(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const ok = authConfig.acceptAnyCode || authConfig.validCodes.includes(code);
      if (ok) {
        setAuthenticated(true);
        toast.success("Welcome back, admin");
        onSuccess();
      } else {
        toast.error("Incorrect verification code");
        setCode("");
      }
    }, 600);
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        style={{
          background:
            "radial-gradient(50% 40% at 50% 20%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(40% 30% at 80% 80%, rgba(244,63,94,0.12), transparent 60%)",
        }}
      />

      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Back to dictionary
        </Link>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
              <Shield className="size-5 text-primary" />
            </div>
            <CardTitle>{step === 1 ? "Admin sign in" : "Two-factor authentication"}</CardTitle>
            <CardDescription>
              {step === 1
                ? "Enter your credentials to continue."
                : "Enter the 6-digit verification code we just sent."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={submitStep1} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="username"
                      placeholder="admin@dictionary.app"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Continue
                </Button>
                <p className="rounded-md border border-dashed border-border/60 bg-background/40 p-2 text-center text-[11px] text-muted-foreground">
                  Demo: <code>{authConfig.email}</code> / <code>{authConfig.password}</code> · code{" "}
                  <code>{authConfig.validCodes[0]}</code>
                </p>
              </form>
            ) : (
              <form onSubmit={submitStep2} className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <KeyRound className="size-6 text-muted-foreground" />
                  <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Verify
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setCode("");
                  }}
                  className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                >
                  ← Use a different account
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const entries = useDictionary();

  function logout() {
    setAuthenticated(false);
    toast.success("Signed out");
    onLogout();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <Shield className="size-4 text-primary" />
            Admin Console
            <Badge variant="outline" className="ml-2">
              {entries.length} entries
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="sm">
                View site
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2">
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Tabs defaultValue="manage" className="space-y-6">
          <TabsList>
            <TabsTrigger value="manage">Manage entries</TabsTrigger>
            <TabsTrigger value="import">AI bulk import</TabsTrigger>
          </TabsList>

          <TabsContent value="manage">
            <ManageEntries />
          </TabsContent>

          <TabsContent value="import">
            <BulkImport />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Bulk Import ---------------- */

function BulkImport() {
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<Omit<WordEntry, "id" | "createdAt">[] | null>(null);

  function analyze() {
    setParsing(true);
    setPreview(null);
    setTimeout(() => {
      const parsed = parseBulkText(text);
      setPreview(parsed);
      setParsing(false);
      if (parsed.length === 0) {
        toast.error("No valid entries detected", {
          description: "Use one entry per line with 4 columns (uz | ru | en | zh).",
        });
      } else {
        toast.success(`AI parsed ${parsed.length} entries`);
      }
    }, 900);
  }

  function commit() {
    if (!preview || preview.length === 0) return;
    dictionaryActions.addMany(preview);
    toast.success(`Imported ${preview.length} entries`);
    setPreview(null);
    setText("");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" /> AI bulk import
          </CardTitle>
          <CardDescription>
            Paste raw text. Our parser extracts 4-language entries. Supports{" "}
            <code>uz | ru | en | zh</code>, comma-separated, or labeled formats.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Salom | Привет | Hello | 你好"
            className="min-h-[260px] font-mono text-sm"
          />
          <Button onClick={analyze} disabled={parsing || !text.trim()} className="w-full gap-2">
            {parsing ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {parsing ? "Analyzing with AI…" : "Analyze and import"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/60">
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Confirm extracted entries before committing them to the dictionary.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!preview ? (
            <div className="grid h-[260px] place-items-center rounded-md border border-dashed border-border/60 text-sm text-muted-foreground">
              {parsing ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" /> Running AI extraction…
                </div>
              ) : (
                "Preview will appear here"
              )}
            </div>
          ) : (
            <>
              <div className="max-h-[260px] overflow-auto rounded-md border border-border/60">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>UZ</TableHead>
                      <TableHead>RU</TableHead>
                      <TableHead>EN</TableHead>
                      <TableHead>ZH</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell>{e.uz}</TableCell>
                        <TableCell>{e.ru}</TableCell>
                        <TableCell>{e.en}</TableCell>
                        <TableCell>{e.zh}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={commit} className="flex-1 gap-2">
                  <CheckCircle2 className="size-4" /> Commit {preview.length} entries
                </Button>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Discard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Manage Entries ---------------- */

function ManageEntries() {
  const entries = useDictionary();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.uz.toLowerCase().includes(q) ||
        e.ru.toLowerCase().includes(q) ||
        e.en.toLowerCase().includes(q) ||
        e.zh.toLowerCase().includes(q),
    );
  }, [entries, query]);

  const allChecked = filtered.length > 0 && filtered.every((e) => selected.has(e.id));
  const someChecked = filtered.some((e) => selected.has(e.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) filtered.forEach((e) => next.delete(e.id));
      else filtered.forEach((e) => next.add(e.id));
      return next;
    });
  }
  function deleteOne(id: string) {
    dictionaryActions.remove(id);
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    toast.success("Entry deleted");
  }
  function deleteSelected() {
    const ids = Array.from(selected);
    dictionaryActions.removeMany(ids);
    setSelected(new Set());
    toast.success(`Deleted ${ids.length} entries`);
  }

  return (
    <Card className="border-border/60 bg-card/60">
      <CardHeader>
        <CardTitle>Dictionary entries</CardTitle>
        <CardDescription>Search, select, and remove entries in bulk.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter entries…"
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{selected.size} selected</Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={selected.size === 0} className="gap-2">
                  <Trash2 className="size-4" /> Delete selected
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} entries?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes the selected entries from the dictionary.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={deleteSelected}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-border/60">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>UZ</TableHead>
                <TableHead>RU</TableHead>
                <TableHead>EN</TableHead>
                <TableHead>ZH</TableHead>
                <TableHead className="w-16 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No entries match your search.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => (
                  <TableRow key={e.id} data-state={selected.has(e.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggle(e.id)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{e.uz}</TableCell>
                    <TableCell>{e.ru}</TableCell>
                    <TableCell>{e.en}</TableCell>
                    <TableCell>{e.zh}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:text-destructive"
                        onClick={() => deleteOne(e.id)}
                        aria-label="Delete entry"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
