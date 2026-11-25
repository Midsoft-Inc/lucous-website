"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Switch } from "@/components/ui/switch";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { AUTH_ROLES, ROLE_CONFIG, setSession, type AuthRole } from "@/lib/auth";

const API_URL = "/api";

// Admin is never shown here. Admins use the /auth/admin/login address.
const VISIBLE_ROLES = AUTH_ROLES.filter((role) => role !== "admin");

type Step = "login" | "verify-email" | "role" | "signup-role";

// Each step now has its own address (the screens look exactly the same):
//   /auth/login  /auth/select-role  /auth/signup  /auth/verify-email
export type AuthView = "login" | "role" | "signup" | "verify-email";

const TICKET_KEY = "lucous_role_ticket"; // { token, email, remember, at } - this tab only
const VERIFY_KEY = "lucous_verify_email";
const NOTICE_KEY = "lucous_auth_notice";
const TICKET_MAX_AGE_MS = 10 * 60 * 1000;

function readTicket(): { token: string; email: string; remember: boolean; at: number } | null {
  try {
    const raw = sessionStorage.getItem(TICKET_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function RoleCards({
  onPick,
  hrefFor,
  disabled,
}: {
  onPick?: (role: AuthRole) => void;
  hrefFor?: (role: AuthRole) => string;
  disabled?: boolean;
}) {
  const cardClass =
    "group flex w-full items-start gap-3.5 rounded-xl bg-card p-4 text-left shadow-soft ring-1 ring-foreground/10 transition-shadow hover:shadow-lift hover:ring-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60";

  return (
    <div className="grid gap-3 text-left sm:grid-cols-2">
      {VISIBLE_ROLES.map((role) => {
        const { label, tagline, icon: Icon } = ROLE_CONFIG[role];
        const inner = (
          <>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1 font-heading text-sm font-semibold text-card-foreground">
                {label}
                <ArrowUpRight
                  className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{tagline}</span>
            </span>
          </>
        );

        return hrefFor ? (
          <Link key={role} href={hrefFor(role)} className={cardClass}>
            {inner}
          </Link>
        ) : (
          <button
            key={role}
            type="button"
            disabled={disabled}
            onClick={() => onPick?.(role)}
            className={cardClass}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}

// First screen: sign in. Second screen (after the password is accepted): choose your
// role, which the server checks (5 wrong tries = 15 minute block).
export function UnifiedAuth({ view = "login" }: { view?: AuthView }) {
  const router = useRouter();

  const step: Step = view === "signup" ? "signup-role" : view;
  const [ready, setReady] = React.useState(view === "login" || view === "signup");
  const [remember, setRemember] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [verifyEmail, setVerifyEmail] = React.useState("");
  const [pendingToken, setPendingToken] = React.useState("");

  React.useEffect(() => {
    if (view === "login") {
      const saved = sessionStorage.getItem(NOTICE_KEY);
      if (saved) {
        setNotice(saved);
        sessionStorage.removeItem(NOTICE_KEY);
      }
      return;
    }

    if (view === "role") {
      const ticket = readTicket();
      if (!ticket || Date.now() - ticket.at > TICKET_MAX_AGE_MS) {
        sessionStorage.removeItem(TICKET_KEY);
        router.replace("/auth/login");
        return;
      }
      setPendingToken(ticket.token);
      setRemember(Boolean(ticket.remember));
      setReady(true);
      return;
    }

    if (view === "verify-email") {
      const saved = sessionStorage.getItem(VERIFY_KEY);
      if (!saved) {
        router.replace("/auth/login");
        return;
      }
      setVerifyEmail(saved);
      setReady(true);
    }
  }, [view, router]);

  async function onLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("identifier") ?? "").trim();
    const password = String(fd.get("password") ?? "");

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, roleStep: true }),
      });
      const data = await response.json();

      if (data.needsVerification) {
        sessionStorage.setItem(VERIFY_KEY, email.toLowerCase());
        router.push("/auth/verify-email");
        return;
      }
      if (!response.ok || !data.success || !data.pendingToken) {
        setError(data.message || "Login failed.");
        return;
      }

      sessionStorage.setItem(
        TICKET_KEY,
        JSON.stringify({ token: data.pendingToken, email: email.toLowerCase(), remember, at: Date.now() })
      );
      router.push("/auth/select-role");
    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to LUCOUS server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  async function onPickRole(role: AuthRole) {
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/verify-role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, role: role.toUpperCase() }),
      });
      const data = await response.json();

      if (data.code === "ROLE_STEP_EXPIRED") {
        sessionStorage.removeItem(TICKET_KEY);
        sessionStorage.setItem(NOTICE_KEY, data.message || "Your sign-in step expired. Please log in again.");
        router.replace("/auth/login");
        return;
      }
      if (!response.ok || !data.success) {
        setError(data.message || "Could not verify your role.");
        return;
      }

      const user = data.user;
      const sessionRole = String(user.role).toLowerCase() as AuthRole;
      const storage = remember ? localStorage : sessionStorage;

      storage.setItem("lucous_token", data.token);
      storage.setItem("lucous_user", JSON.stringify(user));
      sessionStorage.removeItem(TICKET_KEY);

      setSession({
        role: sessionRole,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
      });

      router.replace(ROLE_CONFIG[sessionRole].dashboardPath);
    } catch (err) {
      console.error("Role verification error:", err);
      setError("Unable to connect to LUCOUS server. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  }

  // Nothing is drawn until the saved step is read (no flash of another screen).
  if (!ready) return null;

  if (step === "verify-email") {
    return (
      <Card className="mx-auto w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-lg">Verify your email</CardTitle>
          <CardDescription>Confirm your email address to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <VerifyEmailForm
            email={verifyEmail}
            onVerified={() => {
              sessionStorage.removeItem(VERIFY_KEY);
              sessionStorage.setItem(NOTICE_KEY, "Email verified. Please log in.");
              router.replace("/auth/login");
            }}
          />
        </CardContent>
      </Card>
    );
  }

  if (step === "role") {
    return (
      <div className="w-full text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Welcome to LUCOUS
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Choose your role to continue
        </p>

        <div className="mt-8">
          <RoleCards onPick={onPickRole} disabled={loading} />
        </div>

        {error ? <p className="mt-4 text-sm font-normal text-destructive">{error}</p> : null}

        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(TICKET_KEY);
            router.push("/auth/login");
          }}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Use a different account
        </button>
      </div>
    );
  }

  if (step === "signup-role") {
    return (
      <div className="w-full text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          Choose your role to sign up
        </p>

        <div className="mt-8">
          <RoleCards hrefFor={(role) => `/auth/${role}/signup`} />
        </div>

        <button
          type="button"
          onClick={() => router.push("/auth/login")}
          className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to log in
        </button>
      </div>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-lg">Log in</CardTitle>
        <CardDescription>Sign in to continue to LUCOUS</CardDescription>
      </CardHeader>

      <CardContent>
        <form className="grid gap-3.5" onSubmit={onLogin}>
          <label className="grid gap-1.5 text-sm font-medium">
            Email
            <Input
              required
              name="identifier"
              type="text"
              autoComplete="username"
              placeholder="Enter your email"
              className="h-10"
              disabled={loading}
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            Password
            <PasswordInput
              required
              name="password"
              minLength={8}
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-10"
              disabled={loading}
            />
          </label>

          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch
                checked={remember}
                onCheckedChange={setRemember}
                aria-label="Remember me"
                disabled={loading}
              />
              Remember me
            </span>

            <Link
              href="/auth/student/forgot-password"
              className="rounded text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Forgot password?
            </Link>
          </div>

          {notice ? <p className="text-sm font-normal text-primary">{notice}</p> : null}
          {error ? <p className="text-sm font-normal text-destructive">{error}</p> : null}

          <Button type="submit" className="mt-1 h-10 w-full text-sm" disabled={loading}>
            {loading ? "Checking..." : "Continue"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <button
            type="button"
            onClick={() => router.push("/auth/signup")}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Sign up
          </button>
        </p>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" aria-hidden />
          Next, you&apos;ll confirm your role.
        </p>
      </CardContent>
    </Card>
  );
}