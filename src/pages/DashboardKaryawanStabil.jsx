import { useEffect } from "react";
import DashboardKaryawan from "./DashboardKaryawan";

// Adapter ringan untuk browser/HP yang kadang gagal membuka kamera pada
// percobaan pertama. Geolocation dibiarkan menggunakan API asli browser dan
// logika watchPosition milik DashboardKaryawan agar tidak terjadi callback
// ganda atau konflik dengan lifecycle geolocation browser.
export default function DashboardKaryawanStabil(props) {
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

        // Retry 1: constraint kamera sederhana.
        await new Promise((resolve) => window.setTimeout(resolve, 350));

        try {
          return await getUserMediaAsli({
            video: { facingMode: "user" },
            audio: false,
          });
        } catch {
          // Retry 2: fallback paling umum untuk browser lama.
          return await getUserMediaAsli({ video: true, audio: false });
        }
      }
    };

    return () => {
      aktif = false;
      mediaDevices.getUserMedia = getUserMediaAsli;
    };
  }, []);

  return <DashboardKaryawan {...props} />;
}
