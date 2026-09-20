import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  HelpCircle,
  ReceiptText,
  Share2,
  Smartphone,
  Utensils,
} from "lucide-react";

function formatCurrency(value = 0, withSign = true) {
  const amount = Number(value) || 0;
  const prefix = withSign && amount > 0 ? "+" : withSign && amount < 0 ? "-" : "";

  return `${prefix}${new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Math.abs(amount))}`;
}

function formatTransactionDate(value, mode = "short") {
  if (!value) return "Baru saja";

  const date = new Date(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    ...(mode === "long" ? { second: "2-digit", year: "numeric" } : {}),
  }).format(date);
}

function formatTransactionGroupDate(value) {
  if (!value) return "Hari ini - --/--/----";

  const date = new Date(value);
  const dayName = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(date);
  const numericDate = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);

  return `${dayName} - ${numericDate}`;
}

function getTransactionGroupKey(value) {
  if (!value) return "unknown";
  return new Date(value).toISOString().slice(0, 10);
}

function parseRupiahFromNote(note = "", label = "transfer") {
  const match = note.match(new RegExp(`${label}\\s+Rp([\\d.]+)`, "i"));
  if (!match) return null;
  return Number(match[1].replace(/\D/g, "")) || null;
}

function getTransactionVisual(transaction) {
  const type = transaction.type?.toLowerCase();

  if (type === "income" || Number(transaction.amount) > 0) {
    return { Icon: ArrowDownLeft, tone: "bg-lime" };
  }
  if (type === "topup") return { Icon: Smartphone, tone: "bg-blue" };
  if (type === "payment") return { Icon: ReceiptText, tone: "bg-pink" };
  if (type === "transfer") return { Icon: ArrowUpRight, tone: "bg-red" };
  return { Icon: Utensils, tone: "bg-yellow" };
}

function getTransactionTitle(transaction) {
  const title = transaction.merchant || transaction.note || "Transaksi";
  const type = transaction.type?.toLowerCase();
  const amount = Number(transaction.amount) || 0;

  if (type === "transfer" && amount < 0 && !title.toLowerCase().startsWith("transfer")) {
    return `Transfer keluar ke ${title}`;
  }

  return title;
}

function stripTransferPrefix(value = "") {
  return String(value || "")
    .replace(/^transfer\s+(keluar\s+)?ke\s+/i, "")
    .replace(/^transfer\s+masuk\s+dari\s+/i, "")
    .trim();
}

function getDisplayRef(transaction) {
  if (transaction.ref_code) return transaction.ref_code;
  const source = String(transaction.id || transaction.created_at || Date.now()).replace(/\W/g, "").toUpperCase();
  return `SUMA-KK${source.slice(0, 12).padEnd(12, "0")}`;
}

function getTransactionDetail(transaction, user) {
  const amount = Number(transaction.amount) || 0;
  const type = transaction.type?.toLowerCase();
  const total = Math.abs(amount);
  const parsedAdmin = parseRupiahFromNote(transaction.note, "admin");
  const parsedNominal = parseRupiahFromNote(transaction.note, "transfer");
  const admin = parsedAdmin ?? 0;
  const nominal = parsedNominal ?? Math.max(total - admin, 0);
  const title = getTransactionTitle(transaction);
  const isIncome = amount > 0 || type === "income";
  const isTransfer = type === "transfer" || type === "income";
  const counterpartyName = stripTransferPrefix(transaction.merchant || "") || "-";
  const currentUserName = user?.name || "Akun KantongKu";
  const senderName = isIncome ? counterpartyName : currentUserName;
  const recipientName = isIncome ? currentUserName : counterpartyName;

  return {
    admin,
    bank: isTransfer ? (isIncome ? "KantongKu" : "KantongKu / Bank tujuan") : "-",
    date: formatTransactionDate(transaction.created_at, "long"),
    note: transaction.note || "-",
    nominal,
    ref: getDisplayRef(transaction),
    recipientName,
    source: isIncome ? "Pengirim KantongKu" : "Saldo KantongKu",
    senderName,
    status: transaction.status || "berhasil",
    title,
    total,
    transactionType: isIncome ? "Transfer masuk" : type === "transfer" ? "Transfer keluar" : title,
  };
}

function DetailRow({ label, value, strong = false }) {
  return (
    <div className="transaction-detail-row">
      <span>{label}</span>
      <strong className={strong ? "text-lg" : ""}>{value}</strong>
    </div>
  );
}

export function TransactionList({
  className = "",
  loading = false,
  maxItems = 5,
  notify,
  onViewAll,
  showViewAll = true,
  title = "Transaksi terbaru",
  transactions = [],
  user,
}) {
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const detail = selectedTransaction ? getTransactionDetail(selectedTransaction, user) : null;
  const visibleTransactions = maxItems ? transactions.slice(0, maxItems) : transactions;
  const shouldGroupByDate = !showViewAll && !maxItems;
  const transactionGroups = shouldGroupByDate
    ? visibleTransactions.reduce((groups, transaction) => {
      const key = getTransactionGroupKey(transaction.created_at);
      const existingGroup = groups.find((group) => group.key === key);
      if (existingGroup) {
        existingGroup.items.push(transaction);
      } else {
        groups.push({
          items: [transaction],
          key,
          label: formatTransactionGroupDate(transaction.created_at),
        });
      }
      return groups;
    }, [])
    : [{ items: visibleTransactions, key: "all", label: "" }];

  if (detail) {
    const shareText = [
      "Bukti transaksi KantongKu",
      `Ref: ${detail.ref}`,
      `Status: ${detail.status}`,
      `Jenis: ${detail.transactionType}`,
      `Pengirim: ${detail.senderName}`,
      `Penerima: ${detail.recipientName}`,
      `Total: ${formatCurrency(detail.total, false)}`,
    ].join("\n");

    const copyRef = async () => {
      await navigator.clipboard?.writeText(detail.ref);
      notify?.({ description: `${detail.ref} sudah disalin.`, title: "Ref disalin", type: "info" });
    };

    const shareReceipt = async () => {
      try {
        if (navigator.share) {
          await navigator.share({ text: shareText, title: "Bukti transaksi KantongKu" });
        } else {
          await navigator.clipboard?.writeText(shareText);
        }
        notify?.({ description: "Bukti transaksi siap dibagikan.", title: "Bukti dibagikan", type: "success" });
      } catch {
        notify?.({ description: "Aksi bagikan dibatalkan atau gagal diproses.", title: "Bagikan dibatalkan", type: "error" });
      }
    };

    return (
      <section className="transaction-detail-screen">
        <div className="transaction-detail-topbar">
          <button className="transfer-detail-back" onClick={() => setSelectedTransaction(null)} type="button">
            <ArrowRight className="rotate-180" size={16} /> Kembali
          </button>
        </div>

        <div className="transaction-detail-scroll">
          <div className="transaction-receipt neo-card bg-white">
            <div className="transaction-detail-check">
              <CheckCircle2 size={34} strokeWidth={2.5} />
            </div>
            <p className="eyebrow text-center">Transaksi</p>
            <h3 className="transaction-detail-title">{detail.title}</h3>

            <div className="transaction-detail-block mt-6">
              <DetailRow label="Tanggal" value={detail.date} />
              <DetailRow label="Nomor Referensi" value={detail.ref} />
              <DetailRow label="Status" value={detail.status} />
            </div>

            <div className="transaction-detail-block">
              <DetailRow label="Sumber Dana" value={detail.source} />
              <DetailRow label="Nama Pengirim" value={detail.senderName} />
              <DetailRow label="Jenis Transaksi" value={detail.transactionType} />
              <DetailRow label="Bank / Kanal" value={detail.bank} />
              <DetailRow label="Nama Penerima" value={detail.recipientName} />
              <DetailRow label="Catatan" value={detail.note} />
            </div>

            <div className="transaction-detail-block">
              <DetailRow label="Nominal" value={formatCurrency(detail.nominal, false)} />
              <DetailRow label="Biaya Admin" value={formatCurrency(detail.admin, false)} />
              <DetailRow label="Total" value={formatCurrency(detail.total, false)} strong />
            </div>
          </div>
        </div>

        <div className="transaction-detail-actions">
          <button className="neo-button bg-blue" onClick={shareReceipt} type="button">
            <Share2 size={16} /> Bagikan bukti transaksi
          </button>
          <button className="neo-button bg-white" onClick={copyRef} type="button">
            <Copy size={16} /> Salin nomor referensi
          </button>
          <button
            className="neo-button bg-white"
            onClick={() => notify?.({
              description: `Simpan ref ${detail.ref} untuk dibantu tim KantongKu.`,
              title: "Bantuan transaksi",
              type: "info",
            })}
            type="button"
          >
            <HelpCircle size={16} /> Cari bantuan
          </button>
          <button className="neo-button bg-lime" onClick={() => setSelectedTransaction(null)} type="button">
            OK
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      {title || showViewAll ? (
        <div className="section-heading">
          {title ? <h2>{title}</h2> : <span />}
          {showViewAll ? (
            <button className="text-link" onClick={onViewAll} type="button">
              Lihat semua <ArrowRight size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="neo-card divide-y-2 divide-ink overflow-hidden bg-white">
        {loading ? (
          <article className="transaction-row">
            <div className="transaction-icon bg-blue" />
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black">Memuat transaksi...</h3>
              <p className="mt-0.5 text-xs font-semibold text-muted">Sinkron dengan Supabase</p>
            </div>
          </article>
        ) : null}

        {!loading && transactions.length === 0 ? (
          <article className="transaction-row">
            <div className="transaction-icon bg-lime">
              <ReceiptText size={20} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black">Belum ada transaksi</h3>
              <p className="mt-0.5 text-xs font-semibold text-muted">Aktivitas realtime akan muncul di sini.</p>
            </div>
          </article>
        ) : null}

        {!loading &&
          transactionGroups.map((group) => (
            <div className="transaction-date-group" key={group.key}>
              {group.label ? <div className="transaction-date-divider">{group.label}</div> : null}
              {group.items.map((transaction) => {
            const { Icon, tone } = getTransactionVisual(transaction);
            const amount = Number(transaction.amount) || 0;

            return (
              <button
                className="transaction-row transaction-row-button"
                key={transaction.id}
                onClick={() => setSelectedTransaction(transaction)}
                type="button"
              >
                <div className={`transaction-icon ${tone}`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <h3 className="truncate text-sm font-black">{getTransactionTitle(transaction)}</h3>
                  <p className="mt-0.5 truncate text-xs font-semibold text-muted">
                    {formatTransactionDate(transaction.created_at)}
                    {` · ${getDisplayRef(transaction)}`}
                  </p>
                </div>
                <p className={`text-sm font-black ${amount > 0 ? "text-success" : ""}`}>
                  {formatCurrency(amount)}
                </p>
              </button>
            );
              })}
            </div>
          ))}
      </div>
    </section>
  );
}
