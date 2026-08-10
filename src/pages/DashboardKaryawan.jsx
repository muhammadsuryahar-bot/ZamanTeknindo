import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as turf from "@turf/turf";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";

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

async function ambilKotaKecamatanBigDataCloud(latitude, longitude) {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=id`
  );
  if (!res.ok) throw new Error("Gagal mengambil data BigDataCloud");
  const data = await res.json();
  const bagian = [data.locality, data.city && data.city !== data.locality ? data.city : null].filter(Boolean);
  if (bagian.length === 0) throw new Error("Data BigDataCloud kosong");
  return bagian.join(", ");
}

// Inisial 1-2 huruf dari nama, buat avatar bulat
function inisialNama(nama) {
  if (!nama) return "?";
  const bagian = nama.trim().split(" ");
  if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
  return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
}

export default function DashboardKaryawan({ pengguna, onLogout }) {
  const navigate = useNavigate();

  const [tahap, setTahap] = useState("memuat");
  const [kameraAktif, setKameraAktif] = useState(false);
  const [fotoTerambil, setFotoTerambil] = useState(null);
  const [lokasi, setLokasi] = useState(null);
  const [statusLokasi, setStatusLokasi] = useState("mencari");
  const [pesan, setPesan] = useState("");
  const [pesanTipe, setPesanTipe] = useState("error");
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
      setTahap("gagal"); // dulu: tahap tetap "memuat" selamanya, jadi "Memeriksa status…"
                          // nempel terus bareng pesan error di bawahnya
      setPesan("Gagal memuat status absen. Periksa koneksi internet, lalu coba lagi.");
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

  // PERBAIKAN BUG MIRROR: preview <video> live tampil dibalik (mirror,
  // transform: scaleX(-1)) supaya terasa natural kayak kaca saat framing.
  // Sebelumnya canvas cuma nge-draw frame video APA ADANYA (tidak dibalik),
  // jadi foto hasil jepretan JUSTRU KEBALIKAN dari yang dilihat user saat
  // framing -- kalau ada tulisan di background, misalnya, arahnya kebalik.
  // Fix: canvas ikut dibalik horizontal saat menggambar, supaya hasil akhir
  // konsisten dengan apa yang dilihat user di preview.
  function ambilFoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => setFotoTerambil(blob), "image/jpeg", 0.85);
    hentikanKamera();
  }

  function fotoUlang() {
    setFotoTerambil(null);
    bukaKamera();
  }

  function ambilLokasi() {
    setStatusLokasi("mencari");
    if (!navigator.geolocation) {
      setStatusLokasi("error");
      setPesan("Browser perangkat tidak mendukung pembacaan koordinat GPS.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLokasi({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          akurasi: pos.coords.accuracy,
        });
        setStatusLokasi("siap");
      },
      (err) => {
        setStatusLokasi("error");
        setPesan("Gagal mengunci GPS. Pastikan izin lokasi aktif.");
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
      const namaProvinsiResmi = await cariProvinsiResmi(lokasi.latitude, lokasi.longitude);

      let detailWilayah = "";
      try {
        detailWilayah = await ambilKotaKecamatanBigDataCloud(lokasi.latitude, lokasi.longitude);
      } catch (e) {
        detailWilayah = "Lokasi Operasional Teknindo";
      }

      const alamatLengkap = `${detailWilayah}, ${namaProvinsiResmi || "Luar Wilayah Jaringan"}`;

      const formData = new FormData();
      const namaFile = `absen_${tahap}_${pengguna?.id || "karyawan"}_${Date.now()}.jpg`;
      const berkasFoto = new File([fotoTerambil], namaFile, { type: "image/jpeg" });

      formData.append("foto", berkasFoto);
      formData.append("latitude", lokasi.latitude);
      formData.append("longitude", lokasi.longitude);
      formData.append("alamat", alamatLengkap);
      formData.append("akurasi", lokasi.akurasi);

      const ruteApi = tahap === "belum_masuk" ? "/absensi/masuk" : "/absensi/pulang";

      const respons = await fetch(`${API_URL}${ruteApi}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      });

      const hasil = await respons.json();

      if (!respons.ok) {
        throw new Error(hasil.pesan || hasil.message || "Gagal memproses validasi absensi.");
      }

      setPesan(tahap === "belum_masuk" ? "Absen masuk berhasil tercatat!" : "Absen pulang berhasil tercatat!");
      setPesanTipe("sukses");
      setFotoTerambil(null);
      await ambilStatusHariIni();
    } catch (error) {
      setPesan(error.message || "Terjadi kendala interaksi dengan server.");
      setPesanTipe("error");
    } finally {
      setLoading(false);
    }
  }

  const jamSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div style={styles.wrapper}>
      <div className="karyawan-outer">
        {/* Panel brand — HANYA tampil di layar desktop (lihat index.css).
            Sebelumnya di layar besar halaman ini cuma jadi kartu kecil
            mengambang sendirian di lautan putih kosong; panel ini mengisi
            ruang itu dengan identitas perusahaan, konsisten dengan gaya
            split-screen yang sudah dipakai di halaman Login. */}
        <div className="karyawan-brand-panel" style={styles.desktopBrandPanel}>
          <div style={styles.polaTitikKaryawan} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <img src={logoHorizontal} alt="" style={styles.logoBrandPanel} />
            <h2 style={styles.brandNamaKaryawan}>Selamat Bertugas!</h2>
            <p style={styles.brandTaglineKaryawan}>
              Catat kehadiran hari ini dengan foto & lokasi — cukup sekali klik.
            </p>
          </div>
        </div>

        <div style={styles.shell} className="karyawan-content-shell">
        {/* Header */}
        <div style={styles.header}>
          <img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logo} />
          <button onClick={onLogout} style={styles.tombolLogout}>Keluar</button>
        </div>

        {/* Kartu utama absensi */}
        <div style={styles.card}>
          {/* Profil */}
          <div style={styles.profilRow}>
            <div style={styles.avatar}>{inisialNama(pengguna?.nama)}</div>
            <div>
              <h2 style={styles.namaUser}>{pengguna?.nama}</h2>
              <p style={styles.subUser}>{pengguna?.jabatan} · {pengguna?.divisi}</p>
            </div>
          </div>
          <p style={styles.tanggalHariIni}>{jamSekarang}</p>

          {pesan && (
            <div
              style={{
                ...styles.pesanBox,
                background: pesanTipe === "sukses" ? warna.suksesLembut : warna.bahayaLembut,
                color: pesanTipe === "sukses" ? warna.sukses : warna.bahaya,
              }}
            >
              {pesan}
            </div>
          )}

          {kameraAktif && (
            <div style={styles.kameraBox}>
              <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
              <button onClick={ambilFoto} style={styles.tombolJepret} aria-label="Ambil foto">
                <span style={styles.tombolJepretDalam} />
              </button>
            </div>
          )}

          {fotoTerambil && (
            <div style={styles.previewBox}>
              <img src={URL.createObjectURL(fotoTerambil)} alt="Bukti absen" style={styles.previewImg} />
              <button onClick={fotoUlang} style={styles.tombolFotoUlang}>Foto Ulang</button>
            </div>
          )}

          <canvas ref={canvasRef} style={{ display: "none" }} />

          {tahap === "memuat" && <p style={styles.infoNetral}>Memeriksa status…</p>}

          {tahap === "gagal" && (
            <div style={styles.gagalBox}>
              <p style={styles.gagalTeks}>Status absen belum berhasil dimuat.</p>
              <button onClick={() => { setPesan(""); setTahap("memuat"); ambilStatusHariIni(); }} style={styles.tombolCobaLagi}>
                Coba Lagi
              </button>
            </div>
          )}

          {tahap === "selesai" && (
            <div style={styles.selesaiBox}>
              <span style={styles.selesaiIkon}>✓</span>
              <p style={styles.selesaiTeks}>Absensi Hari Ini Selesai</p>
            </div>
          )}

          {tahap !== "memuat" && tahap !== "selesai" && tahap !== "gagal" && !kameraAktif && !fotoTerambil && (
            <button onClick={bukaKamera} style={styles.tombolUtama}>
              {tahap === "belum_masuk" ? "Absen Masuk Sekarang" : "Absen Pulang Sekarang"}
            </button>
          )}

          {fotoTerambil && (
            <button
              onClick={kirimAbsenKeBackend}
              disabled={loading || statusLokasi === "mencari"}
              style={{
                ...styles.tombolUtama,
                background: statusLokasi === "siap" ? warna.aksen : warna.tintaSamar,
                marginTop: 12,
              }}
            >
              {loading ? "Mengirim…" : statusLokasi === "mencari" ? "Mengunci Koordinat GPS…" : "Konfirmasi & Kirim Absen"}
            </button>
          )}
        </div>

        {/* Menu navigasi */}
        <div style={styles.menuGrid}>
          <button onClick={() => navigate("/karyawan/riwayat")} style={styles.tombolMenu}>
            <span style={styles.menuIkon}>📋</span>
            <span>Riwayat Absen</span>
          </button>
          <button onClick={() => navigate("/karyawan/izin")} style={styles.tombolMenu}>
            <span style={styles.menuIkon}>📝</span>
            <span>Ajukan Izin</span>
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100svh", background: warna.latar, fontFamily: font.display, padding: 16 },
  shell: { maxWidth: 460, margin: "0 auto" },

  // ---------- Panel brand desktop (lihat penjelasan di JSX) ----------
  desktopBrandPanel: {
    position: "relative",
    width: 360,
    borderRadius: 20,
    background: `linear-gradient(160deg, ${warna.aksen} 0%, ${warna.aksenGelap || "#0B6E45"} 100%)`,
    padding: "40px 32px",
    overflow: "hidden",
    alignItems: "flex-end",
    minHeight: 420,
    // catatan: "display" SENGAJA tidak diset di sini (biar CSS
    // .karyawan-brand-panel yang mengatur tampil/sembunyi sesuai lebar
    // layar). Kalau diset di sini, inline style akan menang atas CSS
    // dan panel ini malah ikut muncul di HP.
  },
  polaTitikKaryawan: {
    position: "absolute", inset: 0,
    backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1.5px, transparent 1.5px)",
    backgroundSize: "18px 18px", opacity: 0.6,
  },
  logoBrandPanel: { width: 40, marginBottom: 16, filter: "brightness(0) invert(1)" },
  brandNamaKaryawan: { color: "#fff", fontSize: 20, fontWeight: 700, margin: "0 0 10px 0" },
  brandTaglineKaryawan: { color: "rgba(255,255,255,0.85)", fontSize: 13, lineHeight: 1.6, margin: 0 },

  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  logo: { height: 30 },
  tombolLogout: { background: "none", border: "none", color: warna.bahaya, fontWeight: 600, fontSize: 13, cursor: "pointer", padding: 0 },

  card: {
    background: warna.panel,
    borderRadius: 10,
    padding: 22,
    boxShadow: "0 1px 2px rgba(22,35,61,0.04), 0 8px 24px rgba(22,35,61,0.06)",
    marginBottom: 16,
    border: `1px solid ${warna.garis}`,
  },

  profilRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 2 },
  avatar: {
    width: 44, height: 44, borderRadius: "50%",
    background: warna.aksen, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 15, fontWeight: 700, flexShrink: 0,
  },
  namaUser: { margin: 0, fontSize: 16.5, fontWeight: 700, color: warna.tinta },
  subUser: { margin: "2px 0 0 0", fontSize: 12.5, color: warna.tintaLembut },
  tanggalHariIni: { fontSize: 11.5, color: warna.tintaSamar, margin: "10px 0 18px 0", paddingLeft: 56 },

  pesanBox: { padding: "11px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16, textAlign: "center", fontWeight: 500 },

  kameraBox: { position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 16, backgroundColor: "#000", aspectRatio: "4/3" },
  video: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" },
  tombolJepret: {
    position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
    background: "rgba(255,255,255,0.25)", border: "3px solid #fff", borderRadius: "50%",
    width: 60, height: 60, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    padding: 0,
  },
  tombolJepretDalam: { width: 46, height: 46, borderRadius: "50%", background: "#fff", display: "block" },

  previewBox: { position: "relative", borderRadius: 8, overflow: "hidden", marginBottom: 16, aspectRatio: "4/3" },
  previewImg: { width: "100%", height: "100%", objectFit: "cover" },
  tombolFotoUlang: {
    position: "absolute", bottom: 12, right: 12, backgroundColor: "rgba(22,35,61,0.75)",
    border: "none", color: "#fff", padding: "7px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
  },

  infoNetral: { textAlign: "center", color: warna.tintaSamar, fontSize: 13.5, margin: 0 },

  selesaiBox: { textAlign: "center", padding: "16px 0" },
  selesaiIkon: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 40, height: 40, borderRadius: "50%", background: warna.suksesLembut,
    color: warna.sukses, fontSize: 18, fontWeight: 700, marginBottom: 10,
  },
  selesaiTeks: { margin: 0, color: warna.sukses, fontWeight: 700, fontSize: 14.5 },

  gagalBox: { textAlign: "center", padding: "10px 0 4px 0" },
  gagalTeks: { margin: "0 0 10px 0", color: warna.tintaSamar, fontSize: 13.5 },
  tombolCobaLagi: {
    background: warna.panel, border: `1px solid ${warna.garis}`, color: warna.tinta,
    fontWeight: 600, fontSize: 13, padding: "8px 20px", borderRadius: 8, cursor: "pointer",
  },

  tombolUtama: {
    width: "100%", padding: "15px", background: warna.aksen, color: "#fff",
    border: "none", borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer",
  },

  menuGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  tombolMenu: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
    padding: "16px 12px", backgroundColor: warna.panel, color: warna.tinta,
    border: `1px solid ${warna.garis}`, borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer",
  },
  menuIkon: { fontSize: 20 },
};
