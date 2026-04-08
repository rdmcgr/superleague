"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";

type Props = {
  user: User | null;
  isAdmin: boolean;
};

const links = [
  { href: "/", label: "Picks" },
  { href: "/standings", label: "Standings" },
  { href: "/shit-talk", label: "Shit Talk" },
  { href: "/side-bets", label: "Side Bets" }
];

export default function AppHeader({ user, isAdmin }: Props) {
  const pathname = usePathname();
  const avatarUrl =
    (user?.user_metadata && (user.user_metadata.avatar_url || user.user_metadata.picture)) ||
    (user?.identities &&
      user.identities[0]?.identity_data &&
      (user.identities[0].identity_data.avatar_url || user.identities[0].identity_data.picture)) ||
    null;

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <header className="glass mb-5 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            alt="Super League logo"
            className="h-24 w-24 rounded-3xl object-cover shadow-[0_18px_40px_rgba(0,0,0,0.35)]"
            src="/super-league-shield-logo.png"
            width={96}
            height={96}
            priority
          />
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-cyan-200/80">World Cup 2026</p>
            <h1 className="text-xl font-bold">Super League</h1>
          </div>
        </div>

        <nav className="flex flex-wrap gap-2">
          {links.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-white/20 text-white ring-2 ring-red-400/80"
                    : "bg-white/10 text-slate-200 hover:bg-white/15"
                }`}
                key={link.href}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                pathname === "/admin"
                  ? "bg-white/20 text-white ring-2 ring-red-400/80"
                  : "bg-white/10 text-slate-200 hover:bg-white/15"
              }`}
              href="/admin"
            >
              Admin
            </Link>
          ) : null}
        </nav>

        {user ? (
          <div className="flex items-center gap-2 text-sm">
            <Link className="rounded-full" href="/profile">
              {avatarUrl ? (
                <Image
                  alt="User avatar"
                  className="h-8 w-8 rounded-full object-cover"
                  src={avatarUrl}
                  width={32}
                  height={32}
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
                  {(user.email || "U").slice(0, 1).toUpperCase()}
                </span>
              )}
            </Link>
            <Link className="chip hover:text-white" href="/profile">
              {user.email}
            </Link>
            <button className="btn btn-secondary" onClick={signOut} type="button">
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
