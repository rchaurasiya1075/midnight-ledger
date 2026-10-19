export type Kind = "in" | "out";

export type Category =
  | "Late freelance"
  | "Bar tips"
  | "Side gig"
  | "Refunds"
  | "Transit"
  | "Food"
  | "Tools"
  | "Rent";

export const CATEGORIES: Category[] = [
  "Late freelance",
  "Bar tips",
  "Side gig",
  "Refunds",
  "Transit",
  "Food",
  "Tools",
  "Rent",
];

export const SHIFTS: { name: Category; hours: string }[] = [
  { name: "Late freelance", hours: "4.5h" },
  { name: "Bar tips", hours: "3h" },
  { name: "Side gig", hours: "1.5h" },
  { name: "Refunds", hours: "0.2h" },
];

export type Tx = {
  id: string;
  merchant: string;
  category: Category;
  amount: number;
  kind: Kind;
  at: string;
  note: string;
};

export type Currency = "INR" | "USD" | "EUR";

export const CURRENCIES: { id: Currency; label: string }[] = [
  { id: "INR", label: "₹ INR" },
  { id: "USD", label: "$ USD" },
  { id: "EUR", label: "€ EUR" },
];

export const SESSION_LABEL = "Oct 18 · night session";
export const LAST_NIGHT = 14220;
export const SPARK_BASE = [8200, 4100, 12600, 980, 15400, 14220];

export const BUCKETS = ["Dusk", "Midnight", "Small hours", "Before dusk"] as const;
export type Bucket = (typeof BUCKETS)[number];

export function seedTxs(): Tx[] {
  return [
    {
      id: "tx1",
      merchant: "Northwind Studio",
      category: "Late freelance",
      amount: 18400,
      kind: "in",
      at: "2026-10-18T23:18:00",
      note: "client paid late",
    },
    {
      id: "tx2",
      merchant: "The Low Room",
      category: "Bar tips",
      amount: 1250,
      kind: "in",
      at: "2026-10-19T00:40:00",
      note: "",
    },
    {
      id: "tx3",
      merchant: "Reel voiceover",
      category: "Side gig",
      amount: 3200,
      kind: "in",
      at: "2026-10-19T02:22:00",
      note: "",
    },
    {
      id: "tx4",
      merchant: "Lens kit return",
      category: "Refunds",
      amount: 640,
      kind: "in",
      at: "2026-10-19T03:05:00",
      note: "",
    },
    {
      id: "tx5",
      merchant: "Kettle & Rue",
      category: "Food",
      amount: 240,
      kind: "out",
      at: "2026-10-18T19:12:00",
      note: "espresso before the all-nighter",
    },
    {
      id: "tx6",
      merchant: "City night bus",
      category: "Transit",
      amount: 86,
      kind: "out",
      at: "2026-10-18T20:04:00",
      note: "night bus",
    },
    {
      id: "tx7",
      merchant: "Loft, night slice",
      category: "Rent",
      amount: 2200,
      kind: "out",
      at: "2026-10-18T18:40:00",
      note: "",
    },
    {
      id: "tx8",
      merchant: "Registrar",
      category: "Tools",
      amount: 899,
      kind: "out",
      at: "2026-10-19T00:12:00",
      note: "",
    },
    {
      id: "tx9",
      merchant: "24h chemist",
      category: "Food",
      amount: 175,
      kind: "out",
      at: "2026-10-19T04:18:00",
      note: "",
    },
    {
      id: "tx10",
      merchant: "Sample clearance",
      category: "Tools",
      amount: 499,
      kind: "out",
      at: "2026-10-19T02:48:00",
      note: "",
    },
  ];
}

export function bucketOf(at: string): Bucket {
  const hour = Number(at.slice(11, 13));
  if (hour >= 18 && hour < 22) return "Dusk";
  if (hour >= 22 || hour < 2) return "Midnight";
  if (hour >= 2 && hour < 6) return "Small hours";
  return "Before dusk";
}

export function timeLabel(at: string): string {
  const hour = Number(at.slice(11, 13));
  const minute = at.slice(14, 16);
  const suffix = hour >= 12 ? "PM" : "AM";
  const h12 = hour % 12 || 12;
  return `${h12}:${minute} ${suffix}`;
}

export function dayKey(at: string): string {
  return at.slice(0, 10);
}

export function dayLabel(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  if (!year || !month || !day) return key;
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function netOf(txs: Tx[]): number {
  return txs.reduce((sum, tx) => sum + (tx.kind === "in" ? tx.amount : -tx.amount), 0);
}

export function sumKind(txs: Tx[], kind: Kind): number {
  return txs.filter((tx) => tx.kind === kind).reduce((sum, tx) => sum + tx.amount, 0);
}

export function formatMoney(amount: number, currency: Currency): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function monogram(name: string): string {
  const letter = name.trim().charAt(0).toUpperCase();
  return letter || "A";
}

export function parseAmount(raw: string): number | null {
  const n = Number(raw.replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
}

const STORE = "midnight-ledger-v1";

export type SavedLedger = {
  txs: Tx[];
  name: string;
  currency: Currency;
};

export function loadLedger(): SavedLedger | null {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<SavedLedger>;
    if (!Array.isArray(data.txs)) return null;
    const currency: Currency =
      data.currency === "USD" || data.currency === "EUR" || data.currency === "INR"
        ? data.currency
        : "INR";
    return {
      txs: data.txs.filter(
        (tx): tx is Tx =>
          !!tx &&
          typeof tx.id === "string" &&
          typeof tx.merchant === "string" &&
          typeof tx.amount === "number" &&
          (tx.kind === "in" || tx.kind === "out"),
      ),
      name: typeof data.name === "string" && data.name.trim() ? data.name : "Asha",
      currency,
    };
  } catch {
    return null;
  }
}

export function saveLedger(data: SavedLedger) {
  localStorage.setItem(STORE, JSON.stringify(data));
}
