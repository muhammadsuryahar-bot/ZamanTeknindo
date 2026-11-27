import { useCallback, useEffect, useState } from "react";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import { AlertCircle, CheckCircle2, Clock3, Copy, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";

function tanggalIndonesia(nilai) {
  if (!nilai) return "-";
  const tanggal = new Date(nilai);
  if (Number.isNaN(tanggal.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(tanggal) + " WIB";
}

function labelStatus(status) {
  if (status === "tautan_dibuat") return "Tautan sudah dibuat";
  if (status === "selesai") return "Password sudah diperbarui";
  if (status === "ditolak") return "Permintaan ditolak";
  return "Menunggu verifikasi Admin";
}

export default function AdminPermintaanResetPassword() {
  const [permintaan, setPermintaan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [memuatUlang, setMemuatUlang] = useState(false);
  const [sedangProses, setSedangProses] = useState(null);
  const [tautanHasil, setTautanHasil] = useState({});
  const [tersalin, setTersalin] = useState(null);
  const [pesan, setPesan] = useState("");
  const [error, setError] = useState("");

  const muatPermintaan = useCallback(async (silent = false) => {
    if (silent) setMemuatUlang(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/admin/permintaan-reset-password`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.pesan || "Permintaan pemulihan gagal dimuat.");
      setPermintaan(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(err?.message || "Permintaan pemulihan gagal dimuat.");
    } finally {
      setLoading(false);
      setMemuatUlang(false);
    }
  }, []);

  useEffect(() => {
    void muatPermintaan();
  }, [muatPermintaan]);

  async function terbitkanTautan(item) {
    setSedangProses(item.id);
    setError("");
    setPesan("");
    try {
      const response = await fetch(`${API_URL}/admin/permintaan-reset-password/${item.id}/tautan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.pesan || "Tautan pemulihan gagal dibuat.");
      const tautan = String(payload?.data?.tautan || "");
      if (!tautan) throw new Error("Server tidak mengembalikan tautan pemulihan.");
      setTautanHasil((sebelumnya) => ({ ...sebelumnya, [item.id]: tautan }));
      setPesan(`Tautan pemulihan untuk ${payload.data.namaKaryawan} berhasil dibuat. Bagikan secara pribadi dalam 20 menit.`);
      await muatPermintaan(true);
    } catch (err) {
      setError(err?.message || "Tautan pemulihan gagal dibuat.");
    } finally {
      setSedangProses(null);
    }
  }

  async function salinTautan(id, tautan) {
    try {
      await navigator.clipboard.writeText(tautan);
      setTersalin(id);
      setPesan("Tautan berhasil disalin. Kirim langsung kepada karyawan melalui jalur komunikasi pribadi.");
    } catch {
      setError("Browser tidak mengizinkan penyalinan otomatis. Pilih dan salin tautan dari kolom yang tersedia.");
    }
  }

  const aktif = permintaan.filter((item) => ["menunggu_verifikasi", "tautan_dibuat"].includes(item.status)).length;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={styles.intro}>
        <div style={styles.introIcon}><KeyRound size={20} /></div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2 style={styles.judul}>Permintaan Pemulihan Password</h2>
          <p style={styles.subjudul}>
            Lihat permintaan karyawan yang lupa password. Verifikasi identitas karyawan sebelum menerbitkan tautan pemulihan.
          </p>
        </div>
        <button type="button" onClick={() => muatPermintaan(true)} disabled={memuatUlang} style={styles.refresh}>
          <RefreshCw size={15} className={memuatUlang ? "auth-loading-icon" : ""} />
          <span>{memuatUlang ? "Memuat..." : "Perbarui"}</span>
        </button>
      </div>

      <div style={styles.ringkasan}>
        <div>
          <span style={styles.ringkasanLabel}>Permintaan aktif</span>
          <strong style={styles.ringkasanAngka}>{aktif}</strong>
        </div>
        <span style={styles.ringkasanKeterangan}>Menunggu verifikasi atau karyawan menggunakan tautan</span>
      </div>

      {pesan && <div role="status" style={styles.sukses}><CheckCircle2 size={17} />{pesan}</div>}
      {error && <div role="alert" style={styles.error}><AlertCircle size={17} />{error}</div>}

      {loading ? (
        <div style={styles.kosong}>Memuat daftar permintaan...</div>
      ) : permintaan.length === 0 ? (
        <div style={styles.kosong}>
          <CheckCircle2 size={28} color={warna.aksen} />
          <strong>Belum ada permintaan pemulihan password</strong>
          <span>Permintaan dari karyawan akan muncul di sini dan pada notifikasi Admin.</span>
        </div>
      ) : (
        <div style={styles.daftar}>
          {permintaan.map((item) => {
            const user = item.pengguna || {};
            const link = tautanHasil[item.id];
            const menunggu = ["menunggu_verifikasi", "tautan_dibuat"].includes(item.status);
            return (
              <article key={item.id} style={styles.kartu}>
                <div style={styles.kartuAtas}>
                  <div style={styles.avatar}>{String(user.nama || "K").trim().slice(0, 1).toUpperCase()}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <strong style={styles.nama}>{user.nama || "Karyawan"}</strong>
                    <span style={styles.email}>{user.email || "-"}</span>
                  </div>
                  <span style={{
                    ...styles.status,
                    ...(item.status === "selesai" ? styles.statusSelesai : item.status === "tautan_dibuat" ? styles.statusLink : styles.statusPending),
                  }}>{labelStatus(item.status)}</span>
                </div>

                <div style={styles.meta}>
                  <span><Clock3 size={14} /> Diminta: {tanggalIndonesia(item.dibuatPada)}</span>
                  {item.tautanDibuatPada && <span><KeyRound size={14} /> Tautan dibuat: {tanggalIndonesia(item.tautanDibuatPada)}</span>}
                  {item.selesaiPada && <span><CheckCircle2 size={14} /> Selesai: {tanggalIndonesia(item.selesaiPada)}</span>}
                </div>

                {menunggu && (
                  <div style={styles.aksi}>
                    <div style={styles.catatanVerifikasi}>
                      <ShieldCheck size={16} />
                      <span>Pastikan identitas pemohon melalui komunikasi langsung sebelum membuat tautan. Admin tidak mengatur atau mengetahui password baru.</span>
                    </div>
                    <button type="button" onClick={() => terbitkanTautan(item)} disabled={sedangProses === item.id} style={styles.tombolUtama}>
                      <KeyRound size={15} />
                      {sedangProses === item.id ? "Membuat tautan..." : item.status === "tautan_dibuat" ? "Buat tautan baru" : "Buat tautan pemulihan"}
                    </button>
                  </div>
                )}

                {link && (
                  <div style={styles.linkBox}>
                    <label style={styles.labelLink}>Tautan pemulihan (berlaku 20 menit, sekali pakai)</label>
                    <input readOnly value={link} onFocus={(event) => event.target.select()} style={styles.inputLink} aria-label={`Tautan pemulihan ${user.nama || ""}`} />
                    <button type="button" onClick={() => salinTautan(item.id, link)} style={styles.tombolSalin}>
                      <Copy size={15} /> {tersalin === item.id ? "Tersalin" : "Salin tautan"}
                    </button>
                    <p style={styles.catatanLink}>Kirim tautan hanya kepada karyawan yang sudah diverifikasi. Jangan kirim ke grup umum. Setelah dibuka, karyawan membuat password sendiri.</p>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  intro: { display: "flex", alignItems: "center", gap: 12, padding: 18, border: "1px solid #e4eaf0", borderRadius: 16, background: "#fff", flexWrap: "wrap" },
  introIcon: { width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 12, color: "#08774f", background: "#e8f5ef", flexShrink: 0 },
  judul: { margin: 0, color: "#13233e", fontFamily: font.display, fontSize: 18, fontWeight: 800 },
  subjudul: { margin: "5px 0 0", color: "#64748b", fontSize: 12.5, lineHeight: 1.6 },
  refresh: { display: "inline-flex", alignItems: "center", gap: 7, minHeight: 36, padding: "0 12px", border: "1px solid #dce4ec", borderRadius: 10, background: "#fff", color: "#243247", fontSize: 12, fontWeight: 700, cursor: "pointer", marginLeft: "auto" },
  ringkasan: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", border: "1px solid #e4eaf0", borderRadius: 14, padding: "14px 18px", background: "#fff" },
  ringkasanLabel: { display: "block", color: "#64748b", fontSize: 11, marginBottom: 3 },
  ringkasanAngka: { color: "#13233e", fontSize: 24, fontWeight: 800, fontVariantNumeric: "tabular-nums" },
  ringkasanKeterangan: { color: "#64748b", fontSize: 12, marginLeft: "auto" },
  daftar: { display: "grid", gap: 12 },
  kartu: { minWidth: 0, padding: 17, border: "1px solid #e4eaf0", borderRadius: 15, background: "#fff", display: "grid", gap: 13 },
  kartuAtas: { display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" },
  avatar: { width: 38, height: 38, flexShrink: 0, borderRadius: 12, background: "#e8f5ef", color: "#08774f", display: "grid", placeItems: "center", fontWeight: 800 },
  nama: { display: "block", color: "#17243a", fontSize: 14, fontWeight: 800 },
  email: { display: "block", color: "#64748b", fontSize: 12, marginTop: 3, overflowWrap: "anywhere" },
  status: { display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 10.5, fontWeight: 750, whiteSpace: "nowrap" },
  statusPending: { background: "#fff4df", color: "#9a5b00" },
  statusLink: { background: "#eaf2ff", color: "#285b9e" },
  statusSelesai: { background: "#e9f7ef", color: "#13754d" },
  meta: { display: "flex", gap: 12, flexWrap: "wrap", color: "#64748b", fontSize: 11.5 },
  aksi: { display: "grid", gap: 10, borderTop: "1px solid #edf0f4", paddingTop: 12 },
  catatanVerifikasi: { display: "flex", alignItems: "flex-start", gap: 8, color: "#56657a", fontSize: 11.5, lineHeight: 1.55 },
  tombolUtama: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 40, padding: "0 14px", border: 0, borderRadius: 10, background: "#086744", color: "#fff", fontSize: 12, fontWeight: 750, cursor: "pointer", width: "fit-content", maxWidth: "100%" },
  linkBox: { display: "grid", gap: 8, padding: 12, background: "#f8fafc", borderRadius: 11, border: "1px solid #dce4ec" },
  labelLink: { color: "#334155", fontSize: 11, fontWeight: 750 },
  inputLink: { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "10px 11px", border: "1px solid #d4dce6", borderRadius: 8, background: "#fff", color: "#1e293b", fontSize: 11 },
  tombolSalin: { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 36, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", color: "#1e293b", fontSize: 11.5, fontWeight: 750, cursor: "pointer", width: "fit-content" },
  catatanLink: { margin: 0, color: "#64748b", fontSize: 11, lineHeight: 1.5 },
  kosong: { minHeight: 150, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 9, padding: 24, border: "1px dashed #cbd5e1", borderRadius: 14, background: "#fff", color: "#64748b", textAlign: "center", fontSize: 12 },
  sukses: { display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: "#eaf7ef", color: "#17623f", border: "1px solid #c9ead5", borderRadius: 10, fontSize: 12, lineHeight: 1.5 },
  error: { display: "flex", alignItems: "flex-start", gap: 8, padding: 12, background: "#fff0f0", color: "#a12d2d", border: "1px solid #f4cccc", borderRadius: 10, fontSize: 12, lineHeight: 1.5 },
};
