import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CircleCheck,
  Eye,
  EyeOff,
  Fingerprint,
  Landmark,
  RadioTower,
  ScanLine,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";

const features = [
  {
    number: "01",
    title: "Privasi aman.",
    description: "Data pribadi dan aktivitas finansial dijaga tanpa bikin alur terasa ribet.",
    label: "Privasi",
    tone: "feature-lime",
    icon: Fingerprint,
  },
  {
    number: "02",
    title: "Bantuan 24/7.",
    description: "Customer service siap bantu saat transaksi, kartu, atau saldo butuh perhatian.",
    label: "CS aktif",
    tone: "feature-blue",
    icon: CircleCheck,
  },
  {
    number: "03",
    title: "Notifikasi realtime.",
    description: "Setiap uang masuk, keluar, dan perubahan penting langsung muncul tanpa telat.",
    label: "Realtime",
    tone: "feature-pink",
    icon: BellRing,
  },
  {
    number: "04",
    title: "Kontrol kartu.",
    description: "Bekukan, aktifkan, atau atur limit kartu dari satu tempat yang gampang dipahami.",
    label: "Kontrol",
    tone: "feature-yellow",
    icon: WalletCards,
  },
  {
    number: "05",
    title: "Insight cerdas.",
    description: "Ringkasan pengeluaran dibuat jelas supaya keputusan uang terasa lebih tenang.",
    label: "Insight",
    tone: "feature-white",
    icon: Sparkles,
  },
];

const miniActions = {
  transfer: {
    title: "Transfer siap",
    detail: "Pilih tujuan dan kirim seketika",
    value: "0 detik",
  },
  receive: {
    title: "QR penerima aktif",
    detail: "Siap menerima dari bank mana pun",
    value: "LIVE",
  },
  cards: {
    title: "Kartu terlindungi",
    detail: "Semua kontrol ada di tanganmu",
    value: "AMAN",
  },
};

const tickerItems = [
  "TRANSFER TANPA RIBET",
  "PANTAU REALTIME",
  "NABUNG AUTO-PILOT",
  "SAT-SET BAYAR",
  "KANTONG AMAN",
  "SALDO HIDUP",
  "TRANSFER TANPA RIBET",
  "PANTAU REALTIME",
  "NABUNG AUTO-PILOT",
  "SAT-SET BAYAR",
  "KANTONG AMAN",
  "SALDO HIDUP",
];

const footerColumns = [
  {
    title: "Produk",
    links: ["Kantong", "Transfer", "Insight saldo", "Kartu virtual"],
  },
  {
    title: "Bantuan",
    links: ["Pusat bantuan", "Keamanan", "Status sistem", "Hubungi kami"],
  },
  {
    title: "Perusahaan",
    links: ["Tentang KantongKu", "Karier", "Blog", "Kemitraan"],
  },
];

function useNavScrollState() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 72);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return isScrolled;
}

function useScrollReveal() {
  useEffect(() => {
    const elements = document.querySelectorAll(".reveal-on-scroll");

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -12% 0px",
        threshold: 0.12,
      },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);
}

function useFeatureCardReveal() {
  useEffect(() => {
    const sections = document.querySelectorAll(".story-section");

    if (!("IntersectionObserver" in window)) {
      sections.forEach((section) => {
        section.querySelector(".feature-grid-desktop")?.classList.add("cards-are-visible");
      });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.querySelector(".feature-grid-desktop")?.classList.add("cards-are-visible");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -50% 0px",
        threshold: 0.2,
      },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);
}

function Brand() {
  return (
    <span className="landing-brand" aria-label="KantongKu">
      <span className="brand-underlined">Kantong</span>
      <span>Ku</span>
    </span>
  );
}

function MiniDashboard() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [activeAction, setActiveAction] = useState("transfer");
  const action = miniActions[activeAction];

  useEffect(() => {
    const actions = Object.keys(miniActions);
    const interval = window.setInterval(() => {
      setActiveAction((current) => {
        const currentIndex = actions.indexOf(current);
        return actions[(currentIndex + 1) % actions.length];
      });
    }, 2600);

    return () => window.clearInterval(interval);
  }, []);

  const handlePointerMove = (event) => {
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--rotate-x", `${y * -5}deg`);
    card.style.setProperty("--rotate-y", `${x * 7}deg`);
  };

  const resetTilt = (event) => {
    event.currentTarget.style.setProperty("--rotate-x", "0deg");
    event.currentTarget.style.setProperty("--rotate-y", "0deg");
  };

  return (
    <div
      className="hero-product"
      onMouseMove={handlePointerMove}
      onMouseLeave={resetTilt}
    >
      <span className="float-tag float-tag-safe">
        <ShieldCheck size={15} /> Aman 24/7
      </span>
      <span className="float-tag float-tag-fast">
        <Sparkles size={15} /> Sat-set!
      </span>

      <div className="phone-shell">
        <div className="phone-speaker" />
        <div className="phone-header">
          <span className="mini-logo">K</span>
          <span className="mini-avatar">DK</span>
        </div>
        <p className="mini-kicker">TOTAL SALDO</p>
        <div className="mini-balance-row">
          <p className="mini-balance">
            {balanceVisible ? "Rp12.840.500" : "Rp ••••••••"}
          </p>
          <button
            className="mini-visibility"
            type="button"
            aria-label={balanceVisible ? "Sembunyikan saldo" : "Tampilkan saldo"}
            onClick={() => setBalanceVisible((visible) => !visible)}
          >
            {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        </div>
        <div className="mini-balance-card">
          <div className="mini-card-top">
            <span>kantong.</span>
            <ScanLine size={18} />
          </div>
          <div>
            <p>•••• 2048</p>
            <span>DIMAS K.</span>
          </div>
          <div className="mini-orb" />
        </div>
        <div className="mini-actions">
          <button
            className={activeAction === "transfer" ? "active" : ""}
            type="button"
            aria-label="Transfer"
            aria-pressed={activeAction === "transfer"}
            onClick={() => setActiveAction("transfer")}
          >
            <ArrowUpRight size={17} />
          </button>
          <button
            className={activeAction === "receive" ? "active" : ""}
            type="button"
            aria-label="Terima uang"
            aria-pressed={activeAction === "receive"}
            onClick={() => setActiveAction("receive")}
          >
            <ArrowDownLeft size={17} />
          </button>
          <button
            className={activeAction === "cards" ? "active" : ""}
            type="button"
            aria-label="Kontrol kartu"
            aria-pressed={activeAction === "cards"}
            onClick={() => setActiveAction("cards")}
          >
            <WalletCards size={17} />
          </button>
        </div>
        <div className="mini-live-panel" key={activeAction}>
          <CircleCheck size={18} />
          <span>
            <b>{action.title}</b>
            <small>{action.detail}</small>
          </span>
          <strong>{action.value}</strong>
        </div>
        <div className="mini-transaction">
          <span className="mini-transaction-icon">K</span>
          <span><b>Kopi pagi</b><small>Hari ini, 08:12</small></span>
          <b>-28K</b>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ feature, className = "" }) {
  const Icon = feature.icon;

  return (
    <article className={`feature-card ${feature.tone} ${className}`}>
      <div className="feature-card-head">
        <span className="feature-number">{feature.number}</span>
        <Icon className="feature-icon" size={28} />
      </div>
      <div className="feature-copy">
        <h3>{feature.title}</h3>
        <p>{feature.description}</p>
        <span className="feature-link">
          {feature.label} <ArrowRight size={15} />
        </span>
      </div>
    </article>
  );
}

function FeatureShowcase() {
  const [active, setActive] = useState(0);
  const [previous, setPrevious] = useState(null);
  const [direction, setDirection] = useState("next");
  const [pagerMotion, setPagerMotion] = useState(0);

  const showSlide = (next) => {
    if (next === active) return;
    setDirection(next > active || (active === features.length - 1 && next === 0) ? "next" : "prev");
    setPrevious(active);
    setActive(next);
    setPagerMotion((motion) => motion + 1);
  };

  useEffect(() => {
    if (previous === null) return undefined;
    const timeout = window.setTimeout(() => setPrevious(null), 520);
    return () => window.clearTimeout(timeout);
  }, [previous]);

  return (
    <>
      <div className="feature-grid feature-grid-desktop">
        {features.map((feature) => (
          <FeatureCard feature={feature} key={feature.number} />
        ))}
      </div>

      <div className="feature-deck">
        <div className="feature-deck-stage">
          <FeatureCard
            feature={features[active]}
            className={`feature-slide feature-slide-current slide-enter-${direction}`}
            key={`active-${active}`}
          />
          {previous !== null && (
            <FeatureCard
              feature={features[previous]}
              className={`feature-slide feature-slide-previous slide-exit-${direction}`}
              key={`previous-${previous}`}
            />
          )}
        </div>
        <div
          className={`feature-pagination pager-${direction}`}
          aria-label="Pilih fitur"
          key={pagerMotion}
        >
          {features.map((feature, index) => (
            <button
              className={active === index ? "active" : ""}
              type="button"
              key={feature.number}
              onClick={() => showSlide(index)}
              aria-label={`Tampilkan fitur ${index + 1}: ${feature.title}`}
              aria-current={active === index ? "true" : undefined}
              style={{ "--pager-delay": `${index * 55}ms` }}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

export function LandingPage({ onEnter }) {
  const isScrolled = useNavScrollState();
  useScrollReveal();
  useFeatureCardReveal();

  const scrollToStory = () => {
    document.getElementById("cara-kerja")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="landing-page">
      <header className={`landing-nav ${isScrolled ? "is-scrolled" : ""}`}>
        <Brand />
        <button className="landing-status" type="button" onClick={onEnter}>
          <span />
          Masuk
        </button>
      </header>

      <main>
        <section className="hero-section reveal-on-scroll is-visible">
          <div className="hero-copy">
            <div className="hero-label">
              <Fingerprint size={17} />
              Uangmu, caramu.
            </div>
            <h1 className="hero-title">
              <span className="hero-title-line">Satu kantong,</span>
              <span className="hero-title-line">banyak</span>
              <span className="hero-title-line hero-highlight">kemungkinan.</span>
            </h1>
            <p className="hero-description">
              Cara baru mengatur, mengirim, dan menumbuhkan uang—tanpa bahasa
              bank yang bikin dahi berkerut.
            </p>
            <div className="hero-cta">
              <button className="landing-primary" type="button" onClick={onEnter}>
                Masuk ke KantongKu <ArrowRight size={19} />
              </button>
              <button className="landing-secondary" type="button" onClick={scrollToStory}>
                Lihat cara kerja
              </button>
            </div>
            <p className="hero-footnote">Gratis selamanya · Tanpa biaya tersembunyi</p>
          </div>

          <MiniDashboard />
        </section>

        <div className="ticker reveal-on-scroll" aria-hidden="true">
          <div className="ticker-track">
            {[0, 1].map((group) => (
              <div className="ticker-group" key={group}>
                {tickerItems.map((item, index) => (
                  <span className="ticker-item" key={`${group}-${item}-${index}`}>
                    {item}
                    <i>✦</i>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <section className="story-section reveal-on-scroll" id="cara-kerja">
          <div className="story-heading reveal-child">
            <div>
              <p className="eyebrow">KENAPA KANTONGKU?</p>
              <h2 className="story-title">
                <span>Banking yang</span>
                <span>terasa lebih</span>
                <span>manusia.</span>
              </h2>
            </div>
            <p className="story-note">
              <span className="story-note-text">
                <span>Lima hal penting yang bikin m-banking terasa</span>
                <span>aman, responsif, dan gampang dipakai setiap</span>
                <span>hari.</span>
              </span>
            </p>
          </div>

          <FeatureShowcase />
        </section>

        <section className="landing-quote reveal-on-scroll">
          <p>“Bukan cuma tempat uang singgah—</p>
          <p>ini tempat rencana tumbuh.”</p>
        </section>
      </main>

      <footer className="landing-footer reveal-on-scroll">
        <div className="footer-main">
          <div className="footer-brand-block">
            <Brand />
            <p>
              KantongKu adalah konsep layanan keuangan digital untuk mengelola,
              mengirim, dan memahami uang dengan lebih sederhana.
            </p>
            <div className="footer-regulatory" aria-label="Informasi regulator">
              <span>Kantong telah terdaftar dan diawasi oleh</span>
              <div className="footer-regulator-links">
                <a href="https://www.bi.go.id/" target="_blank" rel="noreferrer">
                  <Landmark size={18} />
                  Bank Indonesia
                </a>
                <a href="https://www.komdigi.go.id/" target="_blank" rel="noreferrer">
                  <RadioTower size={18} />
                  Komdigi
                </a>
              </div>
            </div>
          </div>

          <nav className="footer-nav" aria-label="Navigasi footer">
            {footerColumns.map((column) => (
              <div className="footer-column" key={column.title}>
                <h3>{column.title}</h3>
                {column.links.map((link) => (
                  <a href="#top" key={link}>
                    {link}
                  </a>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="footer-bottom">
          <p>© 2026 KantongKu. Seluruh hak cipta dilindungi.</p>
          <div>
            <a href="#privacy">Kebijakan Privasi</a>
            <a href="#terms">Syarat & Ketentuan</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const legalDocuments = {
  privacy: {
    eyebrow: "KEBIJAKAN PRIVASI",
    title: "Kebijakan Privasi KantongKu",
    intro:
      "Dokumen ini menjelaskan bagaimana KantongKu mengumpulkan, menggunakan, menyimpan, dan melindungi informasi pengguna pada konsep layanan mobile banking digital ini.",
    meta: [
      ["Status publikasi", "Prototype portofolio — belum dirilis sebagai layanan komersial."],
      ["Tanggal berlaku", "8 Juli 2026"],
      ["Versi dokumen", "1.0"],
      ["Pendiri konsep", "Dimas K."],
      ["Operator", "KantongKu Studio (konsep produk digital)."],
    ],
    sections: [
      {
        title: "1. Informasi yang dikumpulkan",
        body:
          "Pada versi prototype, data yang tampil bersifat dummy. Dalam implementasi nyata, KantongKu dapat memproses informasi identitas akun, nomor telepon, email, perangkat, riwayat transaksi, preferensi notifikasi, dan aktivitas keamanan.",
      },
      {
        title: "2. Tujuan penggunaan data",
        body:
          "Data digunakan untuk membuat akun berjalan, memverifikasi identitas, menampilkan saldo dan transaksi, mengirim notifikasi penting, mencegah penyalahgunaan, menyediakan customer service 24/7, serta meningkatkan pengalaman produk.",
      },
      {
        title: "3. Perlindungan dan penyimpanan",
        body:
          "KantongKu dirancang dengan prinsip pembatasan akses, enkripsi data sensitif, audit aktivitas, dan pemantauan anomali. Data hanya disimpan selama diperlukan untuk tujuan layanan, kewajiban hukum, keamanan, atau penyelesaian sengketa.",
      },
      {
        title: "4. Pembagian data",
        body:
          "Data pengguna tidak dijual. Dalam layanan nyata, data hanya dapat dibagikan kepada penyedia infrastruktur, mitra pembayaran, regulator, atau pihak berwenang jika diperlukan oleh hukum dan operasional layanan.",
      },
      {
        title: "5. Hak pengguna",
        body:
          "Pengguna dapat meminta akses, koreksi, pembatasan pemrosesan, atau penghapusan data sesuai ketentuan yang berlaku. Permintaan dapat dikirim melalui kanal kontak resmi KantongKu.",
      },
      {
        title: "6. Cookie dan analitik",
        body:
          "Jika dipublikasikan, situs dapat menggunakan cookie atau analitik terbatas untuk memahami performa halaman, keamanan sesi, dan peningkatan UI. Pengguna dapat mengatur preferensi melalui pengaturan browser.",
      },
      {
        title: "7. Perubahan kebijakan",
        body:
          "Kebijakan dapat diperbarui ketika fitur, regulasi, atau kebutuhan keamanan berubah. Tanggal dan versi dokumen akan diperbarui setiap ada perubahan material.",
      },
    ],
  },
  terms: {
    eyebrow: "SYARAT & KETENTUAN",
    title: "Syarat & Ketentuan KantongKu",
    intro:
      "Dokumen ini mengatur penggunaan KantongKu sebagai konsep mobile banking digital, termasuk batasan layanan, tanggung jawab pengguna, dan ketentuan prototype.",
    meta: [
      ["Status publikasi", "Prototype portofolio — belum menerima transaksi nyata."],
      ["Tanggal berlaku", "8 Juli 2026"],
      ["Versi dokumen", "1.0"],
      ["Pendiri konsep", "Dimas K."],
      ["Kategori produk", "Konsep aplikasi mobile banking dan pengelolaan keuangan."],
    ],
    sections: [
      {
        title: "1. Ruang lingkup layanan",
        body:
          "KantongKu menampilkan konsep fitur seperti saldo, transfer, insight pengeluaran, kontrol kartu, notifikasi realtime, dan customer service. Semua angka dan transaksi pada prototype adalah simulasi.",
      },
      {
        title: "2. Status prototype",
        body:
          "KantongKu belum beroperasi sebagai bank, penyelenggara jasa pembayaran, dompet elektronik, atau lembaga keuangan berizin. Pernyataan regulator pada tampilan digunakan sebagai contoh kebutuhan desain legal dan harus divalidasi sebelum rilis nyata.",
      },
      {
        title: "3. Kewajiban pengguna",
        body:
          "Pengguna wajib menjaga keamanan perangkat, PIN, OTP, kata sandi, dan data akun. Pengguna juga wajib memastikan tujuan transaksi benar sebelum melakukan instruksi pembayaran pada layanan nyata.",
      },
      {
        title: "4. Keamanan akun",
        body:
          "KantongKu dapat membatasi, meninjau, atau menghentikan akses apabila terdeteksi aktivitas mencurigakan, penyalahgunaan, pelanggaran hukum, atau risiko keamanan terhadap pengguna lain.",
      },
      {
        title: "5. Batasan tanggung jawab",
        body:
          "Karena versi ini adalah prototype, KantongKu tidak memproses dana sungguhan dan tidak bertanggung jawab atas keputusan finansial yang dibuat berdasarkan data dummy pada tampilan.",
      },
      {
        title: "6. Hak kekayaan intelektual",
        body:
          "Nama, desain antarmuka, alur, copywriting, dan aset visual KantongKu dalam prototype ini merupakan bagian dari portofolio pembuat konsep kecuali dinyatakan lain.",
      },
      {
        title: "7. Perubahan layanan",
        body:
          "Fitur, tampilan, biaya, kebijakan, dan ketentuan dapat berubah sewaktu-waktu untuk kebutuhan pengembangan produk, regulasi, keamanan, atau peningkatan pengalaman pengguna.",
      },
    ],
  },
};

export function LegalPage({ type = "privacy", onBack }) {
  const document = legalDocuments[type] ?? legalDocuments.privacy;
  const isScrolled = useNavScrollState();
  useScrollReveal();

  return (
    <div className="legal-page">
      <header className={`legal-nav ${isScrolled ? "is-scrolled" : ""}`}>
        <Brand />
        <button className="legal-back" type="button" onClick={onBack}>
          <ArrowLeft size={17} />
          Kembali
        </button>
      </header>

      <main className="legal-shell">
        <section className="legal-hero reveal-on-scroll is-visible">
          <p className="eyebrow">{document.eyebrow}</p>
          <h1>{document.title}</h1>
          <p>{document.intro}</p>
        </section>

        <section className="legal-meta reveal-on-scroll" aria-label="Ringkasan dokumen">
          {document.meta.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <b>{value}</b>
            </div>
          ))}
        </section>

        <section className="legal-document reveal-on-scroll">
          {document.sections.map((section) => (
            <article key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          ))}
        </section>

        <section className="legal-contact reveal-on-scroll">
          <h2>Kontak resmi</h2>
          <p>
            <span>Untuk pertanyaan legal, privasi, keamanan, atau kerja sama,</span>
            <span>
              hubungi tim KantongKu melalui{" "}
              <a href="mailto:legal@kantongku.test">legal@kantongku.test</a>.
            </span>
          </p>
        </section>
      </main>
    </div>
  );
}
