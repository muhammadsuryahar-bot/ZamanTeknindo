import { useEffect, useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { Wallet, AlertTriangle, Download, ArrowRight, Info, CheckCircle2, Calendar } from "lucide-react";

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

  // ---------- Hari Libur ----------
  const [daftarHariLibur, setDaftarHariLibur] = useState([]);
  const [formLibur, setFormLibur] = useState({ tanggal: "", keterangan: "" });
  const [pesanLibur, setPesanLibur] = useState("");
  const [sedangSimpanLibur, setSedangSimpanLibur] = useState(false);

  // ---------- Impor Otomatis Hari Libur ----------
  const [hasilImpor, setHasilImpor] = useState(null); // null = belum pernah diimpor, [] = hasil impor
  const [sedangCariImpor, setSedangCariImpor] = useState(false);
  const [sedangSimpanImpor, setSedangSimpanImpor] = useState(false);
  const [pesanImpor, setPesanImpor] = useState("");

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
    ambilHariLibur();
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

  async function ambilHariLibur() {
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await bacaJsonAman(res);
      setDaftarHariLibur(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error(err);
    }
  }

  async function tambahHariLibur(e) {
    e.preventDefault();
    setPesanLibur("");
    if (!formLibur.tanggal) return setPesanLibur("Tanggal wajib diisi.");
    if (!formLibur.keterangan.trim()) return setPesanLibur("Keterangan wajib diisi (contoh: Hari Kemerdekaan).");

    setSedangSimpanLibur(true);
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(formLibur),
      });
      const data = await bacaJsonAman(res);
      if (!res.ok) return setPesanLibur(data.pesan || "Gagal menambahkan hari libur.");
      setFormLibur({ tanggal: "", keterangan: "" });
      ambilHariLibur();
    } catch (err) {
      console.error(err);
      setPesanLibur("Tidak bisa terhubung ke server.");
    } finally {
      setSedangSimpanLibur(false);
    }
  }

  async function hapusHariLiburKlik(id) {
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) ambilHariLibur();
    } catch (err) {
      console.error(err);
    }
  }

  // Ambil daftar usulan hari libur nasional dari sumber publik (bersumber
  // dari SKB 3 Menteri), TAPI cuma buat "usulan" -- admin tetap yang pilih
  // mana yang mau disimpan, sesuai prinsip "bos tetap pegang kendali penuh".
  // Kalau sumber publiknya lagi tidak bisa diakses (server luar down, dsb),
  // fitur input manual di atas tetap jalan seperti biasa -- ini cuma
  // pelengkap buat hemat waktu ketik, bukan satu-satunya cara.
  async function cariUsulanImpor() {
    setSedangCariImpor(true);
    setPesanImpor("");
    setHasilImpor(null);
    try {
      const res = await fetch(`${API_URL}/admin/hari-libur-usulan?tahun=${tahunPilih}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) {
        const dataError = await res.json().catch(() => ({}));
        throw new Error(dataError.pesan || "Sumber data tidak merespons.");
      }
      const data = await res.json();
      const daftarTanggalSudahAda = new Set(
        daftarHariLibur.map((h) => new Date(h.tanggal).toISOString().slice(0, 10))
      );

      const usulan = (data.data || [])
        .filter((item) => !daftarTanggalSudahAda.has(item.date)) // sembunyikan yang sudah terdaftar
        .map((item) => ({ tanggal: item.date, keterangan: item.description, dipilih: true }));

      if (usulan.length === 0) {
        setPesanImpor(
          data.data && data.data.length > 0
            ? "Semua hari libur tahun ini sudah terdaftar."
            : "Tidak ada data untuk tahun ini dari sumber publik."
        );
      }
      setHasilImpor(usulan);
    } catch (err) {
      console.error(err);
      setPesanImpor("Tidak bisa mengambil data dari sumber publik. Silakan tambahkan manual saja.");
      setHasilImpor([]);
    } finally {
      setSedangCariImpor(false);
    }
  }

  function toggleUsulanImpor(index) {
    setHasilImpor((prev) => prev.map((u, i) => (i === index ? { ...u, dipilih: !u.dipilih } : u)));
  }

  async function simpanUsulanTerpilih() {
    const terpilih = hasilImpor.filter((u) => u.dipilih);
    if (terpilih.length === 0) return;

    setSedangSimpanImpor(true);
    let berhasil = 0;
    for (const u of terpilih) {
      try {
        const res = await fetch(`${API_URL}/admin/hari-libur`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" },
          body: JSON.stringify({ tanggal: u.tanggal, keterangan: u.keterangan }),
        });
        if (res.ok) berhasil += 1;
      } catch (err) {
        console.error(err);
      }
    }
    setSedangSimpanImpor(false);
    setHasilImpor(null);
    setPesanImpor(`${berhasil} hari libur berhasil ditambahkan.`);
    ambilHariLibur();
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
        <p style={styles.judulKartu}>Hari Libur</p>
        <p style={styles.subKartu}>
          Tanggal yang didaftarkan di sini TIDAK akan dihitung "Alpha" walau jatuh di hari kerja
          (Senin–Jumat) -- misal hari libur nasional atau cuti bersama.
        </p>

        <form onSubmit={tambahHariLibur} style={styles.formHariLibur}>
          <input
            type="date"
            value={formLibur.tanggal}
            onChange={(e) => setFormLibur({ ...formLibur, tanggal: e.target.value })}
            style={styles.inputTanggalLibur}
          />
          <input
            type="text"
            placeholder="Keterangan (contoh: Hari Kemerdekaan)"
            value={formLibur.keterangan}
            onChange={(e) => setFormLibur({ ...formLibur, keterangan: e.target.value })}
            style={styles.inputKeteranganLibur}
          />
          <button type="submit" style={styles.tombolTambahLibur} disabled={sedangSimpanLibur}>
            {sedangSimpanLibur ? "Menyimpan…" : "Tambah"}
          </button>
        </form>
        {pesanLibur && <p style={styles.pesanErrorKecil}>{pesanLibur}</p>}

        {/* Selector tahun KHUSUS di kartu ini, biar jelas & gampang ditemukan --
            sebelumnya kontrol tahun cuma ada di kartu "Laporan Gaji Bulanan"
            (di bawah), padahal dipakai bareng juga sama tombol impor di sini.
            Fisik kontrolnya jauh dari tombolnya = orang gak nyadar bisa
            diganti, kerasa kayak "gak bisa update ke tahun depan". */}
        <div style={styles.pilihTahunLiburRow}>
          <span style={styles.pilihTahunLiburLabel}>
            <Calendar size={13} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            Tahun kalender:
          </span>
          <button
            type="button"
            onClick={() => setTahunPilih((t) => t - 1)}
            style={styles.tombolStepperTahun}
            aria-label="Tahun sebelumnya"
          >
            −
          </button>
          <input
            type="number"
            min="2020"
            max="2100"
            value={tahunPilih}
            onChange={(e) => setTahunPilih(Number(e.target.value))}
            style={styles.inputTahunLibur}
          />
          <button
            type="button"
            onClick={() => setTahunPilih((t) => t + 1)}
            style={styles.tombolStepperTahun}
            aria-label="Tahun berikutnya"
          >
            +
          </button>
        </div>

        <button onClick={cariUsulanImpor} style={styles.tombolImporOtomatis} disabled={sedangCariImpor}>
          {sedangCariImpor ? "Mencari…" : `Impor Otomatis dari Kalender ${tahunPilih}`}
        </button>
        {pesanImpor && <p style={styles.pesanImporKecil}>{pesanImpor}</p>}

        {hasilImpor && hasilImpor.length > 0 && (
          <div style={styles.kotakUsulanImpor}>
            <p style={styles.judulUsulanImpor}>
              Ditemukan {hasilImpor.length} usulan. Centang yang mau disimpan, lalu klik "Impor Terpilih".
              Ini masih usulan -- belum tersimpan sampai kamu konfirmasi.
            </p>
            {hasilImpor.map((u, i) => (
              <label key={u.tanggal} style={styles.barisUsulanImpor}>
                <input type="checkbox" checked={u.dipilih} onChange={() => toggleUsulanImpor(i)} />
                <span style={styles.tanggalHariLibur}>
                  {new Date(`${u.tanggal}T00:00:00.000Z`).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}
                </span>
                <span style={styles.keteranganHariLibur}>{u.keterangan}</span>
              </label>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={simpanUsulanTerpilih} style={styles.tombolTambahLibur} disabled={sedangSimpanImpor}>
                {sedangSimpanImpor ? "Menyimpan…" : `Impor ${hasilImpor.filter((u) => u.dipilih).length} Terpilih`}
              </button>
              <button onClick={() => setHasilImpor(null)} style={styles.tombolBatalImpor}>Batal</button>
            </div>
          </div>
        )}

        {daftarHariLibur.length === 0 && (
          <p style={styles.keteranganKosong}>Belum ada hari libur yang didaftarkan.</p>
        )}
        {daftarHariLibur.map((h) => (
          <div key={h.id} style={styles.barisHariLibur}>
            <span style={styles.tanggalHariLibur}>
              {new Date(h.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })}
            </span>
            <span style={styles.keteranganHariLibur}>{h.keterangan}</span>
            <button onClick={() => hapusHariLiburKlik(h.id)} style={styles.tombolHapusKecil}>Hapus</button>
          </div>
        ))}
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

  // ---------- Hari Libur ----------
  formHariLibur: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "stretch",
    marginBottom: 10,
  },
  inputTanggalLibur: {
    minHeight: 44,
    boxSizing: "border-box",
    padding: "0 12px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: warna.panel,
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 14,
    minWidth: 170,
  },
  inputKeteranganLibur: {
    flex: 1,
    minWidth: 200,
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
  tombolTambahLibur: {
    minHeight: 44,
    padding: "0 20px",
    border: "none",
    borderRadius: 10,
    background: warna.aksen,
    color: "#fff",
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "transform .15s ease, filter .15s ease",
  },
  pesanErrorKecil: {
    color: warna.bahaya,
    fontSize: 12.5,
    margin: "0 0 12px",
  },
  keteranganKosong: {
    color: warna.tintaSamar,
    fontSize: 13,
    fontFamily: font.display,
    margin: "8px 0 0",
  },
  barisHariLibur: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 0",
    borderBottom: `1px solid ${warna.garis}`,
  },
  tanggalHariLibur: {
    fontFamily: font.mono,
    fontSize: 12.5,
    fontWeight: 600,
    color: warna.tinta,
    minWidth: 130,
  },
  keteranganHariLibur: {
    flex: 1,
    fontSize: 13.5,
    color: warna.tintaLembut,
  },
  tombolHapusKecil: {
    background: "none",
    border: "none",
    color: warna.bahaya,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 8px",
  },
  pilihTahunLiburRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 4,
  },
  pilihTahunLiburLabel: {
    fontSize: 12.5,
    color: warna.tintaLembut,
    fontWeight: 600,
    fontFamily: font.display,
  },
  tombolStepperTahun: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: `1px solid ${warna.garis}`,
    background: warna.panel,
    color: warna.tinta,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 0,
    lineHeight: 1,
  },
  inputTahunLibur: {
    width: 76,
    height: 28,
    borderRadius: 8,
    border: `1px solid ${warna.garis}`,
    background: warna.panel,
    color: warna.tinta,
    fontSize: 13,
    fontFamily: font.mono,
    fontWeight: 600,
    textAlign: "center",
  },
  tombolImporOtomatis: {
    width: "100%",
    minHeight: 42,
    marginTop: 4,
    marginBottom: 4,
    border: `1px dashed ${warna.garis}`,
    borderRadius: 10,
    background: warna.panelAlt || "#F7F8FA",
    color: warna.tinta,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  pesanImporKecil: {
    color: warna.tintaLembut,
    fontSize: 12.5,
    margin: "0 0 12px",
  },
  kotakUsulanImpor: {
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
    background: warna.panel,
  },
  judulUsulanImpor: {
    fontSize: 12.5,
    color: warna.tintaLembut,
    margin: "0 0 10px",
    lineHeight: 1.5,
  },
  barisUsulanImpor: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
    cursor: "pointer",
  },
  tombolBatalImpor: {
    minHeight: 44,
    padding: "0 18px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 10,
    background: "none",
    color: warna.tintaLembut,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
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
