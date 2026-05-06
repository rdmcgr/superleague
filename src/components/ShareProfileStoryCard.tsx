"use client";

type ShareProfileStoryCardProps = {
  avatarUrl: string | null;
  displayName: string;
  shitTalk: string | null;
  sections: ShareSection[];
};

export type ShareSection = {
  title: string;
  items: string[];
};

export default function ShareProfileStoryCard({
  avatarUrl,
  displayName,
  shitTalk,
  sections
}: ShareProfileStoryCardProps) {
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

      <div className="relative flex flex-1 flex-col px-18 pb-16 pt-18">
        <div className="mb-16 flex flex-col items-center text-center">
          <img
            alt="Super League"
            className="mb-6 h-56 w-56 object-contain"
            decoding="sync"
            fetchPriority="high"
            loading="eager"
            src="/super-league-shield-logo.png"
          />
          <p className="text-[26px] font-semibold uppercase tracking-[0.45em] text-cyan-100/80">World Cup 2026</p>
          <img
            alt="Super League wordmark"
            className="mt-6 h-28 w-[760px] object-contain"
            decoding="sync"
            fetchPriority="high"
            loading="eager"
            src="/superleague-wordmark.png"
          />
        </div>

        <div className="mb-12 flex flex-col items-center text-center">
          {avatarUrl ? (
            <img
              alt={`${displayName} avatar`}
              className="mb-6 h-42 w-42 rounded-full border-4 border-cyan-200/70 object-cover shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
              crossOrigin="anonymous"
              src={avatarUrl}
            />
          ) : (
            <div className="mb-6 flex h-42 w-42 items-center justify-center rounded-full border-4 border-cyan-200/70 bg-white/10 text-7xl font-black uppercase">
              {displayName.slice(0, 1)}
            </div>
          )}
          <h2 className="max-w-[880px] text-[76px] font-black leading-[0.95] text-white">{displayName}</h2>
        </div>

        {shitTalk ? (
          <div className="mb-12 rounded-[36px] border border-white/14 bg-white/8 px-10 py-9 shadow-[0_16px_50px_rgba(0,0,0,0.2)] backdrop-blur-sm">
            <p className="mb-4 text-[22px] font-semibold uppercase tracking-[0.34em] text-cyan-100/75">Shit Talk</p>
            <p className="text-[44px] font-semibold leading-[1.18] text-white">“{shitTalk}”</p>
          </div>
        ) : null}

        <div className="flex flex-1 flex-col gap-7">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-[32px] border border-white/12 bg-slate-950/45 px-10 py-8 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-sm"
            >
              <p className="mb-4 text-[24px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">{section.title}</p>
              <div className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <p key={item} className="text-[42px] font-semibold leading-[1.16] text-white">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center justify-center gap-3 text-[24px] font-semibold uppercase tracking-[0.18em] text-slate-200/85">
          <span>© 2026 Superleague.party. An</span>
          <img
            alt="OWS"
            className="h-10 w-10 rounded-sm object-contain"
            decoding="sync"
            loading="eager"
            src="/ows-nwo-logo.png"
          />
          <span>Joint.</span>
        </div>
      </div>
    </div>
  );
}
