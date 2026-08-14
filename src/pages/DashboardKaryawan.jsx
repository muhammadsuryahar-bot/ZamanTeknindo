import { useState, useEffect, useRef } from "react";
import * as turf from "@turf/turf";
import {
  Camera,
  Clock3,
  History,
  FileText,
  LogOut,
  MapPin,
  RefreshCcw,
  CheckCircle2,
  ShieldCheck,
  Navigation,
} from "lucide-react";

import { API_URL, getToken } from "../utils/api";
import RiwayatAbsensi from "./RiwayatAbsensi";
import PengajuanIzin from "./PengajuanIzin";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logo from "../assets/logo.png";

let dataProvinsiCache = null;

async function muatDataProvinsi() {
  if (dataProvinsiCache) return dataProvinsiCache;

  const res = await fetch("/data/provinsi.json");
  if (!res.ok) throw new Error("Gagal memuat data provinsi.json");

  dataProvinsiCache = await res.json();
  return dataProvinsiCache;
}

async function cariProvinsiResmi(latitude, longitude) {
  const data = await muatDataProvinsi();
  const titik = turf.point([longitude, latitude]);

  for (const fitur of data.features) {
    try {
      if (turf.booleanPointInPolygon(titik, fitur)) {
        return fitur.properties.PROVINSI;
      }
    } catch (err) {
      // Lewati polygon yang bermasalah.
    }
  }

  return null;
}

function DialJamKerja({ tahap }) {
  const [sekarang, setSekarang] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setSekarang(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const jamDesimal = sekarang.getHours() + sekarang.getMinutes() / 60;
  const sudutSekarang = (jamDesimal / 24) * 360;
  const persenMulai = (8 / 24) * 100;
  const persenSelesai = (17 / 24) * 100;

  const warnaDial =
    tahap === "selesai"
      ? warna.sukses
      : tahap === "sudah_masuk"
        ? warna.peringatan
        : warna.aksen;

  return (
    <div style={dialStyles.wrapper}>
      <div
        style={{
          ...dialStyles.cincin,
          background: `conic-gradient(${warna.garis} 0%, ${warna.garis} ${persenMulai}%, ${warnaDial} ${persenMulai}%, ${warnaDial} ${persenSelesai}%, ${warna.garis} ${persenSelesai}%, ${warna.garis} 100%)`,
        }}
      >
        <div style={dialStyles.penandaWrapper}>
          <div
            style={{
              ...dialStyles.penanda,
              transform: `rotate(${sudutSekarang}deg)`,
            }}
          >
            <div style={dialStyles.titikPenanda} />
          </div>
        </div>

        <div style={dialStyles.lubang}>
          <span style={dialStyles.jamText}>
            {sekarang.toLocaleTimeString("id-ID", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <span style={dialStyles.jamLabel}>WIB</span>
        </div>
      </div>
    </div>
  );
}

const dialStyles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 18,
  },
  cincin: {
    width: 118,
    height: 118,
    borderRadius: "50%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  penandaWrapper: {
    position: "absolute",
    inset: 0,
  },
  penanda: {
    position: "absolute",
    inset: 0,
    display: "flex",
    justifyContent: "center",
  },
  titikPenanda: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: warna.tinta,
    marginTop: -1,
    boxShadow: "0 0 0 2px #fff",
  },
  lubang: {
    width: 90,
    height: 90,
    borderRadius: "50%",
    background: warna.panel,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  jamText: {
    fontFamily: font.mono,
    fontSize: 18,
    fontWeight: 600,
    color: warna.tinta,
    lineHeight: 1.1,
  },
  jamLabel: {
    fontFamily: font.mono,
    fontSize: 9.5,
    color: warna.tintaSamar,
    letterSpacing: "0.08em",
  },
};

export default function DashboardKaryawan({ pengguna, onLogout }) {
  const [tahap, setTahap] = useState("memuat");
  const [halaman, setHalaman] = useState("absen");
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoTerambil, setFotoTerambil] = useState(null);
  const [fotoPreview, setFotoPreview] = useState("");
  const [lokasi, setLokasi] = useState(null);
  const [statusLokasi, setStatusLokasi] = useState("mencari");
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const lokasiTimerRef = useRef(null);

  useEffect(() => {
    ambilStatusHariIni();

    return () => {
      hentikanKamera();
      if (lokasiTimerRef.current) {
        clearTimeout(lokasiTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (fotoTerambil) {
      const url = URL.createObjectURL(fotoTerambil);
      setFotoPreview(url);

      return () => URL.revokeObjectURL(url);
    }

    setFotoPreview("");
  }, [fotoTerambil]);

  async function ambilStatusHariIni() {
    setLoadingStatus(true);

    try {
      const res = await fetch(`${API_URL}/absensi/status-hari-ini`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      const data = await res.json();

      if (!res.ok) {
        setPesan(data.pesan || "Gagal memuat status absen.");
        return;
      }

      setTahap(data.tahap);
    } catch (err) {
      console.error(err);
      setPesan("Gagal memuat status absen. Cek koneksi ke server.");
    } finally {
      setLoadingStatus(false);
    }
  }

  async function bukaKamera() {
    setPesan("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setPesan("Browser ini tidak mendukung akses kamera.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setFotoTerambil(null);
      setKameraAktif(true);
      ambilLokasi();
    } catch (err) {
      console.error(err);
      setPesan(
        "Tidak bisa mengakses kamera. Pastikan izin kamera diberikan pada browser."
      );
    }
  }

  useEffect(() => {
    if (kameraAktif && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [kameraAktif]);

  function hentikanKamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setKameraAktif(false);
  }

  function ambilFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setPesan("Kamera belum siap. Tunggu sebentar lalu coba lagi.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      setPesan("Tidak dapat memproses foto kamera.");
      return;
    }

    // Kamera depan biasanya menampilkan preview mirror.
    // Foto yang dikirim kita buat normal agar tidak terbalik.
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setPesan("Foto gagal diproses. Silakan coba lagi.");
          return;
        }

        setFotoTerambil(blob);
        hentikanKamera();
      },
      "image/jpeg",
      0.86
    );
  }

  function fotoUlang() {
    setFotoTerambil(null);
    setLokasi(null);
    setStatusLokasi("mencari");
    bukaKamera();
  }

  async function ambilKotaKecamatanBigDataCloud(latitude, longitude) {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`
    );

    const data = await res.json();
    const bagian = [
      data.locality,
      data.city && data.city !== data.locality ? data.city : null,
    ].filter(Boolean);

    if (bagian.length === 0) {
      throw new Error("Data BigDataCloud kosong");
    }

    return bagian.join(", ");
  }

  async function ambilDetailNominatim(latitude, longitude) {
    const detail = await ambilDetailNominatimPadaZoom(
      latitude,
      longitude,
      18
    );

    if (!detail.jalan) {
      try {
        const detailZoomLebihLuas = await ambilDetailNominatimPadaZoom(
          latitude,
          longitude,
          17
        );

        if (detailZoomLebihLuas.jalan) {
          return detailZoomLebihLuas;
        }
      } catch (err) {
        // Biarkan menggunakan detail sebelumnya.
      }
    }

    return detail;
  }

  async function ambilDetailNominatimPadaZoom(latitude, longitude, zoom) {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=${zoom}&addressdetails=1`
    );

    const data = await res.json();
    const a = data.address || {};

    const namaJalan =
      a.road ||
      a.pedestrian ||
      a.residential ||
      a.living_street ||
      a.footway ||
      a.cycleway ||
      a.path ||
      a.service ||
      null;

    const jalanLengkap = [namaJalan, a.house_number]
      .filter(Boolean)
      .join(" No. ");

    return {
      jalan: jalanLengkap || null,
      kotaKecamatan:
        [
          a.village || a.suburb,
          a.city || a.town || a.county,
        ]
          .filter(Boolean)
          .join(", ") || null,
    };
  }

  async function ambilAlamatDariKoordinat(latitude, longitude) {
    const [kotaKecamatanBDC, detailNominatim, provinsiResmi] =
      await Promise.all([
        ambilKotaKecamatanBigDataCloud(latitude, longitude).catch(
          () => null
        ),
        ambilDetailNominatim(latitude, longitude).catch(() => null),
        cariProvinsiResmi(latitude, longitude).catch((err) => {
          console.error("Gagal mencari provinsi resmi:", err);
          return null;
        }),
      ]);

    const jalan = detailNominatim?.jalan || null;
    const kotaKecamatan =
      kotaKecamatanBDC || detailNominatim?.kotaKecamatan || null;

    const bagian = [jalan, kotaKecamatan, provinsiResmi].filter(Boolean);

    if (bagian.length === 0) {
      return `${latitude}, ${longitude}`;
    }

    return bagian.join(", ");
  }

  function ambilLokasi() {
    setStatusLokasi("mencari");

    if (!navigator.geolocation) {
      setStatusLokasi("gagal");
      return;
    }

    let posisiTerbaik = null;
    let watchId = null;
    let sudahSelesai = false;

    const selesaikan = async () => {
      if (sudahSelesai) return;

      sudahSelesai = true;

      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }

      if (lokasiTimerRef.current) {
        clearTimeout(lokasiTimerRef.current);
        lokasiTimerRef.current = null;
      }

      if (!posisiTerbaik) {
        setStatusLokasi("gagal");
        return;
      }

      const { latitude, longitude, akurasi } = posisiTerbaik;

      setLokasi({
        latitude,
        longitude,
        akurasi,
        alamat: null,
      });

      setStatusLokasi("ditemukan");

      try {
        const alamatLengkap = await ambilAlamatDariKoordinat(
          latitude,
          longitude
        );

        setLokasi({
          latitude,
          longitude,
          akurasi,
          alamat: alamatLengkap,
        });
      } catch (err) {
        console.error("Reverse geocoding gagal:", err);
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (posisi) => {
        const akurasi = Math.round(posisi.coords.accuracy);

        if (!posisiTerbaik || akurasi < posisiTerbaik.akurasi) {
          posisiTerbaik = {
            latitude: posisi.coords.latitude,
            longitude: posisi.coords.longitude,
            akurasi,
          };

          setLokasi((prev) => ({
            latitude: posisiTerbaik.latitude,
            longitude: posisiTerbaik.longitude,
            akurasi: posisiTerbaik.akurasi,
            alamat: prev?.alamat || null,
          }));

          setStatusLokasi("ditemukan");
        }

        if (akurasi <= 20) {
          selesaikan();
        }
      },
      (error) => {
        console.warn("Geolocation error:", error);

        if (!posisiTerbaik) {
          setStatusLokasi("gagal");
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    lokasiTimerRef.current = setTimeout(selesaikan, 6000);
  }

  async function kirimAbsen() {
    if (!fotoTerambil) {
      setPesan("Silakan ambil foto terlebih dahulu.");
      return;
    }

    setLoading(true);
    setPesan("");

    const formData = new FormData();
    formData.append("foto", fotoTerambil, "absen.jpg");

    if (lokasi) {
      formData.append("latitude", lokasi.latitude);
      formData.append("longitude", lokasi.longitude);

      const alamatDasar =
        lokasi.alamat ||
        `${lokasi.latitude}, ${lokasi.longitude}`;

      const infoAkurasi = lokasi.akurasi
        ? ` (akurasi ±${lokasi.akurasi}m)`
        : "";

      formData.append("alamat", alamatDasar + infoAkurasi);
    }

    const endpoint =
      tahap === "belum_masuk" ? "masuk" : "pulang";

    try {
      const res = await fetch(`${API_URL}/absensi/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setPesan(data.pesan || "Gagal mengirim absen.");
        return;
      }

      setPesan(data.pesan);
      setFotoTerambil(null);
      setLokasi(null);
      setStatusLokasi("mencari");
      await ambilStatusHariIni();
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  if (halaman === "riwayat") {
    return <RiwayatAbsensi kembali={() => setHalaman("absen")} />;
  }

  if (halaman === "izin") {
    return <PengajuanIzin kembali={() => setHalaman("absen")} />;
  }

  const judulAksi =
    tahap === "belum_masuk"
      ? "Absensi Masuk"
      : tahap === "sudah_masuk"
        ? "Absensi Pulang"
        : "Absensi Hari Ini";

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <header style={styles.header}>
          <div style={styles.brandHeader}>
            <img
              src={logoHorizontal}
              alt="PT. Zaman Teknindo"
              style={styles.logoHeader}
            />

            <div style={styles.userBlock}>
              <div style={styles.avatarBadge}>
                {inisialNama(pengguna.nama)}
              </div>

              <div style={{ minWidth: 0 }}>
                <p style={styles.namaUser}>{pengguna.nama}</p>
                <p style={styles.subNamaUser}>
                  {pengguna.jabatan || "Karyawan"}
                  {pengguna.divisi ? ` · ${pengguna.divisi}` : ""}
                </p>
              </div>
            </div>
          </div>

          <div style={styles.headerActions}>
            <button
              onClick={() => setHalaman("izin")}
              style={styles.headerButton}
              type="button"
            >
              <FileText size={16} />
              <span>Izin</span>
            </button>

            <button
              onClick={() => setHalaman("riwayat")}
              style={styles.headerButton}
              type="button"
            >
              <History size={16} />
              <span>Riwayat</span>
            </button>

            <button
              onClick={onLogout}
              style={styles.headerLogout}
              type="button"
              aria-label="Keluar"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </header>

        {/* INFO HARI INI */}
        <section style={styles.heroCard}>
          <div>
            <p style={styles.eyebrow}>SISTEM ABSENSI PT. ZAMAN TEKNINDO</p>
            <h1 style={styles.heroTitle}>{judulAksi}</h1>
            <p style={styles.heroDate}>
              {new Date().toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>

          <div style={styles.securityBadge}>
            <ShieldCheck size={15} />
            Data absensi terlindungi
          </div>
        </section>

        {/* STATUS ABSEN */}
        <section style={styles.mainCard}>
          {loadingStatus && (
            <div style={styles.loadingState}>
              <Clock3 size={18} />
              <span>Memuat status absensi...</span>
            </div>
          )}

          {!loadingStatus && tahap !== "memuat" && (
            <DialJamKerja tahap={tahap} />
          )}

          {tahap === "selesai" && (
            <div style={styles.successBox}>
              <div style={styles.successIcon}>
                <CheckCircle2 size={28} />
              </div>
              <h2 style={styles.sectionTitle}>
                Absensi Hari Ini Selesai
              </h2>
              <p style={styles.sectionDescription}>
                Absen masuk dan pulang kamu sudah tercatat.
                Terima kasih, sampai jumpa besok.
              </p>
            </div>
          )}

          {(tahap === "belum_masuk" || tahap === "sudah_masuk") && (
            <>
              <div style={styles.actionHeading}>
                <div>
                  <p style={styles.actionEyebrow}>
                    {tahap === "belum_masuk"
                      ? "LANGKAH 1 · ABSEN MASUK"
                      : "LANGKAH 1 · ABSEN PULANG"}
                  </p>
                  <h2 style={styles.sectionTitle}>
                    Ambil foto untuk mencatat kehadiran
                  </h2>
                </div>
              </div>

              {!kameraAktif && !fotoTerambil && (
                <div style={styles.startPanel}>
                  <div style={styles.cameraIconCircle}>
                    <Camera size={28} />
                  </div>
                  <p style={styles.startTitle}>Siapkan kamera</p>
                  <p style={styles.startDescription}>
                    Pastikan wajah terlihat jelas dan izinkan kamera serta
                    lokasi pada browser HP kamu.
                  </p>

                  <button
                    onClick={bukaKamera}
                    style={styles.primaryButton}
                    type="button"
                  >
                    <Camera size={18} />
                    Buka Kamera
                  </button>
                </div>
              )}

              {kameraAktif && (
                <div style={styles.cameraSection}>
                  <div style={styles.cameraFrame}>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      style={styles.video}
                    />

                    <div style={styles.cameraOverlay}>
                      <div style={styles.faceGuide} />
                    </div>
                  </div>

                  <p style={styles.cameraHelp}>
                    Posisikan wajah di tengah area panduan.
                  </p>

                  <button
                    onClick={ambilFoto}
                    style={styles.primaryButton}
                    type="button"
                  >
                    <Camera size={18} />
                    Ambil Foto
                  </button>
                </div>
              )}

              {fotoTerambil && (
                <div style={styles.previewSection}>
                  <div style={styles.previewFrame}>
                    <img
                      src={fotoPreview}
                      alt="Foto absen"
                      style={styles.previewImage}
                    />
                  </div>

                  <div style={styles.locationCard}>
                    <div style={styles.locationHeader}>
                      <div style={styles.locationIcon}>
                        <MapPin size={17} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={styles.locationTitle}>
                          Lokasi Absensi
                        </p>
                        <p style={styles.locationStatus}>
                          {statusLokasi === "mencari" &&
                            "Sedang mencari lokasi terbaik..."}
                          {statusLokasi === "ditemukan" &&
                            (lokasi?.alamat ||
                              "Lokasi ditemukan, membaca alamat...")}
                          {statusLokasi === "gagal" &&
                            "Lokasi tidak terdeteksi. Kamu masih dapat mencoba absen."}
                        </p>
                      </div>
                    </div>

                    {statusLokasi === "ditemukan" && lokasi?.akurasi && (
                      <div style={styles.locationMeta}>
                        <span>
                          Akurasi ±{lokasi.akurasi} meter
                        </span>

                        {lokasi.akurasi > 100 && (
                          <span style={styles.locationWarning}>
                            Kurang presisi
                          </span>
                        )}
                      </div>
                    )}

                    {statusLokasi === "ditemukan" &&
                      lokasi?.latitude !== undefined &&
                      lokasi?.longitude !== undefined && (
                        <a
                          href={`https://www.google.com/maps?q=${lokasi.latitude},${lokasi.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={styles.mapsLink}
                        >
                          <Navigation size={14} />
                          Lihat lokasi di Google Maps
                        </a>
                      )}
                  </div>

                  <div style={styles.actionButtons}>
                    <button
                      onClick={fotoUlang}
                      style={styles.secondaryButton}
                      type="button"
                      disabled={loading}
                    >
                      <RefreshCcw size={17} />
                      Foto Ulang
                    </button>

                    <button
                      onClick={kirimAbsen}
                      style={styles.primaryButton}
                      type="button"
                      disabled={loading}
                    >
                      {loading ? "Mengirim..." : "Kirim Absen"}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {pesan && (
            <div style={styles.messageBox} role="alert">
              {pesan}
            </div>
          )}
        </section>

        {/* CATATAN BAWAH */}
        <div style={styles.footerNote}>
          <ShieldCheck size={14} />
          <span>
            Gunakan koneksi internet yang stabil saat mengirim absensi.
          </span>
        </div>
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />

      <style>{`
        * { box-sizing: border-box; }

        .karyawan-button-hover:hover {
          transform: translateY(-1px);
        }

        @media (min-width: 761px) {
          .karyawan-page-container {
            padding-top: 32px;
            padding-bottom: 40px;
          }
        }

        @media (max-width: 760px) {
          .karyawan-desktop-only {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .karyawan-header-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: repeat(3, 1fr);
          }

          .karyawan-header-button {
            width: 100% !important;
            justify-content: center !important;
            min-height: 42px !important;
          }
        }
      `}</style>
    </div>
  );
}

function inisialNama(nama) {
  if (!nama) return "?";

  const bagian = nama.trim().split(/\s+/);

  if (bagian.length === 1) {
    return bagian[0].slice(0, 2).toUpperCase();
  }

  return (
    bagian[0][0] + bagian[bagian.length - 1][0]
  ).toUpperCase();
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#FFFFFF",
    fontFamily: font.display,
    color: warna.tinta,
    padding: "max(12px, env(safe-area-inset-top)) 12px max(20px, env(safe-area-inset-bottom))",
  },

  container: {
    width: "100%",
    maxWidth: 760,
    margin: "0 auto",
  },

  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "4px 2px 16px",
    flexWrap: "wrap",
  },

  brandHeader: {
    minWidth: 0,
  },

  logoHeader: {
    width: "min(190px, 68vw)",
    height: "auto",
    maxHeight: 42,
    objectFit: "contain",
    objectPosition: "left center",
    display: "block",
    marginBottom: 12,
  },

  userBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },

  avatarBadge: {
    width: 38,
    height: 38,
    flexShrink: 0,
    borderRadius: "50%",
    background: warna.aksen,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
  },

  namaUser: {
    margin: 0,
    fontSize: 16,
    fontWeight: 700,
    color: warna.tinta,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  subNamaUser: {
    margin: "2px 0 0",
    fontSize: 12,
    color: warna.tintaLembut,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  headerActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },

  headerButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    padding: "8px 12px",
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    color: warna.tinta,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  headerLogout: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    padding: "8px 12px",
    background: "transparent",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    color: warna.bahaya,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },

  heroCard: {
    background: `linear-gradient(145deg, ${warna.aksenLembut}, ${warna.panel})`,
    border: `1px solid ${warna.garis}`,
    borderRadius: 18,
    padding: "18px 18px",
    marginBottom: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.1em",
    color: warna.aksen,
  },

  heroTitle: {
    margin: "6px 0 2px",
    fontSize: "clamp(24px, 5vw, 34px)",
    lineHeight: 1.1,
    fontWeight: 750,
    color: warna.tinta,
  },

  heroDate: {
    margin: 0,
    fontSize: 12.5,
    color: warna.tintaLembut,
  },

  securityBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.7)",
    border: `1px solid ${warna.garis}`,
    color: warna.aksen,
    fontSize: 10.5,
    fontWeight: 650,
    whiteSpace: "nowrap",
  },

  mainCard: {
    background: warna.panel,
    borderRadius: 18,
    padding: "22px 18px 20px",
    border: `1px solid ${warna.garis}`,
    boxShadow: "0 8px 30px rgba(22,35,61,0.05)",
  },

  loadingState: {
    minHeight: 180,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    color: warna.tintaLembut,
    fontSize: 13,
  },

  actionHeading: {
    marginBottom: 18,
    textAlign: "center",
  },

  actionEyebrow: {
    margin: 0,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.08em",
    color: warna.tintaSamar,
  },

  sectionTitle: {
    margin: "5px 0 0",
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 750,
    color: warna.tinta,
  },

  sectionDescription: {
    margin: "8px auto 0",
    maxWidth: 420,
    color: warna.tintaLembut,
    fontSize: 13,
    lineHeight: 1.65,
  },

  startPanel: {
    textAlign: "center",
    padding: "18px 10px 4px",
  },

  cameraIconCircle: {
    width: 68,
    height: 68,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: warna.aksenLembut,
    color: warna.aksen,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  startTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 700,
    color: warna.tinta,
  },

  startDescription: {
    margin: "7px auto 16px",
    maxWidth: 430,
    fontSize: 12.5,
    lineHeight: 1.65,
    color: warna.tintaLembut,
  },

  primaryButton: {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryButton: {
    width: "100%",
    minHeight: 48,
    padding: "12px 16px",
    background: warna.panelAlt,
    color: warna.tinta,
    border: `1px solid ${warna.garis}`,
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  cameraSection: {
    width: "100%",
  },

  cameraFrame: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: 16,
    background: "#0B1110",
    border: `1px solid ${warna.garis}`,
    aspectRatio: "3 / 4",
    maxHeight: 560,
  },

  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transform: "scaleX(-1)",
  },

  cameraOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
  },

  faceGuide: {
    width: "58%",
    height: "56%",
    border: "2px solid rgba(255,255,255,0.82)",
    borderRadius: "42%",
    boxShadow: "0 0 0 999px rgba(0,0,0,0.12)",
  },

  cameraHelp: {
    margin: "9px 0 12px",
    textAlign: "center",
    color: warna.tintaLembut,
    fontSize: 11.5,
  },

  previewSection: {
    width: "100%",
  },

  previewFrame: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    background: "#0B1110",
    border: `1px solid ${warna.garis}`,
    aspectRatio: "3 / 4",
    maxHeight: 560,
  },

  previewImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  locationCard: {
    marginTop: 12,
    padding: 13,
    background: warna.panelAlt,
    border: `1px solid ${warna.garis}`,
    borderRadius: 14,
    textAlign: "left",
  },

  locationHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },

  locationIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    background: warna.aksenLembut,
    color: warna.aksen,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  locationTitle: {
    margin: 0,
    fontSize: 12,
    fontWeight: 750,
    color: warna.tinta,
  },

  locationStatus: {
    margin: "3px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: warna.tintaLembut,
    wordBreak: "break-word",
  },

  locationMeta: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    flexWrap: "wrap",
    marginTop: 9,
    fontSize: 10.5,
    fontFamily: font.mono,
    color: warna.tintaSamar,
  },

  locationWarning: {
    color: warna.peringatan,
    fontFamily: font.display,
    fontWeight: 700,
  },

  mapsLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    color: warna.aksen,
    fontSize: 11.5,
    fontWeight: 700,
    textDecoration: "none",
  },

  actionButtons: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
    marginTop: 12,
  },

  successBox: {
    textAlign: "center",
    padding: "4px 0 10px",
  },

  successIcon: {
    width: 64,
    height: 64,
    margin: "0 auto 14px",
    borderRadius: "50%",
    background: warna.suksesLembut,
    color: warna.sukses,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  messageBox: {
    marginTop: 14,
    padding: "11px 12px",
    borderRadius: 12,
    borderLeft: `3px solid ${warna.aksen}`,
    background: warna.panelAlt,
    color: warna.tinta,
    fontSize: 12.5,
    lineHeight: 1.55,
    textAlign: "left",
  },

  footerNote: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    padding: "14px 4px 4px",
    color: warna.tintaSamar,
    fontSize: 10.5,
    textAlign: "center",
  },
};
