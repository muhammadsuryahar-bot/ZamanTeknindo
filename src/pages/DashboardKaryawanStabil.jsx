import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Clock3, LogOut, ShieldCheck } from "lucide-react";
import DashboardKaryawan from "./DashboardKaryawan";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";

// Adapter ringan untuk browser/HP yang kadang gagal membuka kamera pada
// percobaan pertama. Geolocation tetap menggunakan API asli browser.
export default function DashboardKaryawanStabil(props) {
  const [tahap, setTahap] = useState("memuat");

  useEffect(() => {
    const controller = new AbortController();
    let aktif = true;

    async function muatTahapAbsensi() {
      try {
        const res = await fetch(`${API_URL}/absensi/status-hari-ini`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const tahapBaru = String(data?.tahap || "");
        if (aktif && ["belum_masuk", "sudah_masuk", "selesai", "tidak_perlu_absen"].includes(tahapBaru)) {
          setTahap(tahapBaru);
        }
      } catch {
        // Dashboard utama tetap berjalan walau banner konteks gagal dimuat.
      }
    }

    void muatTahapAbsensi();
    return () => {
      aktif = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    const getUserMediaAsli = mediaDevices?.getUserMedia?.bind(mediaDevices);

    if (!getUserMediaAsli || !mediaDevices) return undefined;

    let aktif = true;

    mediaDevices.getUserMedia = async (constraints) => {
      try {
        return await getUserMediaAsli(constraints);
      } catch (errorPertama) {
        if (!aktif) throw errorPertama;

        await new Promise((resolve) => window.setTimeout(resolve, 350));

        try {
          return await getUserMediaAsli({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch {
          return await getUserMediaAsli({ video: true, audio: false });
        }
      }
    };

    return () => {
      aktif = false;
      mediaDevices.getUserMedia = getUserMediaAsli;
    };
  }, []);

  const konteks = {
    belum_masuk: {
      label: "ABSEN MASUK",
      title: "Anda belum melakukan absen masuk",
      detail: "Silakan ambil foto untuk mencatat kehadiran hari ini.",
      icon: <Clock3 size={17} />,
      warna: warna.aksen,
      latar: warna.aksenLembut,
    },
    sudah_masuk: {
      label: "ABSEN PULANG",
      title: "Absen masuk sudah tercatat",
      detail: "Sekarang Anda berada pada tahap absen pulang.",
      icon: <LogOut size={17} />,
      warna: warna.peringatan,
      latar: warna.peringatanLembut,
    },
    selesai: {
      label: "ABSENSI SELESAI",
      title: "Absensi hari ini sudah lengkap",
      detail: "Absen masuk dan absen pulang sudah tercatat.",
      icon: <CheckCircle2 size={17} />,
      warna: warna.sukses,
      latar: warna.suksesLembut,
    },
    tidak_perlu_absen: {
      label: "TIDAK PERLU ABSEN",
      title: "Pengajuan ketidakhadiran sudah disetujui",
      detail: "Anda tidak perlu melakukan absensi untuk hari ini.",
      icon: <ShieldCheck size={17} />,
      warna: warna.aksen,
      latar: warna.aksenLembut,
    },
    memuat: {
      label: "MENYIAPKAN ABSENSI",
      title: "Memeriksa status absensi...",
      detail: "Mohon tunggu sebentar.",
      icon: <BellRing size={17} />,
      warna: warna.tintaSamar,
      latar: warna.panelAlt,
    },
  }[tahap] || null;

  return (
    <div className="dashboard-karyawan-stabil-shell">
      <div
        className="konteks-absensi-banner"
        style={{
          "--konteks-warna": konteks.warna,
          "--konteks-latar": konteks.latar,
        }}
        role="status"
        aria-live="polite"
      >
        <div className="konteks-absensi-icon">{konteks.icon}</div>
        <div className="konteks-absensi-copy">
          <strong>{konteks.label}</strong>
          <span>{konteks.title}</span>
          <small>{konteks.detail}</small>
        </div>
      </div>
      <DashboardKaryawan {...props} />
    </div>
  );
}
