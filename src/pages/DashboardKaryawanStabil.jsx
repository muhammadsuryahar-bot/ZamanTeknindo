import { useEffect } from "react";
import DashboardKaryawan from "./DashboardKaryawan";

// Lapisan kompatibilitas untuk HP/browser yang kadang gagal membuka kamera
// atau memperoleh lokasi pada percobaan pertama. Tidak mengubah alur React
// maupun data absensi; hanya menyediakan retry/fallback pada Web API.
export default function DashboardKaryawanStabil(props) {
  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    const geo = navigator.geolocation;

    const getUserMediaAsli = mediaDevices?.getUserMedia?.bind(mediaDevices);
    const currentAsli = geo?.getCurrentPosition?.bind(geo);
    const watchAsli = geo?.watchPosition?.bind(geo);
    const clearAsli = geo?.clearWatch?.bind(geo);

    if (!getUserMediaAsli && !currentAsli && !watchAsli) {
      return undefined;
    }

    let aktif = true;
    const fallbackTimers = new Map();

    if (getUserMediaAsli) {
      mediaDevices.getUserMedia = async (constraints) => {
        try {
          return await getUserMediaAsli(constraints);
        } catch (errorPertama) {
          if (!aktif) throw errorPertama;

          // Beberapa Android/browser menolak kombinasi ideal resolution /
          // facingMode tertentu. Percobaan kedua sengaja dibuat sederhana.
          await new Promise((resolve) => window.setTimeout(resolve, 350));

          try {
            return await getUserMediaAsli({
              video: { facingMode: "user" },
              audio: false,
            });
          } catch {
            // Percobaan terakhir mengikuti constraint paling sederhana.
            return await getUserMediaAsli({ video: true, audio: false });
          }
        }
      };
    }

    if (currentAsli) {
      navigator.geolocation.getCurrentPosition = (success, error, options = {}) => {
        const opsiUtama = {
          ...options,
          enableHighAccuracy: true,
          maximumAge: Math.min(Number(options.maximumAge) || 0, 5000),
          timeout: Math.max(Number(options.timeout) || 15000, 15000),
        };

        currentAsli(
          success,
          () => {
            if (!aktif) return;
            currentAsli(
              success,
              error || (() => {}),
              {
                ...opsiUtama,
                enableHighAccuracy: false,
                maximumAge: 30000,
                timeout: 10000,
              },
            );
          },
          opsiUtama,
        );
      };
    }

    if (watchAsli) {
      navigator.geolocation.watchPosition = (success, error, options = {}) => {
        const watchId = watchAsli(success, error, {
          ...options,
          enableHighAccuracy: true,
          maximumAge: Math.min(Number(options.maximumAge) || 0, 5000),
          timeout: Math.max(Number(options.timeout) || 15000, 15000),
        });

        // GPS presisi tinggi pada HP lama bisa membutuhkan beberapa detik.
        // Ambil posisi network/cache sebagai fallback tanpa menunggu refresh.
        const timer = window.setTimeout(() => {
          if (!aktif || !currentAsli) return;
          currentAsli(
            success,
            () => {},
            {
              enableHighAccuracy: false,
              maximumAge: 30000,
              timeout: 10000,
            },
          );
        }, 800);

        fallbackTimers.set(watchId, timer);
        return watchId;
      };
    }

    return () => {
      aktif = false;
      fallbackTimers.forEach((timer) => window.clearTimeout(timer));
      fallbackTimers.clear();

      if (getUserMediaAsli && mediaDevices) {
        mediaDevices.getUserMedia = getUserMediaAsli;
      }
      if (currentAsli && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition = currentAsli;
      }
      if (watchAsli && navigator.geolocation) {
        navigator.geolocation.watchPosition = watchAsli;
      }
      if (clearAsli && navigator.geolocation) {
        navigator.geolocation.clearWatch = clearAsli;
      }
    };
  }, []);

  return <DashboardKaryawan {...props} />;
}
