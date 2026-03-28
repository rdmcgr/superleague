"use client";

import Link from "next/link";
import AppHeader from "@/components/AppHeader";

export default function PaymentPage() {
  return (
    <>
      <AppHeader user={null} isAdmin={false} />
      <section className="glass rounded-2xl p-6">
        <h1 className="mb-2 text-2xl font-bold">Entry Fee Payment</h1>
        <p className="mb-6 text-sm text-slate-300">
          Entry is $40. Use the Venmo links below to pay.
        </p>

        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-300">Venmo Profile Link</p>
            <a
              className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
              href="https://venmo.com/u/rory-mcgrath"
              target="_blank"
              rel="noreferrer"
            >
              https://venmo.com/u/rory-mcgrath
            </a>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-300">Prefilled Payment Link</p>
            <a
              className="text-sm font-semibold text-cyan-200 hover:text-cyan-100"
              href="https://venmo.com/?txn=pay&recipients=rory-mcgrath&amount=40&note=Super%20League%20Entry"
              target="_blank"
              rel="noreferrer"
            >
              Pay $40 via Venmo
            </a>
            <p className="mt-2 text-xs text-slate-400">
              This prefilled link may open the Venmo app on mobile.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Link className="text-sm font-semibold text-slate-200 hover:text-white" href="/">
            Back to Picks
          </Link>
        </div>
      </section>
    </>
  );
}
