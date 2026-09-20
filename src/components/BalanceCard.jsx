import { useState } from "react";
import { Eye, EyeOff, MoreHorizontal } from "lucide-react";

function formatCurrency(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value) || 0);
}

function cleanAccountNumber(accountNumber = "000000000000") {
  return String(accountNumber).replace(/\D/g, "") || "000000000000";
}

function maskAccountNumber(accountNumber) {
  const clean = cleanAccountNumber(accountNumber);
  return `${clean.slice(0, 4)} •••• ${clean.slice(-4)}`;
}

function formatFullAccountNumber(accountNumber) {
  return cleanAccountNumber(accountNumber).replace(/(.{4})/g, "$1 ").trim();
}

export function BalanceCard({ account, loading = false }) {
  const [isAccountVisible, setIsAccountVisible] = useState(false);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const accountLabel = isAccountVisible
    ? formatFullAccountNumber(account?.account_number)
    : maskAccountNumber(account?.account_number);
  const balanceLabel = loading ? "Memuat..." : isBalanceVisible ? formatCurrency(account?.balance) : "Rp •••••••";

  return (
    <section className="neo-card balance-card" aria-label="Saldo utama">
      <div className="relative z-10 flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div>
            <p className="eyebrow text-white/70">Total saldo</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
                {balanceLabel}
              </h2>
              <button
                className="icon-button-dark"
                aria-label={isBalanceVisible ? "Sembunyikan saldo" : "Tampilkan saldo"}
                onClick={() => setIsBalanceVisible((current) => !current)}
                type="button"
              >
                {isBalanceVisible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <button className="icon-button-dark" aria-label="Pilihan saldo">
            <MoreHorizontal size={22} />
          </button>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-white/60">Nomor rekening</p>
              <button
                className="grid h-6 w-6 place-items-center rounded-sm border border-white/40 bg-white/10 text-white"
                type="button"
                aria-label={isAccountVisible ? "Sembunyikan nomor rekening" : "Tampilkan nomor rekening penuh"}
                onClick={() => setIsAccountVisible((current) => !current)}
              >
                {isAccountVisible ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
            <p className="mt-1 font-display text-sm font-extrabold tracking-widest">{accountLabel}</p>
          </div>
          <span className="rounded-sm border-2 border-white bg-lime px-3 py-1 text-xs font-black text-ink">
            UTAMA
          </span>
        </div>
      </div>
      <div className="balance-orb" aria-hidden="true" />
    </section>
  );
}
