import { warna } from "../styles/theme";

/**
 * Mengembalikan label, warna, dan latar untuk status kehadiran
 * @param {string} status - Status kehadiran: tepat_waktu, telat, alpha, izin, sakit, cuti, urgent
 * @returns {object} { teks, warna, latar }
 */
export function labelStatusKehadiran(status) {
  const statusMap = {
    tepat_waktu: {
      teks: "Tepat Waktu",
      warna: warna.sukses,
      latar: warna.suksesLembut,
    },
    telat: {
      teks: "Telat",
      warna: warna.peringatan,
      latar: warna.peringatanLembut,
    },
    alpha: {
      teks: "Alpha",
      warna: warna.bahaya,
      latar: warna.bahayaLembut,
    },
    izin: {
      teks: "Izin",
      warna: warna.aksen,
      latar: warna.aksenLembut,
    },
    sakit: {
      teks: "Sakit",
      warna: warna.aksen,
      latar: warna.aksenLembut,
    },
    cuti: {
      teks: "Cuti",
      warna: warna.aksen,
      latar: warna.aksenLembut,
    },
    urgent: {
      teks: "Urgent",
      warna: warna.peringatan,
      latar: warna.peringatanLembut,
    },
  };

  return (
    statusMap[status] || {
      teks: "Unknown",
      warna: warna.tintaSamar,
      latar: warna.panelAlt,
    }
  );
}