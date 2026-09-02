/*
 * Rekap status compatibility layer.
 *
 * Tujuan:
 * - status otomatis Rekap Hari Ini mengikuti jam masuk + pengaturan jamMasukStandar terbaru;
 * - statusFinal hanya dipakai sebagai override jika absensi memang pernah diedit Admin;
 * - data lama yang telanjur memiliki statusFinal otomatis tidak mengunci status lama.
 */
(() => {
  const FLAG = "__rekapStatusInterceptorSudahDipasang";

  if (window[FLAG]) return;
  window[FLAG] = true;

  const fetchAsli = window.fetch.bind(window);

  function urlDariArgumen(argumen) {
    return typeof argumen[0] === "string"
      ? argumen[0]
      : argumen[0]?.url || "";
  }

  function headerDariArgumen(argumen) {
    const init = argumen[1];
    return init?.headers || argumen[0]?.headers || {};
  }

  function ambilMenitWIB(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const result = {};
    for (const part of parts) {
      if (part.type !== "literal") result[part.type] = part.value;
    }

    return Number(result.hour) * 60 + Number(result.minute) + Number(result.second) / 60;
  }

  function jamKeMenit(jam) {
    const bagian = String(jam || "").split(":").map(Number);
    if (bagian.length < 2 || bagian.some((n) => Number.isNaN(n))) return null;

    const [hour, minute, second = 0] = bagian;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
      return null;
    }

    return hour * 60 + minute + second / 60;
  }

  async function ambilBatasTepatWaktu(urlRekap, headers) {
    try {
      const url = new URL(urlRekap, window.location.href);
      url.pathname = url.pathname.replace(
        "/admin/rekap-hari-ini",
        "/admin/pengaturan-potongan",
      );
      url.search = "";

      const response = await fetchAsli(url.toString(), {
        headers,
      });

      if (!response.ok) return 8 * 60 + 10;

      const data = await response.json();
      return (
        jamKeMenit(data?.data?.jamMasukStandar) ??
        8 * 60 + 10
      );
    } catch (error) {
      console.warn("Gagal membaca batas jam masuk untuk Rekap Hari Ini:", error);
      return 8 * 60 + 10;
    }
  }

  function statusOtomatisDariJamMasuk(jamMasuk, batasMenit) {
    if (!jamMasuk) return null;

    const waktu = new Date(jamMasuk);
    if (Number.isNaN(waktu.getTime())) return null;

    return ambilMenitWIB(waktu) <= batasMenit
      ? "tepat_waktu"
      : "telat";
  }

  window.fetch = async function (...argumen) {
    const urlPermintaan = urlDariArgumen(argumen);

    if (!urlPermintaan.includes("/api/admin/rekap-hari-ini")) {
      return fetchAsli(...argumen);
    }

    const response = await fetchAsli(...argumen);
    if (!response?.ok) return response;

    try {
      const data = await response.clone().json();
      if (!Array.isArray(data?.data)) return response;

      const batasMenit = await ambilBatasTepatWaktu(
        urlPermintaan,
        headerDariArgumen(argumen),
      );

      const dataBaru = data.data.map((item) => {
        // dieditOleh terisi => Admin memang pernah membuat override manual.
        if (item?.dieditOleh != null) return item;

        const statusOtomatisTerhitung = statusOtomatisDariJamMasuk(
          item?.jamMasuk,
          batasMenit,
        );

        if (!statusOtomatisTerhitung) return item;

        return {
          ...item,
          statusOtomatis: statusOtomatisTerhitung,
          statusFinal: statusOtomatisTerhitung,
        };
      });

      const bodyBaru = JSON.stringify({
        ...data,
        data: dataBaru,
      });

      return new Response(bodyBaru, {
        status: response.status,
        statusText: response.statusText,
        headers: new Headers(response.headers),
      });
    } catch (error) {
      console.warn("Normalisasi status Rekap Hari Ini gagal:", error);
      return response;
    }
  };
})();
