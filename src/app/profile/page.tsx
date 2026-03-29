"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import Loading from "@/components/Loading";
import Notice from "@/components/Notice";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";
import type { Profile } from "@/lib/types";

export default function ProfilePage() {
  useAuthResync();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: "neutral" | "success" | "danger" } | null>(null);

  const loadProfile = useCallback(async () => {
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
      .select("id,email,display_name,avatar_url,is_admin")
      .eq("id", session.user.id)
      .single();

    if (profileRes.error) {
      setNotice({ text: "Could not load profile.", tone: "danger" });
      setLoading(false);
      return;
    }

    setProfile(profileRes.data);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (loading) return <Loading label="Loading profile..." />;

  return (
    <>
      <AppHeader user={user} isAdmin={Boolean(profile?.is_admin)} />
      {notice ? <div className="mb-4"><Notice text={notice.text} tone={notice.tone} /></div> : null}

      <section className="glass rounded-2xl p-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {profile?.avatar_url ? (
            <Image
              alt="Profile avatar"
              className="h-20 w-20 rounded-full object-cover"
              src={profile.avatar_url}
              width={80}
              height={80}
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-lg font-semibold">
              {(profile?.display_name || profile?.email || "U").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">Your Profile</h1>
            <p className="text-sm text-slate-300">Your Google profile name and avatar.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-300">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
              value={profile?.email || ""}
              disabled
            />
          </label>

          <label className="text-sm text-slate-300">
            Display name
            <input
              className="mt-1 w-full rounded-lg border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-400"
              value={profile?.display_name || ""}
              disabled
            />
          </label>
        </div>
      </section>
    </>
  );
}
