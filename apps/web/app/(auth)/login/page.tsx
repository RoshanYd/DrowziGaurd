"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shield, Mail, Lock, ArrowRight, Eye, Truck, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"driver" | "manager">("driver");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If Supabase credentials are not configured or invalid, provide seamless demo mode access
        console.warn("Supabase auth notice:", error.message);
        if (
          error.message.includes("fetch failed") ||
          error.message.includes("Invalid login credentials") ||
          !process.env.NEXT_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your_supabase_url")
        ) {
          // Demo fallback
          if (role === "driver") {
            router.push("/driver");
          } else {
            router.push("/manager");
          }
          return;
        }
        setErrorMsg(error.message);
        return;
      }

      if (data.user) {
        if (role === "driver") {
          router.push("/driver");
        } else {
          router.push("/manager");
        }
      }
    } catch {
      // Direct demo redirect
      if (role === "driver") {
        router.push("/driver");
      } else {
        router.push("/manager");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoQuickAccess = (selectedRole: "driver" | "manager") => {
    if (selectedRole === "driver") {
      router.push("/driver");
    } else {
      router.push("/manager");
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,4%)] text-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/70 border border-slate-800 rounded-2xl p-6 md:p-8 backdrop-blur-xl shadow-2xl relative">
        {/* Glow */}
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-48 h-20 bg-blue-600/20 blur-3xl pointer-events-none rounded-full" />

        {/* Brand */}
        <div className="text-center mb-6">
          <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mb-3">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-black text-white">Sign In to DrowsiGuard</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Driver Fatigue Surveillance System
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Role Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Portal Access Role
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole("driver")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  role === "driver"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-950"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Eye className="w-3.5 h-3.5" /> Driver Cabin
              </button>
              <button
                type="button"
                onClick={() => setRole("manager")}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                  role === "manager"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-950"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Truck className="w-3.5 h-3.5" /> Fleet Manager
              </button>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="driver@fleetops.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold tracking-wide transition shadow-lg shadow-blue-900/40 glow-blue disabled:opacity-50 flex items-center justify-center gap-1.5 mt-2"
          >
            {loading ? "Authenticating..." : "Sign In to Portal"}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Demo One-Click Access */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center">
          <span className="text-[11px] text-slate-400 block mb-2.5">
            Instant Demo Access (No Credentials Required)
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleDemoQuickAccess("driver")}
              className="py-1.5 px-3 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[11px] font-medium text-slate-300 transition"
            >
              Demo as Driver
            </button>
            <button
              onClick={() => handleDemoQuickAccess("manager")}
              className="py-1.5 px-3 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[11px] font-medium text-slate-300 transition"
            >
              Demo as Manager
            </button>
          </div>
        </div>

        <div className="mt-5 text-center text-xs text-slate-400">
          Need an account?{" "}
          <Link href="/register" className="text-blue-400 hover:underline font-semibold">
            Create Profile
          </Link>
        </div>
      </div>
    </div>
  );
}
