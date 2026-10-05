"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { DEPARTMENTS } from "@/lib/departments";

type AuthMode = "login" | "register";

function getAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return "Something went wrong. Please try again.";
}

export function AuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const isRegister = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data } = await authClient.getSession();
        if (active && data?.user) router.replace("/dashboard");
      } catch {
        // An unavailable session check should leave the form usable.
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isRegister && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        result = await authClient.signUp.email({ name: name.trim(), email, password });
      } else {
        const demoResponse = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (demoResponse.ok) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
        if (demoResponse.status !== 404) {
          const data = await demoResponse.json().catch(() => null);
          setError(data?.error || "Invalid credentials.");
          return;
        }
        result = await authClient.signIn.email({ email, password });
      }

      if (result.error) {
        setError(getAuthErrorMessage(result.error));
        return;
      }

      if (isRegister) {
        const registration = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), department, role: role.trim() }),
        });
        if (!registration.ok) {
          const data = await registration.json().catch(() => null);
          setError(data?.error || "Your account was created, but the employee profile could not be completed.");
          return;
        }
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (reason) {
      setError(getAuthErrorMessage(reason));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page mesh-bg min-h-screen px-5 py-8 sm:px-8 lg:px-12">
      <div className="auth-layout mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1fr_460px] lg:gap-20">
        <section className="auth-intro fade-up hidden lg:block">
          <Link href="/" className="mb-16 inline-flex items-center gap-3" aria-label="OfficeFlow AI home">
            <span className="brand-gradient grid size-11 place-items-center rounded-2xl text-lg font-black text-white shadow-lg shadow-blue-200/70">O</span>
            <span className="text-xl font-black tracking-tight text-slate-950">OfficeFlow <span className="brand-text">AI</span></span>
          </Link>
          <p className="mb-5 text-sm font-bold uppercase tracking-[.2em] text-blue-600">Intelligent workplace support</p>
          <h1 className="max-w-xl text-5xl font-black leading-[1.05] tracking-[-.04em] text-slate-950 xl:text-6xl">
            Your intelligent workplace helpdesk.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Report what is getting in the way. OfficeFlow AI understands the issue and routes it to the right team.
          </p>
          <div className="auth-signal mt-14 max-w-md rounded-3xl border border-white/80 bg-white/60 p-5 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">✦</span>
              <div><p className="text-sm font-bold text-slate-900">One calm place for every request</p><p className="mt-1 text-xs text-slate-500">Built for employees and the teams behind them.</p></div>
            </div>
          </div>
        </section>

        <section className="auth-card fade-up rounded-[2rem] border border-white/90 bg-white/90 p-6 shadow-[0_24px_80px_rgba(30,41,59,.13)] backdrop-blur-xl sm:p-9">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="OfficeFlow AI home">
              <span className="brand-gradient grid size-10 place-items-center rounded-xl text-base font-black text-white shadow-md shadow-blue-200">O</span>
              <span className="text-lg font-black tracking-tight text-slate-950">OfficeFlow <span className="brand-text">AI</span></span>
            </Link>
          </div>
          <div className="mb-8">
            <p className="text-sm font-bold text-blue-600">{isRegister ? "Get started" : "Welcome back"}</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{isRegister ? "Create your OfficeFlow account" : "Sign in to your workspace"}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">{isRegister ? "Join your workplace support hub in a few seconds." : "Pick up where you left off with your workplace support hub."}</p>
          </div>

          {checkingSession ? (
            <div className="flex min-h-56 items-center justify-center text-sm font-semibold text-slate-500" role="status">
              <span className="mr-3 size-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />Checking your session...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {isRegister && <Field id="name" label="Full name" type="text" value={name} onChange={setName} autoComplete="name" placeholder="Alex Morgan" required />}
              <Field id="email" label="Work email" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@company.com" required />
              <Field id="password" label="Password" type="password" value={password} onChange={setPassword} autoComplete={isRegister ? "new-password" : "current-password"} placeholder="Enter your password" required minLength={8} />
              {isRegister && <Field id="confirm-password" label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" placeholder="Re-enter your password" required minLength={8} />}
              {isRegister && <div><label htmlFor="department" className="mb-2 block text-sm font-bold text-slate-800">Department</label><select id="department" name="department" value={department} onChange={(event) => setDepartment(event.target.value)} required className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"><option value="" disabled>Select your department</option>{DEPARTMENTS.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>}
              {isRegister && <Field id="role" label="Job role" type="text" value={role} onChange={setRole} autoComplete="organization-title" placeholder="Developer" required />}
              {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium leading-5 text-rose-700" role="alert">{error}</p>}
              <button type="submit" disabled={loading} className="brand-gradient flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold text-white shadow-lg shadow-blue-200 transition hover:-translate-y-0.5 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0">
                {loading && <span className="mr-2 size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
                {loading ? (isRegister ? "Creating account..." : "Signing in...") : (isRegister ? "Create account" : "Sign in")}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-sm text-slate-500">
            {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
            <Link href={isRegister ? "/login" : "/register"} className="font-bold text-blue-600 transition hover:text-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-200">{isRegister ? "Sign in" : "Create one"}</Link>
          </p>
        </section>
      </div>
    </main>
  );
}

function Field({ id, label, type, value, onChange, autoComplete, placeholder, required, minLength }: { id: string; label: string; type: string; value: string; onChange: (value: string) => void; autoComplete: string; placeholder: string; required?: boolean; minLength?: number }) {
  return <div><label htmlFor={id} className="mb-2 block text-sm font-bold text-slate-800">{label}</label><input id={id} name={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} placeholder={placeholder} required={required} minLength={minLength} className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100" /></div>;
}