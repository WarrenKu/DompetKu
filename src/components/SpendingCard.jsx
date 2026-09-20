function formatCurrency(value = 0) {
  return new Intl.NumberFormat("id-ID", {
    currency: "IDR",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(Number(value) || 0);
}

function getMonthLabel() {
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date()).toUpperCase();
}

export function SpendingCard({ monthlyExpense = 0 }) {
  const budget = 5_000_000;
  const progress = Math.min(100, Math.round((monthlyExpense / budget) * 100));

  return (
    <section className="neo-card bg-yellow p-5 sm:p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="eyebrow">Pengeluaran bulan ini</p>
          <p className="mt-2 font-display text-2xl font-black">{formatCurrency(monthlyExpense)}</p>
          <p className="mt-1 text-xs font-bold text-ink/65">{progress}% dari budget bulanan</p>
        </div>
        <span className="border-2 border-ink bg-white px-2 py-1 text-xs font-black shadow-[2px_2px_0_#171717]">
          {getMonthLabel()}
        </span>
      </div>
      <div className="mt-5 h-4 overflow-hidden border-2 border-ink bg-white">
        <div className="h-full border-r-2 border-ink bg-pink" style={{ width: `${progress}%` }} />
      </div>
    </section>
  );
}
