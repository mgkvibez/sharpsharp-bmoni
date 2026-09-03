"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Onboarding wizard — visualizes the six-stage BMONI lifecycle live.
 * The personas are already seeded (npm run seed); this page replays
 * the exact API calls the seeder made, stage by stage, with real
 * responses from the sandbox.
 */

const STAGES = [
  { key: "user", title: "Create the user", call: "POST /v1/users" },
  { key: "kyc", title: "Verify identity (BVN)", call: "GET /kyc/bvn-lookup + PATCH /kyc" },
  { key: "wallet", title: "Provision the smart wallet", call: "owner-proof → create-managed" },
  { key: "rail", title: "Activate the NGN rail", call: "POST /onboarding/start-nigeria" },
  { key: "docs", title: "KYC documents", call: "identification / proof-of-address / biometric" },
  { key: "money", title: "Move money", call: "proposal → approve → sign" },
];

export default function Onboarding() {
  const [stage, setStage] = useState(-1);
  const [logs, setLogs] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  const runStage = async (i: number) => {
    setStage(i);
    setRunning(true);
    const push = (s: string) => setLogs((l) => [...l, s]);

    const stage = STAGES[i];
    push(`▶ ${stage.title} — ${stage.call}`);

    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: stage.key, role: "student" }),
      });
      const json = await res.json();
      if (json.ok) {
        for (const line of json.logs ?? []) push(`  ${line}`);
        push(`✓ ${stage.title} complete\n`);
      } else {
        push(`✗ ${json.error ?? "failed"}\n`);
      }
    } catch (e: any) {
      push(`✗ ${e.message}\n`);
    } finally {
      setRunning(false);
    }
  };

  const runAll = async () => {
    setLogs([]);
    for (let i = 0; i < STAGES.length; i++) {
      setStage(i);
      await runStage(i);
    }
  };

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <nav className="flex items-center justify-between mb-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-xl">
            Sharp<span className="grad-text">Sharp</span>
          </span>
        </Link>
        <div className="flex gap-6 text-sm text-bmoni-dim">
          <Link href="/dashboard" className="hover:text-bmoni-text">Dashboard</Link>
          <Link href="/concierge" className="hover:text-bmoni-text">Concierge</Link>
        </div>
      </nav>

      <h1 className="text-3xl font-bold mb-2">The lifecycle, live</h1>
      <p className="text-bmoni-dim mb-8">
        Watch a brand-new user go from nothing to a funded, active NGN wallet —
        every stage a real call to the BMONI sandbox.
      </p>

      <button
        onClick={runAll}
        disabled={running}
        className="mb-8 px-6 py-3 rounded-xl bg-bmoni-accent text-bmoni-bg font-bold hover:opacity-90 disabled:opacity-40"
      >
        {running ? "Running…" : "Run the full lifecycle ▶"}
      </button>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {STAGES.map((s, i) => (
          <div
            key={s.key}
            className={`glow-card rounded-2xl p-5 transition ${stage === i ? "border-bmoni-accent" : ""} ${stage > i ? "opacity-60" : ""}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  stage > i
                    ? "bg-bmoni-accent text-bmoni-bg"
                    : stage === i
                      ? "border border-bmoni-accent text-bmoni-accent"
                      : "border border-bmoni-line text-bmoni-dim"
                }`}
              >
                {stage > i ? "✓" : i + 1}
              </span>
              <span className="font-semibold">{s.title}</span>
            </div>
            <div className="text-xs text-bmoni-dim font-mono pl-9">{s.call}</div>
          </div>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="border border-bmoni-line rounded-2xl p-5 bg-black/40 font-mono text-xs leading-relaxed overflow-x-auto">
          {logs.map((l, i) => (
            <div
              key={i}
              className={
                l.startsWith("✓")
                  ? "text-bmoni-accent"
                  : l.startsWith("✗")
                    ? "text-red-400"
                    : "text-bmoni-dim"
              }
            >
              {l}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
