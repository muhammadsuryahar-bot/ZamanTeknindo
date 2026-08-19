import { useEffect, useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { Wallet, AlertTriangle, Download, ArrowRight, Info, CheckCircle2 } from "lucide-react";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function hanyaDigit(teks) {
  return String(teks).replace(/\D/g, "");
}

function formatRibuan(teks) {
  const digit = hanyaDigit(teks);
  if (!digit) return "";
  return Number(digit).toLocaleString("id-ID");
}

export default function PengaturanGaji() {
  const sekarang = new Date();

  const [potongan, setPotongan] = useState({
    potonganTelat: "",
    potonganAlpha: "",
    jamMasukStandar: "08:00:00",
  });
  const [daftarGaji, setDaftarGaji] = useState([]);
  const [inputGaji, setInputGaji] = useState({});
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");

  const [tahunPilih, setTahunPilih] = useState(sekarang.getFullYear());
  const [bulanPilih, setBulanPilih] = useState(sekarang.getMonth() + 1);
  const [laporanBulanan, setLaporanBulanan] = useState([]);
  const [loadingLaporan, setLoadingLaporan] = useState(false);
  const [sedangHitung, setSedangHitung] = useState(false);
  const [sedangUnduh, setSedangUnduh] = useState(false);
  const [daftarGagal, setDaftarGagal] = useState([]);
  const [laporanDiUjung, setLaporanDiUjung] = useState(false);

  // Status khusus laporan bulanan:
  // belum_dimuat = belum pernah dicek untuk bulan/tahun yang dipilih
  // memuat       = sedang mengambil data
  // tersedia     = ada laporan
  // kosong       = endpoint berhasil, tetapi belum ada laporan
  // error        = gagal mengambil laporan
  const [statusLaporan, setStatusLaporan] = useState("belum_dimuat");

  const namaBulanTerpilih = NAMA_BULAN[bulanPilih - 1] || "bulan";

  useEffect(() => {
    ambilData();
  }, []);

  // Saat bulan/tahun berubah, jangan pertahankan tabel bulan sebelumnya.
  useEffect(() => {
    setLaporanBulanan([]);
    setStatusLaporan("belum_dimuat");
    setLaporanDiUjung(false);
    setDaftarGagal([]);
  }, [bulanPilih, tahunPilih]);

  async function bacaJsonAman(res) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  async function ambilData() {
    setLoading(true);
    try {
      const [resPotongan, resGaji] = await Promise.all([
        fetch(`${API_URL}/admin/pengaturan-potongan`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
        fetch(`${API_URL}/admin/gaji`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        }),
      ]);

      const dataPotongan = await bacaJsonAman(resPotongan);
      const dataGaji = await bacaJsonAman(resGaji);

      if (!resPotongan.ok) {
        throw new Error(dataPotongan.pesan || "Gagal memuat pengaturan potongan.");
      }
      if (!resGaji.ok) {
        throw new Error(dataGaji.pesan || "Gagal memuat data gaji karyawan.");
      }

      setPotongan({
        potonganTelat: dataPotongan.data?.potonganTelat ?? "",
        potonganAlpha: dataPotongan.data?.potonganAlpha ?? "",
        jamMasukStandar: dataPotongan.data?.jamMasukStandar || "08:00:00",
      });

      const daftar = Array.isArray(dataGaji.data) ? dataGaji.data : [];
      setDaftarGaji(daftar);

      const isianAwal = {};
      for (const item of daftar) {
        if (item.gaji?.gajiPokok != null) {
          isianAwal[item.id] = String(Math.round(Number(item.gaji.gajiPokok)));
        }
      }
      setInputGaji(isianAwal);
    } catch (err) {
      console.error(err);
      setPesan(err?.message || "Gagal memuat pengaturan gaji.");
    } finally {
      setLoading(false);
    }
  }

  async function simpanPotongan(e) {
    e.preventDefault();
    setPesan("");

    try {
      const res = await fetch(`${API_URL}/admin/pengaturan-potongan`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(potongan),
      });

      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menyimpan pengaturan potongan.");
        return;
      }

      setPesan(data.pesan || "Pengaturan potongan berhasil disimpan.");
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  async function simpanGajiPokok(id) {
    const nilai = inputGaji[id];

    if (nilai == null || nilai === "") {
      setPesan("Isi gaji pokok terlebih dahulu.");
      return;
    }

    setPesan("");

    try {
      const res = await fetch(`${API_URL}/admin/gaji/${id}/atur`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ gajiPokok: nilai }),
      });

      const data = await bacaJsonAman(res);
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menyimpan gaji pokok.");
        return;
      }

      setPesan(data.pesan || "Gaji pokok berhasil disimpan.");
      await ambilData();
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  async function muatLaporanBulanan() {
    setLoadingLaporan(true);
    setStatusLaporan("memuat");
    setPesan("");
    setLaporanBulanan([]);
    setLaporanDiUjung(false);

    try {
      const res = await fetch(
        `${API_URL}/admin/gaji/laporan?tahun=${tahunPilih}&bulan=${bulanPilih}`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      const data = await bacaJsonAman(res);

      if (!res.ok) {
        setStatusLaporan("error");
        setPesan(data.pesan || `Gagal memuat laporan gaji ${namaBulanTerpilih} ${tahunPilih}.`);
        return;
      }

      const hasil = Array.isArray(data.data) ? data.data : [];
      setLaporanBulanan(hasil);

      if (hasil.length === 0) {
        setStatusLaporan("kosong");
      } else {
        setStatusLaporan("tersedia");
      }
    } catch (err) {
      console.error(err);
      setStatusLaporan("error");
      setPesan("Tidak bisa terhubung ke server saat memuat laporan gaji.");
    } finally {
      setLoadingLaporan(false);
    }
  }

  async function hitungSemuaGaji() {
    setSedangHitung(true);
    setPesan("");
    setDaftarGagal([]);
    setStatusLaporan("belum_dimuat");
    setLaporanBulanan([]);

    try {
      const res = await fetch(
        `${API_URL}/admin/gaji/hitung-semua?tahun=${tahunPilih}&bulan=${bulanPilih}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      const data = await bacaJsonAman(res);

      if (!res.ok) {
        setPesan(data.pesan || `Gagal menghitung gaji ${namaBulanTerpilih} ${tahunPilih}.`);
        return;
      }

      setPesan(data.pesan || `Perhitungan gaji ${namaBulanTerpilih} ${tahunPilih} selesai.`);
      setDaftarGagal(Array.isArray(data.gagal) ? data.gagal : []);

      await muatLaporanBulanan();
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server saat menghitung gaji.");
    } finally {
      setSedangHitung(false);
    }
  }

  async function unduhExcel() {
    setSedangUnduh(true);
    setPesan("");

    try {
      const res = await fetch(
        `${API_URL}/admin/gaji/export?tahun=${tahunPilih}&bulan=${bulanPilih}`,
        {
          headers: { Authorization: `Bearer ${getToken()}` },
        }
      );

      if (!res.ok) {
        const data = await bacaJsonAman(res);
        setPesan(data.pesan || "Gagal mengunduh laporan.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Laporan_Gaji_${bulanPilih}_${tahunPilih}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setPesan("Tidak bisa terhubung ke server saat mengunduh laporan.");
    } finally {
      setSedangUnduh(false);
    }
  }

  function formatRupiah(angka) {
    return `Rp ${Number(angka).toLocaleString("id-ID")}`;
  }

  if (loading) {
    return <p style={styles.kosong}>Memuat…</p>;
  }

  return (
    <div>
      <style>{`
        .gaji-input:focus {
          border-color: ${warna.aksen} !important;
          box-shadow: 0 0 0 3px ${warna.aksenLembut};
          outline: none;
        }
        .gaji-button:hover:not(:disabled) {
          filter: brightness(1.03);
          transform: translateY(-1px);
        }
        .gaji-button:active:not(:disabled) { transform: translateY(0); }
        .gaji-button:disabled { opacity: 0.65; cursor: not-allowed; }
        @media (max-width: 700px) {
          .gaji-month-row { flex-direction: column !important; }
          .gaji-month-row select, .gaji-month-row input { max-width: none !important; width: 100% !important; }
          .gaji-action-row { flex-direction: column !important; align-items: stretch !important; }
          .gaji-action-row button { width: 100% !important; }
          .gaji-stat-row { align-items: flex-start !important; }
        }
      `}</style>

      {pesan && <p style={styles.pesanInfo}>{pesan}</p>}

      <div style={styles.card}>
        <p style={styles.judulKartu}>Pengaturan Potongan (berlaku semua karyawan)</p>

        <form onSubmit={simpanPotongan}>
          <label style={styles.label}>Potongan Telat (Rp/hari)</label>
          <div style={styles.inputRupiah}>
            <span style={styles.prefixRp}>Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatRibuan(potongan.potonganTelat)}
              onChange={(e) => setPotongan({ ...potongan, potonganTelat: hanyaDigit(e.target.value) })}
              style={styles.inputTanpaBorder}
              className="gaji-input"
              placeholder="0"
            />
          </div>

          <label style={styles.label}>Potongan Alpha (Rp/hari)</label>
          <div style={styles.inputRupiah}>
            <span style={styles.prefixRp}>Rp</span>
            <input
              type="text"
              inputMode="numeric"
              value={formatRibuan(potongan.potonganAlpha)}
              onChange={(e) => setPotongan({ ...potongan, potonganAlpha: hanyaDigit(e.target.value) })}
              style={styles.inputTanpaBorder}
              className="gaji-input"
              placeholder="0"
            />
          </div>

          <label style={styles.label}>Jam Masuk Standar</label>
          <input
            type="time"
            step="1"
            value={potongan.jamMasukStandar}
            onChange={(e) => setPotongan({ ...potongan, jamMasukStandar: e.target.value })}
            style={styles.input}
            className="gaji-input"
          />

          <button type="submit" style={styles.tombolUtama} className="gaji-button">
            Simpan Pengaturan
          </button>
        </form>
      </div>

      <div style={styles.card}>
        <p style={styles.judulKartu}>Gaji Pokok per Karyawan</p>

        {daftarGaji.length === 0 && (
          <div style={styles.kosongBox}>
            <Wallet size={26} strokeWidth={1.6} style={styles.kosongIkon} />
            <p style={styles.kosong}>Belum ada karyawan aktif untuk diatur gajinya.</p>
          </div>
        )}

        {daftarGaji.map((item) => (
          <div key={item.id} style={styles.barisVertikal}>
            <p style={styles.namaBaris}>{item.nama}</p>
            <p style={styles.subInfo}>{item.jabatan || "-"} · {item.divisi || "-"}</p>

            <div style={styles.inputGroup}>
              <div style={styles.inputRupiahKecil}>
                <span style={styles.prefixRpKecil}>Rp</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Belum diatur"
                  value={formatRibuan(inputGaji[item.id] ?? "")}
                  onChange={(e) => setInputGaji({ ...inputGaji, [item.id]: hanyaDigit(e.target.value) })}
                  style={styles.inputTanpaBorderKecil}
                  className="gaji-input"
                />
              </div>
              <button onClick={() => simpanGajiPokok(item.id)} style={styles.tombolAktifkan} className="gaji-button">
                Simpan
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.card}>
        <p style={styles.judulKartu}>Laporan Gaji Bulanan</p>
        <p style={styles.subKartu}>
          Pilih bulan, lalu hitung gajinya. Hasilnya bisa langsung diunduh sebagai file Excel (.xlsx).
        </p>

        <div style={styles.inputGroup} className="gaji-month-row">
          <select
            value={bulanPilih}
            onChange={(e) => setBulanPilih(Number(e.target.value))}
            style={styles.inputKecil}
            className="gaji-input"
          >
            {NAMA_BULAN.map((nama, i) => (
              <option key={i} value={i + 1}>{nama}</option>
            ))}
          </select>

          <input
            type="number"
            min="2020"
            max="2100"
            value={tahunPilih}
            onChange={(e) => setTahunPilih(Number(e.target.value))}
            style={{ ...styles.inputKecil, maxWidth: 120 }}
            className="gaji-input"
          />
        </div>

        <div style={styles.inputGroup} className="gaji-action-row">
          <button
            onClick={hitungSemuaGaji}
            style={styles.tombolAktifkan}
            className="gaji-button"
            disabled={sedangHitung}
          >
            {sedangHitung ? "Menghitung…" : "Hitung Gaji Bulan Ini"}
          </button>

          <button
            onClick={muatLaporanBulanan}
            style={styles.tombolSekunder}
            className="gaji-button"
            disabled={loadingLaporan}
          >
            {loadingLaporan ? "Memuat…" : "Muat Data yang Sudah Ada"}
          </button>
        </div>

        <p style={styles.keteranganTombol}>
          Gunakan <strong>"Hitung Gaji Bulan Ini"</strong> kalau laporan untuk bulan tersebut belum pernah dibuat.
          Gunakan <strong>"Muat Data yang Sudah Ada"</strong> kalau hanya ingin melihat atau mengunduh laporan yang sudah pernah dihitung.
        </p>

        {statusLaporan === "kosong" && (
          <div style={styles.statusKosongLaporan}>
            <Info size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div>
              <strong>Belum ada laporan gaji untuk {namaBulanTerpilih} {tahunPilih}.</strong>
              <p style={styles.statusSubteks}>
                Bulan ini belum pernah disimpan hasil perhitungannya. Klik <strong>"Hitung Gaji Bulan Ini"</strong> untuk membuat laporan.
              </p>
            </div>
          </div>
        )}

        {statusLaporan === "tersedia" && (
          <div style={styles.statusTersediaLaporan}>
            <CheckCircle2 size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div>
              <strong>Laporan gaji {namaBulanTerpilih} {tahunPilih} tersedia.</strong>
              <p style={styles.statusSubteks}>
                Ditemukan {laporanBulanan.length} data karyawan yang sudah dihitung.
              </p>
            </div>
          </div>
        )}

        {statusLaporan === "belum_dimuat" && (
          <div style={styles.statusBelumDicek}>
            <Info size={17} strokeWidth={2} style={{ flexShrink: 0 }} />
            <span>Belum memuat laporan untuk {namaBulanTerpilih} {tahunPilih}. Pilih salah satu tombol di atas.</span>
          </div>
        )}

        {daftarGagal.length > 0 && (
          <div style={styles.peringatanGagal}>
            <strong style={styles.peringatanJudul}>
              <AlertTriangle size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 5 }} />
              {daftarGagal.length} karyawan tidak ikut dihitung:
            </strong>
            <ul style={styles.peringatanList}>
              {daftarGagal.map((g, i) => (
                <li key={i}>{g.nama} — {g.alasan}</li>
              ))}
            </ul>
            <span style={styles.peringatanSaran}>
              Kemungkinan besar gaji pokoknya belum diatur. Isi dulu di bagian "Gaji Pokok per Karyawan" di atas, lalu klik "Hitung Gaji Bulan Ini" lagi.
            </span>
          </div>
        )}

        {statusLaporan === "tersedia" && (
          <>
            <button onClick={unduhExcel} style={styles.tombolUtama} className="gaji-button" disabled={sedangUnduh}>
              {sedangUnduh ? (
                "Menyiapkan file Excel…"
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <Download size={15} strokeWidth={2} />
                  Unduh sebagai Excel (.xlsx)
                </span>
              )}
            </button>

            <p style={styles.hintGeser} className="hint-geser">
              <ArrowRight size={13} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 4 }} />
              Geser tabel ke kanan untuk lihat semua kolom
            </p>

            <div style={{ position: "relative" }}>
              <div
                style={{ marginTop: 16, overflowX: "auto" }}
                onScroll={(e) => {
                  const el = e.target;
                  setLaporanDiUjung(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
                }}
              >
                <table style={styles.tabel}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.thTabel, position: "sticky", left: 0, zIndex: 1 }}>Nama</th>
                      <th style={styles.thTabel}>Tepat Waktu</th>
                      <th style={styles.thTabel}>Telat</th>
                      <th style={styles.thTabel}>Alpha</th>
                      <th style={styles.thTabel}>Potongan</th>
                      <th style={styles.thTabel}>Gaji Diterima</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laporanBulanan.map((item) => (
                      <tr key={item.id}>
                        <td style={{ ...styles.tdTabel, position: "sticky", left: 0, background: warna.panel, boxShadow: `1px 0 0 ${warna.garis}` }}>
                          {item.pengguna?.nama || "-"}
                        </td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahTepatWaktu ?? 0}</td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahTelat ?? 0}</td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahAlpha ?? 0}</td>
                        <td style={{ ...styles.tdTabel, fontFamily: font.mono }}>{formatRupiah(item.totalPotongan ?? 0)}</td>
                        <td style={{ ...styles.tdTabel, fontWeight: 700, fontFamily: font.mono }}>{formatRupiah(item.gajiDiterima ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div
                className="tabel-fade-kanan"
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 28,
                  background: `linear-gradient(to right, transparent, ${warna.panel})`,
                  pointerEvents: "none",
                  opacity: laporanDiUjung ? 0 : 1,
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: warna.panel,
    border: `1px solid ${warna.garis}`,
    borderRadius: 14,
    padding: 24,
    marginBottom: 18,
    boxSizing: "border-box",
  },
  judulKartu: {
    margin: "0 0 8px",
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 17,
    fontWeight: 700,
  },
  subKartu: {
    margin: "0 0 18px",
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 14,
    lineHeight: 1.55,
  },
  label: {
    display: "block",
    margin: "16px 0 7px",
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
  },
  input: {
    width: "100%",
    minHeight: 44,
    boxSizing: "border-box",
    padding: "0 12px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: warna.panel,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 14,
  },
  inputKecil: {
    flex: 1,
    minHeight: 44,
    boxSizing: "border-box",
    padding: "0 12px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: warna.panel,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 14,
  },
  inputRupiah: {
    display: "flex",
    alignItems: "center",
    minHeight: 44,
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    overflow: "hidden",
    background: warna.panel,
  },
  prefixRp: {
    width: 42,
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRight: `1px solid ${warna.garis}`,
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
  },
  inputTanpaBorder: {
    flex: 1,
    minWidth: 0,
    height: 44,
    border: 0,
    outline: "none",
    padding: "0 12px",
    background: "transparent",
    color: warna.tinta,
    fontFamily: font.mono,
    fontSize: 14,
  },
  inputRupiahKecil: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    minHeight: 42,
    border: `1px solid ${warna.garis}`,
    borderRadius: 9,
    overflow: "hidden",
    background: warna.panel,
  },
  prefixRpKecil: {
    padding: "0 11px",
    alignSelf: "stretch",
    display: "flex",
    alignItems: "center",
    borderRight: `1px solid ${warna.garis}`,
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 12,
    fontWeight: 700,
  },
  inputTanpaBorderKecil: {
    flex: 1,
    minWidth: 0,
    height: 42,
    border: 0,
    outline: "none",
    padding: "0 11px",
    background: "transparent",
    color: warna.tinta,
    fontFamily: font.mono,
    fontSize: 13,
  },
  inputGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginTop: 16,
  },
  barisVertikal: {
    padding: "15px 0",
    borderTop: `1px solid ${warna.garis}`,
  },
  namaBaris: {
    margin: 0,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 14,
    fontWeight: 700,
  },
  subInfo: {
    margin: "4px 0 10px",
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 12,
  },
  tombolUtama: {
    width: "100%",
    minHeight: 44,
    border: "none",
    borderRadius: 10,
    background: warna.aksen,
    color: "#fff",
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
    transition: "transform .15s ease, filter .15s ease",
  },
  tombolAktifkan: {
    minHeight: 42,
    padding: "0 15px",
    border: "none",
    borderRadius: 9,
    background: warna.aksen,
    color: "#fff",
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tombolSekunder: {
    minHeight: 42,
    padding: "0 15px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 9,
    background: warna.panelAlt,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  pesanInfo: {
    margin: "0 0 14px",
    padding: "11px 13px",
    borderRadius: 10,
    border: `1px solid ${warna.garis}`,
    background: warna.panel,
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 13,
    lineHeight: 1.5,
  },
  keteranganTombol: {
    margin: "10px 0 0",
    color: warna.tintaSamar,
    fontFamily: font.display,
    fontSize: 12,
    lineHeight: 1.55,
  },
  statusBelumDicek: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: "12px 14px",
    borderRadius: 10,
    border: `1px solid ${warna.garis}`,
    background: warna.panelAlt,
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 12.5,
    lineHeight: 1.5,
  },
  statusKosongLaporan: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: "14px 15px",
    borderRadius: 11,
    border: `1px solid ${warna.peringatanLembut || warna.garis}`,
    background: warna.peringatanLembut || warna.panelAlt,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 13,
    lineHeight: 1.55,
  },
  statusTersediaLaporan: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 16,
    padding: "14px 15px",
    borderRadius: 11,
    border: `1px solid ${warna.aksenLembut}`,
    background: warna.aksenLembut,
    color: warna.aksen,
    fontFamily: font.display,
    fontSize: 13,
    lineHeight: 1.55,
  },
  statusSubteks: {
    margin: "4px 0 0",
    color: warna.tintaLembut,
    fontSize: 12,
    lineHeight: 1.5,
  },
  peringatanGagal: {
    marginTop: 16,
    padding: "13px 14px",
    borderRadius: 11,
    border: "1px solid rgba(199,120,0,0.18)",
    background: warna.peringatanLembut,
    fontFamily: font.display,
    fontSize: 12,
    lineHeight: 1.55,
  },
  peringatanJudul: {
    color: "#8A5600",
    fontSize: 13,
  },
  peringatanList: {
    margin: "8px 0 7px 18px",
    padding: 0,
    color: warna.tintaLembut,
  },
  peringatanSaran: {
    color: warna.tintaSamar,
  },
  hintGeser: {
    margin: "12px 0 0",
    color: warna.tintaSamar,
    fontFamily: font.display,
    fontSize: 11.5,
  },
  tabel: {
    width: "100%",
    minWidth: 680,
    borderCollapse: "collapse",
    fontFamily: font.display,
  },
  thTabel: {
    padding: "11px 12px",
    borderBottom: `1px solid ${warna.garis}`,
    background: warna.panelAlt,
    color: warna.tintaLembut,
    fontSize: 11,
    fontWeight: 700,
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  tdTabel: {
    padding: "12px",
    borderBottom: `1px solid ${warna.garis}`,
    color: warna.tintaLembut,
    fontSize: 12,
    background: warna.panel,
    whiteSpace: "nowrap",
  },
  kosong: {
    margin: 0,
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 13,
    textAlign: "center",
    padding: 24,
  },
  kosongBox: {
    border: `1px dashed ${warna.garis}`,
    borderRadius: 11,
    padding: "22px 16px",
    textAlign: "center",
  },
  kosongIkon: {
    color: warna.tintaSamar,
  },
};
