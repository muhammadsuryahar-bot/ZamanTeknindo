import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { Wallet, AlertTriangle, Download, ArrowRight } from "lucide-react";

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

// Simpan angka mentah (tanpa titik) di state, tapi tampilkan berformat "10.000"
// biar gampang dibaca. onChange selalu buang karakter non-digit dulu.
function hanyaDigit(teks) {
  return String(teks).replace(/\D/g, "");
}

function formatRibuan(teks) {
  const digit = hanyaDigit(teks);
  if (!digit) return "";
  return Number(digit).toLocaleString("id-ID");
}

export default function PengaturanGaji() {
  const [potongan, setPotongan] = useState({ potonganTelat: "", potonganAlpha: "", jamMasukStandar: "" });
  const [daftarGaji, setDaftarGaji] = useState([]);
  const [inputGaji, setInputGaji] = useState({}); // { [id]: nilai }
  const [loading, setLoading] = useState(true);
  const [pesan, setPesan] = useState("");

  const sekarang = new Date();
  const [tahunPilih, setTahunPilih] = useState(sekarang.getFullYear());
  const [bulanPilih, setBulanPilih] = useState(sekarang.getMonth() + 1);
  const [laporanBulanan, setLaporanBulanan] = useState([]);
  const [loadingLaporan, setLoadingLaporan] = useState(false);
  const [sedangHitung, setSedangHitung] = useState(false);
  const [sedangUnduh, setSedangUnduh] = useState(false);
  const [daftarGagal, setDaftarGagal] = useState([]); // karyawan yang ke-skip pas hitung gaji semua
  const [laporanDiUjung, setLaporanDiUjung] = useState(false); // tabel laporan sudah digeser sampai ujung? (mobile)

  useEffect(() => {
    ambilData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function ambilData() {
    setLoading(true);
    try {
      const [resPotongan, resGaji] = await Promise.all([
        fetch(`${API_URL}/admin/pengaturan-potongan`, { headers: { Authorization: `Bearer ${getToken()}` } }),
        fetch(`${API_URL}/admin/gaji`, { headers: { Authorization: `Bearer ${getToken()}` } }),
      ]);
      const dataPotongan = await resPotongan.json();
      const dataGaji = await resGaji.json();
      setPotongan({
        potonganTelat: dataPotongan.data?.potonganTelat || "",
        potonganAlpha: dataPotongan.data?.potonganAlpha || "",
        jamMasukStandar: dataPotongan.data?.jamMasukStandar || "08:00:00",
      });
      const daftar = dataGaji.data || [];
      setDaftarGaji(daftar);

      // Pre-fill kotak input dengan gaji pokok yang sudah tersimpan, biar
      // admin bisa langsung lihat & edit nilainya (bukan cuma keterangan
      // placeholder yang harus diketik ulang dari nol tiap mau update).
      const isianAwal = {};
      for (const item of daftar) {
        if (item.gaji?.gajiPokok) {
          isianAwal[item.id] = String(Math.round(Number(item.gaji.gajiPokok)));
        }
      }
      setInputGaji(isianAwal);
    } catch (err) {
      setPesan("Gagal memuat pengaturan gaji.");
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
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(potongan),
      });
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menyimpan pengaturan potongan.");
        return;
      }
      setPesan("Pengaturan potongan berhasil disimpan.");
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  async function simpanGajiPokok(id) {
    const nilai = inputGaji[id];
    if (nilai == null || nilai === "") {
      setPesan("Isi gaji pokok terlebih dahulu.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/admin/gaji/${id}/atur`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ gajiPokok: nilai }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menyimpan gaji pokok.");
        return;
      }
      setPesan(data.pesan);
      ambilData();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    }
  }

  async function muatLaporanBulanan() {
    setLoadingLaporan(true);
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji/laporan?tahun=${tahunPilih}&bulan=${bulanPilih}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      setLaporanBulanan(data.data || []);
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setLoadingLaporan(false);
    }
  }

  async function hitungSemuaGaji() {
    setSedangHitung(true);
    setPesan("");
    setDaftarGagal([]);
    try {
      const res = await fetch(
        `${API_URL}/admin/gaji/hitung-semua?tahun=${tahunPilih}&bulan=${bulanPilih}`,
        { method: "POST", headers: { Authorization: `Bearer ${getToken()}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        setPesan(data.pesan || "Gagal menghitung gaji.");
        return;
      }
      setPesan(data.pesan);
      setDaftarGagal(data.gagal || []);
      muatLaporanBulanan();
    } catch (err) {
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setSedangHitung(false);
    }
  }

  async function unduhExcel() {
    setSedangUnduh(true);
    setPesan("");
    try {
      const res = await fetch(`${API_URL}/admin/gaji/export?tahun=${tahunPilih}&bulan=${bulanPilih}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });

      if (!res.ok) {
        const data = await res.json();
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
      setPesan("Tidak bisa terhubung ke server.");
    } finally {
      setSedangUnduh(false);
    }
  }

  function formatRupiah(angka) {
    return `Rp ${Number(angka).toLocaleString("id-ID")}`;
  }

  if (loading) return <p style={styles.kosong}>Memuat…</p>;

  return (
    <div>
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
          />
          <button type="submit" style={styles.tombolUtama}>Simpan Pengaturan</button>
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
                />
              </div>
              <button onClick={() => simpanGajiPokok(item.id)} style={styles.tombolAktifkan}>
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

        <div style={styles.inputGroup}>
          <select
            value={bulanPilih}
            onChange={(e) => setBulanPilih(Number(e.target.value))}
            style={styles.inputKecil}
          >
            {NAMA_BULAN.map((nama, i) => (
              <option key={i} value={i + 1}>{nama}</option>
            ))}
          </select>
          <input
            type="number"
            value={tahunPilih}
            onChange={(e) => setTahunPilih(Number(e.target.value))}
            style={{ ...styles.inputKecil, maxWidth: 100 }}
          />
        </div>

        <div style={styles.inputGroup}>
          <button onClick={hitungSemuaGaji} style={styles.tombolAktifkan} disabled={sedangHitung}>
            {sedangHitung ? "Menghitung…" : "Hitung Gaji Bulan Ini"}
          </button>
          <button onClick={muatLaporanBulanan} style={styles.tombolSekunder} disabled={loadingLaporan}>
            {loadingLaporan ? "Memuat…" : "Muat Data yang Sudah Ada"}
          </button>
        </div>
        <p style={styles.keteranganTombol}>
          Pakai "Hitung Gaji Bulan Ini" kalau belum pernah dihitung bulan ini. Pakai "Muat Data yang Sudah Ada"
          kalau cuma mau lihat/unduh ulang hasil yang sudah pernah dihitung.
        </p>

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
              Kemungkinan besar gaji pokoknya belum diatur. Isi dulu di bagian "Gaji Pokok per Karyawan"
              di atas, lalu klik "Hitung Gaji Bulan Ini" lagi.
            </span>
          </div>
        )}

        {laporanBulanan.length > 0 && (
          <>
            <button onClick={unduhExcel} style={styles.tombolUtama} disabled={sedangUnduh}>
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
              <div style={{ marginTop: 16, overflowX: "auto" }} onScroll={(e) => { const el = e.target; setLaporanDiUjung(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4); }}>
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
                        <td style={{ ...styles.tdTabel, position: "sticky", left: 0, background: warna.panel, boxShadow: `1px 0 0 ${warna.garis}` }}>{item.pengguna?.nama}</td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahTepatWaktu}</td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahTelat}</td>
                        <td style={{ ...styles.tdTabel, textAlign: "center" }}>{item.jumlahAlpha}</td>
                        <td style={{ ...styles.tdTabel, fontFamily: font.mono }}>{formatRupiah(item.totalPotongan)}</td>
                        <td style={{ ...styles.tdTabel, fontWeight: 700, fontFamily: font.mono }}>{formatRupiah(item.gajiDiterima)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="tabel-fade-kanan" style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 28, background: `linear-gradient(to right, transparent, ${warna.panel})`, pointerEvents: "none", opacity: laporanDiUjung ? 0 : 1 }} />
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
    borderRadius: 10,
    padding: 20,
    marginBottom: 12,
    border: `1px solid ${warna.garis}`,
  },
  judulKartu: { fontSize: 14.5, fontWeight: 700, color: warna.tinta, marginBottom: 4 },
  subKartu: { fontSize: 12.5, color: warna.tintaLembut, marginBottom: 14, lineHeight: 1.5 },
  keteranganTombol: { fontSize: 11.5, color: warna.tintaSamar, marginTop: 8, lineHeight: 1.5 },
  kosong: { textAlign: "center", color: warna.tintaSamar, padding: 24, fontSize: 13.5 },
  kosongBox: { textAlign: "center", padding: "24px 12px" },
  kosongIkon: { display: "block", marginBottom: 6, marginLeft: "auto", marginRight: "auto", color: warna.tintaSamar },
  hintGeser: { alignItems: "center", gap: 6, fontSize: 11.5, color: warna.tintaSamar, margin: "12px 0 4px 2px" },
  pesanInfo: {
    fontSize: 13,
    color: warna.tinta,
    background: warna.panelAlt,
    padding: "10px 12px",
    borderRadius: 10,
    borderLeft: `3px solid ${warna.aksen}`,
    marginBottom: 12,
  },
  barisVertikal: { padding: "10px 0", borderBottom: `1px solid ${warna.garis}` },
  namaBaris: { fontSize: 13.5, fontWeight: 600, color: warna.tinta, margin: 0 },
  subInfo: { fontSize: 12, color: warna.tintaLembut, margin: "2px 0 0" },
  label: { display: "block", fontSize: 12.5, fontWeight: 600, marginBottom: 4, marginTop: 12, color: warna.tinta },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: `1px solid ${warna.garis}`,
    fontSize: 14,
    boxSizing: "border-box",
    color: warna.tinta,
    background: warna.panel,
    colorScheme: "light",
  },
  inputKecil: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 10,
    border: `1px solid ${warna.garis}`,
    fontSize: 12.5,
    boxSizing: "border-box",
    color: warna.tinta,
    background: warna.panel,
    colorScheme: "light",
  },
  inputGroup: { display: "flex", gap: 8, marginTop: 8 },
  inputRupiah: {
    display: "flex",
    alignItems: "center",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: warna.panel,
    boxSizing: "border-box",
    colorScheme: "light",
  },
  prefixRp: { padding: "10px 0 10px 12px", color: warna.tintaSamar, fontSize: 14, fontFamily: font.mono },
  inputTanpaBorder: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    padding: "10px 12px 10px 6px",
    fontSize: 14,
    fontFamily: font.mono,
    color: warna.tinta,
    background: "transparent",
    boxSizing: "border-box",
  },
  inputRupiahKecil: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: warna.panel,
    boxSizing: "border-box",
    colorScheme: "light",
  },
  prefixRpKecil: { padding: "8px 0 8px 10px", color: warna.tintaSamar, fontSize: 12.5, fontFamily: font.mono },
  inputTanpaBorderKecil: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    padding: "8px 10px 8px 4px",
    fontSize: 12.5,
    fontFamily: font.mono,
    color: warna.tinta,
    background: "transparent",
    boxSizing: "border-box",
  },
  tombolUtama: {
    width: "100%",
    padding: "12px",
    background: warna.aksen,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 16,
  },
  tombolAktifkan: {
    padding: "8px 14px",
    background: warna.tinta,
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tombolSekunder: {
    padding: "8px 14px",
    background: warna.panelAlt,
    color: warna.tinta,
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  tabel: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  thTabel: {
    textAlign: "left",
    padding: "8px 10px",
    background: warna.panelAlt,
    borderBottom: `2px solid ${warna.garis}`,
    whiteSpace: "nowrap",
    color: warna.tinta,
  },
  tdTabel: {
    padding: "8px 10px",
    borderBottom: `1px solid ${warna.garis}`,
    whiteSpace: "nowrap",
    color: warna.tinta,
  },
  peringatanGagal: {
    marginTop: 10,
    padding: "10px 12px",
    background: warna.peringatanLembut,
    border: `1px solid ${warna.peringatan}`,
    borderRadius: 10,
  },
  peringatanJudul: { fontSize: 12.5, color: warna.peringatan },
  peringatanList: { margin: "6px 0", paddingLeft: 18, fontSize: 12, color: warna.tinta },
  peringatanSaran: { fontSize: 11.5, color: warna.tintaLembut, display: "block" },
};
