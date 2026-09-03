"use client";

import { useState } from "react";
import Link from "next/link";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function Concierge() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hey 👋 I'm your SharpSharp concierge. I move real money through BMONI's rails. Try: “send 500 naira to my student”.",
    },
  ]);
  const [input, setInput] = useState("");
  const [role, setRole] = useState<"parent" | "student">("parent");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, role }),
      });
      const json = await res.json();
      setMsgs((m) => [...m, { role: "assistant", content: json.reply ?? json.error }]);
    } catch (e: any) {
      setMsgs((m) => [...m, { role: "assistant", content: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <nav className="flex items-center justify-between mb-10">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-xl">
            Sharp<span className="grad-text">Sharp</span>
          </span>
        </Link>
        <div className="flex gap-6 text-sm text-bmoni-dim">
          <Link href="/dashboard" className="hover:text-bmoni-text">Dashboard</Link>
          <Link href="/onboarding" className="hover:text-bmoni-text">Onboarding</Link>
        </div>
      </nav>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Concierge</h1>
        <div className="flex gap-1 text-xs border border-bmoni-line rounded-full p-1">
          {(["parent", "student"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`px-4 py-1.5 rounded-full capitalize ${
                role === r ? "bg-bmoni-accent text-bmoni-bg font-semibold" : "text-bmoni-dim"
              }`}
            >
              as {r}
            </button>
          ))}
        </div>
      </div>

      <div className="glow-card rounded-3xl p-5 h-[480px] flex flex-col mb-4">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : ""}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-bmoni-accent text-bmoni-bg font-medium"
                    : "bg-bmoni-card border border-bmoni-line"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex">
              <div className="bg-bmoni-card border border-bmoni-line rounded-2xl px-4 py-3 text-sm text-bmoni-dim">
                Working on it… <span className="live-dot">●</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="send 500 naira to my student…"
            className="flex-1 bg-bmoni-bg border border-bmoni-line rounded-xl px-4 py-3 text-sm focus:border-bmoni-accent outline-none"
          />
          <button
            onClick={send}
            disabled={busy}
            className="px-5 py-3 rounded-xl bg-bmoni-accent text-bmoni-bg font-bold text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>

      <p className="text-xs text-bmoni-dim">
        Every command runs the real BMONI flow: proposal → approval → owner-key
        signature → on-chain settlement.
      </p>
    </main>
  );
}
