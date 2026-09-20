import {
  CircleHelp,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PieChart,
  QrCode,
  Settings,
  WalletCards,
} from "lucide-react";
import { Logo } from "./Logo";

const navItems = [
  { id: "dashboard", label: "Beranda", icon: LayoutDashboard },
  { id: "transactions", label: "Transaksi", icon: WalletCards },
  { id: "qris", label: "QRIS", icon: QrCode },
  { id: "cards", label: "Kartu", icon: CreditCard },
  { id: "reports", label: "Laporan", icon: PieChart },
];

export function Sidebar({ activeView = "dashboard", onLogout, onNavigate }) {
  return (
    <aside className="sidebar">
      <Logo />

      <nav className="mt-12 flex flex-1 flex-col gap-2" aria-label="Menu utama">
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            className={`nav-item ${activeView === id ? "nav-item-active" : ""}`}
            key={label}
            onClick={() => onNavigate?.(id)}
            type="button"
          >
            <Icon size={20} strokeWidth={2.5} />
            {label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-2">
        <button
          className={`nav-item ${activeView === "help" ? "nav-item-active" : ""}`}
          onClick={() => onNavigate?.("help")}
          type="button"
        >
          <CircleHelp size={20} strokeWidth={2.5} />
          Bantuan
        </button>
        <button
          className={`nav-item ${activeView === "settings" ? "nav-item-active" : ""}`}
          onClick={() => onNavigate?.("settings")}
          type="button"
        >
          <Settings size={20} strokeWidth={2.5} />
          Pengaturan
        </button>
        <button className="nav-item mt-3 border-t-2 border-ink pt-5" onClick={onLogout} type="button">
          <LogOut size={20} strokeWidth={2.5} />
          Keluar
        </button>
      </div>
    </aside>
  );
}
