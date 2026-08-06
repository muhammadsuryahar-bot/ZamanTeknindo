import { useState, useEffect, useRef } from "react";
import * as turf from "@turf/turf";
import { API_URL, getToken } from "../utils/api";
import RiwayatAbsensi from "./RiwayatAbsensi";
import PengajuanIzin from "./PengajuanIzin";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logoWhite from "../assets/logo-white.png";

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
      if (turf.booleanPointInPolygon(titik, fitur)) return fitur.properties.PROVINSI;
    } catch (err) {
      continue;
    }
  }
  return null;
}

// ============ ELEMEN VISUAL UTAMA: DIAL JAM KERJA ============
// Cincin 24 jam, segmen oranye menandai jam kerja (08:00-17:00),
// titik penanda menunjukkan posisi waktu sekarang.
function DialJamKerja({ tahap }) {
  const [sekarang, setSekarang] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setSekarang(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const jamDesimal = sekarang.getHours() + sekarang.getMinutes() / 60;
  const sudutSekarang = (jamDesimal / 24) * 360;
  const sudutMulaiKerja = (8 / 24) * 360;
  const sudutSelesaiKerja = (17 / 24) * 360;
  const persenMulai = (sudutMulaiKerja / 360) * 100;
  const persenSelesai = (sudutSelesaiKerja / 360) * 100;

  const warnaDial =
    tahap === "selesai" ? warna.sukses : tahap === "sudah_masuk" ? warna.peringatan : warna.tintaSamar;

  return (
    <div style={dialStyles.wrapper}>
      <div
        style={{
          ...dialStyles.cincin,
          background: `conic-gradient(${warna.garis} 0%, ${warna.garis} ${persenMulai}%, ${warnaDial} ${persenMulai}%, ${warnaDial} ${persenSelesai}%, ${warna.garis} ${persenSelesai}%, ${warna.garis} 100%)`,
        }}
      >
        <div style={dialStyles.penandaWrapper}>
          <div style={{ ...dialStyles.penanda, transform: `rotate(${sudutSekarang}deg)` }}>
            <div style={dialStyles.titikPenanda} />
          </div>
        </div>
        <div style={dialStyles.lubang}>
          <span style={dialStyles.jamText}>
            {sekarang.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
          </span>
          <span style={dialStyles.jamLabel}>WIB</span>
        </div>
      </div>
    </div>
  );
}

const dialStyles = {
  wrapper: { display: "flex", justifyContent: "center", marginBottom: 18 },
  cincin: {
    width: 108,
    height: 108,
    borderRadius: "50%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  penandaWrapper: { position: "absolute", inset: 0 },
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
    boxShadow: `0 0 0 2px #fff`,
  },
  lubang: {
    width: 82,
    height: 82,
    borderRadius: "50%",
    background: warna.panel,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  jamText: { fontFamily: font.mono, fontSize: 17, fontWeight: 600, color: warna.tinta, lineHeight: 1.1 },
  jamLabel: { fontFamily: font.mono, fontSize: 9.5, color: warna.tintaSamar, letterSpacing: "0.08em" },
};

export default function DashboardKaryawan({ pengguna, onLogout }) {
  const [tahap, setTahap] = useState("memuat");
  const [halaman, setHalaman] = useState("absen");
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoTerambil, setFotoTerambil] = useState(null);
  const [lokasi, setLokasi] = useState(null);
  const [statusLokasi, setStatusLokasi] = useState("mencari");
  const [pesan, setPesan] = useState("");
  const [loading, setLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    ambilStatusHariIni();
    return () => hentikanKamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ambilStatusHariIni() {
    try {
      const res = await fetch(`${API_URL}/absensi/status-hari-ini`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setTahap(data.tahap);
    } catch (err) {
      setPesan("Gagal memuat status absen. Cek koneksi ke server.");
    }
  }

  async function bukaKamera() {
    setPesan("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setKameraAktif(true);
      ambilLokasi();
    } catch (err) {
      setPesan("Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan.");
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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => setFotoTerambil(blob), "image/jpeg", 0.85);
    hentikanKamera();
  }

  function fotoUlang() {
    setFotoTerambil(null);
    bukaKamera();
  }

  async function ambilKotaKecamatanBigDataCloud(latitude, longitude) {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`
    );
    const data = await res.json();
    const bagian = [data.locality, data.city && data.city !== data.locality ? data.city : null].filter(Boolean);
    if (bagian.length === 0) throw new Error("Data BigDataCloud kosong");
    return bagian.join(", ");
  }

  async function ambilDetailNominatim(latitude, longitude) {
    const detail = await ambilDetailNominatimPadaZoom(latitude, longitude, 18);
    if (!detail.jalan) {
      try {
        const detailZoomLebihLuas = await ambilDetailNominatimPadaZoom(latitude, longitude, 17);
        if (detailZoomLebihLuas.jalan) return detailZoomLebihLuas;
      } catch (err) {
        // biarkan
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
      a.road || a.pedestrian || a.residential || a.living_street || a.footway || a.cycleway || a.path || a.service || null;
    const jalanLengkap = [namaJalan, a.house_number].filter(Boolean).join(" No. ");
    return {
      jalan: jalanLengkap || null,
      kotaKecamatan: [a.village || a.suburb, a.city || a.town || a.county].filter(Boolean).join(", ") || null,
    };
  }

  async function ambilAlamatDariKoordinat(latitude, longitude) {
    const [kotaKecamatanBDC, detailNominatim, provinsiResmi] = await Promise.all([
      ambilKotaKecamatanBigDataCloud(latitude, longitude).catch(() => null),
      ambilDetailNominatim(latitude, longitude).catch(() => null),
      cariProvinsiResmi(latitude, longitude).catch((err) => {
        console.error("Gagal mencari provinsi resmi:", err);
        return null;
      }),
    ]);
    const jalan = detailNominatim?.jalan || null;
    const kotaKecamatan = kotaKecamatanBDC || detailNominatim?.kotaKecamatan || null;
    const bagian = [jalan, kotaKecamatan, provinsiResmi].filter(Boolean);
    if (bagian.length === 0) return `${latitude}, ${longitude}`;
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
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (!posisiTerbaik) {
        setStatusLokasi("gagal");
        return;
      }
      const { latitude, longitude, akurasi } = posisiTerbaik;
      setLokasi({ latitude, longitude, akurasi, alamat: null });
      setStatusLokasi("ditemukan");
      const alamatLengkap = await ambilAlamatDariKoordinat(latitude, longitude);
      setLokasi({ latitude, longitude, akurasi, alamat: alamatLengkap });
    };

    watchId = navigator.geolocation.watchPosition(
      (posisi) => {
        const akurasi = Math.round(posisi.coords.accuracy);
        if (!posisiTerbaik || akurasi < posisiTerbaik.akurasi) {
          posisiTerbaik = { latitude: posisi.coords.latitude, longitude: posisi.coords.longitude, akurasi };
          setLokasi((prev) => ({
            latitude: posisiTerbaik.latitude,
            longitude: posisiTerbaik.longitude,
            akurasi: posisiTerbaik.akurasi,
            alamat: prev?.alamat || null,
          }));
          setStatusLokasi("ditemukan");
        }
        if (akurasi <= 20) selesaikan();
      },
      () => {
        if (!posisiTerbaik) setStatusLokasi("gagal");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    setTimeout(selesaikan, 6000);
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
      const alamatDasar = lokasi.alamat || `${lokasi.latitude}, ${lokasi.longitude}`;
      const infoAkurasi = lokasi.akurasi ? ` (akurasi ±${lokasi.akurasi}m)` : "";
      formData.append("alamat", alamatDasar + infoAkurasi);
    }

    const endpoint = tahap === "belum_masuk" ? "masuk" : "pulang";

    try {
      const res = await fetch(`${API_URL}/absensi/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.pesan || "Gagal mengirim absen.");
        setLoading(false);
        return;
      }
      setPesan(data.pesan);
      setFotoTerambil(null);
      setLokasi(null);
      ambilStatusHariIni();
    } catch (err) {
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

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logoHeader} />
          <div style={styles.namaRow}>
            <img src={logoWhite} alt="" style={styles.avatarBadge} />
            <h2 style={styles.namaUser}>{pengguna.nama}</h2>
          </div>
          <p style={styles.subNamaUser}>
            {pengguna.jabatan || "-"} · {pengguna.divisi || "-"}
          </p>
        </div>
        <div style={styles.tombolGroupHeader}>
          <button onClick={() => setHalaman("izin")} style={styles.tombolRiwayat}>
            Izin
          </button>
          <button onClick={() => setHalaman("riwayat")} style={styles.tombolRiwayat}>
            Riwayat
          </button>
          <button onClick={onLogout} style={styles.tombolLogout}>Keluar</button>
        </div>
      </div>

      <div style={styles.card}>
        {tahap === "memuat" && <p style={styles.memuatText}>Memuat status absen…</p>}

        {tahap !== "memuat" && <DialJamKerja tahap={tahap} />}

        {tahap === "selesai" && (
          <div style={styles.selesaiBox}>
            <p style={styles.judulKartu}>Absensi Hari Ini Selesai</p>
            <p style={styles.subJudulKartu}>Terima kasih, sampai jumpa besok.</p>
          </div>
        )}

        {(tahap === "belum_masuk" || tahap === "sudah_masuk") && (
          <>
            <p style={styles.labelTahap}>
              {tahap === "belum_masuk" ? "ABSEN MASUK" : "ABSEN PULANG"}
            </p>

            {!kameraAktif && !fotoTerambil && (
              <button onClick={bukaKamera} style={styles.tombolUtama}>
                Buka Kamera
              </button>
            )}

            {kameraAktif && (
              <div style={styles.kameraBox}>
                <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
                <button onClick={ambilFoto} style={styles.tombolUtama}>
                  Ambil Foto
                </button>
              </div>
            )}

            {fotoTerambil && (
              <div style={styles.kameraBox}>
                <img src={URL.createObjectURL(fotoTerambil)} alt="Foto absen" style={styles.video} />
                <p style={styles.statusLokasi}>
                  {statusLokasi === "mencari" && "Mencari lokasi…"}
                  {statusLokasi === "ditemukan" && (lokasi?.alamat || "Lokasi terdeteksi, mencari alamat…")}
                  {statusLokasi === "gagal" && "Lokasi tidak terdeteksi (tetap bisa absen)"}
                </p>
                {statusLokasi === "ditemukan" && lokasi?.akurasi && (
                  <p style={styles.statusAkurasi}>
                    Akurasi ± {lokasi.akurasi} meter
                    {lokasi.akurasi > 100 && " · kurang presisi, umum terjadi jika absen dari laptop"}
                  </p>
                )}
                {statusLokasi === "ditemukan" && lokasi?.latitude && (
                  <p style={styles.statusAkurasi}>
                    <a
                      href={`https://www.google.com/maps?q=${lokasi.latitude},${lokasi.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.linkMaps}
                    >
                      Cek di Google Maps ({lokasi.latitude.toFixed(5)}, {lokasi.longitude.toFixed(5)})
                    </a>
                  </p>
                )}
                <div style={styles.tombolGroup}>
                  <button onClick={fotoUlang} style={styles.tombolSekunder}>
                    Foto Ulang
                  </button>
                  <button onClick={kirimAbsen} style={styles.tombolUtama} disabled={loading}>
                    {loading ? "Mengirim…" : "Kirim Absen"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {pesan && <p style={styles.pesanInfo}>{pesan}</p>}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    background: warna.latar,
    fontFamily: font.display,
    padding: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    maxWidth: 420,
    margin: "0 auto 20px auto",
  },
  logoHeader: { height: 52, marginBottom: 12, display: "block" },
  namaRow: { display: "flex", alignItems: "center", gap: 8 },
  avatarBadge: { width: 28, height: 28, borderRadius: 6, display: "block" },
  namaUser: { margin: 0, fontSize: 19, color: warna.tinta, fontWeight: 700 },
  subNamaUser: { margin: "2px 0 0 0", fontSize: 13, color: warna.tintaLembut },
  tombolGroupHeader: { display: "flex", gap: 8 },
  tombolRiwayat: {
    background: warna.panel,
    border: `1px solid ${warna.tinta}`,
    borderRadius: 3,
    padding: "8px 14px",
    fontSize: 12.5,
    cursor: "pointer",
    color: warna.tinta,
    fontWeight: 600,
  },
  tombolLogout: {
    background: "none",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    padding: "8px 14px",
    fontSize: 12.5,
    cursor: "pointer",
    color: warna.tintaLembut,
  },
  card: {
    background: warna.panel,
    borderRadius: 4,
    padding: "28px 24px",
    maxWidth: 420,
    margin: "0 auto",
    border: `1px solid ${warna.garis}`,
    textAlign: "center",
  },
  memuatText: { color: warna.tintaLembut, fontSize: 13.5 },
  labelTahap: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: warna.tintaSamar,
    marginBottom: 18,
  },
  judulKartu: { fontSize: 17, fontWeight: 700, color: warna.tinta, marginBottom: 4 },
  subJudulKartu: { fontSize: 13.5, color: warna.tintaLembut },
  selesaiBox: { padding: "4px 0 8px 0" },
  tombolUtama: {
    width: "100%",
    padding: "13px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 3,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  tombolSekunder: {
    width: "100%",
    padding: "13px",
    background: warna.panelAlt,
    color: warna.tinta,
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 14.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
  tombolGroup: { display: "flex", flexDirection: "column", gap: 8 },
  kameraBox: { marginTop: 4 },
  video: {
    width: "100%",
    borderRadius: 3,
    background: "#000",
    marginBottom: 10,
    transform: "scaleX(-1)",
  },
  statusLokasi: { fontSize: 12.5, color: warna.tintaLembut, marginBottom: 4 },
  statusAkurasi: { fontSize: 11, color: warna.tintaSamar, marginBottom: 6, fontFamily: font.mono },
  linkMaps: { color: warna.aksen, textDecoration: "none" },
  pesanInfo: {
    marginTop: 16,
    fontSize: 13,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "10px 12px",
    borderRadius: 3,
    borderLeft: `3px solid ${warna.aksen}`,
    textAlign: "left",
  },
};
