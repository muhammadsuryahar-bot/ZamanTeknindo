import { warna, font } from "../styles/theme";
import logoWhite from "../assets/logo-white.png";

// Header hijau bersama, dipakai di halaman-halaman sub (dibuka dari Dashboard
// lewat tombol "Kembali") supaya identitas visualnya konsisten dengan
// Dashboard Karyawan/Admin -- bukan header polos yang beda sendiri.
export default function TopbarHijau({ judul, kembali }) {
  return (
    <div style={styles.bar}>
      <button onClick={kembali} style={styles.tombolKembali}>← Kembali</button>
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
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 16,
  },
  tombolKembali: {
    background: "none",
    border: "none",
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
    marginBottom: 8,
    fontFamily: font.display,
  },
  identitas: { display: "flex", alignItems: "center", gap: 8 },
  logo: { width: 20, height: 20, borderRadius: 4, display: "block", filter: "brightness(0) invert(1)" },
  judul: { color: "#fff", fontSize: 13.5, fontWeight: 700 },
};
