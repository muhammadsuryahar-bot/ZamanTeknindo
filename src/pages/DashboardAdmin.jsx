import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logoWhite from "../assets/logo-white.png";
import AdminIzin from "./AdminIzin";
import PengaturanGaji from "./PengaturanGaji";
import { labelStatusKehadiran } from "../utils/statusKehadiran";

const DAFTAR_STATUS = ["tepat_waktu", "telat", "alpha", "izin", "sakit", "cuti", "urgent"];

export default function DashboardAdmin({ pengguna, onLogout }) {
  const [tab, setTab] = useState("rekap");
  const [rekap, setRekap] = useState([]);
  const [menunggu, setMenunggu] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");

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
        <div>
          <img src={logoHorizontal} alt="PT. Zaman Teknindo" style={styles.logoHeader} />
          <div style={styles.namaRow}>
            <img src={logoWhite} alt="" style={styles.avatarBadge} />
            <h2 style={styles.namaUser}>Dashboard</h2>
          </div>
          <p style={styles.subNamaUser}>{pengguna.nama}</p>
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
        {loading && <p style={styles.kosong}>Memuat data…</p>}
        {pesan && <p style={styles.pesanError}>{pesan}</p>}
        {pesanSukses && <p style={styles.pesanSukses}>{pesanSukses}</p>}

        {!loading && tab === "rekap" && (
          <>
            {rekap.length === 0 && <p style={styles.kosong}>Belum ada karyawan yang absen hari ini.</p>}
            {rekap.map((item) => {
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
            {menunggu.length === 0 && <p style={styles.kosong}>Tidak ada akun yang menunggu konfirmasi.</p>}
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
            {karyawan.length === 0 && <p style={styles.kosong}>Belum ada karyawan aktif.</p>}
            {karyawan.map((item) => (
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
  wrapper: { minHeight: "100vh", background: warna.latar, fontFamily: font.display, padding: 16 },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
    maxWidth: 600,
    margin: "0 auto 18px auto",
  },
  logoHeader: { height: 52, marginBottom: 12, display: "block" },
  namaRow: { display: "flex", alignItems: "center", gap: 8 },
  avatarBadge: { width: 28, height: 28, borderRadius: 6, display: "block" },
  namaUser: { margin: 0, fontSize: 19, color: warna.tinta, fontWeight: 700 },
  subNamaUser: { margin: "2px 0 0 0", fontSize: 13, color: warna.tintaLembut },
  tombolLogout: {
    background: "none",
    border: `1px solid ${warna.garis}`,
    borderRadius: 3,
    padding: "8px 14px",
    fontSize: 12.5,
    cursor: "pointer",
    color: warna.tintaLembut,
  },
  tabGroup: { display: "flex", gap: 6, maxWidth: 600, margin: "0 auto 16px auto", flexWrap: "wrap" },
  tab: {
    flex: 1,
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
    flex: 1,
    padding: "10px 6px",
    background: warna.tinta,
    border: `1px solid ${warna.tinta}`,
    borderRadius: 3,
    fontSize: 12.5,
    cursor: "pointer",
    color: "#fff",
    fontWeight: 600,
  },
  content: { maxWidth: 600, margin: "0 auto" },
  itemCard: {
    background: warna.panel,
    borderRadius: 3,
    padding: 16,
    marginBottom: 8,
    border: `1px solid ${warna.garis}`,
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
  kosong: { textAlign: "center", color: warna.tintaSamar, padding: 24, fontSize: 13.5 },
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
