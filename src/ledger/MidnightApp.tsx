import { useEffect, useMemo, useState } from "react";
import { BookOpen, LineChart, Moon, Search, Settings } from "lucide-react";
import {
  BUCKETS,
  CATEGORIES,
  CURRENCIES,
  LAST_NIGHT,
  SESSION_LABEL,
  SHIFTS,
  SPARK_BASE,
  bucketOf,
  dayKey,
  dayLabel,
  formatMoney,
  loadLedger,
  monogram,
  netOf,
  nowStamp,
  parseAmount,
  saveLedger,
  seedTxs,
  sumKind,
  timeLabel,
  type Category,
  type Currency,
  type Kind,
  type Tx,
} from "./model";

type Tab = "tonight" | "ledger" | "insights" | "settings";

function chipClass(on: boolean) {
  return on
    ? "rounded-full bg-amber px-3 py-1.5 text-xs text-night"
    : "rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:border-amber hover:text-cream";
}

function Crescent() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="shrink-0 text-amber">
      <path fill="currentColor" d="M9.2 1.4a6.2 6.2 0 1 0 5.4 9.3 5 5 0 1 1-5.4-9.3Z" />
    </svg>
  );
}

function Spark({ values }: { values: number[] }) {
  const w = 108;
  const h = 36;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const point = (v: number, i: number) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 3 - ((v - min) / span) * (h - 8);
    return [x, y] as const;
  };
  const d = values
    .map((v, i) => {
      const [x, y] = point(v, i);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  const [lx, ly] = point(values[values.length - 1] ?? 0, values.length - 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <path
        d={d}
        fill="none"
        stroke="var(--color-amber)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className="spark"
      />
      <circle cx={lx} cy={ly} r="2.2" fill="var(--color-amber)" />
    </svg>
  );
}

function Amount({
  value,
  kind,
  currency,
  className,
}: {
  value: number;
  kind?: Kind;
  currency: Currency;
  className?: string;
}) {
  const tone = kind === "in" ? "text-sage" : kind === "out" ? "text-rose" : "text-cream";
  const sign = kind === "in" ? "+" : kind === "out" ? "−" : "";
  return (
    <span className={`font-serif tabular-nums ${tone} ${className ?? ""}`}>
      {sign}
      {formatMoney(value, currency)}
    </span>
  );
}

export function MidnightApp() {
  const [txs, setTxs] = useState<Tx[]>(seedTxs);
  const [name, setName] = useState("Asha");
  const [currency, setCurrency] = useState<Currency>("INR");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("tonight");
  const [openId, setOpenId] = useState<string | null>(null);
  const [shift, setShift] = useState<Category | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [query, setQuery] = useState("");
  const [freshId, setFreshId] = useState<string | null>(null);
  const [clock, setClock] = useState("—:—");
  const [draftKind, setDraftKind] = useState<Kind>("out");
  const [draftCategory, setDraftCategory] = useState<Category>("Food");
  const [draftMerchant, setDraftMerchant] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [armReset, setArmReset] = useState(false);

  useEffect(() => {
    const saved = loadLedger();
    if (saved) {
      setTxs(saved.txs);
      setName(saved.name);
      setCurrency(saved.currency);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveLedger({ txs, name, currency });
  }, [ready, txs, name, currency]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, "0");
      const s = String(d.getSeconds()).padStart(2, "0");
      const ap = h >= 12 ? "PM" : "AM";
      h = h % 12 || 12;
      setClock(`${h}:${m}:${s} ${ap}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const income = sumKind(txs, "in");
  const expense = sumKind(txs, "out");
  const tonight = income - expense;
  const delta = tonight - LAST_NIGHT;
  const spark = [...SPARK_BASE, tonight];

  const tonightList = useMemo(() => {
    const list = shift ? txs.filter((tx) => tx.category === shift) : txs;
    return [...list].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [txs, shift]);

  const ledgerList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return txs
      .filter((tx) => (kindFilter === "all" ? true : tx.kind === kindFilter))
      .filter((tx) => {
        if (!q) return true;
        return (
          tx.merchant.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          tx.note.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [txs, kindFilter, query]);

  const patch = (id: string, next: Partial<Tx>) => {
    setTxs((rows) => rows.map((tx) => (tx.id === id ? { ...tx, ...next } : tx)));
  };

  const remove = (id: string) => {
    setTxs((rows) => rows.filter((tx) => tx.id !== id));
    setOpenId((current) => (current === id ? null : current));
  };

  const add = () => {
    const amount = parseAmount(draftAmount);
    if (amount == null) return;
    const tx: Tx = {
      id: crypto.randomUUID(),
      merchant: draftMerchant.trim() || draftCategory,
      category: draftCategory,
      amount,
      kind: draftKind,
      at: nowStamp(),
      note: "",
    };
    setTxs((rows) => [tx, ...rows]);
    setFreshId(tx.id);
    setDraftAmount("");
    setDraftMerchant("");
    setOpenId(tx.id);
    setTab("tonight");
  };

  const restore = () => {
    setTxs(seedTxs());
    setOpenId(null);
    setShift(null);
    setFreshId(null);
    setQuery("");
    setKindFilter("all");
    setArmReset(false);
    setTab("tonight");
  };

  return (
    <div className="stage">
      <div className="phone">
        <div className="glow" aria-hidden />
        <header className="flex items-center gap-2 px-4 pt-4 pb-2">
          <Crescent />
          <p className="min-w-0 truncate text-xs tracking-brand text-cream">MIDNIGHT LEDGER</p>
          <p className="ml-auto text-xs tabular-nums text-muted" aria-live="polite">
            {clock}
          </p>
          <button
            type="button"
            aria-label="Open settings"
            onClick={() => setTab("settings")}
            className="grid size-11 place-items-center"
          >
            <span className="grid size-8 place-items-center rounded-full border border-amber text-xs text-amber">
              {monogram(name)}
            </span>
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto scroll-hide">
          <div key={tab} className="tab-in pb-4">
            {tab === "tonight" && (
              <Tonight
                pool={txs}
                txs={tonightList}
                currency={currency}
                tonight={tonight}
                delta={delta}
                income={income}
                expense={expense}
                spark={spark}
                shift={shift}
                setShift={setShift}
                openId={openId}
                setOpenId={setOpenId}
                freshId={freshId}
                patch={patch}
                remove={remove}
              />
            )}
            {tab === "ledger" && (
              <Ledger
                txs={ledgerList}
                currency={currency}
                query={query}
                setQuery={setQuery}
                kindFilter={kindFilter}
                setKindFilter={setKindFilter}
                openId={openId}
                setOpenId={setOpenId}
                freshId={freshId}
                patch={patch}
                remove={remove}
              />
            )}
            {tab === "insights" && <Insights txs={txs} currency={currency} tonight={tonight} />}
            {tab === "settings" && (
              <SettingsPane
                name={name}
                setName={setName}
                currency={currency}
                setCurrency={setCurrency}
                armReset={armReset}
                setArmReset={setArmReset}
                restore={restore}
                count={txs.length}
              />
            )}
          </div>
        </main>

        {tab === "tonight" && (
          <form
            className="border-t border-line bg-panel px-4 py-3"
            onSubmit={(event) => {
              event.preventDefault();
              add();
            }}
          >
            <div className="grid grid-cols-2 gap-1 rounded-full border border-line p-1">
              <button
                type="button"
                onClick={() => setDraftKind("in")}
                className={`rounded-full py-2 text-sm ${draftKind === "in" ? "bg-sage text-night" : "text-muted hover:text-cream"}`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => setDraftKind("out")}
                className={`rounded-full py-2 text-sm ${draftKind === "out" ? "bg-rose text-night" : "text-muted hover:text-cream"}`}
              >
                Expense
              </button>
            </div>
            <label className="mt-3 block">
              <span className="sr-only">Merchant</span>
              <input
                value={draftMerchant}
                onChange={(event) => setDraftMerchant(event.target.value)}
                placeholder="Who was it"
                className="w-full bg-transparent text-sm text-cream outline-none placeholder:text-muted"
              />
            </label>
            <label className="mt-1 block">
              <span className="sr-only">Amount</span>
              <input
                value={draftAmount}
                onChange={(event) => setDraftAmount(event.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="w-full bg-transparent font-serif text-3xl text-cream outline-none placeholder:text-muted"
              />
            </label>
            <div className="mt-2 flex gap-2 overflow-x-auto scroll-hide pb-1">
              {CATEGORIES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setDraftCategory(category)}
                  className={`shrink-0 ${chipClass(draftCategory === category)}`}
                >
                  {category}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={parseAmount(draftAmount) == null}
              className="mt-2 w-full rounded-full bg-amber py-3 text-sm font-medium text-night hover:opacity-90 active:scale-95 disabled:opacity-40"
            >
              Add to ledger
            </button>
          </form>
        )}

        <nav className="grid grid-cols-4 border-t border-line bg-night pb-2">
          {(
            [
              ["tonight", "Tonight", Moon],
              ["ledger", "Ledger", BookOpen],
              ["insights", "Insights", LineChart],
              ["settings", "Settings", Settings],
            ] as const
          ).map(([id, label, Icon]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs ${on ? "text-amber" : "text-muted hover:text-cream"}`}
              >
                <Icon size={18} strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function Tonight({
  pool,
  txs,
  currency,
  tonight,
  delta,
  income,
  expense,
  spark,
  shift,
  setShift,
  openId,
  setOpenId,
  freshId,
  patch,
  remove,
}: {
  pool: Tx[];
  txs: Tx[];
  currency: Currency;
  tonight: number;
  delta: number;
  income: number;
  expense: number;
  spark: number[];
  shift: Category | null;
  setShift: (next: Category | null) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  freshId: string | null;
  patch: (id: string, next: Partial<Tx>) => void;
  remove: (id: string) => void;
}) {
  const up = delta >= 0;
  return (
    <div>
      <section className="px-4 pt-2 pb-4">
        <p className="text-xs tracking-widest text-amber">TONIGHT'S BALANCE</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className={`font-serif text-5xl leading-none tabular-nums ${tonight < 0 ? "text-rose" : "text-cream"}`}>
            {tonight < 0 ? "−" : ""}
            {formatMoney(Math.abs(tonight), currency)}
          </p>
          <Spark values={spark} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="text-muted">{SESSION_LABEL}</span>
          <span className={up ? "text-sage" : "text-rose"}>
            {up ? "+" : "−"}
            {formatMoney(Math.abs(delta), currency)} vs last night
          </span>
        </div>
        <p className="mt-2 text-xs text-muted">
          <span className="text-sage">{formatMoney(income, currency)} in</span>
          {" · "}
          <span className="text-rose">{formatMoney(expense, currency)} out</span>
        </p>
      </section>

      <div className="flex gap-2 overflow-x-auto scroll-hide px-4 pb-2">
        {SHIFTS.map((item) => {
          const amount = netOf(pool.filter((tx) => tx.category === item.name));
          const on = shift === item.name;
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => setShift(on ? null : item.name)}
              className={`w-36 shrink-0 rounded-2xl border px-3 py-3 text-left ${on ? "border-amber bg-panel" : "border-line hover:border-amber"}`}
            >
              <span className="block text-xs text-muted">{item.name}</span>
              <span className="mt-1 block font-serif text-lg leading-tight text-cream tabular-nums">
                {formatMoney(Math.abs(amount), currency)}
              </span>
              <span className="text-xs text-amber">{item.hours}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline justify-between px-4">
        <h2 className="text-sm text-cream">After dark</h2>
        <p className="text-xs text-muted">
          {shift ? shift : `${pool.length} entries`}
        </p>
      </div>
      {txs.length === 0 ? (
        <p className="px-4 py-10 text-sm text-muted">The ledger sleeps until you open it.</p>
      ) : (
        <Groups
          txs={txs}
          currency={currency}
          openId={openId}
          setOpenId={setOpenId}
          freshId={freshId}
          patch={patch}
          remove={remove}
          mode="bucket"
        />
      )}
    </div>
  );
}

function Ledger({
  txs,
  currency,
  query,
  setQuery,
  kindFilter,
  setKindFilter,
  openId,
  setOpenId,
  freshId,
  patch,
  remove,
}: {
  txs: Tx[];
  currency: Currency;
  query: string;
  setQuery: (value: string) => void;
  kindFilter: "all" | Kind;
  setKindFilter: (value: "all" | Kind) => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  freshId: string | null;
  patch: (id: string, next: Partial<Tx>) => void;
  remove: (id: string) => void;
}) {
  const days = [...new Set(txs.map((tx) => dayKey(tx.at)))];
  return (
    <div>
      <div className="px-4 pt-2">
        <h2 className="text-sm text-cream">The whole night book</h2>
        <label className="mt-3 flex items-center gap-2 border-b border-line py-2">
          <Search size={16} className="text-muted" />
          <span className="sr-only">Search the ledger</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Merchant, note, category"
            className="w-full bg-transparent text-sm text-cream outline-none placeholder:text-muted"
          />
        </label>
        <div className="mt-3 flex gap-2">
          {(
            [
              ["all", "All"],
              ["in", "Income"],
              ["out", "Expense"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setKindFilter(id)} className={chipClass(kindFilter === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {txs.length === 0 ? (
        <p className="px-4 py-10 text-sm text-muted">The ledger sleeps until you open it.</p>
      ) : (
        days.map((day) => (
          <section key={day}>
            <h3 className="px-4 pt-4 pb-1 text-xs tracking-widest text-amber">
              {dayLabel(day).toUpperCase()}
              <span className="ml-2 text-muted">
                {formatMoney(netOf(txs.filter((tx) => dayKey(tx.at) === day)), currency)}
              </span>
            </h3>
            <ul>
              {txs
                .filter((tx) => dayKey(tx.at) === day)
                .map((tx) => (
                  <Row
                    key={tx.id}
                    tx={tx}
                    currency={currency}
                    open={openId === tx.id}
                    fresh={freshId === tx.id}
                    onToggle={() => setOpenId(openId === tx.id ? null : tx.id)}
                    patch={patch}
                    remove={remove}
                  />
                ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function Insights({
  txs,
  currency,
  tonight,
}: {
  txs: Tx[];
  currency: Currency;
  tonight: number;
}) {
  const income = sumKind(txs, "in");
  const expense = sumKind(txs, "out");
  const total = income + expense || 1;
  const nights = [
    { name: "12", net: SPARK_BASE[0] ?? 0 },
    { name: "13", net: SPARK_BASE[1] ?? 0 },
    { name: "14", net: SPARK_BASE[2] ?? 0 },
    { name: "15", net: SPARK_BASE[3] ?? 0 },
    { name: "16", net: SPARK_BASE[4] ?? 0 },
    { name: "17", net: SPARK_BASE[5] ?? 0 },
    { name: "18", net: tonight },
  ];
  const byCategory = CATEGORIES.map((category) => ({
    category,
    out: sumKind(
      txs.filter((tx) => tx.category === category),
      "out",
    ),
    inn: sumKind(
      txs.filter((tx) => tx.category === category),
      "in",
    ),
  })).filter((row) => row.out > 0 || row.inn > 0);
  const heaviest = [...byCategory].sort((a, b) => b.out - a.out)[0];
  const counts = BUCKETS.map((bucket) => ({
    bucket,
    n: txs.filter((tx) => bucketOf(tx.at) === bucket).length,
  })).sort((a, b) => b.n - a.n);

  return (
    <div className="px-4 pt-2">
      <p className="text-xs tracking-widest text-amber">AFTER DARK, THIS WEEK</p>
      <p className="mt-2 font-serif text-3xl text-cream tabular-nums">{formatMoney(tonight, currency)}</p>
      <p className="mt-1 text-xs text-muted">Oct 18 is still open. Earlier nights stay put.</p>
      <div className="mt-4">
        <NightChart nights={nights} />
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-panel-2">
        <div className="bg-sage" style={{ width: `${(income / total) * 100}%` }} />
        <div className="bg-rose" style={{ width: `${(expense / total) * 100}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        <span className="text-sage">{formatMoney(income, currency)} in</span>
        {" · "}
        <span className="text-rose">{formatMoney(expense, currency)} out</span>
      </p>

      <h2 className="mt-6 text-sm text-cream">Where the night went</h2>
      <ul className="mt-3 space-y-3">
        {byCategory.map((row) => {
          const width = Math.max(row.out, row.inn);
          const max = Math.max(...byCategory.map((item) => Math.max(item.out, item.inn)), 1);
          return (
            <li key={row.category}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="text-cream">{row.category}</span>
                <span className="text-muted tabular-nums">
                  {row.inn > 0 ? <span className="text-sage">{formatMoney(row.inn, currency)}</span> : null}
                  {row.inn > 0 && row.out > 0 ? " · " : null}
                  {row.out > 0 ? <span className="text-rose">{formatMoney(row.out, currency)}</span> : null}
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-panel-2">
                <div
                  className={`h-full rounded-full ${row.out >= row.inn ? "bg-rose" : "bg-sage"}`}
                  style={{ width: `${(width / max) * 100}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line px-3 py-3">
          <p className="text-xs text-muted">Heaviest cost</p>
          <p className="mt-1 text-sm text-cream">{heaviest && heaviest.out > 0 ? heaviest.category : "None yet"}</p>
        </div>
        <div className="rounded-2xl border border-line px-3 py-3">
          <p className="text-xs text-muted">Busiest stretch</p>
          <p className="mt-1 text-sm text-cream">{counts[0] && counts[0].n > 0 ? counts[0].bucket : "Quiet"}</p>
        </div>
      </div>
    </div>
  );
}

function NightChart({ nights }: { nights: { name: string; net: number }[] }) {
  const [charts, setCharts] = useState<typeof import("recharts") | null>(null);
  useEffect(() => {
    let live = true;
    void import("recharts").then((mod) => {
      if (live) setCharts(mod);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!charts) return <div className="h-40 rounded-2xl bg-panel" />;
  const { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell } = charts;
  return (
    <div className="h-40">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={nights} barCategoryGap="28%">
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--color-muted)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--color-panel-2)" }}
            contentStyle={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              color: "var(--color-cream)",
              fontSize: 12,
            }}
          />
          <Bar dataKey="net" radius={[6, 6, 0, 0]}>
            {nights.map((night) => (
              <Cell key={night.name} fill={night.net >= 0 ? "var(--color-amber)" : "var(--color-rose)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function SettingsPane({
  name,
  setName,
  currency,
  setCurrency,
  armReset,
  setArmReset,
  restore,
  count,
}: {
  name: string;
  setName: (value: string) => void;
  currency: Currency;
  setCurrency: (value: Currency) => void;
  armReset: boolean;
  setArmReset: (value: boolean) => void;
  restore: () => void;
  count: number;
}) {
  return (
    <div className="px-4 pt-2">
      <p className="text-xs tracking-widest text-amber">THE NIGHT DESK</p>
      <h2 className="mt-2 font-serif text-3xl text-cream">Settings</h2>
      <label className="mt-6 block text-xs text-muted">
        What the ledger calls you
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="mt-2 w-full border-b border-line bg-transparent py-2 text-base text-cream outline-none"
        />
      </label>
      <p className="mt-6 text-xs text-muted">Count money in</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {CURRENCIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCurrency(item.id)}
            className={chipClass(currency === item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="mt-6 text-sm text-cream">{count} lines on this device.</p>
      <p className="mt-1 text-xs text-muted">Nothing leaves the phone. Daylight does not get a column.</p>
      <button
        type="button"
        onClick={() => {
          if (!armReset) {
            setArmReset(true);
            return;
          }
          restore();
        }}
        className="mt-6 w-full rounded-full border border-line py-3 text-sm text-cream hover:border-amber"
      >
        {armReset ? "Tap again — sample night returns" : "Restore the sample night"}
      </button>
    </div>
  );
}

function Groups({
  txs,
  currency,
  openId,
  setOpenId,
  freshId,
  patch,
  remove,
  mode,
}: {
  txs: Tx[];
  currency: Currency;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  freshId: string | null;
  patch: (id: string, next: Partial<Tx>) => void;
  remove: (id: string) => void;
  mode: "bucket";
}) {
  const groups = BUCKETS.map((bucket) => ({
    bucket,
    items: txs.filter((tx) => bucketOf(tx.at) === bucket),
  })).filter((group) => group.items.length > 0);
  if (mode !== "bucket") return null;
  return (
    <div>
      {groups.map((group) => (
        <section key={group.bucket}>
          <h3 className="px-4 pt-4 pb-1 text-xs tracking-widest text-amber">{group.bucket.toUpperCase()}</h3>
          <ul>
            {group.items.map((tx) => (
              <Row
                key={tx.id}
                tx={tx}
                currency={currency}
                open={openId === tx.id}
                fresh={freshId === tx.id}
                onToggle={() => setOpenId(openId === tx.id ? null : tx.id)}
                patch={patch}
                remove={remove}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Row({
  tx,
  currency,
  open,
  fresh,
  onToggle,
  patch,
  remove,
}: {
  tx: Tx;
  currency: Currency;
  open: boolean;
  fresh: boolean;
  onToggle: () => void;
  patch: (id: string, next: Partial<Tx>) => void;
  remove: (id: string) => void;
}) {
  return (
    <li className={fresh ? "tx-in" : undefined}>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-panel active:bg-panel-2"
      >
        <span className="w-16 shrink-0 text-xs text-muted tabular-nums">{timeLabel(tx.at)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-cream">{tx.merchant}</span>
          <span className="mt-1 inline-flex rounded-full border border-line px-2 py-0.5 text-xs text-muted">
            {tx.category}
          </span>
        </span>
        <Amount value={tx.amount} kind={tx.kind} currency={currency} className="text-base" />
      </button>
      {open && (
        <div className="space-y-3 border-t border-line bg-panel px-4 py-3">
          {tx.note ? <p className="font-serif text-sm text-cream">{tx.note}</p> : null}
          <label className="block text-xs text-muted">
            Merchant
            <input
              value={tx.merchant}
              onChange={(event) => patch(tx.id, { merchant: event.target.value })}
              className="mt-1 w-full bg-transparent text-sm text-cream outline-none"
            />
          </label>
          <label className="block text-xs text-muted">
            Note
            <textarea
              value={tx.note}
              rows={2}
              onChange={(event) => patch(tx.id, { note: event.target.value })}
              placeholder="A line for later"
              className="mt-1 w-full resize-none bg-transparent text-sm text-cream outline-none placeholder:text-muted"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => patch(tx.id, { category })}
                className={chipClass(category === tx.category)}
              >
                {category}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => remove(tx.id)} className="text-xs text-rose">
            Remove from ledger
          </button>
        </div>
      )}
    </li>
  );
}
