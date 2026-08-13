import { useState } from "react";
import { API_URL } from "../utils/api";
import { warna, font } from "../styles/theme";
import logo from "../assets/logo.png";

export default function Daftar({ keLogin }) {
  const [nama, setNama] = useState("");
  const [email, setEmail] = useState("");
  const [kataSandi, setKataSandi] = useState("");
  const [pesanError, setPesanError] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDaftar(e) {
    e.preventDefault();
    setPesanError("");
    setPesanSukses("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/daftar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, email, kataSandi }),
      });

      const data = await res.json();

      if (!res.ok) {
        setPesanError(data.pesan || "Pendaftaran gagal.");
        setLoading(false);
        return;
      }

      setPesanSukses(data.pesan);
      setNama("");
      setEmail("");
      setKataSandi("");
    } catch (err) {
      console.error(err);
      setPesanError("Tidak bisa terhubung ke server. Pastikan backend sudah jalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.kartuBesar} className="kartu-login-split">
        <div style={styles.panelBrand} className="panel-brand-login">
          <div style={styles.polaTitik} />
          <div style={styles.panelBrandKonten}>
            <img src={logo} alt="" style={styles.logoIkon} />
            <h2 style={styles.brandNama}>PT. Zaman Teknindo</h2>
            <p style={styles.brandTagline}>
              Satu akun untuk absen, lihat riwayat, dan ajukan izin — kapan saja, di mana saja kamu bertugas.
            </p>
          </div>
        </div>

        <div style={styles.panelForm}>
          <h1 style={styles.judul}>Buat Akun</h1>
          <p style={styles.subjudul}>Gunakan email kantor kamu untuk mendaftar.</p>

          <form onSubmit={handleDaftar}>
            <label style={styles.label}>Nama Lengkap</label>
            <input
              type="text"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Nama sesuai identitas"
              style={styles.input}
              className="input-fokus"
              required
            />

            <label style={styles.label}>Email Kantor</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@perusahaan.com"
              style={styles.input}
              className="input-fokus"
              required
            />

            <label style={styles.label}>Buat Password</label>
            <input
              type="password"
              value={kataSandi}
              onChange={(e) => setKataSandi(e.target.value)}
              placeholder="Minimal 6 karakter"
              style={styles.input}
              className="input-fokus"
              required
              minLength={6}
            />

            {pesanError && <p style={styles.errorText}>{pesanError}</p>}
            {pesanSukses && <p style={styles.successText}>{pesanSukses}</p>}

            <button type="submit" style={styles.tombol} className="tombol-hover" disabled={loading}>
              {loading ? "Memproses…" : "Daftar"}
            </button>
          </form>

          <p style={styles.linkText}>
            Sudah punya akun?{" "}
            <span style={styles.link} onClick={keLogin}>
              Login di sini
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
    minHeight: 520,
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
    padding: "40px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
  judul: { fontSize: 24, fontWeight: 700, marginBottom: 4, color: warna.tinta },
  subjudul: { fontSize: 13.5, color: warna.tintaLembut, marginBottom: 24 },
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
    cursor: "pointer",
    marginTop: 6,
    transition: "transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease",
    boxShadow: `0 4px 12px ${warna.aksenLembut}`,
  },
  errorText: { color: warna.bahaya, fontSize: 13, marginBottom: 12 },
  successText: { color: warna.sukses, fontSize: 13, marginBottom: 12 },
  linkText: { textAlign: "center", fontSize: 13, color: warna.tintaLembut, marginTop: 22 },
  link: { color: warna.aksen, fontWeight: 600, cursor: "pointer" },
};
