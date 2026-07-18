import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ShipStake — demo",
  description: "3-minute demo: stake MON, push a commit, get verified onchain.",
};

/** Self-hosted demo player — the video lives in public/demo.mp4, so the
 *  submission's video link is on the same domain as the app it demos. */
export default function DemoPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col justify-center gap-4 px-4 py-10">
      <a href="/" className="font-mono text-xs uppercase tracking-widest text-muted hover:text-primary">
        ← shipstake.vercel.app
      </a>
      <h1 className="font-head text-3xl tracking-tight sm:text-4xl">
        STAKE MON. <span className="text-outline">SHIP OR LOSE IT.</span>
      </h1>
      <div className="border-2 border-primary shadow-brutal">
        <video
          src="/demo.mp4"
          controls
          playsInline
          preload="metadata"
          poster="/opengraph-image.png"
          className="block w-full"
        />
      </div>
      <p className="font-mono text-xs text-muted">
        The full loop, unfaked: create a commitment → push a real commit → the verifier
        checks in onchain → withdraw. Contract&nbsp;
        <a
          href="https://testnet.monadexplorer.com/address/0x42CF460E72bBddfe9828f0D5a33fAB0f50d6A090"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          0x42CF…A090
        </a>
        &nbsp;· source verified · Monad testnet
      </p>
    </main>
  );
}
