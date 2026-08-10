import { useState, useEffect, Fragment } from "react";
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

  // Sidebar mobile (dibuka lewat hamburger di topbar kecil)
  const [sidebarMobileTerbuka, setSidebarMobileTerbuka] = useState(false);

  // Penanda "tabel sudah digeser sampai ujung kanan" (khusus HP) — kalau
  // sudah di ujung, gradient fade di tepi kanan disembunyikan karena tidak
  // ada lagi yang perlu diisyaratkan ke pengguna
  const [rekapDiUjung, setRekapDiUjung] = useState(false);
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
          <button onClick={onLogout} style={styles.tombolLogout}>Keluar</button>
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
                        <tr><td colSpan={6} style={styles.tdKosong}>📋 Belum ada karyawan yang absen hari ini.</td></tr>
                      )}
                      {!loading && rekap.length > 0 && rekapTersaring.length === 0 && (
                        <tr><td colSpan={6} style={styles.tdKosong}>Tidak ada hasil untuk "{cariRekap}".</td></tr>
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
                                <td colSpan={6} style={{ padding: "0 16px 10px 16px" }}>
                                  <p style={styles.catatanAdmin}>Catatan Admin: {item.catatanAdmin}</p>
                                </td>
                              </tr>
                            )}
                            {sedangEdit && (
                              <tr>
                                <td colSpan={6} style={{ padding: "0 16px 16px 16px", background: warna.panelAlt }}>
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
                          </td>
                        </tr>
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
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: { display: "flex", minHeight: "100vh", background: warna.latar, fontFamily: font.display },

  // ---------- SIDEBAR ----------
  sidebar: {
    width: 232,
    background: warna.panel,
    borderRight: `1px solid ${warna.garis}`,
    display: "flex",
    flexDirection: "column",
    padding: "22px 14px",
    flexShrink: 0,
  },
  sidebarAtas: { padding: "0 8px", marginBottom: 26 },
  logoSidebar: { height: 30, display: "block" },
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
  tombolLogout: {
    width: "100%", background: "none", border: `1px solid ${warna.garis}`, borderRadius: 8,
    padding: "9px 12px", fontSize: 12.5, cursor: "pointer", color: warna.tintaLembut, fontWeight: 600,
  },

  // ---------- MAIN AREA ----------
  mainArea: { flex: 1, minWidth: 0, padding: "26px 32px" },
  topbarMobile: { display: "none", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  tombolHamburger: { background: warna.panel, border: `1px solid ${warna.garis}`, borderRadius: 8, padding: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36 },
  topbarLogoKecil: { height: 20, objectFit: "contain" },
  topbarJudul: { fontSize: 15, fontWeight: 700, color: warna.tinta },
  headerAtas: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22 },
  judulHalaman: { margin: 0, fontSize: 24, fontWeight: 700, color: warna.tinta },
  subJudulHalaman: { margin: "4px 0 0 0", fontSize: 13, color: warna.tintaLembut },
  content: { maxWidth: 1040 },

  statGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 },
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
};
