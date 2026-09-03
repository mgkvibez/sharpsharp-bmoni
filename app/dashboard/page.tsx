"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Persona {
  name: string;
  bmoniUserId: string;
  walletAddress: string;
  onboardingStatus: string;
  balances: { currency: string; balance: string }[];
  depositAccounts?: {
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
  }[];
}

interface DemoData {
  ok: boolean;
  baseUrl: string;
  personas: { student?: Persona; parent?: Persona };
}

const FLOW_STEPS = [
  "CREATING_PROPOSAL",
  "APPROVING",
  "WAITING_FOR_SIGNING",
  "SIGNING",
  "SUBMITTED",
  "PENDING_SIGNATURES",
  "COMPLETED",
];

export default function Dashboard() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendOpen, setSendOpen] = useState(false);
  const [amount, setAmount] = useState("50");
  const [flowStep, setFlowStep] = useState(-1);
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    const res = await fetch("/api/demo", { cache: "no-store" });
    const json = await res.json();
    setData(json);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  const sendMoney = async () => {
    setSending(true);
    setResult(null);
    setFlowStep(0);
    try {
      const res = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "parent",
          toRole: "student",
          amount,
          description: "Allowance from Houston 🚀",
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setResult(`✅ ${amount} cNGN landed in ${json.to}'s wallet.`);
      } else {
        setResult(`❌ ${json.error ?? "Transfer failed"}`);
      }
      refresh();
    } catch (e: any) {
      setResult(`❌ ${e.message}`);
    } finally {
      setSending(false);
      setTimeout(() => setFlowStep(-1), 2000);
    }
  };

  const personaCard = (role: string, p: Persona | undefined, emoji: string, subtitle: string) => {
    if (!p) return null;
    return (
      <div key={role} className="glow-card rounded-3xl p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="text-3xl mb-2">{emoji}</div>
            <div className="font-bold">{p.name}</div>
            <div className="text-xs text-bmoni-dim">{subtitle}</div>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-bmoni-accent/10 text-bmoni-accent border border-bmoni-accent/20">
            ● {String(p.onboardingStatus ?? "").toUpperCase()}
          </span>
        </div>
        {p.balances?.map((b, i) => (
          <div key={i} className="mb-4">
            <div className="text-xs text-bmoni-dim mb-1">{b.currency}</div>
            <div className="text-3xl font-bold tabular-nums">
              {Number(b.balance ?? 0).toLocaleString("en-NG", { maximumFractionDigits: 2 })}
            </div>
          </div>
        ))}
        <div className="text-xs font-mono text-bmoni-dim truncate mb-4">
          {p.walletAddress}
        </div>
        {p.depositAccounts?.[0] && (
          <div className="text-xs text-bmoni-dim border-t border-bmoni-line pt-3">
            Virtual NUBAN ({p.depositAccounts[0].bankName}):{" "}
            <span className="font-mono text-bmoni-text">
              {p.depositAccounts[0].accountNumber ?? "—"}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="max-w-5xl mx-auto px-6 py-12">
      <nav className="flex items-center justify-between mb-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-xl">
            Sharp<span className="grad-text">Sharp</span>
          </span>
        </Link>
        <div className="flex gap-6 text-sm text-bmoni-dim">
          <Link href="/onboarding" className="hover:text-bmoni-text">Onboarding</Link>
          <Link href="/concierge" className="hover:text-bmoni-text">Concierge</Link>
        </div>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Live wallets</h1>
        <span className="text-xs text-bmoni-dim flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-bmoni-accent live-dot" />
          polling BMONI sandbox
        </span>
      </div>

      {loading ? (
        <div className="text-bmoni-dim">Loading live data from BMONI…</div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            {personaCard("parent", data?.personas.parent, "👨🏾‍💻", "The parent — abroad")}
            {personaCard("student", data?.personas.student, "👩🏾‍🎓", "The student — Lagos")}
          </div>

          {/* Send money section */}
          <section className="glow-card rounded-3xl p-8">
            <h2 className="text-xl font-bold mb-2">Send money home</h2>
            <p className="text-bmoni-dim text-sm mb-6">
              Parent → Student, through the full proposal → approve → sign flow.
            </p>

            <div className="flex flex-wrap gap-3 items-end mb-6">
              <div>
                <label className="text-xs text-bmoni-dim block mb-1.5">Amount (cNGN)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-40 bg-bmoni-bg border border-bmoni-line rounded-xl px-4 py-3 text-lg font-semibold focus:border-bmoni-accent outline-none"
                />
              </div>
              <button
                onClick={sendMoney}
                disabled={sending}
                className="px-6 py-3 rounded-xl bg-bmoni-accent text-bmoni-bg font-bold hover:opacity-90 transition disabled:opacity-40"
              >
                {sending ? "Sending…" : "Send ⚡"}
              </button>
            </div>

            {/* Live flow visualization */}
            {(flowStep >= 0 || result) && (
              <div className="border border-bmoni-line rounded-2xl p-5 bg-bmoni-bg/50">
                <div className="flex flex-wrap gap-2 mb-4">
                  {FLOW_STEPS.map((s, i) => (
                    <span
                      key={s}
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-full border ${
                        i <= flowStep
                          ? "border-bmoni-accent text-bmoni-accent"
                          : "border-bmoni-line text-bmoni-dim"
                      }`}
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {result && <div className="text-sm font-medium">{result}</div>}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
