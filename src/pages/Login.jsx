import { useState } from "react";
import { API_URL, simpanSesiLogin } from "../utils/api";
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

export default function Login({ onLoginBerhasil, kePendaftaran }) {
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setPesanError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, kataSandi }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPesanError(data.pesan || "Login gagal.");
        setLoading(false);
        return;
      }

      simpanSesiLogin(data.token, data.pengguna);
      onLoginBerhasil(data.pengguna);
    } catch (err) {
      setPesanError("Tidak bisa terhubung ke server. Pastikan backend sudah jalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.kartuBesar} className="kartu-login-split">
        {/* Panel kiri: identitas brand */}
        <div style={styles.panelBrand} className="panel-brand-login">
          <div style={styles.polaTitik} />
          <div style={styles.panelBrandKonten}>
            <img src={logo} alt="" style={styles.logoIkon} />
            <h2 style={styles.brandNama}>PT. Zaman Teknindo</h2>
            <p style={styles.brandTagline}>Catat kehadiran, tepat waktu, setiap hari — di mana pun kamu bertugas.</p>
          </div>
        </div>

        {/* Panel kanan: form login */}
        <div style={styles.panelForm}>
          <h1 style={styles.judul}>Masuk ke Akun</h1>
          <p style={styles.subjudul}>Gunakan email &amp; password akun kamu.</p>

          <form onSubmit={handleLogin}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              style={styles.input}
              className="input-fokus"
              required
            />

            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={kataSandi}
              onChange={(e) => setKataSandi(e.target.value)}
              placeholder="Masukkan password"
              style={styles.input}
              className="input-fokus"
              required
            />

            {pesanError && <p style={styles.errorText}>{pesanError}</p>}

            <button type="submit" style={styles.tombol} className="tombol-hover" disabled={loading}>
              {loading ? "Memproses…" : "Masuk"}
            </button>
          </form>

          <p style={styles.linkText}>
            Belum punya akun?{" "}
            <span style={styles.link} onClick={kePendaftaran}>
              Daftar di sini
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: warna.latar,
    padding: 16,
    fontFamily: font.display,
  },
  kartuBesar: {
    display: "flex",
    width: "100%",
    maxWidth: 780,
    minHeight: 480,
    background: warna.panel,
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 4px 12px rgba(22,35,61,0.05), 0 20px 48px rgba(22,35,61,0.12)",
  },
  panelBrand: {
    position: "relative",
    flex: "0 0 42%",
    background: `linear-gradient(160deg, ${warna.aksen} 0%, ${warna.aksenGelap || "#0B6E45"} 100%)`,
    padding: "40px 32px",
    display: "flex",
    alignItems: "flex-end",
    overflow: "hidden",
  },
  polaTitik: {
    position: "absolute",
    inset: 0,
    backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1.5px, transparent 1.5px)",
    backgroundSize: "18px 18px",
    opacity: 0.6,
  },
  panelBrandKonten: { position: "relative", zIndex: 1 },
  logoIkon: { width: 46, marginBottom: 18, filter: "brightness(0) invert(1)" },
  brandNama: { color: "#fff", fontSize: 19, fontWeight: 700, margin: "0 0 10px 0" },
  brandTagline: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6, margin: 0 },
  panelForm: {
    flex: 1,
    padding: "44px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  judul: { fontSize: 24, fontWeight: 700, marginBottom: 4, color: warna.tinta },
  subjudul: { fontSize: 13.5, color: warna.tintaLembut, marginBottom: 28 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: warna.tinta },
  input: {
    width: "100%",
    padding: "12px 14px",
    marginBottom: 16,
    borderRadius: 9,
    border: `1.5px solid ${warna.garis}`,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: font.display,
    color: warna.tinta,
    background: warna.latar,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  tombol: {
    width: "100%",
    padding: "13px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 9,
    fontSize: 14.5,
    fontWeight: 600,
    letterSpacing: "0.01em",
    cursor: "pointer",
    marginTop: 6,
    transition: "transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease",
    boxShadow: `0 4px 12px ${warna.aksenLembut}`,
  },
  errorText: { color: warna.bahaya, fontSize: 13, marginBottom: 12 },
  linkText: { textAlign: "center", fontSize: 13, color: warna.tintaLembut, marginTop: 22 },
  link: { color: warna.aksen, fontWeight: 600, cursor: "pointer" },
};
