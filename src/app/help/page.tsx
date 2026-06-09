import Image from "next/image";

export default function HelpPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-start justify-center px-3 py-6 sm:px-6 sm:py-10">
      <div className="w-full rounded-3xl border border-white/10 bg-white/5 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-4">
        <Image
          alt="Instructions for adding Super League to your iPhone home screen"
          className="h-auto w-full rounded-2xl"
          src="/help-add-to-home-screen.png"
          width={1055}
          height={1491}
          priority
        />
      </div>
    </main>
  );
}
