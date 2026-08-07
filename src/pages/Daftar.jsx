import { useState } from "react";
import { API_URL } from "../utils/api";
import { warna, font, bayangan } from "../styles/theme";
import logoLogin from "../assets/logo-login.png";

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
      setPesanError("Tidak bisa terhubung ke server. Pastikan backend sudah jalan.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.bracketTL} />
        <div style={styles.bracketTR} />
        <div style={styles.bracketBL} />
        <div style={styles.bracketBR} />
        <img src={logoLogin} alt="PT. Zaman Teknindo" style={styles.logo} />
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
            required
          />

          <label style={styles.label}>Email Kantor</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nama@perusahaan.com"
            style={styles.input}
            required
          />

          <label style={styles.label}>Buat Password</label>
          <input
            type="password"
            value={kataSandi}
            onChange={(e) => setKataSandi(e.target.value)}
            placeholder="Minimal 6 karakter"
            style={styles.input}
            required
            minLength={6}
          />

          {pesanError && <p style={styles.errorText}>{pesanError}</p>}
          {pesanSukses && <p style={styles.successText}>{pesanSukses}</p>}

          <button type="submit" style={styles.tombol} disabled={loading}>
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
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: warna.latar,
    backgroundImage:
      "linear-gradient(#DADFE6 1px, transparent 1px), linear-gradient(90deg, #DADFE6 1px, transparent 1px)",
    backgroundSize: "28px 28px",
    padding: 16,
    fontFamily: font.display,
  },
  card: {
    position: "relative",
    background: warna.panel,
    padding: "36px 30px",
    borderRadius: 4,
    boxShadow: bayangan,
    border: `1px solid ${warna.garis}`,
    width: "100%",
    maxWidth: 380,
  },
  bracketTL: { position: "absolute", top: 12, left: 12, width: 16, height: 16, borderTop: `2px solid ${warna.aksen}`, borderLeft: `2px solid ${warna.aksen}` },
  bracketTR: { position: "absolute", top: 12, right: 12, width: 16, height: 16, borderTop: `2px solid ${warna.aksen}`, borderRight: `2px solid ${warna.aksen}` },
  bracketBL: { position: "absolute", bottom: 12, left: 12, width: 16, height: 16, borderBottom: `2px solid ${warna.aksen}`, borderLeft: `2px solid ${warna.aksen}` },
  bracketBR: { position: "absolute", bottom: 12, right: 12, width: 16, height: 16, borderBottom: `2px solid ${warna.aksen}`, borderRight: `2px solid ${warna.aksen}` },
  logo: {
    width: 150,
    display: "block",
    margin: "0 auto 22px auto",
  },
  judul: { fontSize: 22, fontWeight: 700, marginBottom: 4, color: warna.tinta, textAlign: "center" },
  subjudul: { fontSize: 13.5, color: warna.tintaLembut, marginBottom: 26, textAlign: "center" },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: warna.tinta },
  input: {
    width: "100%",
    padding: "11px 13px",
    marginBottom: 16,
    borderRadius: 3,
    border: `1px solid ${warna.garis}`,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: font.display,
    color: warna.tinta,
    background: warna.latar,
  },
  tombol: {
    width: "100%",
    padding: "13px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 3,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 6,
  },
  errorText: { color: warna.bahaya, fontSize: 13, marginBottom: 12 },
  successText: { color: warna.sukses, fontSize: 13, marginBottom: 12 },
  linkText: { textAlign: "center", fontSize: 13, color: warna.tintaLembut, marginTop: 22 },
  link: { color: warna.aksen, fontWeight: 600, cursor: "pointer" },
};
