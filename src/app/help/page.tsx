"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import { supabase } from "@/lib/supabase-browser";
import { useAuthResync } from "@/lib/useAuthResync";

type BrowserOption = "safari" | "chrome";

const browserImages: Record<
  BrowserOption,
  { src: string; alt: string; label: string }
> = {
  safari: {
    src: "/help-add-to-home-screen.png",
    alt: "Instructions for adding Super League to your iPhone home screen in Safari",
    label: "Safari"
  },
  chrome: {
    src: "/help-add-to-home-screen-chrome.png",
    alt: "Instructions for adding Super League to your iPhone home screen in Chrome",
    label: "Chrome"
  }
};

export default function HelpPage() {
  useAuthResync();
  const [browser, setBrowser] = useState<BrowserOption>("safari");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const selected = browserImages[browser];

  useEffect(() => {
    async function loadHeaderState() {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);

      if (!session?.user) {
        setIsAdmin(false);
        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", session.user.id)
        .maybeSingle();

      setIsAdmin(Boolean(profileRes.data?.is_admin));
    }

    void loadHeaderState();
  }, []);

  return (
    <>
      <AppHeader user={user} isAdmin={isAdmin} />
      <main className="mx-auto flex min-h-screen max-w-6xl items-start justify-center px-3 py-1 sm:px-6 sm:py-4">
        <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-3 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-100 sm:text-2xl">Add Super League to Your Home Screen</h1>
              <p className="mt-1 text-sm text-slate-300">Choose the browser you use on iPhone.</p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/50 p-1">
              {(Object.entries(browserImages) as Array<[BrowserOption, (typeof browserImages)[BrowserOption]]>).map(
                ([key, value]) => {
                  const active = browser === key;
                  return (
                    <button
                      key={key}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        active
                          ? "bg-cyan-300/20 text-cyan-100 shadow-[0_10px_24px_rgba(34,211,238,0.14)]"
                          : "text-slate-300 hover:bg-white/5 hover:text-slate-100"
                      }`}
                      onClick={() => setBrowser(key)}
                      type="button"
                    >
                      {value.label}
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
            <Image
              alt={selected.alt}
              className="h-auto w-full"
              src={selected.src}
              width={1055}
              height={1491}
              priority
            />
          </div>
        </div>
      </main>
    </>
  );
}
