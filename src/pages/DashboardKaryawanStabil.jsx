import { useEffect } from "react";
import DashboardKaryawan from "./DashboardKaryawan";

// Lapisan kompatibilitas ringan untuk browser/HP yang kadang membutuhkan
// percobaan kedua saat membuka kamera atau mendapatkan lokasi.
// Tidak mengubah alur React, endpoint, database, maupun payload absensi.
export default function DashboardKaryawanStabil(props) {
  useEffect(() => {
    const mediaDevices = navigator.mediaDevices;
    const geo = navigator.geolocation;

    const getUserMediaAsli = mediaDevices?.getUserMedia?.bind(mediaDevices);
    const currentAsli = geo?.getCurrentPosition?.bind(geo);
    const watchAsli = geo?.watchPosition?.bind(geo);
    const clearAsli = geo?.clearWatch?.bind(geo);

    if (!getUserMediaAsli && !currentAsli && !watchAsli) return undefined;

    let aktif = true;
    const fallbackTimers = new Map();

    if (getUserMediaAsli) {
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
        const opsiUtama = {
          ...options,
          enableHighAccuracy: true,
          maximumAge: Math.min(Number(options.maximumAge) || 0, 5000),
          timeout: Math.max(Number(options.timeout) || 15000, 15000),
        };

        const watchId = watchAsli(success, (errorGPS) => {
          if (!aktif) return;

          // Saat GPS presisi tinggi gagal, coba satu posisi network/cache.
          if (currentAsli) {
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
          } else if (error) {
            error(errorGPS);
          }
        }, opsiUtama);

        // Jangan menunggu GPS high accuracy terlalu lama untuk mencoba
        // fallback. Ini mencegah tampilan "Mencari lokasi..." menggantung.
        if (currentAsli) {
          const timer = window.setTimeout(() => {
            if (!aktif) return;
            currentAsli(
              success,
              () => {},
              {
                ...opsiUtama,
                enableHighAccuracy: false,
                maximumAge: 30000,
                timeout: 8000,
              },
            );
          }, 2500);

          fallbackTimers.set(watchId, timer);
        }

        return watchId;
      };
    }

    return () => {
      aktif = false;
      fallbackTimers.forEach((timer) => window.clearTimeout(timer));
      fallbackTimers.clear();

      if (getUserMediaAsli && mediaDevices) mediaDevices.getUserMedia = getUserMediaAsli;
      if (currentAsli && navigator.geolocation) navigator.geolocation.getCurrentPosition = currentAsli;
      if (watchAsli && navigator.geolocation) navigator.geolocation.watchPosition = watchAsli;
      if (clearAsli && navigator.geolocation) navigator.geolocation.clearWatch = clearAsli;
    };
  }, []);

  return <DashboardKaryawan {...props} />;
}
