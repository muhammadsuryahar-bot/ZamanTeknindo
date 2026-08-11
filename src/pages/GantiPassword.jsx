import { useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import TopbarHijau from "../components/TopbarHijau";

export default function GantiPassword({ kembali }) {
  const [passwordLama, setPasswordLama] = useState("");
  const [passwordBaru, setPasswordBaru] = useState("");
  const [konfirmasiPasswordBaru, setKonfirmasiPasswordBaru] = useState("");
  const [pesan, setPesan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("error"); // "error" | "sukses"
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setPesan("");

    if (passwordBaru !== konfirmasiPasswordBaru) {
      setPesanTipe("error");
      setPesan("Konfirmasi password baru tidak sama dengan password baru.");
      return;
    }
    if (passwordBaru.length < 6) {
      setPesanTipe("error");
      setPesan("Password baru minimal 6 karakter.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/ganti-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ passwordLama, passwordBaru }),
      });
      const data = await res.json();

      if (!res.ok) {
        setPesanTipe("error");
        setPesan(data.pesan || "Gagal mengubah password.");
        setLoading(false);
        return;
      }

      setPesanTipe("sukses");
      setPesan("Password berhasil diubah. Gunakan password baru untuk login berikutnya.");
      setPasswordLama("");
      setPasswordBaru("");
      setKonfirmasiPasswordBaru("");
    } catch (err) {
      setPesanTipe("error");
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.shell}>
        <TopbarHijau judul="Ganti Password" kembali={kembali} />

        <div style={styles.content}>
          <div style={styles.kartu}>
            <p style={styles.deskripsi}>
              Punya password sementara dari Admin? Ganti sekarang jadi password pilihan kamu sendiri.
            </p>

            <form onSubmit={handleSubmit}>
              <label style={styles.label}>Password Lama</label>
              <input
                type="password"
                value={passwordLama}
                onChange={(e) => setPasswordLama(e.target.value)}
                placeholder="Masukkan password saat ini"
                style={styles.input}
                className="input-fokus"
                required
              />

              <label style={styles.label}>Password Baru</label>
              <input
                type="password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                placeholder="Minimal 6 karakter"
                style={styles.input}
                className="input-fokus"
                required
                minLength={6}
              />

              <label style={styles.label}>Konfirmasi Password Baru</label>
              <input
                type="password"
                value={konfirmasiPasswordBaru}
                onChange={(e) => setKonfirmasiPasswordBaru(e.target.value)}
                placeholder="Ulangi password baru"
                style={styles.input}
                className="input-fokus"
                required
                minLength={6}
              />

              {pesan && (
                <p style={pesanTipe === "sukses" ? styles.pesanSukses : styles.pesanError}>{pesan}</p>
              )}

              <button type="submit" style={styles.tombol} className="tombol-hover" disabled={loading}>
                {loading ? "Menyimpan…" : "Simpan Password Baru"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100svh", background: warna.latar, fontFamily: font.display, padding: 16 },
  shell: { maxWidth: 460, margin: "0 auto" },
  content: {},
  kartu: {
    background: warna.panel,
    borderRadius: 14,
    padding: "24px 22px",
    border: `1px solid ${warna.garis}`,
  },
  deskripsi: { fontSize: 13, color: warna.tintaLembut, margin: "0 0 20px 0", lineHeight: 1.5 },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 6, color: warna.tinta, marginTop: 14 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 9,
    border: `1.5px solid ${warna.garis}`,
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: font.display,
    color: warna.tinta,
    background: warna.latar,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  pesanError: { color: warna.bahaya, fontSize: 13, marginTop: 14, marginBottom: 0 },
  pesanSukses: { color: warna.sukses, fontSize: 13, marginTop: 14, marginBottom: 0 },
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
    marginTop: 20,
    transition: "transform 0.12s ease, filter 0.12s ease, box-shadow 0.12s ease",
    boxShadow: `0 4px 12px ${warna.aksenLembut}`,
  },
};
