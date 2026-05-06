"use client";

type ShareProfileStoryCardProps = {
  avatarUrl: string | null;
  displayName: string;
  sections: ShareSection[];
};

export type ShareSection = {
  title: string;
  items: string[];
};

export default function ShareProfileStoryCard({
  avatarUrl,
  displayName,
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
          <div className="flex max-w-[920px] items-center gap-8">
            {avatarUrl ? (
              <img
                alt={`${displayName} avatar`}
                className="h-36 w-36 shrink-0 rounded-full border-4 border-cyan-200/70 object-cover shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
                crossOrigin="anonymous"
                src={avatarUrl}
              />
            ) : (
              <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-full border-4 border-cyan-200/70 bg-white/10 text-6xl font-black uppercase">
                {displayName.slice(0, 1)}
              </div>
            )}
            <h2 className="text-left text-[76px] font-black leading-[0.95] text-white">{displayName}</h2>
          </div>
          <p className="mt-8 text-[28px] font-semibold uppercase tracking-[0.3em] text-cyan-100/78">
            Check out my picks for the tourney:
          </p>
        </div>

        <div className="flex flex-1 flex-col gap-7">
          {sections.map((section) => (
            <div
              key={section.title}
              className="rounded-[32px] border border-white/12 bg-slate-950/45 px-10 py-8 shadow-[0_18px_55px_rgba(0,0,0,0.22)] backdrop-blur-sm"
            >
              <p className="mb-4 text-[30px] font-semibold uppercase tracking-[0.24em] text-cyan-100/80">{section.title}</p>
              <div className="flex flex-col gap-3">
                {section.items.map((item) => (
                  <p key={item} className="text-[50px] font-semibold leading-[1.14] text-white">
                    {item}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
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
      </div>
    </div>
  );
}
