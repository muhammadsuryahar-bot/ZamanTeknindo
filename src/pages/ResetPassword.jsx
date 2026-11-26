import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Info, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { API_URL } from "../utils/api";
import AuthLayout from "../components/AuthLayout";

export default function ResetPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasi, setKonfirmasi] = useState("");
  const [pesan, setPesan] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selesai, setSelesai] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setPesan("");
    setPesanError("");
    if (!token) {
      setPesanError("Tautan pemulihan tidak memiliki token. Minta tautan baru dari halaman login.");
      return;
    }
    if (passwordBaru.length < 6) {
      setPesanError("Password baru minimal 6 karakter.");
      return;
    }
    if (passwordBaru !== konfirmasi) {
      setPesanError("Konfirmasi password baru tidak sama.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, passwordBaru }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPesanError(data?.pesan || "Tautan pemulihan tidak valid atau sudah kedaluwarsa.");
        return;
      }
      setPesan(data?.pesan || "Password berhasil diperbarui. Silakan login kembali.");
      setSelesai(true);
    } catch (error) {
      console.error("Reset password gagal:", error);
      setPesanError("Tidak bisa terhubung ke server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      tagline="Keamanan akun dimulai dari password yang hanya diketahui oleh pemilik akun."
      formTitle="Buat Password Baru"
      formSubtitle="Atur password baru untuk melanjutkan penggunaan sistem absensi."
    >
      {selesai ? (
        <div style={styles.content}>
          <div className="message message-info" role="status">
            <Info size={18} />
            <span>{pesan}</span>
          </div>
          <button type="button" className="auth-button" onClick={() => navigate("/login", { replace: true })}>
            Kembali ke Login <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="login-form" noValidate>
          {!token && (
            <div className="message message-error" role="alert">
              <AlertCircle size={18} />
              <span>Token pemulihan tidak ditemukan pada tautan ini.</span>
            </div>
          )}
          <div className="field">
            <label htmlFor="passwordBaru" className="field-label">Password Baru</label>
            <div className="input-wrap">
              <LockKeyhole size={18} className="input-icon" />
              <input
                id="passwordBaru"
                type="password"
                value={passwordBaru}
                onChange={(e) => { setPasswordBaru(e.target.value); setPesanError(""); }}
                placeholder="Minimal 6 karakter"
                className="auth-input auth-input-tanpa-tombol"
                autoComplete="new-password"
                minLength={6}
                disabled={loading || !token}
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="konfirmasiPassword" className="field-label">Konfirmasi Password Baru</label>
            <div className="input-wrap">
              <LockKeyhole size={18} className="input-icon" />
              <input
                id="konfirmasiPassword"
                type="password"
                value={konfirmasi}
                onChange={(e) => { setKonfirmasi(e.target.value); setPesanError(""); }}
                placeholder="Ulangi password baru"
                className="auth-input auth-input-tanpa-tombol"
                autoComplete="new-password"
                minLength={6}
                disabled={loading || !token}
                required
              />
            </div>
          </div>
          {pesanError && (
            <div className="message message-error" role="alert">
              <AlertCircle size={18} />
              <span>{pesanError}</span>
            </div>
          )}
          <button type="submit" className="auth-button" disabled={loading || !token}>
            {loading ? (
              <>
                <LoaderCircle size={18} className="auth-loading-icon" />
                Menyimpan password...
              </>
            ) : (
              <>
                Simpan Password Baru
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <button type="button" className="auth-switch-button" onClick={() => navigate("/login")} style={{ display: "block", width: "100%", marginTop: 14, textAlign: "center" }}>
            Kembali ke Login
          </button>
          <div style={styles.note}>
            <ShieldCheck size={14} /> Tautan hanya berlaku 20 menit dan hanya dapat digunakan sekali.
          </div>
        </form>
      )}
    </AuthLayout>
  );
}

const styles = {
  content: { display: "grid", gap: 16 },
  note: { display: "flex", alignItems: "center", gap: 7, marginTop: 12, color: "#64748b", fontSize: 11.5, lineHeight: 1.5 },
};
