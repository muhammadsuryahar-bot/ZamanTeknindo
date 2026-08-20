import { useState, useEffect, useRef } from "react";
import * as turf from "@turf/turf";
import { API_URL, getToken } from "../utils/api";
import RiwayatAbsensi from "./RiwayatAbsensi";
import PengajuanIzin from "./PengajuanIzin";
import { warna, font } from "../styles/theme";
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
      if (turf.booleanPointInPolygon(titik, fitur)) return fitur.properties.PROVINSI;
    } catch (err) {
      continue;
    }
  }
  return null;
}

// ============ ELEMEN VISUAL UTAMA: DIAL JAM KERJA ============
function DialJamKerja({ tahap, varian = "gelap" }) {
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

  const terang = varian === "terang";
  const warnaTrek = terang ? "rgba(255,255,255,0.22)" : warna.garis;
  const warnaDial = terang
    ? "#FFFFFF"
    : tahap === "selesai" ? warna.sukses : tahap === "sudah_masuk" ? warna.peringatan : warna.tintaSamar;
  const warnaTeks = terang ? "#FFFFFF" : warna.tinta;
  const warnaTeksSamar = terang ? "rgba(255,255,255,0.7)" : warna.tintaSamar;
  const warnaTakik = terang ? "rgba(255,255,255,0.45)" : "#C7CDD6";

  const takik = [0, 6, 12, 18].map((jam) => {
    const sudut = (jam / 24) * 360 - 90;
    const rad = (sudut * Math.PI) / 180;
    const x1 = 48 + 38 * Math.cos(rad);
    const y1 = 48 + 38 * Math.sin(rad);
    const x2 = 48 + 44 * Math.cos(rad);
    const y2 = 48 + 44 * Math.sin(rad);
    return { x1, y1, x2, y2, jam };
  });

  return (
    <div style={dialStyles.wrapper}>
      <svg width="108" height="108" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="42" fill="none" stroke={warnaTrek} strokeWidth="6" />
        <circle
          cx="48" cy="48" r="42" fill="none" stroke={warnaDial} strokeWidth="6"
          strokeDasharray={`${((persenSelesai - persenMulai) / 100) * 264} 264`}
          strokeDashoffset={-((persenMulai / 100) * 264)}
          transform="rotate(-90 48 48)"
        />
        {takik.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={warnaTakik} strokeWidth="1.5" />
        ))}
        <g transform={`rotate(${sudutSekarang - 90} 48 48)`}>
          <circle cx="90" cy="48" r="3.5" fill={terang ? "#FFFFFF" : warna.tinta} stroke={terang ? warna.aksen : "#FFFFFF"} strokeWidth="1.5" />
        </g>
        <text x="48" y="45" textAnchor="middle" fontFamily={font.mono} fontSize="15" fontWeight="600" fill={warnaTeks}>
          {sekarang.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
        </text>
        <text x="48" y="58" textAnchor="middle" fontFamily={font.mono} fontSize="7" fill={warnaTeksSamar} letterSpacing="1">
          WIB
        </text>
      </svg>
    </div>
  );
}

const dialStyles = {
  wrapper: { display: "flex", justifyContent: "center", marginBottom: 16 },
};

// ============ BRACKET SUDUT ALA VIEWFINDER ============
function BracketSudut({ warnaGaris, ukuran = 14, jarak = 10 }) {
  const dasar = { position: "absolute", width: ukuran, height: ukuran, borderColor: warnaGaris, borderStyle: "solid", borderWidth: 0 };
  return (
    <>
      <div style={{ ...dasar, top: jarak, left: jarak, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <div style={{ ...dasar, top: jarak, right: jarak, borderTopWidth: 2, borderRightWidth: 2 }} />
      <div style={{ ...dasar, bottom: jarak, left: jarak, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <div style={{ ...dasar, bottom: jarak, right: jarak, borderBottomWidth: 2, borderRightWidth: 2 }} />
    </>
  );
}

export default function DashboardKaryawan({ pengguna, onLogout }) {
  const [tahap, setTahap] = useState("memuat");
  const [halaman, setHalaman] = useState("absen");
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoTerambil, setFotoTerambil] = useState(null);
  const [lokasi, setLokasi] = useState(null);
  const [statusLokasi, setStatusLokasi] = useState("mencari");
  const [pesan, setPesan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("error");
  const [loading, setLoading] = useState(false);
  const [fotoPreviewUrl, setFotoPreviewUrl] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!fotoTerambil) {
      setFotoPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(fotoTerambil);
    setFotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [fotoTerambil]);

  useEffect(() => {
    ambilStatusHariIni();
    return () => hentikanKamera();
  }, []);

  async function ambilStatusHariIni() {
    try {
      const res = await fetch(`${API_URL}/absensi/status-hari-ini`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setTahap(data.tahap);
    } catch (err) {
      console.error("Error ambil status:", err);
      setPesan("Gagal memuat status absen. Cek koneksi ke server.");
      setPesanTipe("error");
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
      console.error("Error kamera:", err);
      setPesan("Tidak bisa mengakses kamera. Pastikan izin kamera sudah diberikan.");
      setPesanTipe("error");
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
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) setFotoTerambil(blob);
    }, "image/jpeg", 0.85);
    hentikanKamera();
  }

  function fotoUlang() {
    setFotoTerambil(null);
    bukaKamera();
  }

  async function ambilKotaKecamatanBigDataCloud(latitude, longitude) {
    try {
      const res = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&localityLanguage=id`
      );
      if (!res.ok) throw new Error("BigDataCloud API error");
      
      const data = await res.json();
      const bagian = [
        data.locality,
        data.city && data.city !== data.locality ? data.city : null
      ].filter(Boolean);
      
      if (bagian.length === 0) throw new Error("Data BigDataCloud kosong");
      return bagian.join(", ");
    } catch (err) {
      console.error("BigDataCloud error:", err);
      throw err;
    }
  }

  async function ambilDetailNominatim(latitude, longitude) {
    try {
      const detail = await ambilDetailNominatimPadaZoom(latitude, longitude, 18);
      if (!detail.jalan) {
        try {
          const detailZoomLebihLuas = await ambilDetailNominatimPadaZoom(latitude, longitude, 17);
          if (detailZoomLebihLuas.jalan) return detailZoomLebihLuas;
        } catch (err) {
          console.warn("Zoom lebih luas gagal:", err);
        }
      }
      return detail;
    } catch (err) {
      console.error("Nominatim detail error:", err);
      throw err;
    }
  }

  async function ambilDetailNominatimPadaZoom(latitude, longitude, zoom) {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", latitude.toString());
    url.searchParams.set("lon", longitude.toString());
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", zoom.toString());
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", "id");
    
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);
    
    const data = await res.json();
    const a = data.address || {};
    return {
      jalan: a.road || a.suburb || a.neighbourhood || null,
      desa: a.village || a.suburb || null
    };
  }

  function ambilLokasi() {
    setStatusLokasi("mencari");
    if (!navigator.geolocation) {
      setStatusLokasi("error");
      setPesan("Browser perangkat tidak mendukung pembacaan koordinat GPS.");
      setPesanTipe("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLokasi({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          akurasi: pos.coords.accuracy
        });
        setStatusLokasi("siap");
      },
      (err) => {
        console.error("Geolocation error:", err);
        setStatusLokasi("error");
        setPesan("Gagal mengunci GPS. Pastikan izin lokasi aktif.");
        setPesanTipe("error");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function kirimAbsenKeBackend() {
    if (!fotoTerambil || !lokasi) {
      setPesan("Foto bukti atau data koordinat lokasi belum siap.");
      setPesanTipe("error");
      return;
    }

    setLoading(true);
    setPesan("");

    try {
      let namaProvinsiResmi = null;
      try {
        namaProvinsiResmi = await cariProvinsiResmi(lokasi.latitude, lokasi.longitude);
      } catch (e) {
        console.warn("Province lookup failed:", e);
        namaProvinsiResmi = null;
      }

      let detailWilayah = "";
      try {
        detailWilayah = await ambilKotaKecamatanBigDataCloud(lokasi.latitude, lokasi.longitude);
      } catch (e) {
        console.warn("BigDataCloud failed, trying Nominatim:", e);
        try {
          const detail = await ambilDetailNominatim(lokasi.latitude, lokasi.longitude);
          detailWilayah = [detail.jalan, detail.desa].filter(Boolean).join(", ");
        } catch (err) {
          console.warn("Nominatim juga gagal, menggunakan default:", err);
          detailWilayah = "Lokasi Operasional Teknindo";
        }
      }

      const alamatLengkap = `${detailWilayah}, ${namaProvinsiResmi || "Luar Wilayah Jaringan"}`;
      const formData = new FormData();
      const namaFile = `absen_${tahap}_${pengguna?.id || "karyawan"}_${Date.now()}.jpg`;
      const berkasFoto = new File([fotoTerambil], namaFile, { type: "image/jpeg" });

      formData.append("foto", berkasFoto);
      formData.append("latitude", String(lokasi.latitude));
      formData.append("longitude", String(lokasi.longitude));
      formData.append("alamat", alamatLengkap);
      formData.append("akurasi", String(lokasi.akurasi));

      const ruteApi = tahap === "belum_masuk" ? "/absensi/masuk" : "/absensi/pulang";
      const token = getToken();
      if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");

      const respons = await fetch(`${API_URL}${ruteApi}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      let hasil = null;
      try {
        hasil = await respons.json();
      } catch (e) {
        console.warn("Response parsing error:", e);
        hasil = null;
      }

      if (!respons.ok) {
        throw new Error(hasil?.pesan || hasil?.message || "Gagal memproses validasi absensi.");
      }

      setPesan(tahap === "belum_masuk" ? "Absen masuk berhasil tercatat!" : "Absen pulang berhasil tercatat!");
      setPesanTipe("sukses");
      setFotoTerambil(null);
      setLokasi(null);
      setStatusLokasi("mencari");
      await ambilStatusHariIni();
    } catch (error) {
      console.error("Kirim absen error:", error);
      setPesan(error.message || "Terjadi kendala interaksi dengan server.");
      setPesanTipe("error");
    } finally {
      setLoading(false);
    }
  }

  // --- BAGIAN NAVIGASI / ROUTING HALAMAN ---
  if (halaman === "riwayat") {
    return <RiwayatAbsensi pengguna={pengguna} onKembali={() => setHalaman("absen")} />;
  }

  if (halaman === "izin") {
    return <PengajuanIzin pengguna={pengguna} onKembali={() => setHalaman("absen")} />;
  }

  // --- BAGIAN TAMPILAN UTAMA (JSX) ---
  return (
    <div style={{ fontFamily: font.sans, padding: 16, color: warna.tinta, maxWidth: 500, margin: "0 auto" }}>
      
      {/* Header / Top Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <img src={logo} alt="Logo" style={{ height: 32, filter: "invert(1)" }} />
        <button onClick={onLogout} style={{ background: "none", border: "none", color: warna.error, fontWeight: "600", cursor: "pointer" }}>
          Keluar
        </button>
      </div>

      {/* Kotak Utama Absensi */}
      <div style={{ backgroundColor: "#ffffff", borderRadius: 12, padding: 20, boxShadow: "0 4px 12px rgba(0,0,0,0.05)", position: "relative", marginBottom: 20 }}>
        
        {/* Profil Pengguna */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: "600", margin: "0 0 4px 0" }}>Halo, {pengguna?.nama}</h2>
          <p style={{ fontSize: 14, color: warna.tintaSamar, margin: 0 }}>{pengguna?.jabatan} - {pengguna?.divisi}</p>
        </div>

        {/* Notifikasi Pesan Sukses / Error */}
        {pesan && (
          <div style={{ padding: 12, borderRadius: 8, backgroundColor: pesanTipe === "sukses" ? "#e6f7ed" : "#fde8e8", color: pesanTipe === "sukses" ? warna.sukses : warna.error, fontSize: 13, marginBottom: 16 }}>
            {pesan}
          </div>
        )}

        {/* Preview Kamera Aktif */}
        {kameraAktif && (
          <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 16, backgroundColor: "#000", aspectRatio: "4/3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <BracketSudut warnaGaris="#fff" />
            <button onClick={ambilFoto} style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", backgroundColor: "#ffffff", border: "none", borderRadius: "50%", width: 60, height: 60, cursor: "pointer", fontWeight: "600" }}>
              📷
            </button>
          </div>
        )}

        {/* Hasil Foto Terambil */}
        {fotoTerambil && fotoPreviewUrl && (
          <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 16, aspectRatio: "4/3" }}>
            <img src={fotoPreviewUrl} alt="Bukti" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            <button onClick={fotoUlang} style={{ position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 13, fontWeight: "500" }}>
              Foto Ulang
            </button>
          </div>
        )}

        {/* Hidden Canvas untuk Proses Foto */}
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {/* Handler Status Tahapan Absensi */}
        {tahap === "memuat" ? (
          <p style={{ textAlign: "center", color: warna.tintaSamar }}>Memeriksa status...</p>
        ) : tahap === "selesai" ? (
          <div style={{ textAlign: "center", padding: "12px 0", color: warna.sukses, fontWeight: "600" }}>
            Absensi Hari Ini Selesai
          </div>
        ) : (
          /* Tombol Buka Kamera jika belum ada foto */
          !kameraAktif && !fotoTerambil && (
            <button onClick={bukaKamera} style={{ width: "100%", padding: "14px", backgroundColor: warna.aksen, color: "#fff", border: "none", borderRadius: 8, fontWeight: "600", fontSize: 15, cursor: "pointer" }}>
              {tahap === "belum_masuk" ? "Absen Masuk Sekarang" : "Absen Pulang Sekarang"}
            </button>
          )
        )}

        {/* Tombol Kirim Data ke Server */}
        {fotoTerambil && (
          <button onClick={kirimAbsenKeBackend} disabled={loading || statusLokasi === "mencari"} style={{ width: "100%", padding: "14px", backgroundColor: statusLokasi === "siap" ? warna.sukses : warna.tintaSamar, color: "#fff", border: "none", borderRadius: 8, fontWeight: "600", fontSize: 15, cursor: "pointer", opacity: loading || statusLokasi === "mencari" ? 0.6 : 1 }}>
            {loading ? "Mengirim..." : statusLokasi === "mencari" ? "Mengunci Koordinat GPS..." : "Konfirmasi & Kirim Absen"}
          </button>
        )}

      </div>

      {/* Menu Navigasi Bawah */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <button onClick={() => setHalaman("riwayat")} style={{ padding: "12px", backgroundColor: "#fff", border: `1px solid ${warna.garis}`, borderRadius: 8, fontWeight: "500", cursor: "pointer" }}>
          Riwayat Absen
        </button>
        <button onClick={() => setHalaman("izin")} style={{ padding: "12px", backgroundColor: "#fff", border: `1px solid ${warna.garis}`, borderRadius: 8, fontWeight: "500", cursor: "pointer" }}>
          Ajukan Izin
        </button>
      </div>

    </div>
  );
}