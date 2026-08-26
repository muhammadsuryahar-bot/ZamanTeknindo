import { ArrowLeft } from "lucide-react";
import { warna, font } from "../styles/theme";
// Sengaja pakai "logo.png" (bukan "logo-white.png"). Alasannya:
// filter CSS "brightness(0) invert(1)" di bawah cuma bisa mengubah logo
// jadi putih kalau file gambarnya punya BACKGROUND TRANSPARAN. "logo.png"
// memang transparan (sudah dipakai & terbukti benar di halaman Login),
// sedangkan "logo-white.png" ternyata full opaque (tidak transparan sama
// sekali) -- itu sebabnya dulu logo di sini tampil sebagai kotak putih
// kosong, bukan bentuk logo.
import logoWhite from "../assets/logo.png";

// Header hijau bersama, dipakai di halaman-halaman sub (dibuka dari Dashboard
// lewat tombol "Kembali") supaya identitas visualnya konsisten dengan
// Dashboard Karyawan/Admin -- bukan header polos yang beda sendiri.
export default function TopbarHijau({ judul, kembali }) {
  return (
    <div style={styles.bar}>
      <button onClick={kembali} style={styles.tombolKembali}>
        <ArrowLeft size={16} strokeWidth={2.2} />
        <span>Kembali</span>
      </button>
      <div style={styles.identitas}>
        <img src={logoWhite} alt="" style={styles.logo} />
        <span style={styles.judul}>{judul}</span>
      </div>
    </div>
  );
}

const styles = {
  bar: {
    background: warna.aksenGelap,
    borderRadius: 14,
    padding: "12px 14px 14px",
    marginBottom: 16,
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tombolKembali: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    minHeight: 42,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.14)",
    borderRadius: 10,
    color: "rgba(255,255,255,0.92)",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
    marginBottom: 10,
    fontFamily: font.display,
  },
  identitas: { display: "flex", alignItems: "center", gap: 8 },
  logo: {
    width: 20,
    height: 20,
    borderRadius: 4,
    display: "block",
    filter: "brightness(0) invert(1)",
  },
  judul: { color: "#fff", fontSize: 13.5, fontWeight: 700 },
};
