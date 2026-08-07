import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import AdminIzin from "./AdminIzin";
import PengaturanGaji from "./PengaturanGaji";
import { labelStatusKehadiran } from "../utils/statusKehadiran";

const DAFTAR_STATUS = ["tepat_waktu", "telat", "alpha", "izin", "sakit", "cuti", "urgent"];

// Kartu abu-abu berkedip pelan, dipakai sebagai placeholder saat data masih dimuat
function SkeletonKartu({ jumlah = 3 }) {
  return (
    <>
      {Array.from({ length: jumlah }).map((_, i) => (
        <div key={i} className="skeleton-pulse" style={styles.skeletonCard}>
          <div style={{ ...styles.skeletonBar, width: "40%", height: 14 }} />
          <div style={{ ...styles.skeletonBar, width: "60%", height: 11, marginTop: 8 }} />
          <div style={{ ...styles.skeletonBar, width: "30%", height: 11, marginTop: 6 }} />
        </div>
      ))}
    </>
  );
}

export default function DashboardAdmin({ pengguna, onLogout }) {
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
  const [formAktivasi, setFormAktivasi] = useState({ jabatan: "", divisi: "" });

  // Konfirmasi ubah status karyawan yang lagi dibuka (ganti confirm() bawaan browser)
  const [konfirmasiStatusTerbuka, setKonfirmasiStatusTerbuka] = useState(null); // id karyawan atau null

  // Form edit status kehadiran manual yang lagi dibuka
  const [editStatusTerbuka, setEditStatusTerbuka] = useState(null); // id absensi atau null
  const [formEditStatus, setFormEditStatus] = useState({ statusFinal: "", catatanAdmin: "" });

  useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function muatData() {
    setLoading(true);
    try {
      const [resRekap, resMenunggu, resKaryawan] = await Promise.all([
        fetch(`${API_URL}/admin/rekap-hari-ini`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/akun-menunggu`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/karyawan`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const dataRekap = await resRekap.json();
      const dataMenunggu = await resMenunggu.json();
      const dataKaryawan = await resKaryawan.json();
      setRekap(dataRekap.data || []);
      setMenunggu(dataMenunggu.data || []);
      setKaryawan(dataKaryawan.data || []);
    } catch (err) {
      setPesan("Gagal memuat data. Cek koneksi ke server.");
    } finally {
      setLoading(false);
    }
  }

  // Buka/tutup form aktivasi inline untuk 1 item, kosongkan isiannya tiap dibuka
  function bukaFormAktivasi(id) {
    setFormAktivasiTerbuka(id);
    setFormAktivasi({ jabatan: "", divisi: "" });
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

  // Buka form edit status absensi, isi awal dengan status yang sekarang berlaku
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

  function formatJam(tanggalIso) {
    if (!tanggalIso) return "–";
    return new Date(tanggalIso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  }

  // Filter sederhana: cocok kalau kata kunci ditemukan di nama, jabatan, atau divisi
  // (tidak peduli huruf besar/kecil)
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

  // Ringkasan angka hari ini, buat kartu statistik di atas tab Rekap —
  // supaya Bos langsung tahu kondisi hari ini tanpa perlu scroll/baca satu-satu
  const karyawanAktifCount = karyawan.filter((k) => k.statusAkun === "aktif").length;
  const jumlahTepatWaktu = rekap.filter((r) => (r.statusFinal || r.statusOtomatis) === "tepat_waktu").length;
  const jumlahTelat = rekap.filter((r) => (r.statusFinal || r.statusOtomatis) === "telat").length;
  const jumlahIzinSakitDll = rekap.filter((r) =>
    ["izin", "sakit", "cuti", "urgent"].includes(r.statusFinal || r.statusOtomatis)
  ).length;
  const jumlahBelumAbsen = Math.max(karyawanAktifCount - rekap.length, 0);

  const jamSekarang = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Inisial 1-2 huruf dari nama, buat avatar bulat di header
  function inisialNama(nama) {
    if (!nama) return "?";
    const bagian = nama.trim().split(" ");
    if (bagian.length === 1) return bagian[0].slice(0, 2).toUpperCase();
    return (bagian[0][0] + bagian[bagian.length - 1][0]).toUpperCase();
  }

  const tabs = [
    { id: "rekap", label: "Rekap Hari Ini" },
    { id: "approval", label: `Menunggu${menunggu.length > 0 ? ` (${menunggu.length})` : ""}` },
    { id: "karyawan", label: "Karyawan" },
    { id: "izin", label: "Izin" },
    { id: "gaji", label: "Gaji" },
  ];

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div style={styles.headerKiri}>
          <img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logoHeader} />
          <div style={styles.namaRow}>
            <div style={styles.avatarLingkaran}>{inisialNama(pengguna.nama)}</div>
            <div>
              <h2 style={styles.namaUser}>Halo, {pengguna.nama.split(" ")[0]}</h2>
              <p style={styles.subNamaUser}>{jamSekarang}</p>
            </div>
          </div>
        </div>
        <button onClick={onLogout} style={styles.tombolLogout}>Keluar</button>
      </div>

      <div style={styles.tabGroup}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={tab === t.id ? styles.tabAktif : styles.tab}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {loading && <SkeletonKartu jumlah={3} />}
        {pesan && <p style={styles.pesanError}>{pesan}</p>}
        {pesanSukses && <p style={styles.pesanSukses}>{pesanSukses}</p>}

        {!loading && tab === "rekap" && (
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

            {rekap.length > 0 && (
              <input
                type="text"
                value={cariRekap}
                onChange={(e) => setCariRekap(e.target.value)}
                placeholder="Cari nama, jabatan, atau divisi…"
                style={styles.kotakCari}
              />
            )}
            {rekap.length === 0 && (
              <div style={styles.kosongBox}>
                <span style={styles.kosongIkon}>📋</span>
                <p style={styles.kosong}>Belum ada karyawan yang absen hari ini.</p>
              </div>
            )}
            {rekap.length > 0 && rekapTersaring.length === 0 && (
              <p style={styles.kosong}>Tidak ada hasil untuk "{cariRekap}".</p>
            )}
            {rekapTersaring.map((item) => {
              const status = labelStatusKehadiran(item.statusFinal || item.statusOtomatis);
              const sedangEdit = editStatusTerbuka === item.id;
              return (
                <div key={item.id} style={styles.itemCard}>
                  <div style={styles.itemHeader}>

                    <strong style={styles.itemNama}>{item.pengguna.nama}</strong>
                    <span style={{ ...styles.badge, color: status.warna, background: status.latar }}>
                      {status.teks}
                    </span>
                  </div>
                  <p style={styles.itemSub}>
                    {item.pengguna.jabatan || "-"} · {item.pengguna.divisi || "-"}
                  </p>
                  <p style={styles.itemDetail}>
                    Masuk <span style={styles.mono}>{formatJam(item.jamMasuk)}</span>
                    <span style={styles.pemisah}>·</span>
                    Pulang <span style={styles.mono}>{formatJam(item.jamPulang)}</span>
                  </p>
                  {item.alamatMasuk && <p style={styles.itemAlamat}>{item.alamatMasuk}</p>}
                  {item.catatanAdmin && !sedangEdit && (
                    <p style={styles.catatanAdmin}>Catatan Admin: {item.catatanAdmin}</p>
                  )}

                  {!sedangEdit ? (
                    <button onClick={() => bukaEditStatus(item)} style={styles.tombolEditKecil}>
                      Ubah Status Manual
                    </button>
                  ) : (
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
                  )}
                </div>
              );
            })}
          </>
        )}

        {!loading && tab === "approval" && (
          <>
            {menunggu.length === 0 && (
              <div style={styles.kosongBox}>
                <span style={styles.kosongIkon}>✅</span>
                <p style={styles.kosong}>Tidak ada akun yang menunggu konfirmasi.</p>
              </div>
            )}
            {menunggu.map((item) => (
              <div key={item.id} style={styles.itemCard}>
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
                    <div style={styles.formTombolGroup}>
                      <button onClick={() => setFormAktivasiTerbuka(null)} style={styles.tombolBatal}>Batal</button>
                      <button onClick={() => kirimAktivasi(item.id)} style={styles.tombolAktifkan}>Simpan & Aktifkan</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {!loading && tab === "karyawan" && (
          <>
            {karyawan.length > 0 && (
              <input
                type="text"
                value={cariKaryawan}
                onChange={(e) => setCariKaryawan(e.target.value)}
                placeholder="Cari nama, email, jabatan, atau divisi…"
                style={styles.kotakCari}
              />
            )}
            {karyawan.length === 0 && (
              <div style={styles.kosongBox}>
                <span style={styles.kosongIkon}>👥</span>
                <p style={styles.kosong}>Belum ada karyawan aktif.</p>
              </div>
            )}
            {karyawan.length > 0 && karyawanTersaring.length === 0 && (
              <p style={styles.kosong}>Tidak ada hasil untuk "{cariKaryawan}".</p>
            )}
            {karyawanTersaring.map((item) => (
              <div key={item.id} style={styles.itemCard}>
                <div style={styles.itemHeader}>
                  <strong style={styles.itemNama}>{item.nama}</strong>
                  <span
                    style={{
                      ...styles.badge,
                      color: item.statusAkun === "aktif" ? warna.sukses : warna.tintaSamar,
                      background: item.statusAkun === "aktif" ? warna.suksesLembut : warna.panelAlt,
                    }}
                  >
                    {item.statusAkun === "aktif" ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p style={styles.itemSub}>{item.email}</p>
                <p style={styles.itemDetail}>
                  {item.jabatan || "-"} · {item.divisi || "-"}
                  {item.kantor?.namaKantor ? ` · ${item.kantor.namaKantor}` : ""}
                </p>
                {item.statusAkun === "aktif" ? (
                  konfirmasiStatusTerbuka === item.id ? (
                    <div style={styles.konfirmasiInline}>
                      <span style={styles.konfirmasiTeks}>Yakin nonaktifkan {item.nama}?</span>
                      <div style={styles.formTombolGroup}>
                        <button onClick={() => setKonfirmasiStatusTerbuka(null)} style={styles.tombolBatal}>Batal</button>
                        <button onClick={() => ubahStatusKaryawan(item.id, "nonaktif")} style={styles.tombolNonaktifkan}>Ya, Nonaktifkan</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setKonfirmasiStatusTerbuka(item.id)} style={styles.tombolNonaktifkan}>
                      Nonaktifkan
                    </button>
                  )
                ) : (
                  <button onClick={() => ubahStatusKaryawan(item.id, "aktif")} style={styles.tombolAktifkan}>
                    Aktifkan Kembali
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {tab === "izin" && <AdminIzin />}

        {tab === "gaji" && <PengaturanGaji />}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: "100vh", background: warna.latar, fontFamily: font.display, padding: "24px 16px" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 22,
    maxWidth: 920,
    margin: "0 auto 22px auto",
  },
  headerKiri: { flex: 1 },
  logoHeader: { height: 40, marginBottom: 16, display: "block" },
  namaRow: { display: "flex", alignItems: "center", gap: 12 },
  avatarLingkaran: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: warna.tinta,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: "0.02em",
    flexShrink: 0,
  },
  avatarBadge: { width: 28, height: 28, borderRadius: 6, display: "block" },
  namaUser: { margin: 0, fontSize: 20, color: warna.tinta, fontWeight: 700 },
  subNamaUser: { margin: "2px 0 0 0", fontSize: 13, color: warna.tintaLembut },
  tombolLogout: {
    background: "none",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    padding: "9px 16px",
    fontSize: 12.5,
    cursor: "pointer",
    color: warna.tintaLembut,
    flexShrink: 0,
  },
  tabGroup: { display: "flex", gap: 6, maxWidth: 920, margin: "0 auto 20px auto", flexWrap: "wrap" },
  tab: {
    flex: "1 1 auto",
    minWidth: 110,
    padding: "10px 6px",
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    color: warna.tintaLembut,
    fontWeight: 500,
  },
  tabAktif: {
    flex: "1 1 auto",
    minWidth: 110,
    padding: "10px 6px",
    background: warna.tinta,
    border: `1px solid ${warna.tinta}`,
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    color: "#fff",
    fontWeight: 600,
  },
  content: { maxWidth: 920, margin: "0 auto" },
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
    marginBottom: 18,
  },
  statCard: {
    background: warna.panel,
    borderRadius: 4,
    padding: "16px 18px",
    border: `1px solid ${warna.garis}`,
    borderLeft: `3px solid ${warna.tinta}`,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statAngka: { fontSize: 26, fontWeight: 700, color: warna.tinta, fontFamily: font.mono, lineHeight: 1 },
  statLabel: { fontSize: 12, color: warna.tintaLembut, fontWeight: 500 },
  kotakCari: {
    width: "100%",
    padding: "10px 14px",
    marginBottom: 12,
    borderRadius: 3,
    border: `1px solid ${warna.garis}`,
    fontSize: 13.5,
    color: warna.tinta,
    background: warna.panel,
    boxSizing: "border-box",
    fontFamily: font.display,
  },
  itemCard: {
    background: warna.panel,
    borderRadius: 3,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  itemHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  itemNama: { fontSize: 14.5, color: warna.tinta },
  itemSub: { fontSize: 12.5, color: warna.tintaLembut, margin: "3px 0" },
  itemDetail: { fontSize: 12.5, color: warna.tinta, margin: "6px 0 2px 0" },
  itemAlamat: { fontSize: 11.5, color: warna.tintaSamar, margin: "3px 0 0 0" },
  mono: { fontFamily: font.mono, fontWeight: 600 },
  pemisah: { margin: "0 8px", color: warna.garis },
  badge: {
    fontSize: 11,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 3,
  },
  kosongBox: {
    textAlign: "center",
    padding: "48px 24px",
    background: warna.panel,
    borderRadius: 4,
    border: `1px dashed ${warna.garis}`,
  },
  kosongIkon: { fontSize: 28, display: "block", marginBottom: 8, opacity: 0.7 },
  kosong: { textAlign: "center", color: warna.tintaSamar, fontSize: 13.5, margin: 0 },
  skeletonCard: {
    background: warna.panel,
    borderRadius: 3,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
  },
  skeletonBar: {
    background: warna.panelAlt,
    borderRadius: 3,
  },
  pesanError: { color: warna.bahaya, textAlign: "center" },
  pesanSukses: { color: warna.sukses, textAlign: "center" },
  catatanAdmin: {
    fontSize: 11.5,
    color: warna.tintaLembut,
    background: warna.panelAlt,
    borderLeft: `3px solid ${warna.aksen}`,
    padding: "8px 10px",
    borderRadius: 2,
    margin: "8px 0 0 0",
  },
  tombolEditKecil: {
    marginTop: 10,
    padding: "6px 12px",
    background: "none",
    color: warna.tintaLembut,
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 11.5,
    cursor: "pointer",
    fontWeight: 500,
  },
  formInline: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${warna.garis}`,
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  labelForm: { fontSize: 11, color: warna.tintaLembut, fontWeight: 600, marginTop: 6 },
  inputForm: {
    padding: "8px 10px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 13,
    color: warna.tinta,
    fontFamily: font.display,
  },
  selectForm: {
    padding: "8px 10px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 13,
    color: warna.tinta,
    fontFamily: font.display,
    background: "#fff",
  },
  textareaForm: {
    padding: "8px 10px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 13,
    color: warna.tinta,
    fontFamily: font.display,
    minHeight: 56,
    resize: "vertical",
  },
  formTombolGroup: { display: "flex", gap: 8, marginTop: 8 },
  tombolBatal: {
    flex: 1,
    padding: "9px 14px",
    background: "none",
    color: warna.tintaLembut,
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    fontWeight: 600,
  },
  konfirmasiInline: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: `1px solid ${warna.garis}`,
  },
  konfirmasiTeks: { fontSize: 12.5, color: warna.tinta, fontWeight: 500 },
  tombolAktifkan: {
    marginTop: 10,
    padding: "8px 16px",
    background: warna.tinta,
    color: "#fff",
    border: "none",
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    fontWeight: 600,
  },
  tombolNonaktifkan: {
    marginTop: 10,
    padding: "8px 16px",
    background: "#fff",
    color: warna.bahaya,
    border: `1px solid ${warna.bahaya}`,
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    fontWeight: 600,
  },
};
