"use client";

import type { StoryCardSection } from "@/lib/story-card";

type ShareProfileStoryCardProps = {
  avatarUrl: string | null;
  displayName: string;
  allegiance: string | null;
  introLine: string;
  sections: StoryCardSection[];
  variant?: "group" | "knockout";
};

export default function ShareProfileStoryCard({
  avatarUrl,
  displayName,
  allegiance,
  introLine,
  sections,
  variant = "group"
}: ShareProfileStoryCardProps) {
  const isKnockout = variant === "knockout";

  return (
    <div
      className="relative flex h-[1920px] w-[1080px] flex-col overflow-hidden bg-slate-950 text-slate-50"
      style={{
        background:
          "radial-gradient(circle at 15% 10%, rgba(32, 232, 160, 0.22), transparent 26%), radial-gradient(circle at 85% 12%, rgba(255, 93, 80, 0.2), transparent 24%), linear-gradient(180deg, #07111d 0%, #0b1730 52%, #0a1220 100%)"
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "56px 56px"
        }}
      />

      <div className={`relative flex flex-1 flex-col px-18 ${isKnockout ? "pb-12 pt-14" : "pb-16 pt-18"}`}>
        <div className={`flex flex-col items-center text-center ${isKnockout ? "mb-10" : "mb-16"}`}>
          <p className="text-[26px] font-semibold uppercase tracking-[0.45em] text-cyan-100/80">World Cup 2026</p>
          <img
            alt="Super League wordmark"
            className={`object-contain ${isKnockout ? "mt-4 h-24 w-[700px]" : "mt-6 h-28 w-[760px]"}`}
            decoding="sync"
            fetchPriority="high"
            loading="eager"
            src="/superleague-wordmark.png"
          />
        </div>

        <div className={`flex flex-col items-center text-center ${isKnockout ? "mb-8" : "mb-12"}`}>
          <div className={`flex max-w-[920px] items-center ${isKnockout ? "gap-6" : "gap-8"}`}>
            {avatarUrl ? (
              <img
                alt={`${displayName} avatar`}
                className={`shrink-0 rounded-full border-4 border-cyan-200/70 object-cover shadow-[0_24px_80px_rgba(0,0,0,0.35)] ${
                  isKnockout ? "h-32 w-32" : "h-36 w-36"
                }`}
                crossOrigin="anonymous"
                src={avatarUrl}
              />
            ) : (
              <div
                className={`flex shrink-0 items-center justify-center rounded-full border-4 border-cyan-200/70 bg-white/10 font-black uppercase ${
                  isKnockout ? "h-32 w-32 text-5xl" : "h-36 w-36 text-6xl"
                }`}
              >
                {displayName.slice(0, 1)}
              </div>
            )}
            <h2 className={`text-left font-black leading-[0.95] text-white ${isKnockout ? "text-[68px]" : "text-[76px]"}`}>
              {displayName}
            </h2>
          </div>
          <p
            className={`font-semibold uppercase text-cyan-100/78 ${
              isKnockout ? "mt-6 text-[24px] tracking-[0.24em]" : "mt-8 text-[28px] tracking-[0.3em]"
            }`}
          >
            {introLine}
          </p>
        </div>

        <div className={`${isKnockout ? "flex flex-col gap-5" : "flex flex-1 flex-col gap-7"}`}>
          {sections.map((section) => (
            <div
              key={section.title}
              className={`rounded-[32px] border border-white/12 bg-slate-950/45 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-sm ${
                isKnockout ? "px-8 py-6" : "px-10 py-8"
              }`}
            >
              <p
                className={`font-semibold uppercase text-cyan-100/80 ${
                  isKnockout ? "mb-3 text-[24px] tracking-[0.18em]" : "mb-4 text-[30px] tracking-[0.24em]"
                }`}
              >
                {section.title}
              </p>
              <div className={`flex flex-col ${isKnockout ? "gap-2" : "gap-3"}`}>
                {section.items.map((item) => (
                  <p
                    key={item}
                    className={`font-semibold leading-[1.14] text-white ${isKnockout ? "text-[40px]" : "text-[50px]"}`}
                  >
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isKnockout ? (
          <div className="mt-2 flex flex-col items-center gap-2">
            {allegiance ? (
              <p className="text-center text-[32px] font-bold leading-[1.18] text-cyan-100">
                But my allegiance is to {allegiance}! Let&apos;s go!
              </p>
            ) : null}

            <div className="flex items-center justify-center gap-4">
              {allegiance ? <span className="text-[170px] leading-none">{allegiance.split(" ")[0]}</span> : null}
              <img
                alt="Super League"
                className="h-56 w-56 object-contain"
                decoding="sync"
                fetchPriority="high"
                loading="eager"
                src="/super-league-shield-logo.png"
              />
            </div>

            <div className="flex items-center justify-center gap-3 text-[20px] font-semibold uppercase tracking-[0.14em] text-slate-200/85">
              <span>© 2026 Superleague.party. An</span>
              <img
                alt="OWS"
                className="h-12 w-12 rounded-sm object-contain"
                decoding="sync"
                loading="eager"
                src="/ows-nwo-logo.png"
              />
              <span>Joint.</span>
            </div>
          </div>
        ) : (
          <>
            {allegiance ? (
              <p className="mt-10 text-center text-[38px] font-bold leading-[1.18] text-cyan-100">
                But my allegiance is to {allegiance}! Let&apos;s go!
              </p>
            ) : null}

            <div className="mt-12 flex items-center justify-center gap-6">
              {allegiance ? <span className="text-[220px] leading-none">{allegiance.split(" ")[0]}</span> : null}
              <img
                alt="Super League"
                className="h-72 w-72 object-contain"
                decoding="sync"
                fetchPriority="high"
                loading="eager"
                src="/super-league-shield-logo.png"
              />
            </div>

            <div className="mt-10 flex items-center justify-center gap-3 text-[24px] font-semibold uppercase tracking-[0.18em] text-slate-200/85">
              <span>© 2026 Superleague.party. An</span>
              <img
                alt="OWS"
                className="h-14 w-14 rounded-sm object-contain"
                decoding="sync"
                loading="eager"
                src="/ows-nwo-logo.png"
              />
              <span>Joint.</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
