import Link from "next/link";

const LIFECYCLE = [
  { n: 1, title: "User", desc: "Your parent abroad signs up in seconds" },
  { n: 2, title: "Wallet", desc: "Self-custodied stablecoin wallet provisioned on-device" },
  { n: 3, title: "KYC", desc: "BVN verification issues a Nigerian virtual account" },
  { n: 4, title: "Rail", desc: "Local NGN rail activates instantly" },
  { n: 5, title: "Fund", desc: "USD in — auto-swapped to cNaira in the wallet" },
  { n: 6, title: "Move money", desc: "Send to family or cash out to any Nigerian bank" },
];

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      {/* Nav */}
      <nav className="flex items-center justify-between mb-20">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚡</span>
          <span className="font-bold text-xl tracking-tight">
            Sharp<span className="grad-text">Sharp</span>
          </span>
        </div>
        <div className="flex gap-6 text-sm text-bmoni-dim">
          <Link href="/dashboard" className="hover:text-bmoni-text">Dashboard</Link>
          <Link href="/onboarding" className="hover:text-bmoni-text">Onboarding</Link>
          <Link href="/concierge" className="hover:text-bmoni-text">Concierge</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mb-24">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border border-bmoni-line bg-bmoni-card mb-6">
          <span className="w-2 h-2 rounded-full bg-bmoni-accent live-dot" />
          Built on BMONI Embedded — live sandbox
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-[1.05] mb-6">
          Diaspora money,
          <br />
          <span className="grad-text">wey land sharp sharp.</span>
        </h1>
        <p className="text-lg text-bmoni-dim max-w-xl mb-8">
          Your parent in Houston sends your allowance straight to your wallet.
          No 6% Western Union cut. No &quot;check again in 3 days.&quot;
          Stablecoin rails, self-custodied, settled in seconds.
        </p>
        <div className="flex gap-4">
          <Link
            href="/dashboard"
            className="px-6 py-3 rounded-xl bg-bmoni-accent text-bmoni-bg font-semibold hover:opacity-90 transition"
          >
            See the live demo
          </Link>
          <Link
            href="/concierge"
            className="px-6 py-3 rounded-xl border border-bmoni-line bg-bmoni-card font-semibold hover:border-bmoni-accent transition"
          >
            Talk to the concierge →
          </Link>
        </div>
      </section>

      {/* The old way vs SharpSharp */}
      <section className="grid md:grid-cols-2 gap-6 mb-24">
        <div className="glow-card rounded-2xl p-8">
          <h3 className="text-sm font-semibold text-bmoni-dim mb-4">THE OLD WAY</h3>
          <ul className="space-y-3 text-bmoni-dim">
            <li>✕ 4–6% hidden fees on every transfer</li>
            <li>✕ 2–5 business days to arrive</li>
            <li>✕ Parent has no visibility once sent</li>
            <li>✕ Student queues at the agent to collect</li>
          </ul>
        </div>
        <div className="glow-card rounded-2xl p-8 border-bmoni-accent/30">
          <h3 className="text-sm font-semibold text-bmoni-accent mb-4">WITH SHARPSHARP</h3>
          <ul className="space-y-3">
            <li>✓ Sub-cent transfer cost on stablecoin rails</li>
            <li>✓ Arrives in seconds, on-chain</li>
            <li>✓ Both sides watch it settle live</li>
            <li>✓ Cash out to any Nigerian bank, instantly</li>
          </ul>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="mb-24">
        <h2 className="text-3xl font-bold mb-3">One product. The whole BMONI lifecycle.</h2>
        <p className="text-bmoni-dim mb-10">
          Every stage of BMONI Embedded, in order, wired into a real product.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {LIFECYCLE.map((s) => (
            <div key={s.n} className="glow-card rounded-2xl p-6">
              <div className="text-bmoni-accent text-xs font-mono mb-3">STAGE {s.n}</div>
              <div className="font-semibold text-lg mb-2">{s.title}</div>
              <div className="text-bmoni-dim text-sm">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="mb-24">
        <h2 className="text-3xl font-bold mb-10">The demo cast</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glow-card rounded-2xl p-8">
            <div className="text-2xl mb-3">👩🏾‍🎓</div>
            <div className="font-bold text-lg mb-1">The Student — Bunch Dillon</div>
            <p className="text-bmoni-dim text-sm">
              Lives in Lagos. Fully KYC&apos;ed with BVN — her identity check runs live
              in the onboarding wizard. Holds a cNaira wallet and a Nigerian virtual
              account for deposits.
            </p>
          </div>
          <div className="glow-card rounded-2xl p-8">
            <div className="text-2xl mb-3">👨🏾‍💻</div>
            <div className="font-bold text-lg mb-1">The Parent — Samson Jabo</div>
            <p className="text-bmoni-dim text-sm">
              Works abroad. Sends money home with one sentence to the concierge:
              &quot;send 50k naira to my student&quot; — and watches the proposal,
              approval, and signature settle in real time.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-bmoni-line pt-8 text-sm text-bmoni-dim">
        Built for the BMONI Embedded hackathon · Sandbox environment ·{" "}
        <span className="font-mono">docs: bkey.mintlify.app</span>
      </footer>
    </main>
  );
}
