import { warna } from "../styles/theme";

// Satu sumber kebenaran untuk label & warna tiap status kehadiran.
// Dipakai di DashboardAdmin.jsx dan RiwayatAbsensi.jsx supaya konsisten
// dan tidak perlu diubah di 2 tempat kalau nanti ada status baru lagi.
export function labelStatusKehadiran(status) {
  switch (status) {
    case "tepat_waktu":
      return { teks: "Tepat Waktu", warna: warna.sukses, latar: warna.suksesLembut };
    case "telat":
      return { teks: "Telat", warna: warna.peringatan, latar: warna.peringatanLembut };
    case "alpha":
      return { teks: "Alpha", warna: warna.bahaya, latar: warna.bahayaLembut };
    case "izin":
      return { teks: "Izin", warna: warna.aksen, latar: warna.aksenLembut };
    case "sakit":
      return { teks: "Sakit", warna: warna.aksen, latar: warna.aksenLembut };
    case "cuti":
      return { teks: "Cuti", warna: warna.aksen, latar: warna.aksenLembut };
    case "urgent":
      return { teks: "Urgent", warna: warna.aksen, latar: warna.aksenLembut };
    default:
      return { teks: "-", warna: warna.tintaSamar, latar: warna.panelAlt };
  }
}
