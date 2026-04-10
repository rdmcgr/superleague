"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-browser";
import Notice from "@/components/Notice";
import { useAuthResync } from "@/lib/useAuthResync";

export default function LoginPage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = useCallback(async () => {
    const {
      data: { session }
    } = await supabase.auth.getSession();
    if (session) {
      router.replace("/");
    }
  }, [router]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  async function googleSignIn() {
    setLoading(true);
    setError(null);

    const redirectTo = `${window.location.origin}/`;
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo }
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto mt-2 max-w-md">
      <div className="glass rounded-2xl p-7">
        <div className="mb-4 flex justify-center">
          <Image
            alt="Super League logo"
            className="h-40 w-40 rounded-2xl object-cover shadow-[0_16px_36px_rgba(0,0,0,0.35)]"
            src="/super-league-shield-logo.png"
            width={160}
            height={160}
            priority
          />
        </div>
        <p className="mb-2 text-xs uppercase tracking-[0.22em] text-cyan-200/80">World Cup 2026</p>
        <p className="mb-6 text-sm text-slate-300">
          Join the{" "}
          <Image
            alt="Super League wordmark"
            className="mx-1 inline-block h-auto w-32 align-middle object-contain"
            src="/superleague-wordmark.png"
            width={128}
            height={32}
          />{" "}
          today! Sign in with your Google account, make your picks for the 2026 World Cup, and they will save. Come
          back anytime before the tourney to change your picks.
        </p>

        {error ? (
          <div className="mb-4">
            <Notice text={error} tone="danger" />
          </div>
        ) : null}

        <button className="btn btn-primary w-full" disabled={loading} onClick={() => void googleSignIn()} type="button">
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>

      <section className="glass mt-6 rounded-2xl p-5">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="section-title">How It Works</h2>
          <span className="chip">Super League Rules</span>
        </div>
        <ul className="space-y-2 text-sm text-slate-200/90">
          <li>Pick one team per question. Each team can be used only once per stage.</li>
          <li>Stages open one at a time. Group Stage picks due by June 8th, Knockout Stage picks due by June 28th.</li>
          <li>Picks lock and become visible to all participants after the due date.</li>
          <li>Correct answer point value varies by quesiton.</li>
          <li>One entry per person -- $40 fee to enter.</li>
        </ul>
      </section>
    </div>
  );
}
