import {
  ArrowDownLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Bolt,
  Landmark,
  ReceiptText,
  SmartphoneCharging,
  Smartphone,
  Wallet,
  Utensils,
} from "lucide-react";

export const quickActions = [
  { id: "transfer", label: "Transfer", icon: ArrowUpRight, tone: "bg-lime" },
  { id: "receive", label: "Terima", icon: ArrowDownLeft, tone: "bg-blue" },
  { id: "pay", label: "Bayar", icon: ReceiptText, tone: "bg-pink" },
  { id: "topup", label: "Isi saldo", icon: Smartphone, tone: "bg-yellow" },
];

export const paymentServices = [
  { label: "Pulsa & Tagihan", icon: SmartphoneCharging, tone: "bg-lime" },
  { label: "Listrik PLN", icon: Bolt, tone: "bg-yellow" },
  { label: "E-Wallet", icon: Wallet, tone: "bg-blue" },
  { label: "Top Up", icon: BadgeDollarSign, tone: "bg-pink" },
  { label: "Tagihan Saya", icon: ReceiptText, tone: "bg-white" },
];

export const transactions = [
  {
    id: 1,
    merchant: "Makan Siang",
    detail: "Hari ini • 12:42",
    amount: "-Rp42.000",
    icon: Utensils,
    tone: "bg-pink",
  },
  {
    id: 2,
    merchant: "Gaji Bulanan",
    detail: "Hari ini • 09:10",
    amount: "+Rp8.500.000",
    amountClass: "text-success",
    icon: Landmark,
    tone: "bg-lime",
  },
  {
    id: 3,
    merchant: "Pulsa Telkomsel",
    detail: "3 Jul • 18:20",
    amount: "-Rp100.000",
    icon: Smartphone,
    tone: "bg-blue",
  },
];
