"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "@/components/ui/Logo";
import { useCallback, useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { CommitmentCard } from "@/components/CommitmentCard";
import { CreateCommitmentForm } from "@/components/CreateCommitmentForm";
import { useRainbowKitReady } from "@/components/Providers";
import { TextReveal } from "@/components/anim/TextReveal";
import { AnimateDigits } from "@/components/anim/AnimateDigits";
import { Marquee } from "@/components/anim/Marquee";
import { CONTRACT_ADDRESS, COMMITMENT_DEVICE_ABI } from "@/lib/contract";
import { getTrackedIds } from "@/lib/storage";

const TICKER_ITEMS = [
  "STAKE MON",
  "SHIP OR LOSE IT",
  "VERIFIED BY YOUR GITHUB ACTIVITY",
  "BUILT ON MONAD",
];

export default function Home() {
  const [ids, setIds] = useState<number[]>([]);
  const rainbowKitReady = useRainbowKitReady();

  const refresh = useCallback(() => {
    setIds([...getTrackedIds()].reverse());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { data: totalCommitments } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: COMMITMENT_DEVICE_ABI,
    functionName: "nextId",
  });

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b-2 border-line bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <a href="#top" className="flex items-center gap-2 font-head text-sm tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center border-2 border-primary bg-primary/10">
              <Logo className="h-4.5 w-4.5 text-primary" />
            </span>
            SHIPSTAKE
          </a>
          {rainbowKitReady ? <ConnectButton /> : <div className="h-10 w-32" aria-hidden="true" />}
        </div>
        <Marquee className="border-t-2 border-line bg-surface py-1.5">
          {TICKER_ITEMS.map((t) => (
            <span key={t} className="font-mono text-[11px] tracking-widest text-muted">
              {t} <span className="text-primary">//</span>
            </span>
          ))}
        </Marquee>
      </header>

      <main id="top" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-10 px-4 py-12">
        <section className="bg-grid -mx-4 flex flex-col gap-4 border-b-2 border-line px-4 pb-10">
          <h1 className="font-head text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            <TextReveal text="STAKE MON." />
            <br />
            <TextReveal text="SHIP OR LOSE IT." delay={0.15} className="text-outline" />
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Put real money behind your next commit. A verifier checks your GitHub
            activity against the deadline — ship it and reclaim your stake, miss it
            and your beneficiary takes it.
          </p>
          <div className="mt-2 flex items-center gap-2 font-mono text-xs text-muted">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full animate-blink rounded-full bg-primary" />
            </span>
            <AnimateDigits value={Number(totalCommitments ?? BigInt(0))} className="text-primary" />
            <span>commitments staked onchain</span>
          </div>
        </section>

        <CreateCommitmentForm onCreated={refresh} />

        <section className="flex flex-col gap-3">
          <h2 className="font-head text-lg tracking-tight">Your commitments</h2>
          {ids.length === 0 ? (
            <p className="border-2 border-dashed border-line px-4 py-6 text-center text-sm text-muted">
              Nothing staked yet — make your first commitment above.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {ids.map((id) => (
                <CommitmentCard key={id} id={id} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t-2 border-line px-4 py-6 text-center font-mono text-xs text-muted">
        Monad Testnet · verifier is a trusted backend for hackathon scope, not a decentralized oracle
      </footer>
    </div>
  );
}
