"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Logo } from "@/components/brand";
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
    <div className="flex min-h-screen items-center justify-center bg-slate-200 p-4">
      <div className="w-full max-w-md">
      <div className="border border-b-0 border-primary-700 bg-primary-600 px-3 py-1.5 text-[13px] font-bold text-white">Innvela: Sign in</div>
      <Card className="w-full">
        <CardContent className="px-6 py-8 sm:px-8">
          <div className="mb-5 text-center">
            <Logo className="mb-4" markClassName="h-9 w-9" wordClassName="text-2xl" />
            <h1 className="text-lg font-bold text-slate-900">Sign in to your hotel</h1>
            <p className="text-[13px] text-slate-600">Use the email and password your hotel gave you.</p>
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
