import { useEffect } from "react";
import DashboardKaryawan from "./DashboardKaryawan";

// Stabilisasi yang sengaja hanya aktif selama Dashboard Karyawan terpasang.
// Tidak mengganti fetch global dan tidak mengubah alur absensi.
export default function DashboardKaryawanStabil(props) {
  useEffect(() => {
    const geo = navigator.geolocation;
    if (!geo?.watchPosition || !geo?.getCurrentPosition) return undefined;

    const watchAsli = geo.watchPosition.bind(geo);
    const currentAsli = geo.getCurrentPosition.bind(geo);
    const clearAsli = geo.clearWatch.bind(geo);
    const fallbackTimers = new Map();
    let aktif = true;

    geo.watchPosition = (success, error, options = {}) => {
      const watchId = watchAsli(success, error, {
        ...options,
        enableHighAccuracy: true,
        maximumAge: Math.min(Number(options.maximumAge) || 0, 5000),
        timeout: Math.max(Number(options.timeout) || 15000, 15000),
      });

      const timer = window.setTimeout(() => {
        if (!aktif) return;
        currentAsli(success, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 12000,
        });
      }, 700);

      fallbackTimers.set(watchId, timer);
      return watchId;
    };

    geo.clearWatch = (watchId) => {
      const timer = fallbackTimers.get(watchId);
      if (timer) window.clearTimeout(timer);
      fallbackTimers.delete(watchId);
      clearAsli(watchId);
    };

    return () => {
      aktif = false;
      fallbackTimers.forEach((timer) => window.clearTimeout(timer));
      fallbackTimers.clear();
      geo.watchPosition = watchAsli;
      geo.getCurrentPosition = currentAsli;
      geo.clearWatch = clearAsli;
    };
  }, []);

  return <DashboardKaryawan {...props} />;
}
