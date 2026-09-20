import { CreditCard, LayoutDashboard, QrCode, UserRound, WalletCards } from "lucide-react";
import { createPortal } from "react-dom";

export function MobileNav({ onNavigate }) {
  const nav = (
    <nav className="mobile-nav" aria-label="Navigasi mobile">
      <button className="mobile-nav-item active" onClick={() => onNavigate?.("dashboard")} type="button">
        <LayoutDashboard size={21} />
        <span>Beranda</span>
      </button>
      <button className="mobile-nav-item" onClick={() => onNavigate?.("transactions")} type="button">
        <WalletCards size={21} />
        <span>Transaksi</span>
      </button>
      <button className="qr-button" aria-label="QRIS" onClick={() => onNavigate?.("qris")} type="button">
        <QrCode size={24} strokeWidth={2.8} />
      </button>
      <button className="mobile-nav-item" onClick={() => onNavigate?.("cards")} type="button">
        <CreditCard size={21} />
        <span>Kartu</span>
      </button>
      <button className="mobile-nav-item" onClick={() => onNavigate?.("settings")} type="button">
        <UserRound size={21} />
        <span>Profil</span>
      </button>
    </nav>
  );

  return createPortal(nav, document.body);
}
