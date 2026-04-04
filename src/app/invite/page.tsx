"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Profile } from "@/lib/types";

export default function InvitePage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace("/login");
      return;
    }

    setUser(session.user);

    const profileRes = await supabase
      .from("profiles")
      .select("id,email,display_name,avatar_url,shit_talk,shit_talk_updated_at,invite_code_used,invite_approved_at,is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileRes.error) {
      setNotice({ text: "Could not load your profile.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);

    if (profileRes.data.invite_code_used || profileRes.data.is_admin) {
      router.replace("/");
      return;
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function redeem() {
    if (!code.trim()) return;
    setSaving(true);
    setNotice(null);

    const res = await supabase.rpc("redeem_invite_code", { input_code: code.trim() });
    if (res.error) {
      setNotice({ text: res.error.message, tone: "danger" });
      setSaving(false);
      return;
    }

    setNotice({ text: "Invite code accepted. Welcome!", tone: "success" });
    router.replace("/");
  }

  if (loading) return <Loading label="Checking invite..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />
      {notice ? <div className="mb-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      <section className="glass rounded-2xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Invite Code Required</h1>
        <p className="mb-6 text-sm text-slate-300">
          Enter your invite code to join Super League.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <input
            className="min-w-[240px] rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Invite code"
          />
          <button className="btn btn-primary" disabled={saving} onClick={() => void redeem()} type="button">
            {saving ? "Checking..." : "Enter"}
          </button>
        </div>
      </section>
    </>
  );
}
