import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { labelStatusKehadiran } from "../utils/statusKehadiran";
import TopbarHijau from "../components/TopbarHijau";
import { CalendarDays, RefreshCcw, AlertCircle, MapPin, Navigation } from "lucide-react";

const TIMEZONE_WIB = "Asia/Jakarta";
const cacheAlamatKoordinat = new Map();

async function alamatDariKoordinatNominatim(latitude, longitude) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { signal: controller.signal, headers: { Accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const a = data.address || {};
    const jalan = a.road || a.pedestrian || a.residential || a.living_street || a.footway || null;
    const kecamatan = a.suburb || a.city_district || a.district || a.village || null;
    const kota = a.city || a.town || a.municipality || a.county || null;
    const provinsi = a.state || a.province || null;
    const bagian = [jalan, kecamatan, kota, provinsi].filter(Boolean);
    return bagian.length ? bagian.join(", ") : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function alamatDariKoordinat(latitude, longitude) {
  // Tolak koordinat 0,0 (Samudera Atlantik)
  if (latitude === 0 && longitude === 0) return null;

  const cacheKey = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  if (cacheAlamatKoordinat.has(cacheKey)) return cacheAlamatKoordinat.get(cacheKey);

  // Coba Nominatim dulu (ada nama jalan), fallback ke BigDataCloud
  let hasil = await alamatDariKoordinatNominatim(latitude, longitude).catch(() => null);

  if (!hasil) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`,
        { signal: controller.signal },
      );
      if (res.ok) {
        const data = await res.json();
        const bagian = [
          data.locality,
          data.city && data.city !== data.locality ? data.city : null,
          data.principalSubdivision,
        ].filter(Boolean);
        if (bagian.length) hasil = bagian.join(", ");
      }
    } catch {
      // Abaikan
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  cacheAlamatKoordinat.set(cacheKey, hasil);
  return hasil;
}

function adalahKoordinatMentah(alamat) {
  return /^\s*-?\d+\.\d+\s*,\s*-?\d+\.\d+/.test(String(alamat || ""));
}

function koordinatDariAlamat(alamat) {
  const cocok = String(alamat || "").match(
    /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*\(akurasi\s*±([^\)]+)\))?/i,
  );
  if (!cocok) return null;
  return { latitude: Number(cocok[1]), longitude: Number(cocok[2]), akurasi: cocok[3] || null };
}

async function normalisasiLokasi(item, field) {
  const nilaiAlamat = String(item[field] || "").trim();

  // Jika sudah berupa teks alamat yang bermakna (bukan raw koordinat), tampilkan langsung
  if (nilaiAlamat && !adalahKoordinatMentah(nilaiAlamat)) return item;

  // Tentukan field koordinat yang sesuai
  const latField = field === "alamatMasuk" ? "latitudeMasuk" : "latitudePulang";
  const lngField = field === "alamatMasuk" ? "longitudeMasuk" : "longitudePulang";

  // Coba parsing koordinat dari teks ("lat, lng") atau dari field langsung
  const dariTeks = koordinatDariAlamat(nilaiAlamat);
  const latitude = dariTeks?.latitude ?? Number(item[latField]);
  const longitude = dariTeks?.longitude ?? Number(item[lngField]);
  const akurasiAda = dariTeks?.akurasi || null;

  // Tolak koordinat tidak valid atau 0,0 (Samudera Atlantik)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return item;
  if (latitude === 0 && longitude === 0) return item;

  const namaLokasi = await alamatDariKoordinat(latitude, longitude);
  if (!namaLokasi) return item;

  return {
    ...item,
    [field]: namaLokasi + (akurasiAda ? ` (akurasi ±${akurasiAda})` : ""),
  };
}

async function normalisasiRiwayat(data) {
  const hasil = [];
  for (const item of data) {
    const denganMasuk = await normalisasiLokasi(item, "alamatMasuk");
    // Hanya normalisasi lokasi pulang jika karyawan sudah absen pulang
    const denganPulang = item.jamPulang
      ? await normalisasiLokasi(denganMasuk, "alamatPulang")
      : denganMasuk;
    hasil.push(denganPulang);
  }
  return hasil;
}

export default function RiwayatAbsensi({ kembali }) {
  const [riwayat, setRiwayat] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");

  async function muatRiwayat({ silent = false } = {}) {
    if (!silent) setLoading(true);
    if (!silent) setPesan("");

    try {
      const res = await fetch(`${API_URL}/absensi/riwayat-saya`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }

      if (!res.ok) {
        throw new Error(data?.pesan || "Gagal memuat riwayat absensi.");
      }

      const daftar = Array.isArray(data.data) ? data.data : [];
      setRiwayat(daftar);
      if (!silent) setLoading(false);

      // Reverse-geocoding hanya memperkaya tampilan; jangan menahan riwayat.
      const daftarDenganAlamat = await normalisasiRiwayat(daftar);
      setRiwayat(daftarDenganAlamat);
    } catch (err) {
      console.error(err);
      if (!silent) { setRiwayat([]); setPesan(err?.message || "Gagal memuat riwayat. Cek koneksi ke server."); }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    void muatRiwayat();
  }, []);

  // AUTO_REFRESH_RiwayatAbsensi_APPLIED
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") void muatRiwayat({ silent: true });
    };
    const id = window.setInterval(refresh, 30000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function formatTanggal(tanggalIso) {
    return new Date(tanggalIso).toLocaleDateString("id-ID", {
      timeZone: TIMEZONE_WIB,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function formatJam(tanggalIso) {
    if (!tanggalIso) return "–";
    return new Date(tanggalIso).toLocaleTimeString("id-ID", {
      timeZone: TIMEZONE_WIB,
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function koordinatValid(latitude, longitude) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    // Tolak jika bukan angka finite, atau 0,0 (Samudera Atlantik)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (lat === 0 && lng === 0) return false;
    return true;
  }

  function alamatTampilan(item, tipe = "masuk") {
    const field = tipe === "masuk" ? "alamatMasuk" : "alamatPulang";
    const latField = tipe === "masuk" ? "latitudeMasuk" : "latitudePulang";
    const lngField = tipe === "masuk" ? "longitudeMasuk" : "longitudePulang";

    if (item[field]) return item[field];

    if (koordinatValid(item[latField], item[lngField])) {
      return `${Number(item[latField]).toFixed(6)}, ${Number(item[lngField]).toFixed(6)}`;
    }

    return "Lokasi GPS tidak tersimpan pada data absensi ini.";
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.shell}>
        <TopbarHijau judul="Riwayat Absensi" kembali={kembali} />

        <div style={styles.content}>
          {loading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton-pulse" style={styles.skeletonCard}>
                  <div style={{ ...styles.skeletonBar, width: "50%", height: 13 }} />
                  <div style={{ ...styles.skeletonBar, width: "35%", height: 11, marginTop: 10 }} />
                  <div style={{ ...styles.skeletonBar, width: "75%", height: 10, marginTop: 9 }} />
                </div>
              ))}
            </>
          )}

          {!loading && pesan && (
            <div style={styles.errorBox} role="alert">
              <AlertCircle size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <strong style={styles.errorTitle}>Riwayat belum dapat dimuat</strong>
                <p style={styles.errorText}>{pesan}</p>
                <button type="button" onClick={() => void muatRiwayat()} style={styles.retryButton}>
                  <RefreshCcw size={14} />
                  Coba Lagi
                </button>
              </div>
            </div>
          )}

          {!loading && !pesan && riwayat.length === 0 && (
            <div style={styles.kosongBox}>
              <CalendarDays size={28} strokeWidth={1.6} style={styles.kosongIkon} />
              <p style={styles.kosongTitle}>Belum ada riwayat absensi</p>
              <p style={styles.kosongText}>
                Riwayat kehadiran kamu akan muncul di sini setelah melakukan absensi.
              </p>
            </div>
          )}

          {!loading && !pesan && riwayat.map((item) => {
            const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
            const punyaKoordinatMasuk = koordinatValid(item.latitudeMasuk, item.longitudeMasuk);
            const punyaKoordinatPulang = koordinatValid(item.latitudePulang, item.longitudePulang);

            return (
              <div key={item.id} style={styles.itemCard} className="kartu-hover">
                <div style={styles.itemHeader}>
                  <strong style={styles.tanggal}>{formatTanggal(item.tanggal)}</strong>
                  <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>
                    {status.teks}
                  </span>
                </div>

                <p style={styles.itemDetail}>
                  Masuk <span style={styles.mono}>{formatJam(item.jamMasuk)}</span>
                  <span style={styles.pemisah}>·</span>
                  Pulang <span style={styles.mono}>{formatJam(item.jamPulang)}</span>
                </p>

                <div style={styles.locationBlock}>
                  <div style={styles.locationTitle}>
                    <MapPin size={14} />
                    <strong>Lokasi masuk</strong>
                  </div>
                  <p style={styles.itemAlamat}>{alamatTampilan(item, "masuk")}</p>

                  {punyaKoordinatMasuk && (
                    <a
                      href={`https://www.google.com/maps?q=${item.latitudeMasuk},${item.longitudeMasuk}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.mapsLink}
                    >
                      <Navigation size={13} />
                      Lihat di Google Maps
                    </a>
                  )}
                </div>

                {item.jamPulang && (item.alamatPulang || punyaKoordinatPulang) ? (
                  <div style={styles.locationBlock}>
                    <div style={styles.locationTitle}>
                      <MapPin size={14} />
                      <strong>Lokasi pulang</strong>
                    </div>
                    <p style={styles.itemAlamat}>
                      {alamatTampilan(item, "pulang")}
                    </p>
                    {punyaKoordinatPulang && (
                      <a
                        href={`https://www.google.com/maps?q=${item.latitudePulang},${item.longitudePulang}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mapsLink}
                      >
                        <Navigation size={13} />
                        Lihat di Google Maps
                      </a>
                    )}
                  </div>
                ) : null}

                {item.catatanAdmin && (
                  <p style={styles.catatan}>Catatan Admin: {item.catatanAdmin}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100svh", background: warna.latar, fontFamily: font.display, padding: 16 },
  shell: { maxWidth: 460, margin: "0 auto" },
  content: {},
  errorBox: {
    display: "flex", gap: 10, alignItems: "flex-start", padding: 14, marginBottom: 12,
    borderRadius: 12, border: `1px solid ${warna.bahayaLembut}`, background: warna.bahayaLembut, color: warna.bahaya,
  },
  errorTitle: { display: "block", fontSize: 13, color: warna.tinta },
  errorText: { margin: "4px 0 10px", fontSize: 12, color: warna.tintaLembut, lineHeight: 1.5 },
  retryButton: {
    display: "inline-flex", alignItems: "center", gap: 6, minHeight: 38, padding: "8px 12px",
    borderRadius: 9, border: `1px solid ${warna.garis}`, background: warna.panel, color: warna.tinta,
    fontSize: 12, fontWeight: 700, cursor: "pointer",
  },
  kosongBox: {
    textAlign: "center", padding: "42px 20px", background: warna.panel, borderRadius: 12,
    border: `1px dashed ${warna.garis}`,
  },
  kosongIkon: { display: "block", marginBottom: 10, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  kosongTitle: { color: warna.tinta, fontSize: 14, fontWeight: 700, margin: 0 },
  kosongText: { color: warna.tintaSamar, fontSize: 12, lineHeight: 1.55, maxWidth: 300, margin: "6px auto 0" },
  skeletonCard: { background: warna.panel, borderRadius: 12, padding: 16, marginBottom: 9, border: `1px solid ${warna.garis}` },
  skeletonBar: { background: warna.panelAlt, borderRadius: 4 },
  itemCard: {
    background: warna.panel, borderRadius: 12, padding: 16, marginBottom: 9, border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 7 },
  tanggal: { fontSize: 13.5, color: warna.tinta },
  itemDetail: { fontSize: 12.5, color: warna.tinta, margin: "8px 0 8px" },
  itemAlamat: { fontSize: 11.5, color: warna.tintaSamar, margin: "4px 0", lineHeight: 1.45, wordBreak: "break-word" },
  mono: { fontFamily: font.mono, fontWeight: 600 },
  pemisah: { margin: "0 8px", color: warna.garis },
  locationBlock: {
    marginTop: 8, paddingTop: 9, borderTop: `1px solid ${warna.garis}`,
  },
  locationTitle: {
    display: "flex", alignItems: "center", gap: 6, color: warna.tinta, fontSize: 11.5,
  },
  mapsLink: {
    display: "inline-flex", alignItems: "center", gap: 5, marginTop: 7, color: warna.aksen,
    fontSize: 11, fontWeight: 700, textDecoration: "none",
  },
  catatan: {
    fontSize: 11.5, color: warna.tinta, background: warna.panelAlt, padding: "7px 10px",
    borderRadius: 8, marginTop: 9, borderLeft: `3px solid ${warna.aksen}`, lineHeight: 1.45,
  },
  badge: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap" },
};
