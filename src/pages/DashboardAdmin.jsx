import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logo from "../assets/logo.png";
import AdminIzin from "./AdminIzin";
import PengaturanGaji from "./PengaturanGaji";
import { labelStatusKehadiran } from "../utils/statusKehadiran";

const DAFTAR_STATUS = ["tepat_waktu", "telat", "alpha", "izin", "sakit", "cuti", "urgent"];

const IKON_TAB = {
  rekap: "📋",
  approval: "🕒",
  karyawan: "👥",
  izin: "📝",
  gaji: "💵",
  kantor: "🏢",
};

// Kartu abu-abu berkedip pelan, dipakai sebagai placeholder saat data masih dimuat
function SkeletonBaris({ jumlah = 4 }) {
  return (
    <>
      {Array.from({ length: jumlah }).map((_, i) => (
        <tr key={i} className="skeleton-pulse">
          <td colSpan={99} style={{ padding: "14px 16px" }}>
            <div style={{ height: 12, width: `${40 + (i % 3) * 15}%`, background: warna.panelAlt, borderRadius: 6 }} />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function DashboardAdmin({ pengguna, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("rekap");
  const [rekap, setRekap] = useState([]);
  const [menunggu, setMenunggu] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");

  // Kata kunci pencarian, terpisah untuk tiap tab supaya tidak saling ganggu
  const [cariRekap, setCariRekap] = useState("");
  const [cariKaryawan, setCariKaryawan] = useState("");

  // Form aktivasi akun yang lagi dibuka (ganti prompt() bawaan browser)
  const [formAktivasiTerbuka, setFormAktivasiTerbuka] = useState(null); // id akun atau null
  const [formAktivasi, setFormAktivasi] = useState({ jabatan: "", divisi: "", kantorId: "" });

  // Daftar kantor/cabang, dipakai di dropdown aktivasi & tab Kantor
  const [daftarKantorState, setDaftarKantorState] = useState([]);
  const [formKantor, setFormKantor] = useState({ namaKantor: "", alamat: "", latitude: "", longitude: "" });
  const [kantorEditId, setKantorEditId] = useState(null); // id kantor yang lagi diedit, atau null = mode tambah baru
  const [sedangSimpanKantor, setSedangSimpanKantor] = useState(false);

  // Konfirmasi ubah status karyawan yang lagi dibuka (ganti confirm() bawaan browser)
  const [konfirmasiStatusTerbuka, setKonfirmasiStatusTerbuka] = useState(null); // id karyawan atau null

  // Hasil reset password (password sementara) yang baru saja digenerate,
  // ditampilkan sekali ke Admin supaya bisa disalin & disampaikan manual
  const [resetPasswordHasil, setResetPasswordHasil] = useState(null); // { id, password } atau null

  // Form edit status kehadiran manual yang lagi dibuka
  const [editStatusTerbuka, setEditStatusTerbuka] = useState(null); // id absensi atau null
  const [formEditStatus, setFormEditStatus] = useState({ statusFinal: "", catatanAdmin: "" });

  // Sidebar mobile (dibuka lewat hamburger di topbar kecil)
  const [sidebarMobileTerbuka, setSidebarMobileTerbuka] = useState(false);

  // Penanda "tabel sudah digeser sampai ujung kanan" (khusus HP) — kalau
  // sudah di ujung, gradient fade di tepi kanan disembunyikan karena tidak
  // ada lagi yang perlu diisyaratkan ke pengguna
  const [rekapDiUjung, setRekapDiUjung] = useState(false);

  // Panel "Tren & Analisis" -- sengaja TIDAK ikut di-fetch bareng data utama
  // (muatData), supaya buka dashboard tetap ringan/cepat setiap hari. Data ini
  // baru diambil kalau admin sendiri yang membuka panelnya.
  const [ringkasanTerbuka, setRingkasanTerbuka] = useState(false);
  const [ringkasan, setRingkasan] = useState(null);
  const [loadingRingkasan, setLoadingRingkasan] = useState(false);

  async function bukaTutupRingkasan() {
    const mauDibuka = !ringkasanTerbuka;
    setRingkasanTerbuka(mauDibuka);
    if (mauDibuka && !ringkasan) {
      setLoadingRingkasan(true);
      try {
        const res = await fetch(`${API_URL}/admin/ringkasan`, { headers: { Authorization: `Bearer ${getToken()}` } });
        const data = await res.json();
        setRingkasan(data.data || null);
      } catch (err) {
        setPesan("Gagal memuat tren & analisis.");
      } finally {
        setLoadingRingkasan(false);
      }
    }
  }

  function namaHariSingkat(tanggalISO) {
    const hari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    return hari[new Date(`${tanggalISO}T00:00:00.000Z`).getUTCDay()];
  }
  const [karyawanDiUjung, setKaryawanDiUjung] = useState(false);
  function cekUjungScroll(e, setDiUjung) {
    const el = e.target;
    setDiUjung(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function muatData() {
    setLoading(true);
    try {
      const [resRekap, resMenunggu, resKaryawan, resKantor] = await Promise.all([
        fetch(`${API_URL}/admin/rekap-hari-ini`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/akun-menunggu`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/karyawan`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/kantor`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const dataRekap = await resRekap.json();
      const dataMenunggu = await resMenunggu.json();
      const dataKaryawan = await resKaryawan.json();
      const dataKantor = await resKantor.json();
      setRekap(dataRekap.data || []);
      setMenunggu(dataMenunggu.data || []);
      setKaryawan(dataKaryawan.data || []);
      setDaftarKantorState(dataKantor.data || []);
    } catch (err) {
      setPesan("Gagal memuat data. Cek koneksi ke server.");
    } finally {
      setLoading(false);
    }
  }

  function bukaFormAktivasi(id) {
    setFormAktivasiTerbuka(id);
    setFormAktivasi({ jabatan: "", divisi: "", kantorId: daftarKantorState[0]?.id ? String(daftarKantorState[0].id) : "" });
  }

  async function kirimAktivasi(id) {
    if (!formAktivasi.jabatan.trim() || !formAktivasi.divisi.trim()) {
      setPesan("Jabatan dan divisi wajib diisi.");
      return;
    }
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/akun/${id}/aktifkan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formAktivasi),
      });
      const data = await res.json();
      if (!res.ok) return setPesan(data.pesan || "Gagal mengaktifkan akun.");
      setPesanSukses(data.pesan);
      setFormAktivasiTerbuka(null);
      muatData();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  function bukaFormTambahKantor() {
    setKantorEditId(null);
    setFormKantor({ namaKantor: "", alamat: "", latitude: "", longitude: "" });
  }

  function bukaFormEditKantor(k) {
    setKantorEditId(k.id);
    setFormKantor({
      namaKantor: k.namaKantor || "",
      alamat: k.alamat || "",
      latitude: k.latitude ?? "",
      longitude: k.longitude ?? "",
    });
  }

  async function simpanKantor() {
    if (!formKantor.namaKantor.trim()) {
      setPesan("Nama kantor wajib diisi.");
      return;
    }
    setPesan("");
    setSedangSimpanKantor(true);
    try {
      const sedangEdit = kantorEditId !== null;
      const url = sedangEdit ? `${API_URL}/admin/kantor/${kantorEditId}` : `${API_URL}/admin/kantor`;
      const res = await fetch(url, {
        method: sedangEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formKantor),
      });
      const data = await res.json();
      if (!res.ok) return setPesan(data.pesan || "Gagal menyimpan kantor.");
      setPesanSukses(data.pesan);
      setKantorEditId(null);
      setFormKantor({ namaKantor: "", alamat: "", latitude: "", longitude: "" });
      muatData();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setSedangSimpanKantor(false);
    }
  }

  async function bukaResetPassword(id) {
    if (resetPasswordHasil?.id === id) {
      setResetPasswordHasil(null);
      return;
    }
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/karyawan/${id}/reset-password`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) return setPesan(data.pesan || "Gagal mereset password.");
      setResetPasswordHasil({ id, password: data.passwordSementara });
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  async function ubahStatusKaryawan(id, statusBaru) {
    try {
      const res = await fetch(`${API_URL}/admin/karyawan/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ statusAkun: statusBaru }),
      });
      const data = await res.json();
      if (!res.ok) return setPesan(data.pesan || "Gagal mengubah status.");
      setPesanSukses(data.pesan);
      setKonfirmasiStatusTerbuka(null);
      muatData();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  function bukaEditStatus(item) {
    setEditStatusTerbuka(item.id);
    setFormEditStatus({
      statusFinal: item.statusFinal || item.statusOtomatis || "tepat_waktu",
      catatanAdmin: item.catatanAdmin || "",
    });
  }

  async function simpanEditStatus(id) {
    if (!formEditStatus.catatanAdmin.trim()) {
      setPesan("Catatan wajib diisi kalau mengubah status secara manual (buat jejak alasan perubahan).");
      return;
    }
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/absensi/${id}/edit-status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(formEditStatus),
      });
      const data = await res.json();
      if (!res.ok) return setPesan(data.pesan || "Gagal mengubah status absensi.");
      setPesanSukses(data.pesan);
      setEditStatusTerbuka(null);
      muatData();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  // Bangun URL foto dengan aman -- data lama ada yang tersimpan SUDAH
  // pakai awalan "/uploads/" (bug lama, sudah diperbaiki di backend),
  // ada yang cuma nama file polos. Fungsi ini menangani DUA KEMUNGKINAN
  // itu, supaya foto lama yang sempat tersimpan salah juga ikut normal
  // tampil lagi tanpa perlu karyawan absen ulang.
  function urlFoto(namaFile) {
    if (!namaFile) return null;
    return namaFile.startsWith("/uploads/") ? namaFile : `/uploads/${namaFile}`;
  }

  function formatJam(tanggalIso) {
    if (!tanggalIso) return "–";
    return new Date(tanggalIso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  function cocokKataKunci(teksTarget, kataKunci) {
    if (!kataKunci.trim()) return true;
    return teksTarget.toLowerCase().includes(kataKunci.trim().toLowerCase());
  }

  const rekapTersaring = rekap.filter((item) =>
    cocokKataKunci(`${item.pengguna.nama} ${item.pengguna.jabatan || ""} ${item.pengguna.divisi || ""}`, cariRekap)
  );

  const karyawanTersaring = karyawan.filter((item) =>
    cocokKataKunci(`${item.nama} ${item.email} ${item.jabatan || ""} ${item.divisi || ""}`, cariKaryawan)
  );

  const karyawanAktifCount = karyawan.filter((k) => k.statusAkun === "aktif").length;
  const jumlahTepatWaktu = rekap.filter((r) => (r.statusFinal || r.statusOtomatis) === "tepat_waktu").length;
  const jumlahTelat = rekap.filter((r) => (r.statusFinal || r.statusOtomatis) === "telat").length;
  const jumlahIzinSakitDll = rekap.filter((r) =>
    ["izin", "sakit", "cuti", "urgent"].includes(r.statusFinal || r.statusOtomatis)
  ).length;
  const jumlahBelumAbsen = Math.max(karyawanAktifCount - rekap.length, 0);

  const jamSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  function inisialNama(nama) {
    if (!nama) return "?";
    const bagian = nama.trim().split(" ");
    if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
    return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
  }

  const tabs = [
    { id: "rekap", label: "Rekap Hari Ini" },
    { id: "approval", label: "Menunggu", badge: menunggu.length || null },
    { id: "karyawan", label: "Karyawan" },
    { id: "izin", label: "Izin" },
    { id: "gaji", label: "Gaji" },
    { id: "kantor", label: "Kantor" },
  ];

  const judulTab = tabs.find((t) => t.id === tab)?.label || "";

  function pindahTab(idTab) {
    setTab(idTab);
    setSidebarMobileTerbuka(false);
  }

  return (
    <div style={styles.shell}>
      {/* ============ SIDEBAR (tampil di desktop, tersembunyi & jadi drawer di mobile) ============ */}
      <aside
        className={sidebarMobileTerbuka ? "admin-sidebar sidebar-mobile-terbuka" : "admin-sidebar"}
        style={styles.sidebar}
      >
        <div style={styles.sidebarAtas}>
          <img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logoSidebar} />
        </div>

        <nav style={styles.navSidebar}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => pindahTab(t.id)}
              style={tab === t.id ? styles.navItemAktif : styles.navItem}
              className="nav-item-hover"
            >
              <span style={styles.navIkon}>{IKON_TAB[t.id]}</span>
              <span style={{ flex: 1, textAlign: "left" }}>{t.label}</span>
              {t.badge ? <span style={styles.navBadge}>{t.badge}</span> : null}
            </button>
          ))}
        </nav>

        <div style={styles.sidebarBawah}>
          <div style={styles.profilSidebar}>
            <div style={styles.avatarLingkaran}>{inisialNama(pengguna.nama)}</div>
            <div style={{ overflow: "hidden" }}>
              <p style={styles.namaProfil}>{pengguna.nama}</p>
              <p style={styles.perananProfil}>Admin</p>
            </div>
          </div>
          <div style={styles.aksiSidebarRow}>
            <button onClick={() => navigate("/ganti-password")} style={styles.tombolAksiSidebar} className="tombol-aksi-sidebar">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke={warna.tintaLembut} strokeWidth="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke={warna.tintaLembut} strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              Password
            </button>
            <button onClick={onLogout} style={{ ...styles.tombolAksiSidebar, ...styles.tombolAksiSidebarBahaya }} className="tombol-aksi-sidebar-bahaya">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 3.5H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2M10.5 11l3-3-3-3M13.5 8H6" stroke={warna.bahaya} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay gelap saat sidebar mobile terbuka, klik buat nutup */}
      {sidebarMobileTerbuka && (
        <div className="overlay-mobile" onClick={() => setSidebarMobileTerbuka(false)} />
      )}

      {/* ============ AREA KONTEN UTAMA ============ */}
      <div style={styles.mainArea} className="main-area-admin">
        <div style={styles.topbarMobile} className="topbar-mobile">
          <button onClick={() => setSidebarMobileTerbuka(true)} style={styles.tombolHamburger} aria-label="Buka menu navigasi">
            {/* Ikon garis tiga (hamburger) — dulu pakai logo perusahaan di sini,
                orang tidak akan mengira logo itu bisa diklik untuk buka menu */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5.5H17M3 10H17M3 14.5H17" stroke={warna.tinta} strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
          <img src={logo} alt="PT. Zaman Teknindo" style={styles.topbarLogoKecil} />
          <div style={{ width: 32 }} />
        </div>

        <div style={styles.headerAtas}>
          <div>
            <h1 style={styles.judulHalaman}>{judulTab}</h1>
            <p style={styles.subJudulHalaman}>{jamSekarang}</p>
          </div>
        </div>

        <div style={styles.content}>
          {pesan && <p style={styles.pesanError}>{pesan}</p>}
          {pesanSukses && <p style={styles.pesanSukses}>{pesanSukses}</p>}

          {tab === "rekap" && (
            <>
              <div style={styles.statGrid}>
                <div style={styles.statCard}>
                  <span style={styles.statAngka}>{karyawanAktifCount}</span>
                  <span style={styles.statLabel}>Karyawan Aktif</span>
                </div>
                <div style={{ ...styles.statCard, borderLeft: `3px solid ${warna.sukses}` }}>
                  <span style={{ ...styles.statAngka, color: warna.sukses }}>{jumlahTepatWaktu}</span>
                  <span style={styles.statLabel}>Tepat Waktu</span>
                </div>
                <div style={{ ...styles.statCard, borderLeft: `3px solid ${warna.peringatan}` }}>
                  <span style={{ ...styles.statAngka, color: warna.peringatan }}>{jumlahTelat}</span>
                  <span style={styles.statLabel}>Telat</span>
                </div>
                <div style={{ ...styles.statCard, borderLeft: `3px solid ${warna.aksen}` }}>
                  <span style={{ ...styles.statAngka, color: warna.aksen }}>{jumlahIzinSakitDll}</span>
                  <span style={styles.statLabel}>Izin/Sakit/Cuti</span>
                </div>
                <div style={{ ...styles.statCard, borderLeft: `3px solid ${warna.tintaSamar}` }}>
                  <span style={{ ...styles.statAngka, color: warna.tintaSamar }}>{jumlahBelumAbsen}</span>
                  <span style={styles.statLabel}>Belum Absen</span>
                </div>
              </div>

              <button onClick={bukaTutupRingkasan} style={styles.tombolTogglePanel} className="tombol-toggle-panel">
                <span>📊 Tren & Analisis (7 hari terakhir)</span>
                <span style={{ transform: ringkasanTerbuka ? "rotate(180deg)" : "none", display: "inline-block", transition: "transform 0.15s ease" }}>▾</span>
              </button>

              {ringkasanTerbuka && (
                <div style={styles.panelRingkasan}>
                  {loadingRingkasan && <p style={styles.kosong}>Memuat…</p>}

                  {!loadingRingkasan && ringkasan && (
                    <div style={styles.ringkasanGrid} className="ringkasan-grid">
                      <div style={styles.ringkasanKotak}>
                        <p style={styles.ringkasanJudul}>Tren Kehadiran</p>
                        <div style={styles.chartBarGroup}>
                          {ringkasan.tren7Hari.map((h) => {
                            const total = h.tepatWaktu + h.telat + h.alpha + h.izinDll;
                            const tinggiMax = 56;
                            return (
                              <div key={h.tanggal} style={styles.chartKolom}>
                                <div style={styles.chartBatangWrapper}>
                                  {total === 0 ? (
                                    <div style={styles.chartBatangKosong} />
                                  ) : (
                                    <>
                                      {h.tepatWaktu > 0 && <div style={{ ...styles.chartSegmen, height: (h.tepatWaktu / total) * tinggiMax, background: warna.sukses }} title={`Tepat waktu: ${h.tepatWaktu}`} />}
                                      {h.telat > 0 && <div style={{ ...styles.chartSegmen, height: (h.telat / total) * tinggiMax, background: warna.peringatan }} title={`Telat: ${h.telat}`} />}
                                      {h.izinDll > 0 && <div style={{ ...styles.chartSegmen, height: (h.izinDll / total) * tinggiMax, background: warna.aksen }} title={`Izin/Sakit/Cuti: ${h.izinDll}`} />}
                                      {h.alpha > 0 && <div style={{ ...styles.chartSegmen, height: (h.alpha / total) * tinggiMax, background: warna.bahaya }} title={`Alpha: ${h.alpha}`} />}
                                    </>
                                  )}
                                </div>
                                <span style={styles.chartLabelHari}>{namaHariSingkat(h.tanggal)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div style={styles.ringkasanKotak}>
                        <p style={styles.ringkasanJudul}>Perlu Perhatian (30 hari)</p>
                        {ringkasan.sorotanKaryawan.length === 0 && (
                          <p style={styles.kosong}>Tidak ada yang perlu disorot. 👍</p>
                        )}
                        {ringkasan.sorotanKaryawan.map((k) => (
                          <div key={k.id} style={styles.sorotanBaris}>
                            <span style={styles.sorotanNama}>{k.nama}</span>
                            <span style={styles.sorotanAngka}>
                              {k.telat > 0 && <span style={{ color: warna.peringatan }}>{k.telat}× telat</span>}
                              {k.telat > 0 && k.alpha > 0 && <span style={{ margin: "0 4px" }}>·</span>}
                              {k.alpha > 0 && <span style={{ color: warna.bahaya }}>{k.alpha}× alpha</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {rekap.length > 0 && (
                <input
                  type="text"
                  value={cariRekap}
                  onChange={(e) => setCariRekap(e.target.value)}
                  placeholder="Cari nama, jabatan, atau divisi…"
                  style={styles.kotakCari}
                  className="input-fokus"
                />
              )}

              <p style={styles.hintGeser} className="hint-geser">👉 Geser tabel ke kanan untuk lihat jam pulang & lokasi</p>
              <div style={styles.tabelWrapperLuar}>
                <div style={styles.tabelWrapper} className="tabel-scroll" onScroll={(e) => cekUjungScroll(e, setRekapDiUjung)}>
                  <table style={styles.tabel}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.thSticky }}>Karyawan</th>
                        <th style={styles.th}>Foto</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}>Masuk</th>
                        <th style={styles.th}>Pulang</th>
                        <th style={styles.th}>Lokasi</th>
                        <th style={styles.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && <SkeletonBaris jumlah={4} />}

                      {!loading && rekap.length === 0 && (
                        <tr><td colSpan={7} style={styles.tdKosong}>📋 Belum ada karyawan yang absen hari ini.</td></tr>
                      )}
                      {!loading && rekap.length > 0 && rekapTersaring.length === 0 && (
                        <tr><td colSpan={7} style={styles.tdKosong}>Tidak ada hasil untuk "{cariRekap}".</td></tr>
                      )}

                      {!loading && rekapTersaring.map((item) => {
                        const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
                        const sedangEdit = editStatusTerbuka === item.id;
                        return (
                          <Fragment key={item.id}>
                            <tr className="baris-hover">
                              <td style={{ ...styles.td, ...styles.tdSticky }}>
                                <strong style={{ color: warna.tinta, fontSize: 13.5 }}>{item.pengguna.nama}</strong>
                                <div style={styles.tdSub}>{item.pengguna.jabatan || "-"} · {item.pengguna.divisi || "-"}</div>
                              </td>
                              <td style={styles.td}>
                                <div style={styles.fotoAbsenRow}>
                                  {item.fotoMasuk && (
                                    <a href={urlFoto(item.fotoMasuk)} target="_blank" rel="noopener noreferrer" title="Lihat foto absen masuk">
                                      <img src={urlFoto(item.fotoMasuk)} alt="Foto absen masuk" style={styles.fotoAbsenThumb} />
                                    </a>
                                  )}
                                  {item.fotoPulang && (
                                    <a href={urlFoto(item.fotoPulang)} target="_blank" rel="noopener noreferrer" title="Lihat foto absen pulang">
                                      <img src={urlFoto(item.fotoPulang)} alt="Foto absen pulang" style={styles.fotoAbsenThumb} />
                                    </a>
                                  )}
                                  {!item.fotoMasuk && !item.fotoPulang && (
                                    <span style={{ fontSize: 11, color: warna.tintaSamar }}>–</span>
                                  )}
                                </div>
                              </td>
                              <td style={styles.td}>
                                <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>{status.teks}</span>
                              </td>
                              <td style={{ ...styles.td, ...styles.mono }}>{formatJam(item.jamMasuk)}</td>
                              <td style={{ ...styles.td, ...styles.mono }}>{formatJam(item.jamPulang)}</td>
                              <td style={{ ...styles.td, fontSize: 12, color: warna.tintaSamar, maxWidth: 200 }}>
                                {item.alamatMasuk || "–"}
                              </td>
                              <td style={{ ...styles.td, textAlign: "right" }}>
                                <button onClick={() => (sedangEdit ? setEditStatusTerbuka(null) : bukaEditStatus(item))} style={styles.tombolEditKecil}>
                                  {sedangEdit ? "Tutup" : "Ubah Status"}
                                </button>
                              </td>
                            </tr>
                            {item.catatanAdmin && !sedangEdit && (
                              <tr>
                                <td colSpan={7} style={{ padding: "0 16px 10px 16px" }}>
                                  <p style={styles.catatanAdmin}>Catatan Admin: {item.catatanAdmin}</p>
                                </td>
                              </tr>
                            )}
                            {sedangEdit && (
                              <tr>
                                <td colSpan={7} style={{ padding: "0 16px 16px 16px", background: warna.panelAlt }}>
                                <div style={styles.formInline}>
                                  <label style={styles.labelForm}>Status baru</label>
                                  <select
                                    value={formEditStatus.statusFinal}
                                    onChange={(e) => setFormEditStatus({ ...formEditStatus, statusFinal: e.target.value })}
                                    style={styles.selectForm}
                                  >
                                    {DAFTAR_STATUS.map((s) => (
                                      <option key={s} value={s}>{labelStatusKehadiran(s).teks}</option>
                                    ))}
                                  </select>
                                  <label style={styles.labelForm}>Catatan (wajib diisi, jadi jejak alasan perubahan)</label>
                                  <textarea
                                    value={formEditStatus.catatanAdmin}
                                    onChange={(e) => setFormEditStatus({ ...formEditStatus, catatanAdmin: e.target.value })}
                                    placeholder="Contoh: Telat karena tugas luar kota, dikonfirmasi lewat WA."
                                    style={styles.textareaForm}
                                  />
                                  <div style={styles.formTombolGroup}>
                                    <button onClick={() => setEditStatusTerbuka(null)} style={styles.tombolBatal}>Batal</button>
                                    <button onClick={() => simpanEditStatus(item.id)} style={styles.tombolAktifkan}>Simpan</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                <div className="tabel-fade-kanan" style={{ ...styles.tabelFade, opacity: rekapDiUjung ? 0 : 1 }} />
              </div>
            </>
          )}

          {tab === "approval" && (
            <>
              {menunggu.length === 0 && (
                <div style={styles.kosongBox}>
                  <span style={styles.kosongIkon}>✅</span>
                  <p style={styles.kosong}>Tidak ada akun yang menunggu konfirmasi.</p>
                </div>
              )}
              <div style={styles.kartuGrid}>
                {menunggu.map((item) => (
                  <div key={item.id} style={styles.itemCard} className="kartu-hover">
                    <strong style={styles.itemNama}>{item.nama}</strong>
                    <p style={styles.itemSub}>{item.email}</p>

                    {formAktivasiTerbuka !== item.id ? (
                      <button onClick={() => bukaFormAktivasi(item.id)} style={styles.tombolAktifkan}>
                        Aktifkan Akun
                      </button>
                    ) : (
                      <div style={styles.formInline}>
                        <label style={styles.labelForm}>Jabatan</label>
                        <input
                          value={formAktivasi.jabatan}
                          onChange={(e) => setFormAktivasi({ ...formAktivasi, jabatan: e.target.value })}
                          placeholder="Contoh: Teknisi"
                          style={styles.inputForm}
                        />
                        <label style={styles.labelForm}>Divisi</label>
                        <input
                          value={formAktivasi.divisi}
                          onChange={(e) => setFormAktivasi({ ...formAktivasi, divisi: e.target.value })}
                          placeholder="Contoh: Operasional"
                          style={styles.inputForm}
                        />
                        {daftarKantorState.length > 0 && (
                          <>
                            <label style={styles.labelForm}>Kantor / Lokasi Kerja</label>
                            <select
                              value={formAktivasi.kantorId}
                              onChange={(e) => setFormAktivasi({ ...formAktivasi, kantorId: e.target.value })}
                              style={styles.inputForm}
                            >
                              {daftarKantorState.map((k) => (
                                <option key={k.id} value={k.id}>{k.namaKantor}</option>
                              ))}
                            </select>
                          </>
                        )}
                        <div style={styles.formTombolGroup}>
                          <button onClick={() => setFormAktivasiTerbuka(null)} style={styles.tombolBatal}>Batal</button>
                          <button onClick={() => kirimAktivasi(item.id)} style={styles.tombolAktifkan}>Simpan & Aktifkan</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {tab === "karyawan" && (
            <>
              {karyawan.length > 0 && (
                <input
                  type="text"
                  value={cariKaryawan}
                  onChange={(e) => setCariKaryawan(e.target.value)}
                  placeholder="Cari nama, email, jabatan, atau divisi…"
                  style={styles.kotakCari}
                  className="input-fokus"
                />
              )}

              <p style={styles.hintGeser} className="hint-geser">👉 Geser tabel ke kanan untuk lihat status</p>
              <div style={styles.tabelWrapperLuar}>
                <div style={styles.tabelWrapper} className="tabel-scroll" onScroll={(e) => cekUjungScroll(e, setKaryawanDiUjung)}>
                  <table style={styles.tabel}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, ...styles.thSticky }}>Nama</th>
                        <th style={styles.th}>Email</th>
                        <th style={styles.th}>Jabatan / Divisi</th>
                        <th style={styles.th}>Status</th>
                        <th style={styles.th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && <SkeletonBaris jumlah={4} />}

                      {!loading && karyawan.length === 0 && (
                        <tr><td colSpan={5} style={styles.tdKosong}>👥 Belum ada karyawan aktif.</td></tr>
                      )}
                      {!loading && karyawan.length > 0 && karyawanTersaring.length === 0 && (
                        <tr><td colSpan={5} style={styles.tdKosong}>Tidak ada hasil untuk "{cariKaryawan}".</td></tr>
                      )}

                      {!loading && karyawanTersaring.map((item) => (
                        <Fragment key={item.id}>
                          <tr className="baris-hover">
                            <td style={{ ...styles.td, ...styles.tdSticky }}><strong style={{ color: warna.tinta, fontSize: 13.5 }}>{item.nama}</strong></td>
                            <td style={{ ...styles.td, color: warna.tintaLembut, fontSize: 12.5 }}>{item.email}</td>
                            <td style={styles.td}>
                              {item.jabatan || "-"} · {item.divisi || "-"}
                              {item.kantor?.namaKantor ? <div style={styles.tdSub}>{item.kantor.namaKantor}</div> : null}
                            </td>
                            <td style={styles.td}>
                              <span
                              style={{
                                ...styles.badge,
                                color: item.statusAkun === "aktif" ? warna.sukses : warna.tintaSamar,
                                background: item.statusAkun === "aktif" ? warna.suksesLembut : warna.panelAlt,
                              }}
                            >
                              {item.statusAkun === "aktif" ? "Aktif" : "Nonaktif"}
                            </span>
                          </td>
                          <td style={{ ...styles.td, textAlign: "right" }}>
                            <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                              <button
                                onClick={() => bukaResetPassword(item.id)}
                                style={styles.tombolEditKecil}
                              >
                                Reset Password
                              </button>
                              {item.statusAkun === "aktif" ? (
                                <button
                                  onClick={() => setKonfirmasiStatusTerbuka(konfirmasiStatusTerbuka === item.id ? null : item.id)}
                                  style={styles.tombolNonaktifkanKecil}
                                >
                                  {konfirmasiStatusTerbuka === item.id ? "Tutup" : "Nonaktifkan"}
                                </button>
                              ) : (
                                <button onClick={() => ubahStatusKaryawan(item.id, "aktif")} style={styles.tombolEditKecil}>
                                  Aktifkan Kembali
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {resetPasswordHasil?.id === item.id && (
                          <tr>
                            <td colSpan={5} style={{ padding: "0 16px 16px 16px", background: warna.panelAlt }}>
                              <div style={styles.hasilResetBox}>
                                <p style={styles.hasilResetTeks}>
                                  Password sementara untuk <strong>{item.nama}</strong>:
                                </p>
                                <div style={styles.hasilResetKode}>{resetPasswordHasil.password}</div>
                                <p style={styles.hasilResetCatatan}>
                                  Sampaikan ini secara manual (WA/telepon) ke karyawan, lalu minta segera diganti lewat menu "Ganti Password".
                                </p>
                                <button onClick={() => setResetPasswordHasil(null)} style={styles.tombolBatal}>Tutup</button>
                              </div>
                            </td>
                          </tr>
                        )}
                        {konfirmasiStatusTerbuka === item.id && (
                          <tr>
                            <td colSpan={5} style={{ padding: "0 16px 16px 16px", background: warna.panelAlt }}>
                              <div style={styles.konfirmasiInline}>
                                <span style={styles.konfirmasiTeks}>Yakin nonaktifkan {item.nama}?</span>
                                <div style={styles.formTombolGroup}>
                                  <button onClick={() => setKonfirmasiStatusTerbuka(null)} style={styles.tombolBatal}>Batal</button>
                                  <button onClick={() => ubahStatusKaryawan(item.id, "nonaktif")} style={styles.tombolNonaktifkan}>Ya, Nonaktifkan</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
                </div>
                <div className="tabel-fade-kanan" style={{ ...styles.tabelFade, opacity: karyawanDiUjung ? 0 : 1 }} />
              </div>
            </>
          )}

          {tab === "izin" && <AdminIzin />}
          {tab === "gaji" && <PengaturanGaji />}

          {tab === "kantor" && (
            <>
              <div style={styles.kartuFormKantor}>
                <p style={styles.judulFormKantor}>
                  {kantorEditId !== null ? "Edit Kantor" : "Tambah Kantor Baru"}
                </p>
                <div style={styles.formGridKantor}>
                  <div>
                    <label style={styles.labelForm}>Nama Kantor</label>
                    <input
                      value={formKantor.namaKantor}
                      onChange={(e) => setFormKantor({ ...formKantor, namaKantor: e.target.value })}
                      placeholder="Contoh: Kantor Pusat Pekanbaru"
                      style={styles.inputForm}
                    />
                  </div>
                  <div>
                    <label style={styles.labelForm}>Alamat</label>
                    <input
                      value={formKantor.alamat}
                      onChange={(e) => setFormKantor({ ...formKantor, alamat: e.target.value })}
                      placeholder="Jl. Contoh No. 1, Pekanbaru"
                      style={styles.inputForm}
                    />
                  </div>
                  <div>
                    <label style={styles.labelForm}>Latitude (opsional)</label>
                    <input
                      value={formKantor.latitude}
                      onChange={(e) => setFormKantor({ ...formKantor, latitude: e.target.value })}
                      placeholder="0.5071"
                      style={styles.inputForm}
                    />
                  </div>
                  <div>
                    <label style={styles.labelForm}>Longitude (opsional)</label>
                    <input
                      value={formKantor.longitude}
                      onChange={(e) => setFormKantor({ ...formKantor, longitude: e.target.value })}
                      placeholder="101.4478"
                      style={styles.inputForm}
                    />
                  </div>
                </div>
                <div style={styles.formTombolGroup}>
                  {kantorEditId !== null && (
                    <button onClick={bukaFormTambahKantor} style={styles.tombolBatal}>Batal Edit</button>
                  )}
                  <button onClick={simpanKantor} style={styles.tombolAktifkan} disabled={sedangSimpanKantor}>
                    {sedangSimpanKantor ? "Menyimpan…" : kantorEditId !== null ? "Simpan Perubahan" : "Tambah Kantor"}
                  </button>
                </div>
              </div>

              <div style={styles.kartuGrid}>
                {daftarKantorState.map((k) => (
                  <div key={k.id} style={styles.itemCard} className="kartu-hover">
                    <strong style={styles.itemNama}>{k.namaKantor}</strong>
                    <p style={styles.itemSub}>{k.alamat || "Alamat belum diisi"}</p>
                    <p style={styles.itemSub}>
                      {k._count?.pengguna ?? 0} karyawan ditempatkan di sini
                    </p>
                    <button onClick={() => bukaFormEditKantor(k)} style={styles.tombolEditKantor}>
                      Edit
                    </button>
                  </div>
                ))}
                {daftarKantorState.length === 0 && (
                  <p style={styles.infoKosong}>Belum ada kantor terdaftar. Tambahkan lewat form di atas.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  // Dulu "minHeight: 100vh" tanpa batas overflow -- akibatnya kalau konten
  // sebuah tab panjang (misal halaman Gaji), SELURUH halaman ikut discroll
  // termasuk sidebar-nya, jadi sidebar kelihatan "ikut kabur" ke atas.
  // Sekarang shell dikunci setinggi layar (height, bukan minHeight) + overflow
  // hidden, supaya sidebar & konten masing-masing scroll sendiri-sendiri --
  // pola "app shell" standar: sidebar diam, cuma konten kanan yang jalan.
  shell: { display: "flex", height: "100svh", overflow: "hidden", background: warna.latar, fontFamily: font.display },

  // ---------- SIDEBAR ----------
  sidebar: {
    width: 232,
    background: warna.panel,
    borderRight: `1px solid ${warna.garis}`,
    display: "flex",
    flexDirection: "column",
    padding: "22px 14px",
    flexShrink: 0,
    overflowY: "auto",
  },
  sidebarAtas: { padding: "0 8px", marginBottom: 26 },
  logoSidebar: { height: 42, display: "block" },
  navSidebar: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: "none",
    border: "none",
    borderRadius: 8,
    fontSize: 13.5,
    color: warna.tintaLembut,
    cursor: "pointer",
    fontWeight: 500,
    textAlign: "left",
  },
  navItemAktif: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    background: warna.aksenLembut,
    border: "none",
    borderRadius: 8,
    fontSize: 13.5,
    color: warna.aksen,
    cursor: "pointer",
    fontWeight: 700,
    textAlign: "left",
  },
  navIkon: { fontSize: 15, width: 18, textAlign: "center" },
  navBadge: {
    background: warna.bahaya,
    color: "#fff",
    fontSize: 10.5,
    fontWeight: 700,
    borderRadius: 20,
    padding: "1px 7px",
  },
  sidebarBawah: { borderTop: `1px solid ${warna.garis}`, paddingTop: 14, marginTop: 10 },
  profilSidebar: { display: "flex", alignItems: "center", gap: 10, padding: "0 8px", marginBottom: 10 },
  avatarLingkaran: {
    width: 36, height: 36, borderRadius: "50%", background: warna.tinta, color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0,
  },
  namaProfil: { margin: 0, fontSize: 13, color: warna.tinta, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  perananProfil: { margin: 0, fontSize: 11, color: warna.tintaSamar },
  // Dua tombol aksi (Ganti Password & Keluar) berdampingan sebagai kartu
  // kecil bertepi, bukan lagi teks polos tanpa bingkai
  aksiSidebarRow: { display: "flex", gap: 6 },
  tombolAksiSidebar: {
    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
    background: warna.panelAlt, border: `1px solid ${warna.garis}`, borderRadius: 8,
    padding: "8px 6px", fontSize: 11.5, fontWeight: 600, color: warna.tintaLembut, cursor: "pointer",
  },
  tombolAksiSidebarBahaya: { color: warna.bahaya },

  // ---------- MAIN AREA ----------
  mainArea: { flex: 1, minWidth: 0, padding: "26px 32px", overflowY: "auto", height: "100%" },
  topbarMobile: {
    display: "none", alignItems: "center", justifyContent: "space-between", marginBottom: 14,
    position: "sticky", top: 0, zIndex: 10, background: warna.latar, padding: "4px 0",
  },
  tombolHamburger: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 8, padding: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36 },
  topbarLogoKecil: { height: 28, objectFit: "contain" },
  topbarJudul: { fontSize: 15, fontWeight: 700, color: warna.tinta },
  headerAtas: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 },
  judulHalaman: { margin: 0, fontSize: 24, fontWeight: 700, color: warna.tinta },
  subJudulHalaman: { margin: "4px 0 0 0", fontSize: 13, color: warna.tintaLembut },
  content: { maxWidth: 1040 },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 },

  // ---------- Panel Tren & Analisis (collapsible) ----------
  tombolTogglePanel: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
    background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 10,
    padding: "12px 16px", fontSize: 13, fontWeight: 600, color: warna.tinta, cursor: "pointer",
    marginBottom: 12,
  },
  panelRingkasan: { marginBottom: 18 },
  ringkasanGrid: { display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 },
  ringkasanKotak: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 10, padding: "14px 16px" },
  ringkasanJudul: { fontSize: 12.5, fontWeight: 600, color: warna.tintaLembut, margin: "0 0 12px 0" },
  chartBarGroup: { display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 6, height: 76 },
  chartKolom: { display: "flex", flexDirection: "column", alignItems: "center", gap: 5, flex: 1 },
  chartBatangWrapper: { display: "flex", flexDirection: "column-reverse", alignItems: "center", width: "100%", maxWidth: 26 },
  chartSegmen: { width: "100%", borderRadius: 2 },
  chartBatangKosong: { width: "100%", height: 3, borderRadius: 2, background: warna.panelAlt },
  chartLabelHari: { fontSize: 10.5, color: warna.tintaSamar },
  sorotanBaris: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${warna.garis}`, fontSize: 12.5 },
  sorotanNama: { color: warna.tinta },
  sorotanAngka: { fontSize: 11.5, color: warna.tintaLembut, fontWeight: 600, fontFamily: font.mono },
  statCard: {
    background: warna.panel, borderRadius: 10, padding: "16px 18px", border: `1px solid ${warna.garis}`,
    borderLeft: `3px solid ${warna.tinta}`, display: "flex", flexDirection: "column", gap: 4,
  },
  statAngka: { fontSize: 26, fontWeight: 700, color: warna.tinta, fontFamily: font.mono, lineHeight: 1 },
  statLabel: { fontSize: 12, color: warna.tintaLembut, fontWeight: 500 },

  kotakCari: {
    width: "100%", maxWidth: 360, padding: "10px 14px", marginBottom: 14, borderRadius: 10,
    border: `1px solid ${warna.garis}`, fontSize: 13.5, color: warna.tinta, background: warna.panel,
    boxSizing: "border-box", fontFamily: font.display,
  },

  // ---------- TABEL ----------
  // Wrapper diberi position:relative supaya bisa ditumpuki gradient fade
  // (lihat "tabelFade") sebagai penanda "masih ada kolom di sebelah kanan, geser dong"
  tabelWrapperLuar: { position: "relative" },
  tabelWrapper: {
    background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 12,
    overflow: "auto", maxWidth: "100%", WebkitOverflowScrolling: "touch",
  },
  // Gradient tipis di tepi kanan tabel, HANYA terlihat kalau tabelnya memang
  // lebih lebar dari kontainer (lihat className "tabel-fade" + CSS di index.css)
  tabelFade: {
    position: "absolute", top: 0, right: 0, bottom: 0, width: 28,
    background: `linear-gradient(to right, transparent, ${warna.panel})`,
    pointerEvents: "none", borderRadius: "0 12px 12px 0",
  },
  tabel: { width: "100%", borderCollapse: "collapse", minWidth: 640 },
  th: {
    textAlign: "left", fontSize: 11, fontWeight: 700, color: warna.tintaSamar, textTransform: "uppercase",
    letterSpacing: "0.04em", padding: "12px 16px", borderBottom: `1px solid ${warna.garis}`, background: warna.panelAlt,
  },
  // Kolom pertama (nama karyawan) dibuat "lengket" ke kiri saat tabel digeser
  // ke samping di HP, supaya orang tetap tahu baris ini punya siapa
  thSticky: { position: "sticky", left: 0, zIndex: 1 },
  td: { padding: "13px 16px", borderBottom: `1px solid ${warna.garis}`, fontSize: 13, color: warna.tinta, verticalAlign: "top" },
  tdSticky: { position: "sticky", left: 0, background: warna.panel, zIndex: 1, boxShadow: `1px 0 0 ${warna.garis}` },
  tdSub: { fontSize: 11.5, color: warna.tintaLembut, marginTop: 2 },
  tdKosong: { textAlign: "center", padding: "40px 16px", color: warna.tintaSamar, fontSize: 13.5 },
  mono: { fontFamily: font.mono, fontWeight: 600 },
  hintGeser: {
    alignItems: "center", gap: 6, fontSize: 11.5, color: warna.tintaSamar,
    margin: "0 0 8px 2px",
  },

  badge: { fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 10, whiteSpace: "nowrap" },

  // ---------- KARTU (dipakai buat tab Menunggu) ----------
  kartuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 10 },
  itemCard: {
    background: warna.panel, borderRadius: 10, padding: 16, border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
  },
  itemNama: { fontSize: 14.5, color: warna.tinta },
  itemSub: { fontSize: 12.5, color: warna.tintaLembut, margin: "3px 0 12px 0" },

  kosongBox: { textAlign: "center", padding: "48px 24px", background: warna.panel, borderRadius: 10, border: `1px dashed ${warna.garis}` },
  kosongIkon: { fontSize: 28, display: "block", marginBottom: 8, opacity: 0.7 },
  kosong: { textAlign: "center", color: warna.tintaSamar, fontSize: 13.5, margin: 0 },

  pesanError: { color: warna.bahaya, marginBottom: 12, fontSize: 13.5 },
  pesanSukses: { color: warna.sukses, marginBottom: 12, fontSize: 13.5 },

  catatanAdmin: {
    fontSize: 11.5, color: warna.tintaLembut, background: "#fff", borderLeft: `3px solid ${warna.aksen}`,
    padding: "8px 10px", borderRadius: 8, margin: 0,
  },
  tombolEditKecil: {
    padding: "7px 12px", background: "none", color: warna.tinta, border: `1px solid ${warna.garis}`,
    borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
  },
  formInline: { paddingTop: 12, display: "flex", flexDirection: "column", gap: 4, maxWidth: 420 },
  labelForm: { fontSize: 11, color: warna.tintaLembut, fontWeight: 600, marginTop: 6 },
  inputForm: { padding: "8px 10px", border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 13, color: warna.tinta, fontFamily: font.display },
  selectForm: { padding: "8px 10px", border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 13, color: warna.tinta, fontFamily: font.display, background: "#fff" },
  textareaForm: { padding: "8px 10px", border: `1px solid ${warna.garis}`, borderRadius: 8, fontSize: 13, color: warna.tinta, fontFamily: font.display, minHeight: 56, resize: "vertical" },
  formTombolGroup: { display: "flex", gap: 8, marginTop: 8 },
  tombolBatal: {
    flex: 1, padding: "9px 14px", background: "none", color: warna.tintaLembut, border: `1px solid ${warna.garis}`,
    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
  },
  konfirmasiInline: { paddingTop: 12 },
  konfirmasiTeks: { fontSize: 12.5, color: warna.tinta, fontWeight: 500 },
  hasilResetBox: { paddingTop: 12, maxWidth: 420 },
  hasilResetTeks: { fontSize: 12.5, color: warna.tinta, margin: "0 0 8px 0" },
  hasilResetKode: {
    fontFamily: font.mono, fontSize: 18, fontWeight: 700, letterSpacing: "0.06em", color: warna.aksen,
    background: "#fff", border: `1.5px dashed ${warna.aksen}`, borderRadius: 8, padding: "10px 14px",
    textAlign: "center", marginBottom: 8, userSelect: "all",
  },
  hasilResetCatatan: { fontSize: 11.5, color: warna.tintaLembut, margin: "0 0 10px 0", lineHeight: 1.5 },
  tombolAktifkan: {
    padding: "9px 16px", background: warna.aksen, color: "#fff", border: "none", borderRadius: 8,
    fontSize: 12.5, cursor: "pointer", fontWeight: 600,
  },
  tombolNonaktifkan: {
    padding: "9px 16px", background: "#fff", color: warna.bahaya, border: `1px solid ${warna.bahaya}`,
    borderRadius: 8, fontSize: 12.5, cursor: "pointer", fontWeight: 600,
  },
  tombolNonaktifkanKecil: {
    padding: "7px 12px", background: "none", color: warna.bahaya, border: `1px solid ${warna.bahaya}`,
    borderRadius: 8, fontSize: 11.5, cursor: "pointer", fontWeight: 600, whiteSpace: "nowrap",
  },

  kartuFormKantor: {
    background: warna.panel, borderRadius: 10, padding: 20, border: `1px solid ${warna.garis}`, marginBottom: 16,
  },
  judulFormKantor: { fontSize: 14.5, fontWeight: 700, color: warna.tinta, margin: "0 0 4px 0" },
  formGridKantor: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginTop: 4 },
  tombolEditKantor: {
    padding: "7px 14px", background: "none", color: warna.tinta, border: `1px solid ${warna.garis}`,
    borderRadius: 8, fontSize: 12, cursor: "pointer", fontWeight: 600,
  },
  infoKosong: { color: warna.tintaSamar, fontSize: 13.5, gridColumn: "1 / -1" },

  fotoAbsenRow: { display: "flex", gap: 8, marginTop: 10 },
  fotoAbsenThumb: {
    width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: `1px solid ${warna.garis}`, cursor: "pointer",
  },
  fotoAbsenLabel: { fontSize: 10, color: warna.tintaSamar, textAlign: "center", marginTop: 3 },
};
