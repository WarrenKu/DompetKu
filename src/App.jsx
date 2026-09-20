import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowLeft, Bell, BookOpenCheck, Building2, CheckCircle2, ChevronDown, ChevronRight, Copy, CreditCard, Info, Landmark, KeyRound, MessageSquareText, ReceiptText, Search, Send, ShieldCheck, UserPlus, WalletCards, X } from "lucide-react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { BalanceCard } from "./components/BalanceCard";
import { AuthPage } from "./components/AuthPage";
import { bankOptions } from "./bankOptions";
import { LandingPage, LegalPage } from "./components/LandingPage";
import { Logo } from "./components/Logo";
import { MobileNav } from "./components/MobileNav";
import { QuickActions } from "./components/QuickActions";
import { ServiceGrid } from "./components/ServiceGrid";
import { Sidebar } from "./components/Sidebar";
import { SpendingCard } from "./components/SpendingCard";
import { TransactionList } from "./components/TransactionList";
import { paymentServices } from "./data";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const demoUser = {
  slug: "dimas",
  name: "Dimas",
  initials: "DM",
  bankId: "KK-DIM-DEMO",
};

const authAttemptKey = "kantongku.authAttempts";
const maxAuthAttempts = 3;
const lockDurationMs = 5 * 60 * 1000;
const transferAdminFee = 1500;
const toastDurationMs = 3600;
const toastExitMs = 360;
const payTokenSalt = "kantongku-qris-v1";

function checksumText(value = "") {
  let hash = 2166136261;
  const text = `${payTokenSalt}:${value}`;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function encodeBase64Url(value = "") {
  return btoa(unescape(encodeURIComponent(value))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value = "") {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return decodeURIComponent(escape(atob(padded)));
}

function createPayToken({ amount = 0, to = "" } = {}) {
  const payload = {
    a: Number(amount) || 0,
    i: Date.now(),
    t: String(to || "").replace(/\D/g, ""),
    v: 2,
  };
  const body = `${payload.v}.${payload.t}.${payload.a}.${payload.i}`;
  return encodeBase64Url(JSON.stringify({ ...payload, c: checksumText(body) }));
}

function parsePayToken(token = "") {
  try {
    const envelope = JSON.parse(decodeBase64Url(token));
    if (envelope.v === 2) {
      const to = String(envelope.t || "").replace(/\D/g, "");
      const amount = Number(envelope.a || 0);
      const issuedAt = Number(envelope.i || 0);
      const body = `${envelope.v}.${to}.${amount}.${issuedAt}`;
      if (!to || !envelope.c || envelope.c !== checksumText(body)) return null;
      return {
        amount,
        isEncoded: true,
        to,
      };
    }

    const body = decodeBase64Url(envelope.body || "");
    if (!envelope.checksum || envelope.checksum !== checksumText(body)) return null;
    const payload = JSON.parse(body);
    const to = String(payload.to || "").replace(/\D/g, "");
    if (!to) return null;
    return {
      amount: Number(payload.amount || 0),
      isEncoded: true,
      to,
    };
  } catch {
    return null;
  }
}

function createPayUrl({ amount = 0, to = "" } = {}) {
  const token = createPayToken({ amount, to });
  return `${window.location.origin}/pay?q=${encodeURIComponent(token)}`;
}

function createUserWorkspaceUrl(userSlug = demoUser.slug, section = "dashboard") {
  return `/@${userSlug}/s?=${section}`;
}

function getUserWorkspace(location = window.location) {
  const match = location.pathname.match(/^\/@([a-z0-9-]+)\/s\/?$/i);
  if (!match) return null;

  return {
    section: location.search.startsWith("?=") ? location.search.slice(2) || "dashboard" : "dashboard",
    userSlug: match[1],
  };
}

function getPayRequest(location = window.location) {
  if (location.pathname !== "/pay") return null;
  const params = new URLSearchParams(location.search);
  return parsePayToken(params.get("q") || "");
}

function parseKantongPayPayload(rawValue = "") {
  try {
    const url = new URL(rawValue, window.location.origin);
    if (url.pathname !== "/pay") return null;
    const params = new URLSearchParams(url.search);
    return parsePayToken(params.get("q") || "");
  } catch {
    return null;
  }
}

function useToastController() {
  const [toasts, setToasts] = useState([]);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)));
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, toastExitMs);
  }, []);

  const notify = useCallback((toast) => {
    const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    const nextToast = {
      description: "",
      duration: toastDurationMs,
      title: "Info",
      type: "info",
      ...toast,
      id,
    };

    setToasts((current) => [nextToast, ...current].slice(0, 3));
    window.setTimeout(() => dismissToast(id), nextToast.duration);
    return id;
  }, [dismissToast]);

  return { dismissToast, notify, toasts };
}

function ToastItem({ toast, onDismiss }) {
  const [dragX, setDragX] = useState(0);
  const Icon = toast.type === "success" ? CheckCircle2 : toast.type === "error" ? AlertTriangle : Info;

  const handlePointerDown = (event) => {
    const startX = event.clientX;
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const handleMove = (moveEvent) => {
      setDragX(moveEvent.clientX - startX);
    };

    const handleUp = (upEvent) => {
      const delta = upEvent.clientX - startX;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      if (Math.abs(delta) > 70) {
        setDragX(delta > 0 ? 420 : -420);
        onDismiss(toast.id);
        return;
      }
      setDragX(0);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  };

  return (
    <article
      className={`toast-card toast-${toast.type} ${toast.leaving ? "is-leaving" : ""}`}
      onPointerDown={handlePointerDown}
      style={{ "--toast-drag": `${dragX}px`, "--toast-life": `${toast.duration}ms` }}
    >
      <div className="toast-icon">
        <Icon size={18} />
      </div>
      <div className="toast-copy">
        <strong>{toast.title}</strong>
        {toast.description ? <p>{toast.description}</p> : null}
      </div>
      <button className="toast-close" onClick={() => onDismiss(toast.id)} type="button" aria-label="Tutup notifikasi">
        <X size={16} />
      </button>
      <span className="toast-progress" />
    </article>
  );
}

function ToastViewport({ onDismiss, toasts = [] }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function normalizeProfile(profile) {
  if (!profile) return null;

  return {
    bankId: profile.bank_id,
    email: profile.email,
    id: profile.id,
    initials: profile.initials,
    name: profile.full_name,
    notificationsReadAt: profile.notifications_read_at || "",
    pin: profile.pin_code || "",
    slug: profile.slug,
  };
}

function readAuthAttempts() {
  try {
    return JSON.parse(sessionStorage.getItem(authAttemptKey)) || {};
  } catch {
    return {};
  }
}

function writeAuthAttempts(attempts) {
  sessionStorage.setItem(authAttemptKey, JSON.stringify(attempts));
}

function getAttemptState(identity) {
  const key = identity.trim().toLowerCase() || "unknown";
  const attempts = readAuthAttempts();
  const record = attempts[key];

  if (!record) return { key, isLocked: false, remainingAttempts: maxAuthAttempts };

  if (record.lockedUntil && Date.now() < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - Date.now()) / 1000);
    return { key, isLocked: true, remainingAttempts: 0, remainingSeconds };
  }

  if (record.lockedUntil) {
    delete attempts[key];
    writeAuthAttempts(attempts);
    return { key, isLocked: false, remainingAttempts: maxAuthAttempts };
  }

  return {
    key,
    isLocked: false,
    remainingAttempts: Math.max(0, maxAuthAttempts - (record.count || 0)),
  };
}

function registerFailedAttempt(key) {
  const attempts = readAuthAttempts();
  const count = (attempts[key]?.count || 0) + 1;
  const lockedUntil = count >= maxAuthAttempts ? Date.now() + lockDurationMs : null;

  attempts[key] = { count, lockedUntil };
  writeAuthAttempts(attempts);

  return {
    isLocked: Boolean(lockedUntil),
    remainingAttempts: Math.max(0, maxAuthAttempts - count),
  };
}

function clearFailedAttempts(key) {
  const attempts = readAuthAttempts();
  delete attempts[key];
  writeAuthAttempts(attempts);
}

async function fetchProfile(userId) {
  if (!isSupabaseConfigured || !userId) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;

  return normalizeProfile(data);
}

function getMonthlyExpense(transactions = []) {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();

  return transactions.reduce((total, transaction) => {
    const createdAt = new Date(transaction.created_at);
    const amount = Number(transaction.amount) || 0;
    const isCurrentMonth = createdAt.getMonth() === month && createdAt.getFullYear() === year;

    if (!isCurrentMonth || amount >= 0) return total;
    return total + Math.abs(amount);
  }, 0);
}

async function fetchDashboardData(userId) {
  if (!isSupabaseConfigured || !userId) {
    return { account: null, transactions: [] };
  }

  const [{ data: account }, { data: transactions }] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("transactions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, 999),
  ]);

  return {
    account: account || null,
    transactions: transactions || [],
  };
}

function AccountSettings({ notify, user }) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [message, setMessage] = useState("");

  const handlePinSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!/^\d{6}$/.test(pin)) {
      setMessage("PIN harus 6 digit angka.");
      notify?.({ description: "Gunakan 6 digit angka untuk PIN akses.", title: "PIN belum valid", type: "error" });
      return;
    }

    if (pin !== confirmPin) {
      setMessage("Konfirmasi PIN belum sama.");
      notify?.({ description: "Ulangi PIN harus sama dengan PIN baru.", title: "Konfirmasi belum sama", type: "error" });
      return;
    }

    const { error } = await supabase.from("profiles").update({ pin_code: pin }).eq("id", user.id);

    if (error) {
      setMessage(error.message);
      notify?.({ description: error.message, title: "Gagal menyimpan PIN", type: "error" });
      return;
    }

    setPin("");
    setConfirmPin("");
    setMessage("PIN berhasil diperbarui.");
    notify?.({ description: "PIN akses akun sudah diperbarui.", title: "PIN berhasil disimpan", type: "success" });
  };

  return (
    <div className="grid gap-7 lg:grid-cols-[1fr_0.85fr]">
      <section className="neo-card bg-white p-6">
        <p className="eyebrow">Pengaturan akun</p>
        <h2 className="mt-2 font-display text-2xl font-black">Identitas KantongKu</h2>

        <div className="mt-6 grid gap-4">
          <div className="border-2 border-ink bg-canvas p-4">
            <p className="text-xs font-black text-muted">Nama</p>
            <p className="mt-1 font-display text-xl font-black">{user.name}</p>
          </div>
          <div className="border-2 border-ink bg-canvas p-4">
            <p className="text-xs font-black text-muted">Email</p>
            <p className="mt-1 break-all text-sm font-black">{user.email}</p>
          </div>
          <div className="border-2 border-ink bg-blue p-4">
            <p className="text-xs font-black text-ink/65">ID bank</p>
            <p className="mt-1 font-display text-xl font-black">{user.bankId}</p>
            <p className="mt-2 text-xs font-bold text-ink/70">ID ini dibuat sistem dan tidak bisa diubah manual.</p>
          </div>
        </div>
      </section>

      <section className="neo-card bg-yellow p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 place-items-center border-2 border-ink bg-white shadow-[3px_3px_0_#171717]">
            <KeyRound size={22} />
          </span>
          <div>
            <p className="eyebrow">Keamanan</p>
            <h2 className="mt-1 font-display text-xl font-black">Atur PIN akses</h2>
          </div>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handlePinSubmit}>
          <label className="auth-field">
            <span>PIN baru</span>
            <div>
              <ShieldCheck size={17} />
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="6 digit angka"
                type="password"
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
              />
            </div>
          </label>
          <label className="auth-field">
            <span>Confirm PIN</span>
            <div>
              <ShieldCheck size={17} />
              <input
                inputMode="numeric"
                maxLength={6}
                placeholder="Ulangi PIN"
                type="password"
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, ""))}
              />
            </div>
          </label>
          <button className="neo-button bg-white" type="submit">
            Simpan PIN
          </button>
        </form>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>
    </div>
  );
}

const actionCopy = {
  pay: {
    amountLabel: "Nominal bayar",
    button: "Bayar sekarang",
    merchantLabel: "Nama tagihan / merchant",
    merchantPlaceholder: "Contoh: Internet rumah",
    title: "Bayar",
    type: "payment",
  },
  topup: {
    amountLabel: "Nominal isi saldo",
    button: "Isi saldo",
    merchantLabel: "Sumber dana",
    merchantPlaceholder: "Contoh: Bank transfer",
    title: "Isi saldo",
    type: "topup",
  },
  transfer: {
    amountLabel: "Nominal transfer",
    button: "Kirim transfer",
    merchantLabel: "Tujuan transfer",
    merchantPlaceholder: "Nama / rekening tujuan",
    title: "Transfer",
    type: "transfer",
  },
};

function formatPlainAccountNumber(accountNumber = "") {
  return String(accountNumber).replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
}

function parseMoneyInput(value = "") {
  return Number(String(value).replace(/\D/g, ""));
}

function formatMoneyInput(value = "") {
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

function formatBankAccountInput(value = "") {
  return String(value)
    .replace(/\D/g, "")
    .slice(0, 18)
    .replace(/(.{4})/g, "$1-")
    .replace(/-$/, "");
}

function formatDashboardMoney(value = 0, withSign = false) {
  const amount = Number(value) || 0;
  const prefix = withSign && amount > 0 ? "+" : withSign && amount < 0 ? "-" : "";
  return `${prefix}Rp${new Intl.NumberFormat("id-ID").format(Math.abs(amount))}`;
}

function formatDashboardDate(value) {
  if (!value) return "Baru saja";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function getTransactionNotice(transaction) {
  const amount = Number(transaction.amount) || 0;
  const status = (transaction.status || "berhasil").toLowerCase();
  const type = transaction.type?.toLowerCase();
  const isFailed = status !== "berhasil";
  const target = transaction.merchant || transaction.note || "Transaksi";

  if (isFailed) {
    return {
      body: `${target} belum selesai. Ref: ${getDashboardRef(transaction)}`,
      title: "Transaksi perlu dicek",
      tone: "yellow",
    };
  }

  if (amount > 0 || type === "income") {
    return {
      body: `${formatDashboardMoney(amount, true)} dari ${target}.`,
      title: "Dana masuk",
      tone: "lime",
    };
  }

  if (type === "payment") {
    return {
      body: `${target} dibayar ${formatDashboardMoney(amount, true)}.`,
      title: "Pembayaran berhasil",
      tone: "pink",
    };
  }

  if (type === "topup") {
    return {
      body: `${formatDashboardMoney(amount, true)} masuk ke KantongKu.`,
      title: "Isi saldo berhasil",
      tone: "blue",
    };
  }

  return {
    body: `${formatDashboardMoney(amount, true)} ke ${target}.`,
    title: "Transfer berhasil",
    tone: "red",
  };
}

function getDashboardRef(transaction) {
  if (transaction.ref_code) return transaction.ref_code;
  const source = String(transaction.id || transaction.created_at || Date.now()).replace(/\W/g, "").toUpperCase();
  return `SUMA-KK${source.slice(0, 12).padEnd(12, "0")}`;
}

function splitBankCodeFromInput(value = "") {
  const digits = String(value).replace(/\D/g, "");
  const bankCodeMatch = bankOptions.find((bank) => digits.startsWith(bank.code));

  if (!bankCodeMatch || digits.length <= bankCodeMatch.code.length) {
    return {
      account: bankCodeMatch ? "" : digits,
      bank: bankCodeMatch || null,
    };
  }

  return {
    account: digits.slice(bankCodeMatch.code.length),
    bank: bankCodeMatch,
  };
}

function BankLogo({ bank }) {
  const [imageFailed, setImageFailed] = useState(false);
  const fallback = bank?.code?.slice(0, 2) || "BK";

  if (bank?.image && !imageFailed) {
    return <img alt={bank.name} className="bank-logo-img" onError={() => setImageFailed(true)} src={bank.image} />;
  }

  return <span className="bank-logo-fallback">{fallback}</span>;
}

function playTransferSound(type = "success") {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    gain.connect(audioContext.destination);
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioContext.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.42);

    const notes = type === "success" ? [660, 880, 1046] : [260, 196];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime + index * 0.09);
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.09);
      oscillator.stop(audioContext.currentTime + index * 0.09 + 0.12);
    });

    window.setTimeout(() => audioContext.close(), 650);
  } catch {
    // Sound is optional; ignore browser audio restrictions.
  }
}

function QuickActionPanel({ account, action, notify, onClose, onSubmit }) {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [message, setMessage] = useState("");

  if (!action) return null;

  const isReceive = action === "receive";
  const config = actionCopy[action];

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const result = await onSubmit({
      action,
      amount: parseMoneyInput(amount),
      merchant: merchant.trim(),
    });

    if (!result.ok) {
      setMessage(result.message);
      return;
    }

    setAmount("");
    setMerchant("");
    setMessage(result.message);
  };

  const copyAccount = async () => {
    await navigator.clipboard?.writeText(account?.account_number || "");
    setMessage("Nomor rekening disalin.");
    notify?.({ description: "Nomor rekening KantongKu sudah masuk clipboard.", title: "Rekening disalin", type: "info" });
  };

  return (
    <section className="action-panel neo-card bg-white p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="eyebrow">{isReceive ? "Terima uang" : "Aksi cepat"}</p>
          <h2 className="mt-1 font-display text-2xl font-black">{isReceive ? "Bagikan rekening" : config.title}</h2>
        </div>
        <button className="icon-button-light" aria-label="Tutup aksi" onClick={onClose} type="button">
          <X size={18} />
        </button>
      </div>

      {isReceive ? (
        <div className="mt-5 grid gap-4">
          <div className="border-2 border-ink bg-blue p-4 shadow-[4px_4px_0_#171717]">
            <p className="text-xs font-black text-ink/65">Nomor rekening KantongKu</p>
            <p className="mt-2 font-display text-2xl font-black tracking-wide">
              {formatPlainAccountNumber(account?.account_number)}
            </p>
            <p className="mt-2 text-xs font-bold text-ink/70">Berikan nomor ini ke pengirim.</p>
          </div>
          <button className="neo-button bg-lime" onClick={copyAccount} type="button">
            <Copy size={17} /> Salin nomor rekening
          </button>
        </div>
      ) : (
        <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{config.merchantLabel}</span>
            <div>
              <ShieldCheck size={17} />
              <input
                placeholder={config.merchantPlaceholder}
                required
                value={merchant}
                onChange={(event) => setMerchant(event.target.value)}
              />
            </div>
          </label>
          <label className="auth-field">
            <span>{config.amountLabel}</span>
            <div>
              <KeyRound size={17} />
              <input
                inputMode="numeric"
                min="1000"
                placeholder="Contoh: 50.000"
                required
                type="text"
                value={amount}
                onChange={(event) => setAmount(formatMoneyInput(event.target.value))}
              />
            </div>
          </label>
          <button className="neo-button bg-yellow" type="submit">
            {config.button}
          </button>
        </form>
      )}

      {message ? <p className="auth-message">{message}</p> : null}
    </section>
  );
}

function NotificationBell({ transactions = [], user }) {
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);
  const wasOpenRef = useRef(false);
  const storedReadAt = (() => {
    try {
      return localStorage.getItem(`kantongku.notificationsReadAt:${user?.id || "guest"}`) || "";
    } catch {
      return "";
    }
  })();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [suppressHover, setSuppressHover] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [lastReadAt, setLastReadAt] = useState(() => user?.notificationsReadAt || storedReadAt);
  const notices = transactions.slice(0, 5).map((transaction) => ({
    createdAt: transaction.created_at,
    id: transaction.id,
    time: formatDashboardDate(transaction.created_at),
    ...getTransactionNotice(transaction),
  }));
  const opened = isPinned || (isHovered && !suppressHover);
  const panelVisible = opened || isClosing;
  const unreadCount = notices.filter((notice) => {
    if (!lastReadAt) return true;
    return new Date(notice.createdAt || 0).getTime() > new Date(lastReadAt).getTime();
  }).length;

  useEffect(() => {
    if (user?.notificationsReadAt) setLastReadAt(user.notificationsReadAt);
  }, [user?.notificationsReadAt]);

  useEffect(() => {
    window.clearTimeout(closeTimerRef.current);

    if (opened) {
      setIsClosing(false);
      wasOpenRef.current = true;
      return undefined;
    }

    if (!wasOpenRef.current) return undefined;
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setIsClosing(false);
      wasOpenRef.current = false;
    }, 180);

    return () => window.clearTimeout(closeTimerRef.current);
  }, [opened]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.id) return undefined;

    const channel = supabase
      .channel(`notification-read:${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", filter: `id=eq.${user.id}`, schema: "public", table: "profiles" },
        (payload) => setLastReadAt(payload.new?.notifications_read_at || ""),
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user?.id]);

  const markAsRead = useCallback(async () => {
    if (!notices.length) return;
    const nextReadAt = new Date().toISOString();
    setLastReadAt(nextReadAt);
    try {
      localStorage.setItem(`kantongku.notificationsReadAt:${user?.id || "guest"}`, nextReadAt);
    } catch {
      // Penyimpanan lokal hanya fallback apabila browser membatasinya.
    }

    if (!isSupabaseConfigured || !user?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({ notifications_read_at: nextReadAt })
      .eq("id", user.id);

    // Migrasi schema lama belum memiliki kolom ini. State lokal tetap membuat
    // notifikasi terbaca di perangkat sekarang tanpa mengganggu interaksi UI.
    if (error) return;
  }, [notices.length, user?.id]);

  const handleButtonClick = () => {
    if (isPinned) {
      setIsPinned(false);
      setSuppressHover(true);
      return;
    }

    setSuppressHover(false);
    setIsPinned(true);
    void markAsRead();
  };

  useEffect(() => {
    const closeFromOutside = (event) => {
      if (!wrapRef.current?.contains(event.target)) {
        setIsPinned(false);
        setIsHovered(false);
        setSuppressHover(true);
      }
    };
    const closeFromKeyboard = (event) => {
      if (event.key !== "Escape") return;
      setIsPinned(false);
      setIsHovered(false);
      setSuppressHover(true);
    };

    document.addEventListener("pointerdown", closeFromOutside);
    document.addEventListener("keydown", closeFromKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside);
      document.removeEventListener("keydown", closeFromKeyboard);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="notification-wrap"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setSuppressHover(false);
      }}
    >
      <button
        className="header-icon"
        aria-label="Notifikasi"
        aria-expanded={opened}
        aria-pressed={isPinned}
        onClick={handleButtonClick}
        type="button"
      >
        <Bell size={20} strokeWidth={2.5} />
        {unreadCount ? <span className="notification-dot" /> : null}
      </button>

      {panelVisible ? (
        <section className={`notification-panel neo-card bg-white ${isClosing ? "is-closing" : ""}`}>
          <div className="notification-head">
            <p className="eyebrow">Notifikasi</p>
            <span>{unreadCount || notices.length}</span>
          </div>
          <div className="notification-list">
            {notices.length ? (
              notices.map((notice) => (
                <article className="notification-item" key={notice.id}>
                  <span className={`notification-mark ${notice.tone}`} />
                  <div>
                    <strong>{notice.title}</strong>
                    <p>{notice.body}</p>
                    <small>{notice.time}</small>
                  </div>
                </article>
              ))
            ) : (
              <article className="notification-empty">
                <strong>Belum ada notifikasi</strong>
                <p>Aktivitas pembayaran, transfer, dan status transaksi akan muncul di sini.</p>
              </article>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function TransactionMessageCenter({ mode = "messages", notify, onBack, transactions = [], user }) {
  const isReceiptMode = mode === "receipts";
  const items = transactions.map((transaction) => ({
    ...transaction,
    notice: getTransactionNotice(transaction),
  }));

  if (isReceiptMode) {
    return (
      <section className="transaction-center-card">
        <div className="transaction-archive-topbar">
          <button className="transfer-detail-back" onClick={onBack} type="button">
            <ArrowLeft size={16} /> Kembali
          </button>
          <span>Semua transaksi</span>
        </div>
        <TransactionList
          className="transaction-archive-list"
          maxItems={0}
          notify={notify}
          showViewAll={false}
          title=""
          transactions={transactions}
          user={user}
        />
      </section>
    );
  }

  return (
    <section className="transaction-center-card neo-card bg-white p-5">
      <button className="transfer-detail-back mb-4" onClick={onBack} type="button">
        <ArrowLeft size={16} /> Kembali
      </button>
      <div className="transaction-center-head">
        <p className="eyebrow">Pesan transaksi</p>
        <h2>Semua status transaksi.</h2>
        <p>
          Pantau transfer masuk, pembayaran berhasil, pembayaran dibatalkan, dan info transaksi lainnya.
        </p>
      </div>

      <div className="transaction-message-list">
        {items.length ? (
          items.map((item) => (
            <article className="transaction-message-row" key={item.id}>
              <span className={`notification-mark ${item.notice.tone}`} />
              <div>
                <strong>{isReceiptMode ? getDashboardRef(item) : item.notice.title}</strong>
                <p>{isReceiptMode ? item.notice.body : item.notice.body}</p>
                <small>
                  {formatDashboardDate(item.created_at)}
                  {item.status ? ` · Status: ${item.status}` : ""}
                </small>
              </div>
              <span className="transaction-message-amount">
                {formatDashboardMoney(item.amount, true)}
              </span>
            </article>
          ))
        ) : (
          <article className="transaction-message-empty">
            <MessageSquareText size={28} />
            <strong>Belum ada pesan transaksi</strong>
            <p>Setelah ada transfer, pembayaran, atau isi saldo, semua informasinya akan masuk ke sini.</p>
          </article>
        )}
      </div>
    </section>
  );
}

function HelpCenter({ notify, onBack }) {
  const supportEmail = "noreply@suma.my.id";
  const helpTopics = [
    {
      Icon: ReceiptText,
      title: "Transaksi & bukti",
      body: "Cek status transfer, bukti pembayaran, nomor referensi, dan riwayat transaksi yang sudah tercatat.",
    },
    {
      Icon: ShieldCheck,
      title: "Keamanan akun",
      body: "Atur PIN, pastikan perangkat aman, dan jangan bagikan kode akses atau detail rekening ke orang lain.",
    },
    {
      Icon: WalletCards,
      title: "Saldo & pembayaran",
      body: "Pantau saldo, pembayaran QRIS, tagihan, isi saldo, dan transaksi masuk realtime dari KantongKu.",
    },
    {
      Icon: KeyRound,
      title: "Login & akses",
      body: "Gunakan nomor rekening KantongKu atau ID bank generik untuk masuk. PIN diminta jika sudah diatur.",
    },
  ];

  const faqItems = [
    ["Transfer berhasil tapi penerima belum melihat saldo?", "Simpan nomor referensi, cek bukti transaksi, lalu hubungi bantuan resmi agar transaksi bisa ditelusuri."],
    ["Kenapa pembayaran meminta PIN?", "PIN dipakai sebagai konfirmasi tambahan. Kalau akun belum punya PIN, pembayaran tertentu bisa lanjut tanpa PIN."],
    ["Apa itu nomor referensi SUMA-KK?", "Nomor referensi adalah kode unik transaksi untuk pencarian bukti, audit, dan bantuan jika ada kendala."],
    ["Apakah email resmi KantongKu?", `Kontak bantuan resmi project ini adalah ${supportEmail}. Jangan kirim password atau PIN lewat email.`],
  ];

  const copyEmail = async () => {
    await navigator.clipboard?.writeText(supportEmail);
    notify?.({ description: `${supportEmail} sudah disalin.`, title: "Email bantuan disalin", type: "success" });
  };

  return (
    <section className="help-page">
      <div className="help-topbar">
        <button className="transfer-detail-back" onClick={onBack} type="button">
          <ArrowLeft size={16} /> Kembali
        </button>
        <span>Bantuan KantongKu</span>
      </div>

      <div className="help-hero neo-card bg-white">
        <p className="eyebrow">Pusat bantuan</p>
        <h2>Butuh arahan? Mulai dari sini.</h2>
        <p>
          Semua informasi penting untuk transaksi, keamanan, QRIS, saldo, dan bukti pembayaran dikumpulkan di satu tempat.
        </p>
      </div>

      <div className="help-grid">
        {helpTopics.map(({ Icon, title, body }) => (
          <article className="help-topic neo-card bg-white" key={title}>
            <span className="help-topic-icon bg-lime">
              <Icon size={21} strokeWidth={2.5} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="help-flow neo-card bg-blue">
        <p className="eyebrow">Kalau transaksi bermasalah</p>
        <div className="help-steps">
          <span>1. Buka bukti transaksi</span>
          <span>2. Salin nomor referensi</span>
          <span>3. Kirim detail ke bantuan resmi</span>
        </div>
      </section>

      <section className="help-faq neo-card bg-white">
        <p className="eyebrow">Pertanyaan umum</p>
        {faqItems.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>

      <section className="help-contact neo-card bg-lime">
        <div>
          <p className="eyebrow">Kontak resmi</p>
          <h3>{supportEmail}</h3>
          <p>Gunakan email ini untuk laporan legal, privasi, keamanan, kerja sama, atau kendala transaksi.</p>
        </div>
        <div className="help-contact-actions">
          <button className="neo-button bg-white" onClick={copyEmail} type="button">
            <Copy size={16} /> Salin email
          </button>
          <a className="neo-button bg-yellow" href={`mailto:${supportEmail}?subject=Bantuan%20KantongKu`}>
            <Send size={16} /> Kirim email
          </a>
        </div>
      </section>
    </section>
  );
}

function PayView({ notify, onBack, onSubmit, onViewReceipt, user }) {
  const [selectedService, setSelectedService] = useState(paymentServices[0]);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [successReceipt, setSuccessReceipt] = useState(null);
  const [paymentFeedback, setPaymentFeedback] = useState(null);
  const [pin, setPin] = useState("");
  const [visiblePinIndex, setVisiblePinIndex] = useState(-1);
  const [confirmingPin, setConfirmingPin] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const numericAmount = parseMoneyInput(amount);
  const billId = merchant.trim();
  const servicePrefixMap = {
    "E-Wallet": "E-WALLET",
    "Listrik PLN": "PLN LISTRIK",
    "Pulsa & Tagihan": "PULSA",
    "Tagihan Saya": "TAGIHAN",
    "Top Up": "TOP UP",
  };
  const servicePrefix = servicePrefixMap[selectedService.label] || selectedService.label.toUpperCase();
  const displayName = billId ? `${servicePrefix} - ${billId}` : selectedService.label;

  useEffect(() => {
    if (visiblePinIndex < 0) return undefined;
    const timeout = window.setTimeout(() => setVisiblePinIndex(-1), 520);
    return () => window.clearTimeout(timeout);
  }, [pin, visiblePinIndex]);

  const resetPin = () => {
    setPin("");
    setVisiblePinIndex(-1);
  };

  const processPayment = async () => {
    if (isPaying) return;
    setMessage("");
    setIsPaying(true);

    const result = await onSubmit({
      action: "pay",
      amount: numericAmount,
      merchant: displayName,
      note: `${selectedService.label} - ${displayName}`,
      suppressToast: true,
    });
    setIsPaying(false);

    if (!result.ok) {
      playTransferSound("error");
      setPaymentFeedback({
        description: result.message,
        title: "Pembayaran gagal",
        type: "error",
      });
      setMessage(result.message);
      return;
    }

    playTransferSound("success");
    setSuccessReceipt({
      amount: numericAmount,
      date: new Date().toISOString(),
      ref: `SUMA-KK${crypto?.randomUUID?.().replace(/\W/g, "").slice(0, 12).toUpperCase() || Date.now()}`,
      service: selectedService.label,
      target: displayName,
    });
    setPaymentFeedback({
      amount: numericAmount,
      description: `${formatDashboardMoney(numericAmount)} sudah tercatat di bukti transaksi.`,
      target: displayName,
      title: "Pembayaran berhasil",
      type: "success",
    });
    notify?.({
      description: `${formatDashboardMoney(numericAmount)} dibayarkan ke ${displayName}.`,
      title: "Pembayaran berhasil",
      type: "success",
    });
    setAmount("");
    setMerchant("");
    resetPin();
    setConfirmingPin(false);
    setMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!numericAmount || numericAmount < 1000) {
      playTransferSound("error");
      setMessage("Nominal minimal Rp1.000.");
      return;
    }

    if (!user?.pin) {
      await processPayment();
      return;
    }

    playTransferSound("success");
    resetPin();
    setConfirmingPin(true);
  };

  const pressPinKey = (key) => {
    if (isPaying) return;

    let nextPin = pin;
    if (key === "backspace") {
      setVisiblePinIndex(-1);
      nextPin = pin.slice(0, -1);
    } else if (key === "clear") {
      setVisiblePinIndex(-1);
      nextPin = "";
    } else if (pin.length < 6) {
      setVisiblePinIndex(pin.length);
      nextPin = `${pin}${key}`.replace(/\D/g, "");
    }

    setPin(nextPin);
    if (nextPin.length !== 6) return;

    if (nextPin !== user.pin) {
      playTransferSound("error");
      notify?.({ description: "PIN pembayaran tidak sesuai.", title: "PIN salah", type: "error" });
      window.setTimeout(resetPin, 260);
      return;
    }

    processPayment();
  };

  return (
    <section className="pay-page">
      <div className="pay-layout">
        <article className="pay-main neo-card bg-white">
          <div className="transfer-page-head">
            <button className="transfer-back-btn" onClick={onBack} type="button">
              <ArrowLeft size={17} />
              <span>Kembali</span>
            </button>
            <span className="transfer-head-badge">
              <ReceiptText size={14} />
              Layanan bayar
            </span>
          </div>

          <p className="eyebrow mt-6">Pembayaran</p>
          <h2 className="pay-title">Mau bayar apa hari ini?</h2>
          <p className="pay-copy">Pilih layanan, isi detail tagihan, lalu bayar langsung dari saldo KantongKu.</p>

          <div className="pay-service-grid" aria-label="Pilih layanan pembayaran">
            {paymentServices.map((service) => {
              const Icon = service.icon;
              const isActive = selectedService.label === service.label;
              return (
                <button
                  className={`pay-service-card ${isActive ? "active" : ""}`}
                  key={service.label}
                  onClick={() => {
                    setSelectedService(service);
                    setMessage("");
                  }}
                  type="button"
                >
                  <span className={`pay-service-icon ${service.tone}`}>
                    <Icon size={22} strokeWidth={2.7} />
                  </span>
                  <span>{service.label}</span>
                </button>
              );
            })}
          </div>

          <form className="pay-form" onSubmit={handleSubmit}>
            <label className="auth-field">
              <span>Nama tagihan / nomor pelanggan</span>
              <div>
                <ReceiptText size={17} />
                <input
                  placeholder={selectedService.label === "Listrik PLN" ? "Contoh: IDPEL 52xxxx" : "Contoh: Internet rumah"}
                  value={merchant}
                  onChange={(event) => {
                    setMerchant(event.target.value);
                    setSuccessReceipt(null);
                  }}
                />
              </div>
            </label>
            <label className="auth-field">
              <span>Nominal bayar</span>
              <div>
                <KeyRound size={17} />
                <input
                  inputMode="numeric"
                  placeholder="Contoh: 50.000"
                  value={amount}
                  onChange={(event) => {
                    setAmount(formatMoneyInput(event.target.value));
                    setSuccessReceipt(null);
                  }}
                />
              </div>
            </label>
            <button className="neo-button bg-lime w-full" disabled={isPaying || confirmingPin} type="submit">
              {confirmingPin ? "Menunggu PIN" : "Bayar sekarang"}
            </button>
          </form>

          {confirmingPin ? (
            <div className="pay-pin-panel neo-card bg-white">
              <div className="payment-pin-head">
                <button className="payment-pin-back" onClick={() => { resetPin(); setConfirmingPin(false); }} type="button" aria-label="Kembali ke pembayaran">
                  <ArrowLeft size={17} />
                </button>
                <span className="secure-pad-label">PIN pembayaran</span>
              </div>
              <div className="secure-pin-display" aria-label="PIN pembayaran">
                <ShieldCheck size={17} />
                <strong>
                  {pin
                    ? pin.split("").map((digit, index) => (index === visiblePinIndex ? digit : "•")).join("")
                    : "Masukkan PIN"}
                </strong>
              </div>
              <div className="secure-keypad secure-pin-keypad" aria-label="Keypad PIN pembayaran">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => (
                  <button key={key} onClick={() => pressPinKey(key)} type="button">
                    {key === "clear" ? "C" : key === "backspace" ? "⌫" : key}
                  </button>
                ))}
              </div>
              <p className="payment-pin-hint">{isPaying ? "Memproses pembayaran..." : "Masukkan 6 digit PIN untuk membayar."}</p>
            </div>
          ) : null}

          {message ? <p className="auth-message">{message}</p> : null}

          {successReceipt ? (
            <p className="pay-inline-success">Pembayaran {successReceipt.target} berhasil diproses.</p>
          ) : null}
        </article>

        <aside className="pay-summary neo-card bg-yellow">
          <p className="eyebrow">Ringkasan</p>
          <h3>{selectedService.label}</h3>
          <div className="pay-summary-list">
            <p><span>Tujuan</span><strong>{displayName}</strong></p>
            <p><span>Nominal</span><strong>{numericAmount ? formatDashboardMoney(numericAmount) : "Belum diisi"}</strong></p>
            <p><span>Admin</span><strong>Rp0</strong></p>
            <p><span>Status</span><strong>Siap diproses realtime</strong></p>
          </div>
          <p className="pay-summary-note">Pembayaran yang berhasil akan masuk ke riwayat dan bukti transaksi.</p>
        </aside>
      </div>

      {paymentFeedback ? (
        <div className="pay-feedback-backdrop" role="presentation">
          <section className={`pay-feedback-modal neo-card ${paymentFeedback.type === "success" ? "bg-lime" : "bg-pink"}`} role="dialog" aria-modal="true" aria-label={paymentFeedback.title}>
            <div className={`pay-feedback-icon ${paymentFeedback.type}`}>
              {paymentFeedback.type === "success" ? <CheckCircle2 size={42} /> : <AlertTriangle size={42} />}
            </div>
            <p className="eyebrow">{paymentFeedback.type === "success" ? "Selesai" : "Gagal"}</p>
            <h3>{paymentFeedback.title}</h3>
            {paymentFeedback.target ? <strong>{paymentFeedback.target}</strong> : null}
            {paymentFeedback.type === "error" ? <p>{paymentFeedback.description}</p> : null}
            <div className="pay-feedback-actions">
              {paymentFeedback.type === "success" ? (
                <button
                  className="neo-button bg-white"
                  onClick={() => {
                    setPaymentFeedback(null);
                    onViewReceipt?.();
                  }}
                  type="button"
                >
                  Lihat struk
                </button>
              ) : null}
              <button className="neo-button bg-white" onClick={() => setPaymentFeedback(null)} type="button">
                Oke
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function TransferView({ account, notify, onBack, onTransfer, transactions = [], user }) {
  const [mode, setMode] = useState("menu");
  const [rail, setRail] = useState("kantong");
  const [bankCode, setBankCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [savedRecipients, setSavedRecipients] = useState([]);
  const [summary, setSummary] = useState(null);
  const [message, setMessage] = useState("");
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [bankSearch, setBankSearch] = useState("");
  const [bankListScrolling, setBankListScrolling] = useState(false);
  const [registeredReceipt, setRegisteredReceipt] = useState(null);
  const [transferResult, setTransferResult] = useState(null);

  const loadRecipients = useCallback(async () => {
    const { data } = await supabase
      .from("transfer_recipients")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setSavedRecipients(data || []);
  }, [user.id]);

  useEffect(() => {
    loadRecipients();
  }, [loadRecipients]);

  const selectedBank = bankOptions.find((bank) => bank.code === bankCode) || null;
  const isRegisterMode = mode === "register-kantong" || mode === "register-bank";
  const isTransferMode = mode === "transfer-kantong" || mode === "transfer-bank";
  const isBankTransferMode = mode === "transfer-bank";
  const isKantongTransferMode = mode === "transfer-kantong";
  const bankRecipients = savedRecipients.filter((item) => item.rail === "bank");
  const kantongRecipients = savedRecipients.filter((item) => item.rail === "kantong");

  const resetForm = () => {
    setRecipient("");
    setRecipientName("");
    setAmount("");
    setNote("");
    setBankCode("");
    setSummary(null);
    setMessage("");
    setBankPickerOpen(false);
    setBankSearch("");
    setBankListScrolling(false);
  };

  const openMode = (nextMode) => {
    setMode(nextMode);
    setRail(nextMode.includes("bank") ? "bank" : "kantong");
    resetForm();
    if (nextMode === "transfer-bank") {
      setBankPickerOpen(false);
    }
  };

  const chooseBank = (code) => {
    setBankCode(code);
    setSummary(null);
    setMessage("");
  };

  const applyBankRecipient = (item) => {
    setBankCode(item.bank_code || "");
    setRecipient(formatBankAccountInput(item.account_number));
    setRecipientName(item.account_name || "");
    setSummary(null);
    setMessage("");
  };

  const applyKantongRecipient = (item) => {
    setRecipient(item.account_number);
    setRecipientName(item.account_name || "");
    setSummary(null);
    setMessage("");
  };

  const handleBankAccountInput = (value, inputType = "") => {
    const digits = String(value).replace(/\D/g, "");
    const isDeleting = inputType.startsWith("delete");

    if (selectedBank && isDeleting && !digits) {
      setRecipient("");
      setBankCode("");
      setBankSearch("");
      setSummary(null);
      setMessage("");
      return;
    }

    if (!value.trim()) {
      setRecipient("");
      setBankCode("");
      setBankSearch("");
      setSummary(null);
      setMessage("");
      return;
    }

    if (selectedBank) {
      setRecipient(formatBankAccountInput(digits));
      setSummary(null);
      return;
    }

    const detected = splitBankCodeFromInput(value);

    if (detected.bank && detected.bank.code !== bankCode) {
      setBankCode(detected.bank.code);
      setBankPickerOpen(true);
      setBankSearch(detected.bank.code);
      setMessage(`Kode ${detected.bank.code} terdeteksi sebagai ${detected.bank.name}.`);
      notify?.({
        description: `Kode ${detected.bank.code} mengarah ke ${detected.bank.name}.`,
        title: "Bank terdeteksi",
        type: "info",
      });
    }

    setRecipient(formatBankAccountInput(detected.account));
    setSummary(null);
  };

  const handleBankListScroll = (event) => {
    setBankListScrolling(true);
    window.clearTimeout(event.currentTarget.scrollResetTimer);
    event.currentTarget.scrollResetTimer = window.setTimeout(() => {
      setBankListScrolling(false);
    }, 180);
  };

  const filteredBankOptions = bankOptions.filter((bank) => {
    const keyword = bankSearch.trim().toLowerCase();
    if (!keyword) return true;
    return `${bank.code} ${bank.name}`.toLowerCase().includes(keyword);
  });

  const resolveRecipient = async () => {
    const cleanRecipient = recipient.trim();
    const cleanBankAccount = cleanRecipient.replace(/\D/g, "");

    if (!cleanRecipient) return { ok: false, message: "Tujuan transfer wajib diisi." };

    if (rail === "kantong") {
      if (!/^\d{8,}$/.test(cleanBankAccount)) {
        return {
          ok: false,
          message: "Masukkan nomor rekening KantongKu.",
        };
      }

      let { data, error } = await supabase.rpc("lookup_kantong_recipient", {
        p_identifier: cleanBankAccount,
      });

      if (error?.message?.toLowerCase().includes("function")) {
        return {
          ok: false,
          message: "Lookup nomor rekening belum aktif. Jalankan SQL terbaru dulu di Supabase.",
        };
      } else if (Array.isArray(data)) {
        data = data[0] || null;
      }

      if (error) return { ok: false, message: error.message };
      if (!data) return { ok: false, message: "Penerima KantongKu tidak ditemukan." };
      if (data.id === user.id) return { ok: false, message: "Tidak bisa transfer ke akun sendiri." };

      return {
        ok: true,
        data: {
          accountName: data.full_name,
          accountNumber: data.account_number || data.bank_id,
          destination: data.account_number || data.bank_id,
          method: "Antar Rekening KantongKu",
          rail: "kantong",
          recipientUserId: data.id,
        },
      };
    }

    if (!selectedBank) {
      return { ok: false, message: "Pilih bank tujuan dulu." };
    }

    if (cleanBankAccount.length < 6) {
      return { ok: false, message: "Nomor rekening bank terlalu pendek." };
    }

    if (isBankTransferMode) {
      const isRegistered = bankRecipients.some(
        (item) => item.bank_code === selectedBank.code && item.account_number === cleanBankAccount,
      );

      if (!isRegistered) {
        return { ok: false, message: "Rekening ini belum terdaftar. Daftarkan rekening dulu sebelum transfer." };
      }
    }

    return {
      ok: true,
      data: {
        accountName: recipientName.trim() || "Belum diisi",
        accountNumber: cleanBankAccount,
        destination: `${selectedBank.code}-${formatBankAccountInput(cleanBankAccount)}`,
        method: `Antar Bank - ${selectedBank.name}`,
        rail: "bank",
      },
    };
  };

  const saveRecipient = async (resolved) => {
    const { error } = await supabase.from("transfer_recipients").insert({
      account_name: resolved.accountName,
      account_number: resolved.accountNumber,
      bank_code: rail === "bank" ? selectedBank.code : null,
      bank_name: rail === "bank" ? selectedBank.name : "KantongKu",
      rail,
      user_id: user.id,
    });

    if (error) return { ok: false, message: error.message };
    await loadRecipients();
    return { ok: true };
  };

  const handleRegisterSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const resolved = await resolveRecipient();
    if (!resolved.ok) {
      setMessage(resolved.message);
      notify?.({ description: resolved.message, title: "Rekening belum valid", type: "error" });
      return;
    }

    const saved = await saveRecipient(resolved.data);
    if (!saved.ok) {
      setMessage(saved.message);
      notify?.({ description: saved.message, title: "Gagal menyimpan rekening", type: "error" });
      return;
    }

    setRegisteredReceipt({
      bank: rail === "bank" ? selectedBank.name : "KantongKu",
      date: new Date().toISOString(),
      name: resolved.data.accountName,
      number: rail === "bank" ? `${selectedBank.code}-${formatBankAccountInput(resolved.data.accountNumber)}` : resolved.data.accountNumber,
    });
    resetForm();
    setMessage("Rekening tujuan berhasil didaftarkan.");
    notify?.({
      description: `${resolved.data.accountName} masuk ke daftar tujuan transfer.`,
      title: "Rekening tersimpan",
      type: "success",
    });
  };

  const handleTransferSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    const numericAmount = parseMoneyInput(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 1000) {
      setMessage("Nominal minimal Rp1.000.");
      notify?.({ description: "Nominal transaksi minimal Rp1.000.", title: "Nominal belum valid", type: "error" });
      return;
    }

    if (!summary) {
      const resolved = await resolveRecipient();
      if (!resolved.ok) {
        setMessage(resolved.message);
        notify?.({ description: resolved.message, title: "Tujuan belum valid", type: "error" });
        return;
      }

      setSummary({
        ...resolved.data,
        adminFee: resolved.data.rail === "kantong" ? 0 : transferAdminFee,
        amount: numericAmount,
        date: new Date().toISOString(),
        fromAccount: formatPlainAccountNumber(account?.account_number),
        note: note.trim(),
        totalDebit: numericAmount + (resolved.data.rail === "kantong" ? 0 : transferAdminFee),
      });
      return;
    }

    const result = await onTransfer({
      amount: summary.totalDebit,
      merchant: summary.accountName,
      note: `${summary.method} - transfer Rp${new Intl.NumberFormat("id-ID").format(summary.amount)} - admin Rp${new Intl.NumberFormat("id-ID").format(summary.adminFee)}${summary.note ? ` - ${summary.note}` : ""}`,
      rail: summary.rail,
      recipientUserId: summary.recipientUserId,
    });

    if (!result.ok) {
      if (result.reason === "insufficient") {
        playTransferSound("error");
        setTransferResult({
          adminFee: summary.adminFee,
          amount: summary.amount,
          balance: Number(result.balance ?? account?.balance ?? 0),
          message: "Saldo anda tidak mencukupi untuk transfer ini.",
          title: "Saldo tidak mencukupi",
          totalDebit: summary.totalDebit,
          type: "error",
        });
        notify?.({
          description: "Saldo anda tidak mencukupi untuk transfer ini.",
          title: "Transfer gagal",
          type: "error",
        });
      } else {
        setMessage(result.message);
        notify?.({ description: result.message, title: "Transfer gagal", type: "error" });
      }
      return;
    }

    playTransferSound("success");
    setTransferResult({
      adminFee: summary.adminFee,
      amount: summary.amount,
      destination: summary.destination,
      message: "Transfer berhasil dan tercatat di akuntansi.",
      name: summary.accountName,
      status: "Berhasil",
      title: "Transfer berhasil",
      totalDebit: summary.totalDebit,
      type: "success",
    });
    notify?.({
      description: `${summary.accountName} menerima ${formatDashboardMoney(summary.amount)}.`,
      title: "Transfer berhasil",
      type: "success",
    });
    resetForm();
    await loadRecipients();
  };

  const renderRecipientFields = () => (
    <>
      {rail === "bank" ? (
        <label className="auth-field">
          <span>Bank tujuan</span>
          <button
            className="bank-select-trigger"
            onClick={() => {
              if (isBankTransferMode) {
                setBankPickerOpen(false);
                setSummary(null);
                setMessage("");
                return;
              }

              setBankPickerOpen(true);
            }}
            type="button"
          >
            <span className={`bank-logo-box ${selectedBank ? "" : "empty bank-placeholder-icon"}`}>
              {selectedBank ? <BankLogo bank={selectedBank} /> : <Landmark size={17} />}
            </span>
            <span className={`bank-select-copy ${selectedBank ? "" : "empty"}`}>
              <strong>{isBankTransferMode && selectedBank ? recipientName || "Belum diisi" : selectedBank ? selectedBank.name : isBankTransferMode ? "Pilih rekening" : "Pilih bank"}</strong>
              <small>{selectedBank ? selectedBank.name : isBankTransferMode ? "Pilih dari daftar rekening tersimpan" : "Silakan pilih bank tujuan dulu"}</small>
            </span>
            <ChevronDown size={18} />
          </button>
        </label>
      ) : null}

      {rail === "bank" ? (
        <label className="auth-field">
          <span>Nomor rekening tujuan</span>
          <div className={`bank-account-field ${selectedBank ? "has-bank" : ""}`}>
            {selectedBank ? (
              <button
                aria-label="Hapus bank terpilih"
                className="bank-account-prefix"
                onClick={() => {
                  setBankCode("");
                  setBankSearch("");
                  setRecipient("");
                  setSummary(null);
                  setMessage("");
                }}
                type="button"
              >
                Kode {selectedBank.code}
              </button>
            ) : null}
            <input
              inputMode="numeric"
              placeholder="Isi nomor rekening"
              required
              readOnly={isBankTransferMode && Boolean(selectedBank)}
              value={recipient}
              onChange={(event) => handleBankAccountInput(event.target.value, event.nativeEvent.inputType || "")}
            />
          </div>
          <small className="bank-input-hint">
            {selectedBank && recipient
              ? `Format tujuan: ${selectedBank.code}-${recipient}`
              : isBankTransferMode
                ? "Pilih rekening tersimpan dari daftar kanan."
                : "Pilih bank, lalu isi nomor rekening tujuan."}
          </small>
        </label>
      ) : (
        <label className="auth-field">
          <span>Nomor rekening KantongKu tujuan</span>
          <div>
            <ShieldCheck size={17} />
            <input
              inputMode="numeric"
              placeholder="Contoh: 8808 7361 3878"
              required
              value={recipient}
              onChange={(event) => { setRecipient(formatPlainAccountNumber(event.target.value)); setSummary(null); }}
            />
          </div>
        </label>
      )}

      {rail === "bank" && !isBankTransferMode ? (
        <label className="auth-field">
          <span className="field-label-inline">
            Nama penerima
            <small>Opsional</small>
          </span>
          <div>
            <ShieldCheck size={17} />
            <input
              placeholder="Isi kalau sudah tahu nama penerima"
              value={recipientName}
              onChange={(event) => { setRecipientName(event.target.value); setSummary(null); }}
            />
          </div>
        </label>
      ) : null}
    </>
  );

  if (mode === "messages" || mode === "receipts") {
    return (
      <TransactionMessageCenter
        mode={mode}
        onBack={() => setMode("menu")}
        transactions={transactions}
      />
    );
  }

  if (mode === "menu") {
    return (
      <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="neo-card transfer-home-card bg-white p-4 sm:p-5">
          <div className="transfer-page-head">
            <button className="transfer-back-btn" onClick={onBack} type="button">
              <ArrowLeft size={17} />
              <span>Kembali</span>
            </button>
            <span className="transfer-head-badge">
              <Send size={14} />
              Layanan transaksi
            </span>
          </div>

          <div className="transfer-menu mt-6">
            <div className="transfer-menu-title">Daftar Rekening</div>
            <button className="transfer-menu-row" onClick={() => openMode("register-kantong")} type="button">
              <span className="transfer-row-icon"><UserPlus size={18} /></span>
              <span className="transfer-row-copy">
                <strong>Antar Rekening</strong>
                <small>Simpan tujuan KantongKu</small>
              </span>
              <ChevronRight className="transfer-row-arrow" size={20} />
            </button>
            <button className="transfer-menu-row" onClick={() => openMode("register-bank")} type="button">
              <span className="transfer-row-icon blue"><Building2 size={18} /></span>
              <span className="transfer-row-copy">
                <strong>Antar Bank</strong>
                <small>Simpan bank lain pakai kode bank</small>
              </span>
              <ChevronRight className="transfer-row-arrow" size={20} />
            </button>

            <div className="transfer-menu-title">Transfer</div>
            <button className="transfer-menu-row" onClick={() => openMode("transfer-kantong")} type="button">
              <span className="transfer-row-icon pink"><Send size={18} /></span>
              <span className="transfer-row-copy">
                <strong>Antar Rekening</strong>
                <small>Kirim ke sesama KantongKu</small>
              </span>
              <ChevronRight className="transfer-row-arrow" size={20} />
            </button>
            <button className="transfer-menu-row" onClick={() => openMode("transfer-bank")} type="button">
              <span className="transfer-row-icon yellow"><Building2 size={18} /></span>
              <span className="transfer-row-copy">
                <strong>Antar Bank</strong>
                <small>Transfer via jaringan bank nasional</small>
              </span>
              <ChevronRight className="transfer-row-arrow" size={20} />
            </button>
            <button
              className="transfer-menu-row"
              onClick={() => {
                setMessage("Virtual Account akan kita sambungkan setelah modul biller siap.");
                notify?.({
                  description: "Virtual Account akan kita sambungkan setelah modul biller siap.",
                  title: "Fitur segera hadir",
                  type: "info",
                });
              }}
              type="button"
            >
              <span className="transfer-row-icon"><CreditCard size={18} /></span>
              <span className="transfer-row-copy">
                <strong>Virtual Account</strong>
                <small>Tagihan VA dan pembayaran merchant</small>
              </span>
              <ChevronRight className="transfer-row-arrow" size={20} />
            </button>
          </div>

          {message ? <p className="auth-message">{message}</p> : null}
        </section>

        <section className="neo-card transfer-tool-card bg-blue p-5">
          <p className="eyebrow">Pusat transaksi</p>
          <div className="mt-4 grid gap-3">
            <button className="transfer-tool-button" onClick={() => setMode("messages")} type="button">
              <span><MessageSquareText size={20} /></span>
              <div>
                <strong>Pesan</strong>
                <small>Info, status, dan notifikasi transaksi.</small>
              </div>
              <ChevronRight size={18} />
            </button>
            <button className="transfer-tool-button" onClick={() => setMode("receipts")} type="button">
              <span><BookOpenCheck size={20} /></span>
              <div>
                <strong>Bukti transaksi</strong>
                <small>Akuntansi dan arsip bukti transfer.</small>
              </div>
              <ChevronRight size={18} />
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-7 lg:grid-cols-[1.1fr_0.9fr]">
      {registeredReceipt ? (
        <div className="transfer-modal-backdrop" role="presentation">
          <section className="transfer-modal neo-card bg-white" role="dialog" aria-modal="true" aria-label="Rekening berhasil didaftarkan">
            <p className="eyebrow">Daftarkan</p>
            <h2 className="mt-2 font-display text-2xl font-black">Rekening tersimpan.</h2>
            <div className="transfer-modal-list">
              <p><span>Nama</span> <strong>{registeredReceipt.name}</strong></p>
              <p><span>Bank</span> <strong>{registeredReceipt.bank}</strong></p>
              <p><span>Nomor rek</span> <strong>{registeredReceipt.number}</strong></p>
              <p>
                <span>Tanggal</span>{" "}
                <strong>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(registeredReceipt.date))}</strong>
              </p>
            </div>
            <button className="neo-button bg-lime mt-5 w-full" onClick={() => setRegisteredReceipt(null)} type="button">
              Oke
            </button>
          </section>
        </div>
      ) : null}

      {summary ? (
        <div className="transfer-modal-backdrop" role="presentation">
          <section className="transfer-modal neo-card bg-white" role="dialog" aria-modal="true" aria-label="Konfirmasi transfer">
            <p className="eyebrow">Ringkasan</p>
            <h2 className="mt-2 font-display text-2xl font-black">Lanjutkan transfer?</h2>
            <div className="transfer-modal-list">
              <p><span>Bank</span> <strong>{summary.method}</strong></p>
              <p><span>Tujuan</span> <strong>{summary.destination}</strong></p>
              <p><span>Nama</span> <strong>{summary.accountName}</strong></p>
              <p><span>Jumlah</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(summary.amount)}</strong></p>
              <p><span>Admin</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(summary.adminFee)}</strong></p>
              <p><span>Total</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(summary.totalDebit)}</strong></p>
              <p><span>Dari</span> <strong>{summary.fromAccount}</strong></p>
              <p>
                <span>Tanggal</span>{" "}
                <strong>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.date))}</strong>
              </p>
            </div>
            <div className="transfer-modal-actions">
              <button className="neo-button" onClick={() => setSummary(null)} type="button">Batal</button>
              <button className="neo-button bg-lime" onClick={handleTransferSubmit} type="button">Lanjut</button>
            </div>
          </section>
        </div>
      ) : null}

      {transferResult ? (
        <div className="transfer-modal-backdrop" role="presentation">
          <section className={`transfer-modal neo-card bg-white ${transferResult.type === "error" ? "transfer-modal-error" : "transfer-modal-success"}`} role="dialog" aria-modal="true" aria-label={transferResult.title}>
            <p className="eyebrow">{transferResult.type === "error" ? "Gagal" : "Berhasil"}</p>
            <h2 className="mt-2 font-display text-2xl font-black">{transferResult.title}</h2>
            <p className="mt-3 text-sm font-bold text-ink/70">{transferResult.message}</p>
            <div className="transfer-modal-list">
              {transferResult.type === "success" ? (
                <>
                  <p><span>Status</span> <strong>{transferResult.status}</strong></p>
                  <p><span>Tujuan</span> <strong>{transferResult.destination}</strong></p>
                  <p><span>Nama</span> <strong>{transferResult.name}</strong></p>
                  <p><span>Jumlah</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(transferResult.amount)}</strong></p>
                  <p><span>Admin</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(transferResult.adminFee)}</strong></p>
                  <p><span>Total</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(transferResult.totalDebit)}</strong></p>
                </>
              ) : null}
              {transferResult.type === "error" ? (
                <p><span>Saldo anda</span> <strong>Rp{new Intl.NumberFormat("id-ID").format(transferResult.balance || 0)}</strong></p>
              ) : null}
            </div>
            <button className="neo-button bg-lime mt-5 w-full" onClick={() => setTransferResult(null)} type="button">Oke</button>
          </section>
        </div>
      ) : null}

      <section className="neo-card bg-white p-5 sm:p-6">
        <button className="transfer-detail-back mb-4" onClick={() => { setMode("menu"); resetForm(); }} type="button">
          <ArrowLeft size={16} />
          <span>Kembali</span>
        </button>
        <p className="eyebrow">{isRegisterMode ? "Daftar rekening" : "Transfer"}</p>
        <h2 className="mt-2 font-display text-2xl font-black">
          {rail === "bank" ? "Antar Bank" : "Antar Rekening"}
        </h2>

        <form className="mt-5 grid gap-4" onSubmit={isRegisterMode ? handleRegisterSubmit : handleTransferSubmit}>
          {renderRecipientFields()}

          {isTransferMode ? (
            <>
              <label className="auth-field">
                <span>Jumlah uang</span>
                <div>
                  <KeyRound size={17} />
                  <input
                    inputMode="numeric"
                    min="1000"
                    placeholder="Contoh: 50.000"
                    required
                    type="text"
                    value={amount}
                    onChange={(event) => { setAmount(formatMoneyInput(event.target.value)); setSummary(null); }}
                  />
                </div>
              </label>
              <label className="auth-field">
                <span>Catatan</span>
                <div>
                  <Copy size={17} />
                  <input placeholder="Opsional" value={note} onChange={(event) => { setNote(event.target.value); setSummary(null); }} />
                </div>
              </label>
            </>
          ) : null}

          <button className="neo-button bg-yellow" type="submit">
            {isRegisterMode ? "Daftarkan rekening" : summary ? "Konfirmasi & kirim" : "Kirim transfer"}
          </button>
        </form>

        {message ? <p className="auth-message">{message}</p> : null}
      </section>

      <aside className="grid gap-7 content-start">
        {isKantongTransferMode && !summary ? (
          <section className="neo-card bank-list-panel bg-white p-5">
            <div className="bank-list-head">
              <div>
                <p className="eyebrow">Daftar Rekening</p>
                <p className="mt-1 text-xs font-bold text-ink/60">Pilih rekening KantongKu tersimpan.</p>
              </div>
              <span className="bank-list-count">{kantongRecipients.length}</span>
            </div>

            <div className="mt-4 grid gap-3">
              {kantongRecipients.length === 0 ? (
                <div className="saved-recipient-empty">
                  <WalletCards size={18} />
                  <div>
                    <strong>Belum ada rekening KantongKu tersimpan.</strong>
                    <small>Masuk ke Daftar Rekening &gt; Antar Rekening dulu.</small>
                  </div>
                </div>
              ) : (
                kantongRecipients.map((item) => (
                  <button
                    className={`saved-recipient-row ${recipient === item.account_number ? "active" : ""}`}
                    key={item.id}
                    onClick={() => applyKantongRecipient(item)}
                    type="button"
                  >
                    <span className="bank-logo-box">
                      <WalletCards size={17} />
                    </span>
                    <span>
                      <strong>{item.account_name || "Belum diisi"}</strong>
                      <small>{item.bank_name} - {item.account_number}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))
              )}
            </div>
          </section>
        ) : isBankTransferMode && !summary ? (
          <section className="neo-card bank-list-panel bg-white p-5">
            <div className="bank-list-head">
              <div>
                <p className="eyebrow">Daftar Rekening</p>
                <p className="mt-1 text-xs font-bold text-ink/60">Pilih rekening tersimpan untuk transfer.</p>
              </div>
              <span className="bank-list-count">{bankRecipients.length}</span>
            </div>

            <div className="mt-4 grid gap-3">
              {bankRecipients.length === 0 ? (
                <div className="saved-recipient-empty">
                  <WalletCards size={18} />
                  <div>
                    <strong>Belum ada rekening bank tersimpan.</strong>
                    <small>Masuk ke Daftar Rekening &gt; Antar Bank dulu.</small>
                  </div>
                </div>
              ) : (
                bankRecipients.map((item) => (
                  <button
                    className={`saved-recipient-row ${recipient.replace(/\D/g, "") === item.account_number ? "active" : ""}`}
                    key={item.id}
                    onClick={() => applyBankRecipient(item)}
                    type="button"
                  >
                    <span className="bank-logo-box">
                      <BankLogo bank={bankOptions.find((bank) => bank.code === item.bank_code)} />
                    </span>
                    <span>
                      <strong>{item.account_name || "Belum diisi"}</strong>
                      <small>{item.bank_name} - {formatPlainAccountNumber(item.account_number)}</small>
                    </span>
                    <ChevronRight size={18} />
                  </button>
                ))
              )}
            </div>
          </section>
        ) : rail === "bank" && bankPickerOpen ? (
          <section className="neo-card bank-list-panel bg-white p-5">
            <div className="bank-list-head">
              <div>
                <p className="eyebrow">Daftar Bank</p>
                <p className="mt-1 text-xs font-bold text-ink/60">Klik bank untuk mengganti tujuan.</p>
              </div>
              <button className="bank-list-close" onClick={() => setBankPickerOpen(false)} type="button">
                Ringkasan
              </button>
            </div>

            <label className="bank-search-field">
              <Search size={16} />
              <input
                placeholder="Cari kode atau nama bank"
                value={bankSearch}
                onChange={(event) => setBankSearch(event.target.value)}
              />
            </label>

            <div
              className={`bank-list-scroll ${bankListScrolling ? "is-scrolling" : ""}`}
              aria-label="Daftar bank tujuan"
              onScroll={handleBankListScroll}
            >
              {filteredBankOptions.map((bank) => (
                <button
                  className={`bank-list-row ${bank.code === bankCode ? "active" : ""}`}
                  key={bank.code}
                  onClick={() => chooseBank(bank.code)}
                  type="button"
                >
                  <span className="bank-logo-box">
                    <BankLogo bank={bank} />
                  </span>
                  <span className="bank-list-copy">
                    <strong>{bank.code}</strong>
                    <small>{bank.name}</small>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
              {filteredBankOptions.length === 0 ? (
                <p className="bank-empty-state">Bank tidak ditemukan.</p>
              ) : null}
            </div>
          </section>
        ) : (
        <section className="neo-card bg-lime p-5">
          <p className="eyebrow">Ringkasan</p>
          {summary ? (
            <div className="mt-4 grid gap-3 text-sm font-bold">
              <p><span className="text-ink/60">Bank:</span> {summary.method}</p>
              <p><span className="text-ink/60">Ke rekening tujuan:</span> {summary.destination}</p>
              <p><span className="text-ink/60">Nama:</span> {summary.accountName}</p>
              <p><span className="text-ink/60">Jumlah uang:</span> Rp{new Intl.NumberFormat("id-ID").format(summary.amount)}</p>
              <p><span className="text-ink/60">Admin:</span> Rp{new Intl.NumberFormat("id-ID").format(summary.adminFee)}</p>
              <p><span className="text-ink/60">Total:</span> Rp{new Intl.NumberFormat("id-ID").format(summary.totalDebit)}</p>
              <p><span className="text-ink/60">Dari rekening:</span> {summary.fromAccount}</p>
              <p><span className="text-ink/60">Tanggal:</span> {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(summary.date))}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm font-bold text-ink/70">Isi data lalu klik tombol utama untuk validasi penerima. Ringkasan akan muncul sebelum transfer dikirim.</p>
          )}
        </section>
        )}
      </aside>
    </div>
  );
}

function QrisScannerView({ notify, onBack, onDetected }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(0);
  const autoOpenRef = useRef(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const handleDecoded = useCallback((rawValue) => {
    const payload = parseKantongPayPayload(rawValue);
    if (!payload) {
      notify?.({
        description: "QR tidak dikenali sebagai QRIS KantongKu.",
        title: "QR tidak valid",
        type: "error",
      });
      return;
    }

    notify?.({
      description: "Data pembayaran QR berhasil dibaca.",
      title: "QRIS terbaca",
      type: "success",
    });
    onDetected?.(payload);
  }, [notify, onDetected]);

  const stopCamera = useCallback(() => {
    window.cancelAnimationFrame(scanLoopRef.current);
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setIsCameraActive(false);
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { willReadFrequently: true });

    if (!video || !canvas || !context || video.readyState < 2) {
      scanLoopRef.current = window.requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height);

    if (result?.data) {
      stopCamera();
      handleDecoded(result.data);
      return;
    }

    scanLoopRef.current = window.requestAnimationFrame(scanFrame);
  }, [handleDecoded, stopCamera]);

  const startCamera = useCallback(async () => {
    if (streamRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraActive(true);
      scanLoopRef.current = window.requestAnimationFrame(scanFrame);
    } catch {
      notify?.({
        description: "Kamera tidak bisa dibuka. Coba import gambar QR dari galeri.",
        title: "Kamera gagal",
        type: "error",
      });
    }
  }, [notify, scanFrame]);

  const importQrImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context) return;
      canvas.width = image.width;
      canvas.height = image.height;
      context.drawImage(image, 0, 0);
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(imageData.data, imageData.width, imageData.height);
      if (result?.data) handleDecoded(result.data);
      else notify?.({ description: "QR tidak terbaca dari gambar ini.", title: "Import gagal", type: "error" });
      URL.revokeObjectURL(image.src);
    };
    image.src = URL.createObjectURL(file);
    event.target.value = "";
  };

  useEffect(() => {
    if (autoOpenRef.current || typeof window === "undefined") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    if (!navigator.permissions?.query || !navigator.mediaDevices?.getUserMedia) return;

    let isCancelled = false;
    navigator.permissions
      .query({ name: "camera" })
      .then((permissionStatus) => {
        if (!isCancelled && permissionStatus.state === "granted") {
          autoOpenRef.current = true;
          startCamera();
        }
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [startCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return (
    <section className="qris-scan-page">
      <div className="qris-scan-layout">
        <div className="qris-scan-shell neo-card bg-white">
          <div className="transfer-page-head">
            <button className="transfer-back-btn" onClick={() => { stopCamera(); onBack?.(); }} type="button">
              <ArrowLeft size={17} />
              <span>Kembali</span>
            </button>
            <span className="transfer-head-badge">
              <Send size={14} />
              QRIS KantongKu
            </span>
          </div>

          <p className="eyebrow">QRIS KantongKu</p>
          <h2 className="qris-scan-title">Scan pembayaran</h2>
          <p className="qris-scan-copy">Arahkan kamera ke QR KantongKu, atau import gambar QR dari galeri.</p>

          <section className="qris-scanner-frame">
            <video ref={videoRef} muted playsInline />
            {!isCameraActive ? (
              <div className="qris-scanner-empty">
                <Search size={30} />
                <strong>Siap scan QRIS</strong>
                <p>Kamera akan langsung aktif di mobile kalau izin sebelumnya sudah diberikan.</p>
              </div>
            ) : null}
            <span className="qris-scan-line" />
            <span className="qris-scan-corner top-left" />
            <span className="qris-scan-corner top-right" />
            <span className="qris-scan-corner bottom-left" />
            <span className="qris-scan-corner bottom-right" />
          </section>
        </div>

        <div className="qris-scan-side-stack">
          <aside className="qris-scan-summary neo-card bg-lime">
            <p className="eyebrow">Ringkasan</p>
            <p>
              Scan QR KantongKu untuk membuka panel bayar. Nominal bisa diisi lewat keypad aman sebelum pembayaran dikirim.
            </p>
          </aside>

          <div className="qris-scan-actions neo-card bg-white">
            <button className="neo-button bg-lime" onClick={isCameraActive ? stopCamera : startCamera} type="button">
              {isCameraActive ? "Matikan kamera" : "Buka kamera"}
            </button>
            <label className="neo-button bg-white">
              Import dari galeri
              <input accept="image/*" className="sr-only" type="file" onChange={importQrImage} />
            </label>
          </div>
        </div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </section>
  );
}

function ReceiveMoneyView({ account, notify, onBack, user }) {
  const [amount, setAmount] = useState("");
  const [payUrl, setPayUrl] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(180);
  const numericAmount = parseMoneyInput(amount);

  useEffect(() => {
    if (!account?.account_number) return;
    setPayUrl(createPayUrl({ amount: numericAmount, to: account.account_number }));
  }, [account?.account_number, numericAmount]);

  useEffect(() => {
    if (!payUrl) return;
    let isMounted = true;
    QRCode.toDataURL(payUrl, {
      color: { dark: "#171717", light: "#ffffff" },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 340,
    }).then((url) => {
      if (isMounted) setQrImage(url);
    });
    return () => {
      isMounted = false;
    };
  }, [payUrl]);

  useEffect(() => {
    if (!payUrl) return undefined;
    setSecondsLeft(180);
    const interval = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setPayUrl(createPayUrl({ amount: numericAmount, to: account?.account_number || "" }));
          return 180;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [account?.account_number, numericAmount, payUrl]);

  const copyLink = async () => {
    await navigator.clipboard?.writeText(payUrl);
    notify?.({ description: "Link QRIS KantongKu sudah disalin.", title: "Link disalin", type: "info" });
  };

  const countdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  return (
    <section className="receive-page">
      <div className="receive-hero neo-card">
        <article className="receive-qr-card">
          <div className="transfer-page-head w-full">
            <button className="transfer-back-btn" onClick={onBack} type="button">
              <ArrowLeft size={17} />
              <span>Kembali</span>
            </button>
            <span className="transfer-head-badge">
              <Send size={14} />
              QRIS KantongKu
            </span>
          </div>
          <p className="eyebrow text-center">KantongKu QRIS</p>
          <h3>{user.name}</h3>
          <p className="receive-account">{formatPlainAccountNumber(account?.account_number)}</p>
          <div className="receive-qr-box">
            {qrImage ? <img alt="QRIS KantongKu" src={qrImage} /> : <span>Membuat QR...</span>}
            <span className="receive-qr-logo">K</span>
          </div>
          <p className="receive-countdown">QR kedaluwarsa dalam {countdown}</p>
          <p className="receive-qris-note">Tunjukkan QR ini untuk menerima pembayaran KantongKu.</p>
        </article>

        <aside className="receive-side-panel neo-card bg-white">
          <p className="eyebrow">Pengaturan QRIS</p>
          <div className="receive-actions-card">
            <button onClick={copyLink} type="button">
              <Copy size={20} />
              <span>
                <strong>Bagikan QRIS atau Link</strong>
                <small>Link bisa dibuka dari device lain.</small>
              </span>
              <ChevronRight size={18} />
            </button>
            <label>
              <WalletCards size={20} />
              <span>
                <strong>Atur Nominal</strong>
                <small>Opsional, kosongkan jika bebas nominal.</small>
              </span>
              <input
                inputMode="numeric"
                placeholder="Contoh: 50.000"
                value={amount}
                onChange={(event) => setAmount(formatMoneyInput(event.target.value))}
              />
            </label>
          </div>
        </aside>
      </div>
    </section>
  );
}

function PaymentRequestSheet({ notify, onClose, onPay, request, user }) {
  const paymentLockRef = useRef(false);
  const [recipient, setRecipient] = useState(null);
  const [amountValue, setAmountValue] = useState("");
  const [pin, setPin] = useState("");
  const [visiblePinIndex, setVisiblePinIndex] = useState(-1);
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState(() => (Number(request?.amount || 0) ? "pin" : "amount"));
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const lockedAmount = Number(request?.amount || 0);
  const amount = lockedAmount || Number(amountValue || 0);

  const closeWithAnimation = useCallback(() => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsClosing(false);
      onClose?.();
    }, 240);
  }, [onClose]);

  useEffect(() => {
    setAmountValue("");
    setPin("");
    setVisiblePinIndex(-1);
    setIsConfirmed(false);
    setIsClosing(false);
    paymentLockRef.current = false;
    setPaymentStep(Number(request?.amount || 0) ? "pin" : "amount");
  }, [request?.amount, request?.to]);

  useEffect(() => {
    let isMounted = true;

    const loadRecipient = async () => {
      if (!request?.to) return;
      const { data, error } = await supabase.rpc("lookup_kantong_recipient", {
        p_identifier: String(request.to).replace(/\D/g, ""),
      });

      if (!isMounted) return;
      if (error) {
        notify?.({ description: error.message, title: "QR tidak valid", type: "error" });
        return;
      }
      setRecipient(Array.isArray(data) ? data[0] : data);
    };

    loadRecipient();
    return () => {
      isMounted = false;
    };
  }, [notify, request?.to]);

  useEffect(() => {
    if (visiblePinIndex < 0) return undefined;
    const timeout = window.setTimeout(() => setVisiblePinIndex(-1), 520);
    return () => window.clearTimeout(timeout);
  }, [pin, visiblePinIndex]);

  const pressKey = (key) => {
    if (lockedAmount) return;
    setAmountValue((current) => {
      if (key === "backspace") return current.slice(0, -1);
      if (key === "clear") return "";
      if (current.length >= 10) return current;
      return `${current}${key}`.replace(/^0+(?=\d)/, "");
    });
  };

  const pressPinKey = (key) => {
    if (isPaying || paymentLockRef.current) return;

    let nextPin = pin;
    if (key === "backspace") {
      setVisiblePinIndex(-1);
      nextPin = pin.slice(0, -1);
    } else if (key === "clear") {
      setVisiblePinIndex(-1);
      nextPin = "";
    } else if (pin.length < 6) {
      setVisiblePinIndex(pin.length);
      nextPin = `${pin}${key}`.replace(/\D/g, "");
    }

    setPin(nextPin);

    if (nextPin.length !== 6) return;
    if (user.pin && nextPin !== user.pin) {
      playTransferSound("error");
      notify?.({ description: "PIN tidak sesuai. Coba masukkan ulang.", title: "PIN salah", type: "error" });
      window.setTimeout(() => {
        setPin("");
        setVisiblePinIndex(-1);
      }, 260);
      return;
    }

    handlePay(nextPin);
  };

  const goToPinStep = () => {
    if (!amount || amount < 1) {
      playTransferSound("error");
      notify?.({ description: "Masukkan nominal pembayaran terlebih dahulu.", title: "Nominal belum valid", type: "error" });
      return;
    }
    if (!user.pin) {
      handlePay();
      return;
    }
    playTransferSound("success");
    setPaymentStep("pin");
  };

  const handlePay = useCallback(async (pinOverride = pin) => {
    if (paymentLockRef.current) return;
    if (!recipient) {
      playTransferSound("error");
      notify?.({ description: "Penerima QR belum ditemukan.", title: "QR belum valid", type: "error" });
      return;
    }
    if (!amount || amount < 1) {
      playTransferSound("error");
      notify?.({ description: "Masukkan nominal pembayaran terlebih dahulu.", title: "Nominal belum valid", type: "error" });
      return;
    }
    if (recipient.id === user.id) {
      playTransferSound("error");
      notify?.({ description: "Tidak bisa membayar QR milik akun sendiri.", title: "QR akun sendiri", type: "error" });
      return;
    }
    if (user.pin && user.pin !== pinOverride) {
      playTransferSound("error");
      notify?.({ description: "Masukkan PIN yang sesuai untuk melanjutkan pembayaran.", title: "PIN belum cocok", type: "error" });
      return;
    }

    paymentLockRef.current = true;
    setIsConfirmed(true);
    setIsPaying(true);
    const result = await onPay({
      amount,
      merchant: recipient.full_name,
      note: `QRIS KantongKu - bayar ${formatDashboardMoney(amount)}`,
      rail: "kantong",
      recipientUserId: recipient.id,
    });
    setIsPaying(false);

    if (!result.ok) {
      paymentLockRef.current = false;
      setIsConfirmed(false);
      playTransferSound("error");
      notify?.({ description: result.message, title: "Pembayaran gagal", type: "error" });
      return;
    }

    playTransferSound("success");
    notify?.({ description: `${formatDashboardMoney(amount)} terkirim ke ${recipient.full_name}.`, title: "Pembayaran berhasil", type: "success" });
    closeWithAnimation();
  }, [amount, closeWithAnimation, notify, onPay, pin, recipient, user.id, user.pin]);

  if (!request?.to) return null;

  const hasPinStepCard = paymentStep === "pin" && Boolean(user.pin);

  const sheet = (
    <div className={`payment-sheet-backdrop ${isClosing ? "is-closing" : ""}`} role="presentation">
      <section className={`payment-sheet ${isClosing ? "is-closing" : ""} ${hasPinStepCard ? "payment-step-pin has-pin-dialog" : `payment-step-${paymentStep}`} ${isConfirmed ? "is-confirming" : ""} neo-card bg-white`} role="dialog" aria-modal="true" aria-label="Konfirmasi QRIS">
        <button className="payment-sheet-close" onClick={closeWithAnimation} type="button" aria-label="Tutup pembayaran">
          <X size={18} />
        </button>
        <div className="payment-merchant">
          <span className="avatar">{recipient?.full_name?.slice(0, 2).toUpperCase() || "KK"}</span>
          <div>
            <p className="eyebrow">QRIS KantongKu</p>
            <h2>{recipient?.full_name || "Memuat penerima..."}</h2>
            <small>{recipient?.account_number ? formatPlainAccountNumber(recipient.account_number) : "Validasi nomor rekening"}</small>
          </div>
        </div>

        <div className="payment-total">
          <span>Total bayar</span>
          <strong>{formatDashboardMoney(amount)}</strong>
        </div>

        {hasPinStepCard ? <div className="payment-underlay" aria-hidden="true" /> : null}

        <div className="payment-step-panel" key={paymentStep}>
          {paymentStep === "amount" && !lockedAmount ? (
            <div className="secure-amount-pad">
              <div className="secure-amount-display">
                <span>Rp.</span>
                <strong>{amountValue ? new Intl.NumberFormat("id-ID").format(Number(amountValue)) : "0"}</strong>
              </div>
              <div className="secure-keypad" aria-label="Keypad nominal pembayaran">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => (
                  <button key={key} onClick={() => pressKey(key)} type="button">
                    {key === "clear" ? "C" : key === "backspace" ? "⌫" : key}
                  </button>
                ))}
              </div>
            </div>
          ) : user.pin ? (
            <div className="secure-pin-pad payment-pin-card neo-card bg-white">
              <div className="payment-pin-head">
                {!lockedAmount ? (
                  <button className="payment-pin-back" onClick={() => { setPin(""); setVisiblePinIndex(-1); setPaymentStep("amount"); }} type="button" aria-label="Kembali ke nominal">
                    <ArrowLeft size={17} />
                  </button>
                ) : null}
                <span className="secure-pad-label">PIN pembayaran</span>
              </div>
              <div className="secure-pin-display" aria-label="PIN pembayaran">
                <ShieldCheck size={17} />
                <strong>
                  {pin
                    ? pin.split("").map((digit, index) => (index === visiblePinIndex ? digit : "•")).join("")
                    : "Masukkan PIN"}
                </strong>
              </div>
              <div className="secure-keypad secure-pin-keypad" aria-label="Keypad PIN pembayaran">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "backspace"].map((key) => (
                  <button key={key} onClick={() => pressPinKey(key)} type="button">
                    {key === "clear" ? "C" : key === "backspace" ? "⌫" : key}
                  </button>
                ))}
              </div>
              <p className="payment-pin-hint">{isPaying ? "Memproses pembayaran..." : "Masukkan 6 digit PIN untuk membayar otomatis."}</p>
            </div>
          ) : (
            <p className="payment-pin-note">PIN belum diatur, pembayaran bisa langsung dilanjutkan.</p>
          )}
        </div>

        {paymentStep === "amount" && !lockedAmount ? (
          <button className="payment-pay-button neo-button bg-lime mt-5 w-full" disabled={isPaying} onClick={goToPinStep} type="button">
            Lanjut
          </button>
        ) : !user.pin ? (
          <button className="payment-pay-button neo-button bg-lime mt-5 w-full" disabled={isPaying} onClick={() => handlePay()} type="button">
            {isPaying ? "Memproses..." : "Bayar"}
          </button>
        ) : null}
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
}

function Dashboard({ notify, onBack, onLogout, user = demoUser }) {
  const initialView = getUserWorkspace()?.section || "dashboard";
  const [activeView, setActiveView] = useState(initialView);
  const [paymentRequest, setPaymentRequest] = useState(() => getPayRequest());
  const [account, setAccount] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(true);
  const [activeAction, setActiveAction] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadDashboard = async () => {
      setIsLoadingDashboard(true);
      const data = await fetchDashboardData(user.id);

      if (!isMounted) return;
      setAccount(data.account);
      setTransactions(data.transactions);
      setIsLoadingDashboard(false);
    };

    loadDashboard();

    if (!isSupabaseConfigured || !user.id) {
      return () => {
        isMounted = false;
      };
    }

    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", filter: `user_id=eq.${user.id}`, schema: "public", table: "accounts" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setAccount(null);
            return;
          }

          setAccount(payload.new);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", filter: `user_id=eq.${user.id}`, schema: "public", table: "transactions" },
        async () => {
          const data = await fetchDashboardData(user.id);
          if (isMounted) {
            setAccount(data.account);
            setTransactions(data.transactions);
          }
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const monthlyExpense = getMonthlyExpense(transactions);
  const handleNavigate = (view) => {
    setActiveView(view);
    setActiveAction(null);
    setPaymentRequest(null);
    window.history.pushState({ screen: "dashboard", user: user.slug, view }, "", createUserWorkspaceUrl(user.slug, view));
    window.scrollTo({ top: 0 });
  };

  const handleQuickAction = (action) => {
    if (action === "transfer") {
      handleNavigate("transfer");
      return;
    }

    if (action === "receive") {
      handleNavigate("receive");
      return;
    }

    if (action === "pay") {
      handleNavigate("pay");
      return;
    }

    setActiveAction(action);
  };

  const handleQuickActionSubmit = async ({ action, amount, merchant, note, rail, recipientUserId, suppressToast = false }) => {
    if (!account) {
      if (!suppressToast) notify?.({ description: "Akun saldo belum siap disinkronkan.", title: "Proses tertunda", type: "error" });
      return { ok: false, message: "Akun saldo belum siap." };
    }
    const minimumAmount = rail === "kantong" && recipientUserId ? 1 : 1000;
    if (!Number.isFinite(amount) || amount < minimumAmount) {
      if (!suppressToast) notify?.({
        description: minimumAmount === 1 ? "Masukkan nominal transaksi terlebih dahulu." : "Nominal transaksi minimal Rp1.000.",
        title: "Nominal belum valid",
        type: "error",
      });
      return { ok: false, message: minimumAmount === 1 ? "Masukkan nominal transaksi." : "Nominal minimal Rp1.000." };
    }

    const config = actionCopy[action];
    const isIncome = action === "topup";

    if (action === "transfer" && rail === "kantong" && recipientUserId) {
      const { data, error } = await supabase.rpc("transfer_kantong", {
        p_amount: amount,
        p_merchant: merchant,
        p_note: note || config.title,
        p_recipient_id: recipientUserId,
      });

      if (error) {
        const message = error.message || "Transfer gagal diproses.";
        if (message.toLowerCase().includes("saldo")) {
          if (!suppressToast) notify?.({ description: "Saldo anda tidak cukup untuk menyelesaikan transfer.", title: "Saldo tidak mencukupi", type: "error" });
          return { balance: Number(account.balance || 0), ok: false, message, reason: "insufficient" };
        }
        if (!suppressToast) notify?.({ description: message, title: "Transfer gagal", type: "error" });
        return { ok: false, message };
      }

      const nextBalance = Number(data ?? Number(account.balance || 0) - amount);
      setAccount((current) => (current ? { ...current, balance: nextBalance } : current));
      if (!suppressToast) notify?.({ description: "Transfer KantongKu sudah tercatat realtime.", title: "Transfer berhasil", type: "success" });
      return { balance: nextBalance, ok: true, message: "Transfer berhasil diproses." };
    }

    const signedAmount = isIncome ? amount : -amount;
    const nextBalance = Number(account.balance || 0) + signedAmount;

    if (nextBalance < 0) {
      if (!suppressToast) notify?.({ description: "Saldo anda tidak cukup untuk transaksi ini.", title: "Saldo tidak mencukupi", type: "error" });
      return { balance: Number(account.balance || 0), ok: false, message: "Saldo tidak cukup untuk transaksi ini.", reason: "insufficient" };
    }

    const { error: accountError } = await supabase
      .from("accounts")
      .update({ balance: nextBalance })
      .eq("id", account.id)
      .eq("user_id", user.id);

    if (accountError) {
      if (!suppressToast) notify?.({ description: accountError.message, title: "Saldo gagal diperbarui", type: "error" });
      return { ok: false, message: accountError.message };
    }

    const transactionPayload = {
      amount: signedAmount,
      merchant,
      note: note || config.title,
      status: "berhasil",
      type: config.type,
      user_id: user.id,
    };

    let { error: transactionError } = await supabase.from("transactions").insert(transactionPayload);

    if (transactionError?.message?.toLowerCase().includes("status")) {
      const { status, ...fallbackPayload } = transactionPayload;
      void status;
      const retry = await supabase.from("transactions").insert(fallbackPayload);
      transactionError = retry.error;
    }

    if (transactionError) {
      if (!suppressToast) notify?.({ description: transactionError.message, title: "Transaksi gagal dicatat", type: "error" });
      return { ok: false, message: transactionError.message };
    }

    setAccount((current) => (current ? { ...current, balance: nextBalance } : current));
    if (!suppressToast) notify?.({
      description: `${config.title} sebesar ${formatDashboardMoney(Math.abs(signedAmount))} tercatat realtime.`,
      title: `${config.title} berhasil`,
      type: "success",
    });
    return { balance: nextBalance, ok: true, message: `${config.title} berhasil diproses.` };
  };

  return (
    <div className="dashboard-enter min-h-screen bg-canvas text-ink">
      <Sidebar activeView={activeView} onLogout={onLogout} onNavigate={handleNavigate} />

      <main className="main-shell">
        <header className="topbar">
          <div className="lg:hidden">
            <button className="border-0 bg-transparent p-0" onClick={onBack} type="button">
              <Logo compact />
            </button>
          </div>
          <div className="hidden lg:block">
            <p className="text-sm font-bold text-muted">Sabtu, 4 Juli 2026</p>
            <h1 className="font-display text-2xl font-black">Selamat siang, {user.name}!</h1>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell transactions={transactions} user={user} />
            <button className="profile-button" type="button">
              <span className="avatar">{user.initials}</span>
              <span className="hidden text-left sm:block">
                <span className="block text-xs font-black">{user.name}</span>
                <span className="block text-[10px] font-bold text-muted">Personal</span>
              </span>
              <ChevronDown className="hidden sm:block" size={16} />
            </button>
          </div>
        </header>

        <div className="content-shell">
          <div className="mb-6 lg:hidden">
            <p className="text-sm font-bold text-muted">Sabtu, 4 Juli 2026</p>
            <h1 className="font-display text-2xl font-black">Halo, {user.name}!</h1>
          </div>

          {activeView === "settings" ? (
            <AccountSettings notify={notify} user={user} />
          ) : activeView === "qris" ? (
            <QrisScannerView
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
              onDetected={(payload) => setPaymentRequest(payload)}
            />
          ) : activeView === "receive" ? (
            <ReceiveMoneyView
              account={account}
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
              user={user}
            />
          ) : activeView === "transfer" ? (
            <TransferView
              account={account}
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
              onTransfer={(payload) => handleQuickActionSubmit({ ...payload, action: "transfer", suppressToast: true })}
              transactions={transactions}
              user={user}
            />
          ) : activeView === "pay" ? (
            <PayView
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
              onViewReceipt={() => handleNavigate("transactions")}
              onSubmit={handleQuickActionSubmit}
              user={user}
            />
          ) : activeView === "transactions" ? (
            <TransactionMessageCenter
              mode="receipts"
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
              transactions={transactions}
              user={user}
            />
          ) : activeView === "help" ? (
            <HelpCenter
              notify={notify}
              onBack={() => handleNavigate("dashboard")}
            />
          ) : (
            <div className="dashboard-grid">
              <div className="flex flex-col gap-7">
                <BalanceCard account={account} loading={isLoadingDashboard} />
                <QuickActions onAction={handleQuickAction} />
                <QuickActionPanel
                  account={account}
                  action={activeAction}
                  notify={notify}
                  onClose={() => setActiveAction(null)}
                  onSubmit={handleQuickActionSubmit}
                />
                <ServiceGrid />
                <TransactionList
                  loading={isLoadingDashboard}
                  notify={notify}
                  onViewAll={() => handleNavigate("transactions")}
                  transactions={transactions}
                  user={user}
                />
              </div>
              <aside className="flex flex-col gap-7">
                <SpendingCard monthlyExpense={monthlyExpense} />
                <section className="neo-card bg-blue p-5 sm:p-6">
                  <p className="eyebrow">Tips hari ini</p>
                  <h2 className="mt-2 font-display text-xl font-black leading-tight">
                    Sisihkan dulu, belanja kemudian.
                  </h2>
                  <p className="mt-3 text-sm font-semibold leading-relaxed text-ink/70">
                    Aktifkan tabungan otomatis agar tujuanmu terasa lebih dekat.
                  </p>
                  <button className="neo-button mt-5" type="button" onClick={() => handleNavigate("settings")}>
                    Atur tabungan
                  </button>
                </section>
              </aside>
            </div>
          )}
        </div>
      </main>

      <MobileNav onNavigate={handleNavigate} />
      <PaymentRequestSheet
        notify={notify}
        onClose={() => {
          setPaymentRequest(null);
          window.history.replaceState({ screen: "dashboard", user: user.slug }, "", createUserWorkspaceUrl(user.slug));
        }}
        onPay={(payload) => handleQuickActionSubmit({ ...payload, action: "transfer", suppressToast: true })}
        request={paymentRequest}
        user={user}
      />
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const { dismissToast, notify, toasts } = useToastController();
  const getAuthMode = () => (new URLSearchParams(window.location.search).get("m") === "signup" ? "signup" : "signin");

  const getCurrentScreen = () => {
    const workspace = getUserWorkspace();
    if (window.location.pathname === "/pay") return "dashboard";
    if (workspace) return "dashboard";
    if (window.location.pathname === "/auth") return "auth";
    if (window.location.hash === "#privacy") return "privacy";
    if (window.location.hash === "#terms") return "terms";
    return "landing";
  };

  const [screen, setScreen] = useState(getCurrentScreen);
  const [authMode, setAuthMode] = useState(getAuthMode);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      if (!isSupabaseConfigured) {
        setAuthReady(true);
        return;
      }

      const { data } = await supabase.auth.getSession();
      const profile = await fetchProfile(data.session?.user?.id);

      if (!isMounted) return;
      setSession(profile);
      setAuthReady(true);
    };

    loadSession();

    if (!isSupabaseConfigured) return undefined;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, authSession) => {
      const profile = await fetchProfile(authSession?.user?.id);
      if (isMounted) setSession(profile);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleRouteChange = () => {
      setScreen(getCurrentScreen());
      setAuthMode(getAuthMode());
      window.scrollTo({ top: 0 });
    };

    window.addEventListener("hashchange", handleRouteChange);
    window.addEventListener("popstate", handleRouteChange);
    return () => {
      window.removeEventListener("hashchange", handleRouteChange);
      window.removeEventListener("popstate", handleRouteChange);
    };
  }, []);

  useEffect(() => {
    if (screen === "landing" && session && window.location.pathname === "/" && !window.location.hash) {
      window.history.replaceState(
        { screen: "dashboard", user: session.slug },
        "",
        createUserWorkspaceUrl(session.slug),
      );
      setScreen("dashboard");
    }

    if (screen === "auth" && getUserWorkspace() && !session) {
      window.history.replaceState({ screen: "auth" }, "", "/auth?m=signin");
      setAuthMode("signin");
    }

    if (authReady && screen === "dashboard" && !session) {
      if (window.location.pathname === "/pay") {
        sessionStorage.setItem("kantongku.pendingPay", `${window.location.pathname}${window.location.search}`);
      }
      window.history.replaceState({ screen: "auth" }, "", "/auth?m=signin");
      setAuthMode("signin");
      setScreen("auth");
    }
  }, [authReady, screen, session]);

  const openDashboard = () => {
    const activeUser = session || demoUser;
    window.history.pushState(
      { screen: "dashboard", user: activeUser.slug },
      "",
      createUserWorkspaceUrl(activeUser.slug),
    );
    setScreen(session ? "dashboard" : "auth");
    if (!session) {
      window.history.replaceState({ screen: "auth" }, "", "/auth?m=signin");
      setAuthMode("signin");
    }
    window.scrollTo({ top: 0 });
  };

  const openLanding = () => {
    window.history.pushState({ screen: "landing" }, "", "/");
    setScreen("landing");
    window.scrollTo({ top: 0 });
  };

  const openAuthMode = (mode) => {
    window.history.pushState({ screen: "auth", mode }, "", `/auth?m=${mode}`);
    setAuthMode(mode);
    setScreen("auth");
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }

    setSession(null);
    window.history.pushState({ screen: "auth" }, "", "/auth?m=signin");
    setAuthMode("signin");
    setScreen("auth");
    window.scrollTo({ top: 0 });
  };

  const handleSignup = async ({ fullName, email, password, confirmPassword }) => {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Supabase belum dikonfigurasi. Isi .env dulu, lalu restart dev server." };
    }

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 3) return { ok: false, message: "Nama lengkap minimal 3 karakter." };
    if (password.length < 6) return { ok: false, message: "Password minimal 6 karakter." };
    if (password !== confirmPassword) return { ok: false, message: "Confirm password belum sama." };

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
        },
      },
    });

    if (error) {
      return { ok: false, message: error.message };
    }

    const profile = await fetchProfile(data.user?.id);
    return {
      ok: true,
      profile: profile || { bankId: "dibuat setelah email dikonfirmasi" },
    };
  };

  const handleLogin = async ({ identity, password, pin }) => {
    if (!isSupabaseConfigured) {
      return { ok: false, message: "Supabase belum dikonfigurasi. Isi .env dulu, lalu restart dev server." };
    }

    const normalizedIdentity = identity.trim().toLowerCase();
    const attempt = getAttemptState(normalizedIdentity);

    if (attempt.isLocked) {
      return {
        ok: false,
        message: `Akun dikunci sementara. Coba lagi sekitar ${Math.ceil(attempt.remainingSeconds / 60)} menit lagi.`,
      };
    }

    const failAttempt = (message, extra = {}) => {
      const failed = registerFailedAttempt(attempt.key);

      if (failed.isLocked) {
        return {
          ok: false,
          ...extra,
          message: "Percobaan gagal 3 kali. Akses akun dikunci sementara selama 5 menit.",
        };
      }

      return {
        ok: false,
        ...extra,
        message: `${message} Sisa percobaan: ${failed.remainingAttempts}.`,
      };
    };

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .or(
        `bank_id.ilike.${normalizedIdentity},slug.ilike.${normalizedIdentity},full_name.ilike.${normalizedIdentity},email.ilike.${normalizedIdentity}`,
      )
      .maybeSingle();

    if (profileError) return { ok: false, message: profileError.message };
    if (!profileRow) return failAttempt("Nama atau ID bank tidak ditemukan.");

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: profileRow.email,
      password,
    });

    if (authError) return failAttempt("Password belum cocok.");

    const profile = normalizeProfile(profileRow);
    if (profile.pin && !pin) {
      await supabase.auth.signOut();
      return { ok: false, pinRequired: true, message: "Password cocok. Masukkan PIN untuk melanjutkan." };
    }
    if (profile.pin && profile.pin !== pin) {
      await supabase.auth.signOut();
      return failAttempt("PIN belum cocok.", { pinRequired: true });
    }

    clearFailedAttempts(attempt.key);
    setSession(profile);
    const pendingPay = sessionStorage.getItem("kantongku.pendingPay");
    if (pendingPay) {
      sessionStorage.removeItem("kantongku.pendingPay");
      window.history.pushState({ screen: "dashboard", user: profile.slug, pay: true }, "", pendingPay);
    } else {
      window.history.pushState({ screen: "dashboard", user: profile.slug }, "", createUserWorkspaceUrl(profile.slug));
    }
    setScreen("dashboard");
    window.scrollTo({ top: 0 });
    return { ok: true, profile };
  };

  const dashboardUser = session || demoUser;

  if (screen === "dashboard") {
    return (
      <>
        <Dashboard notify={notify} onBack={openLanding} onLogout={handleLogout} user={dashboardUser} />
        <ToastViewport onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }
  if (screen === "auth") {
    return (
      <>
        <AuthPage
          mode={authMode}
          notify={notify}
          onBack={openLanding}
          onLogin={handleLogin}
          onModeChange={openAuthMode}
          onSignup={handleSignup}
        />
        <ToastViewport onDismiss={dismissToast} toasts={toasts} />
      </>
    );
  }
  if (screen === "privacy") return <LegalPage key="privacy" type="privacy" onBack={openLanding} />;
  if (screen === "terms") return <LegalPage key="terms" type="terms" onBack={openLanding} />;
  return (
    <>
      <LandingPage onEnter={openDashboard} />
      <ToastViewport onDismiss={dismissToast} toasts={toasts} />
    </>
  );
}

export default App;



