"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand";
import { BuildingArt } from "@/components/building-art";
import { Button, Card, CardContent, Field, Input } from "@/components/ui";

const SHOW_DEMO = process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Sent here because the account was switched off or the hotel was paused while signed in.
  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get("reason");
    if (reason === "paused") setError("This hotel's account is paused. Please contact your software provider to switch it back on.");
    else if (reason === "ended") setError("You have been signed out. Please sign in again, or ask the owner if your account was switched off.");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not sign in");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Cannot reach the server. Please check your internet connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="hidden flex-col justify-between bg-wall px-12 py-12 text-white lg:flex">
        <Logo tone="dark" markClassName="h-9 w-9" wordClassName="text-2xl" />
        <div>
          <BuildingArt className="mb-10" />
          <p className="max-w-sm font-heading text-3xl font-bold leading-tight">Every room and every guest, at a glance.</p>
          <p className="mt-3 max-w-sm text-primary-200">Lit windows have a guest in. Sign in to see your hotel tonight.</p>
        </div>
        <p className="text-sm text-primary-300">Innvela front desk</p>
      </aside>
      <div className="flex items-center justify-center p-4 sm:p-8">
      <Card className="w-full max-w-md">
        <CardContent className="px-6 py-8 sm:px-8">
          <div className="mb-8 text-center">
            <Logo className="mb-5 lg:hidden" markClassName="h-10 w-10" wordClassName="text-3xl" />
            <h1 className="text-3xl font-extrabold tracking-tight text-primary-600">Welcome back</h1>
            <p className="mt-1 text-[15px] text-slate-500">Sign in to manage your hotel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email" htmlFor="email">
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@hotel.com" required autoFocus />
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </Field>

            {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>}

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Sign in
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">Forgot your password? Ask the hotel owner to reset it in Settings → Staff. Owners can ask their software provider.</p>
          <p className="mt-3 text-center text-sm text-slate-500">
            New to Innvela?{" "}
            <Link href="/welcome" className="font-semibold text-primary-600 hover:underline">
              See how it works
            </Link>
          </p>

          {SHOW_DEMO && (
            <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-1 font-semibold text-slate-800">Demo accounts</p>
              <button type="button" className="block hover:underline" onClick={() => { setEmail("admin@hotel.com"); setPassword("admin123"); }}>
                Owner: admin@hotel.com / admin123
              </button>
              <button type="button" className="block hover:underline" onClick={() => { setEmail("staff@hotel.com"); setPassword("staff123"); }}>
                Front desk: staff@hotel.com / staff123
              </button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
