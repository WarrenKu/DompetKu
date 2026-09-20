import { useState } from "react";
import { ArrowLeft, ArrowRight, BadgeCheck, Fingerprint, LockKeyhole, Mail } from "lucide-react";

function AuthField({ icon: Icon, label, ...props }) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <div>
        <Icon size={17} />
        <input {...props} />
      </div>
    </label>
  );
}

export function AuthPage({ mode = "signin", notify, onBack, onLogin, onModeChange, onSignup }) {
  const isSignup = mode === "signup";
  const [message, setMessage] = useState("");
  const [pinStep, setPinStep] = useState(false);
  const [loginForm, setLoginForm] = useState({
    identity: "",
    password: "",
    pin: "",
  });
  const [signupForm, setSignupForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const titleLines = isSignup ? ["Buat akses", "KantongKu."] : ["Masuk ke", "KantongKu."];
  const subtitle = isSignup
    ? "Daftar dulu, nanti sistem membuat ID bank yang tidak bisa diubah."
    : pinStep
      ? "Password cocok. Sekarang masukkan PIN untuk menyelesaikan akses."
      : "Gunakan nama atau ID bank dan password. PIN boleh dikosongkan kalau belum diatur.";


  const handleSignup = async (event) => {
    event.preventDefault();
    setMessage("");

    const result = await onSignup(signupForm);
    if (!result.ok) {
      setMessage(result.message);
      notify?.({ description: result.message, title: "Sign up gagal", type: "error" });
      return;
    }

    setMessage(`Akun dibuat. ID bank kamu ${result.profile.bankId}. PIN belum aktif dan bisa diatur nanti.`);
    notify?.({
      description: `ID bank kamu ${result.profile.bankId}. PIN bisa diatur setelah masuk.`,
      title: "Akun berhasil dibuat",
      type: "success",
    });
    setSignupForm({ fullName: "", email: "", password: "", confirmPassword: "" });
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setMessage("");

    const result = await onLogin(loginForm);
    if (!result.ok) {
      setMessage(result.message);
      notify?.({
        description: result.message,
        title: result.pinRequired ? "PIN diperlukan" : "Sign in gagal",
        type: result.pinRequired ? "info" : "error",
      });
      setPinStep(Boolean(result.pinRequired));
      return;
    }

    notify?.({ description: "Akses dashboard sedang dibuka.", title: "Sign in berhasil", type: "success" });
  };

  return (
    <div className="auth-page">
      <button className="auth-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Kembali
      </button>

      <main className="auth-shell">
        <section className="auth-copy">
          <div className="hero-label auth-label">
            <Fingerprint size={17} />
            Akses aman
          </div>
          <h1 key={`title-${mode}`} className="auth-title">
            {titleLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h1>
          <p key={`subtitle-${mode}`} className="auth-subtitle">
            {subtitle}
          </p>

          <div key={`notice-${mode}`} className="auth-id-preview">
            <span>{isSignup ? "Catatan keamanan" : "Proteksi akses"}</span>
            <strong>{isSignup ? "Pilih password yang mudah kamu ingat." : "Maksimal 3 percobaan."}</strong>
            <small>
              {isSignup
                ? "Gunakan kombinasi yang familiar untukmu, tapi jangan pakai tanggal lahir atau PIN yang sama."
                : "Jika nama/ID, password, atau PIN salah 3 kali, akses akun dikunci sementara."}
            </small>
          </div>
        </section>

        <section className="auth-card">
          <div className="auth-tabs" aria-label="Pilih mode akses">
            <button className={!isSignup ? "active" : ""} type="button" onClick={() => onModeChange("signin")}>
              Sign in
            </button>
            <button className={isSignup ? "active" : ""} type="button" onClick={() => onModeChange("signup")}>
              Sign up
            </button>
          </div>

          {isSignup ? (
            <form key="signup" className="auth-form-panel" onSubmit={handleSignup}>
              <AuthField
                icon={BadgeCheck}
                label="Nama lengkap"
                name="fullName"
                placeholder="Contoh: Dimas Kurnia"
                required
                value={signupForm.fullName}
                onChange={(event) => setSignupForm((form) => ({ ...form, fullName: event.target.value }))}
              />
              <AuthField
                icon={Mail}
                label="Email noreply"
                name="email"
                placeholder="nama@email.com"
                required
                type="email"
                value={signupForm.email}
                onChange={(event) => setSignupForm((form) => ({ ...form, email: event.target.value }))}
              />
              <AuthField
                icon={LockKeyhole}
                label="Password"
                name="password"
                placeholder="Minimal 6 karakter"
                required
                type="password"
                value={signupForm.password}
                onChange={(event) => setSignupForm((form) => ({ ...form, password: event.target.value }))}
              />
              <AuthField
                icon={LockKeyhole}
                label="Confirm password"
                name="confirmPassword"
                placeholder="Ulangi password"
                required
                type="password"
                value={signupForm.confirmPassword}
                onChange={(event) => setSignupForm((form) => ({ ...form, confirmPassword: event.target.value }))}
              />
              <button className="auth-submit" type="submit">
                Sign up sekarang <ArrowRight size={18} />
              </button>
            </form>
          ) : (
            <form key="signin" className="auth-form-panel" onSubmit={handleLogin}>
              <AuthField
                icon={BadgeCheck}
                label="Nama / ID bank"
                name="identity"
                placeholder="Dimas, email, atau KK-DIM-ABCDE"
                required
                value={loginForm.identity}
                onChange={(event) => {
                  setPinStep(false);
                  setLoginForm((form) => ({ ...form, identity: event.target.value, pin: "" }));
                }}
              />
              <AuthField
                icon={LockKeyhole}
                label="Password"
                name="password"
                placeholder="Password akun"
                required
                type="password"
                value={loginForm.password}
                onChange={(event) => {
                  setPinStep(false);
                  setLoginForm((form) => ({ ...form, password: event.target.value, pin: "" }));
                }}
              />
              <AuthField
                icon={Fingerprint}
                label={pinStep ? "PIN wajib" : "PIN opsional"}
                name="pin"
                placeholder={pinStep ? "Masukkan PIN akun" : "Kosongkan kalau belum punya PIN"}
                required={pinStep}
                inputMode="numeric"
                maxLength={6}
                value={loginForm.pin}
                onChange={(event) => setLoginForm((form) => ({ ...form, pin: event.target.value.replace(/\D/g, "") }))}
              />
              <button className="auth-submit" type="submit">
                {pinStep ? "Verifikasi PIN" : "Sign in sekarang"} <ArrowRight size={18} />
              </button>
            </form>
          )}

          {message ? <p className="auth-message">{message}</p> : null}
        </section>
      </main>
    </div>
  );
}
