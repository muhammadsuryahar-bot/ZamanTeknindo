import { useState, useEffect } from "react";
import { API_URL, getToken } from "../utils/api";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ShieldAlert,
  Calendar,
  Clock,
  User,
  FileText,
  RefreshCw,
  Search,
  Filter,
  Eye,
  Check,
  ChevronRight
} from "lucide-react";

const JAM_MASUK_BATAS = "08:10";
const BATAS_MENIT = 8 * 60 + 10; // 490

function hitungStatus(jamStr) {
  try {
    let h, m;
    if (jamStr instanceof Date) {
      const wib = jamStr.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
      [h, m] = wib.split(":").map(Number);
    } else {
      const parts = String(jamStr).split(":").map(Number);
      h = parts[0]; m = parts[1];
    }
    const total = h * 60 + m;
    if (total > BATAS_MENIT) {
      const telat = total - BATAS_MENIT;
      return { label: "Terlambat", isTelat: true, telatMenit: telat };
    }
    return { label: "Tepat Waktu", isTelat: false, telatMenit: 0 };
  } catch {
    return { label: "Tepat Waktu", isTelat: false, telatMenit: 0 };
  }
}

function formatTanggalWIB(dateInput) {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("id-ID", {
      timeZone: "Asia/Jakarta",
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function formatJamWIB(dateInput) {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", {
      timeZone: "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }) + " WIB";
  } catch {
    return "-";
  }
}

export default function AdminManual() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [itemApprove, setItemApprove] = useState(null);
  const [itemReject, setItemReject] = useState(null);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [alasanTolak, setAlasanTolak] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function loadPending() {
    setLoading(true);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/admin/manual-pending?status=${filter.toUpperCase()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const d = await r.json();
        setPending((d.data || []).map((x) => ({ ...x, pengguna: x.user || x.pengguna, user: x.user || x.pengguna })));
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadPending();
  }, [filter]);

  async function confirmApprove() {
    if (!itemApprove || submitting) return;
    setSubmitting(true);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/admin/manual-approve/${itemApprove.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json();
      if (r.ok) {
        setPending((prev) =>
          prev.map((p) => (p.id === itemApprove.id ? { ...p, status: "APPROVED" } : p))
        );
        setItemApprove(null);
        setFeedback({
          type: "success",
          title: "Persetujuan Berhasil",
          message: j.message || `Presensi manual untuk ${itemApprove.pengguna?.nama || "Karyawan"} berhasil disetujui!`,
        });
        window.dispatchEvent(new CustomEvent("manual-pending-updated"));
      } else {
        setFeedback({
          type: "error",
          title: "Gagal Menyetujui",
          message: j.message || "Terjadi kesalahan saat menyetujui pengajuan.",
        });
      }
    } catch (e) {
      setFeedback({
        type: "error",
        title: "Kesalahan Sistem",
        message: e.message || "Gagal menghubungi server.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmReject() {
    if (!itemReject || submitting) return;
    setSubmitting(true);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/admin/manual-reject/${itemReject.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ alasanTolak }),
      });
      const j = await r.json();
      if (r.ok) {
        setPending((prev) =>
          prev.map((p) => (p.id === itemReject.id ? { ...p, status: "REJECTED" } : p))
        );
        setItemReject(null);
        setAlasanTolak("");
        setFeedback({
          type: "success",
          title: "Pengajuan Ditolak",
          message: j.message || `Pengajuan verifikasi manual untuk ${itemReject.pengguna?.nama || "Karyawan"} telah ditolak.`,
        });
        window.dispatchEvent(new CustomEvent("manual-pending-updated"));
      } else {
        setFeedback({
          type: "error",
          title: "Gagal Menolak",
          message: j.message || "Terjadi kesalahan saat menolak pengajuan.",
        });
      }
    } catch (e) {
      setFeedback({
        type: "error",
        title: "Kesalahan Sistem",
        message: e.message || "Gagal menghubungi server.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const dataFiltered = pending.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const nama = (item.pengguna?.nama || "").toLowerCase();
    const tipe = (item.tipe || "").toLowerCase();
    const alasan = (item.alasan || "").toLowerCase();
    return nama.includes(query) || tipe.includes(query) || alasan.includes(query);
  });

  return (
    <div style={{ background: "#ffffff", borderRadius: 20, border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.03)", overflow: "hidden", fontFamily: "inherit" }}>
      {/* Header Container */}
      <div style={{ padding: "24px 28px", borderBottom: "1px solid #f3f4f6", background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: 18, color: "#111827", margin: 0, letterSpacing: "-0.02em" }}>Verifikasi Manual Kiosk</h2>
                <p style={{ fontSize: 12.5, color: "#6b7280", margin: "2px 0 0" }}>Backup pengajuan presensi ketika kendala deteksi wajah</p>
              </div>
            </div>
          </div>

          {/* Action Filters */}
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: 200 }}>
              <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
              <input
                type="text"
                placeholder="Cari karyawan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: 38,
                  paddingLeft: 34,
                  paddingRight: 12,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  fontSize: 12.5,
                  outline: "none",
                  boxSizing: "border-box",
                  background: "#fff"
                }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", padding: 3, borderRadius: 10 }}>
              {["ALL", "PENDING", "APPROVED", "REJECTED"].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  style={{
                    height: 32,
                    padding: "0 12px",
                    borderRadius: 8,
                    border: 0,
                    fontSize: 11.5,
                    fontWeight: filter === st ? 700 : 600,
                    background: filter === st ? "#fff" : "transparent",
                    color: filter === st ? "#111827" : "#6b7280",
                    boxShadow: filter === st ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  {st === "ALL" ? "Semua" : st === "PENDING" ? "Menunggu" : st === "APPROVED" ? "Disetujui" : "Ditolak"}
                </button>
              ))}
            </div>

            <button
              onClick={loadPending}
              title="Muat Ulang Data"
              style={{
                height: 38,
                width: 38,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#374151",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer"
              }}
            >
              <RefreshCw size={15} className={loading ? "spin-icon" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Content */}
      {loading ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>
          <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 12, color: "#2563eb" }} />
          <div style={{ fontSize: 13, fontWeight: 600 }}>Memuat data pengajuan...</div>
        </div>
      ) : dataFiltered.length === 0 ? (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "#f3f4f6", color: "#9ca3af", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <FileText size={24} />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>Tidak Ada Pengajuan {filter !== "ALL" ? filter : ""}</div>
          <p style={{ fontSize: 12.5, color: "#6b7280", marginTop: 4, maxWidth: 400, marginInline: "auto", lineHeight: 1.5 }}>
            Pengajuan verifikasi manual dari kiosk presensi akan muncul di tabel ini ketika ada karyawan melakukan submit backup manual.
          </p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", textAlign: "left", fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                <th style={{ padding: "14px 20px", fontWeight: 700 }}>Karyawan</th>
                <th style={{ padding: "14px 20px", fontWeight: 700 }}>Tanggal Presensi</th>
                <th style={{ padding: "14px 20px", fontWeight: 700 }}>Waktu Kiosk</th>
                <th style={{ padding: "14px 20px", fontWeight: 700 }}>Alasan Pengajuan</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, textAlign: "center" }}>Foto Bukti</th>
                <th style={{ padding: "14px 20px", fontWeight: 700, textAlign: "right" }}>Tindakan / Status</th>
              </tr>
            </thead>
            <tbody>
              {dataFiltered.map((item) => {
                const dateObj = new Date(item.requestedAt);
                const tanggalTampil = formatTanggalWIB(item.requestedAt);
                const jamWIB = formatJamWIB(item.requestedAt);
                const statusHitung = hitungStatus(dateObj);

                return (
                  <tr
                    key={item.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      transition: "background 0.15s ease",
                    }}
                    className="row-hover"
                  >
                    {/* User Info */}
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: "#f1f5f9", color: "#475569", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {(item.pengguna?.nama || "K")[0].toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: 13 }}>{item.pengguna?.nama || "Karyawan"}</div>
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ padding: "1px 6px", borderRadius: 4, background: "#e2e8f0", color: "#334155", fontWeight: 700, fontSize: 9.5, textTransform: "uppercase" }}>
                              {item.tipe}
                            </span>
                            <span>•</span>
                            <span>{item.pengguna?.jabatan || "Karyawan"}</span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Tanggal Presensi */}
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f172a", fontWeight: 600 }}>
                        <Calendar size={14} style={{ color: "#2563eb" }} />
                        <span>{tanggalTampil}</span>
                      </div>
                    </td>

                    {/* Waktu Presensi Kiosk */}
                    <td style={{ padding: "16px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#0f172a", fontWeight: 700 }}>
                        <Clock size={14} style={{ color: "#64748b" }} />
                        <span>{jamWIB}</span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 99,
                            fontSize: 10,
                            fontWeight: 700,
                            background: statusHitung.isTelat ? "#fee2e2" : "#dcfce7",
                            color: statusHitung.isTelat ? "#991b1b" : "#166534",
                          }}
                        >
                          {statusHitung.isTelat ? `Terlambat ${statusHitung.telatMenit} menit` : "Tepat Waktu"}
                        </span>
                      </div>
                    </td>

                    {/* Alasan */}
                    <td style={{ padding: "16px 20px", maxWidth: 240 }}>
                      <div style={{ color: "#334155", fontSize: 12, lineHeight: 1.4, wordBreak: "break-word" }}>
                        {(item.alasan || "Deteksi wajah tidak tersedia").split("|")[0].trim()}
                      </div>
                    </td>

                    {/* Foto Bukti */}
                    <td style={{ padding: "16px 20px", textAlign: "center" }}>
                      {item.fotoBukti ? (
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={item.fotoBukti}
                            alt="Bukti Presensi"
                            style={{ width: 50, height: 40, borderRadius: 8, objectFit: "cover", border: "1px solid #cbd5e1", cursor: "pointer", transition: "transform 0.15s ease" }}
                            onClick={() => setPreviewFoto(item.fotoBukti)}
                          />
                        </div>
                      ) : (
                        <span style={{ color: "#94a3b8", fontSize: 11 }}>Tanpa Foto</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: "16px 20px", textAlign: "right" }}>
                      {item.status === "PENDING" ? (
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                          <button
                            onClick={() => { setItemReject(item); setAlasanTolak(""); }}
                            style={{
                              padding: "7px 14px",
                              borderRadius: 9,
                              border: "1px solid #fecaca",
                              background: "#fff5f5",
                              color: "#dc2626",
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Tolak
                          </button>
                          <button
                            onClick={() => setItemApprove(item)}
                            style={{
                              padding: "7px 16px",
                              borderRadius: 9,
                              border: 0,
                              background: "#16a34a",
                              color: "#fff",
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: "pointer",
                              boxShadow: "0 2px 6px rgba(22, 163, 74, 0.2)",
                              transition: "all 0.15s ease"
                            }}
                          >
                            Setujui
                          </button>
                        </div>
                      ) : (
                        <span
                          style={{
                            fontSize: 11.5,
                            fontWeight: 700,
                            padding: "6px 14px",
                            borderRadius: 99,
                            background: item.status === "APPROVED" ? "#dcfce7" : "#fee2e2",
                            color: item.status === "APPROVED" ? "#15803d" : "#b91c1c",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5
                          }}
                        >
                          {item.status === "APPROVED" ? <Check size={14} /> : <X size={14} />}
                          {item.status === "APPROVED" ? "Disetujui" : "Ditolak"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL LIGHTBOX PREVIEW FOTO */}
      {previewFoto && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.75)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setPreviewFoto(null)}>
          <div style={{ position: "relative", maxWidth: 600, width: "100%", background: "#fff", borderRadius: 20, padding: 12, overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setPreviewFoto(null)} style={{ position: "absolute", right: 16, top: 16, width: 32, height: 32, borderRadius: 99, background: "rgba(0,0,0,0.5)", color: "#fff", border: 0, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <X size={18} />
            </button>
            <img src={previewFoto} alt="Bukti Presensi Kiosk" style={{ width: "100%", maxHeight: "75vh", borderRadius: 14, objectFit: "contain", display: "block" }} />
          </div>
        </div>
      )}

      {/* MODAL POPUP SETUJUI */}
      {itemApprove && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 20, maxWidth: 460, width: "100%", padding: 26, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>Setujui Verifikasi Manual</h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Backup Presensi Kiosk</p>
                </div>
              </div>
              <button onClick={() => !submitting && setItemApprove(null)} style={{ background: "none", border: 0, color: "#94a3b8", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, border: "1px solid #e2e8f0", marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{itemApprove.pengguna?.nama || "Karyawan"}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                Tipe Presensi: <b style={{ textTransform: "uppercase", color: "#2563eb" }}>{itemApprove.tipe}</b> • {itemApprove.pengguna?.jabatan || "Karyawan"}
              </div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #cbd5e1", fontSize: 12, color: "#334155" }}>
                <div>Tanggal: <b>{formatTanggalWIB(itemApprove.requestedAt)}</b></div>
                <div style={{ marginTop: 2 }}>Waktu Kiosk: <b>{formatJamWIB(itemApprove.requestedAt)}</b></div>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5, margin: "0 0 22px" }}>
              Waktu kehadiran akan dicatat menggunakan waktu presensi saat karyawan melakukan submit di kiosk. Lanjutkan menyetujui pengajuan ini?
            </p>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                disabled={submitting}
                onClick={() => setItemApprove(null)}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12.5, fontWeight: 700, color: "#475569", cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                disabled={submitting}
                onClick={confirmApprove}
                style={{ padding: "10px 22px", borderRadius: 10, border: 0, background: "#16a34a", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.3)" }}
              >
                {submitting ? "Memproses..." : "Ya, Setujui"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POPUP TOLAK */}
      {itemReject && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 20, maxWidth: 460, width: "100%", padding: 26, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: "#0f172a" }}>Tolak Verifikasi Manual</h3>
                  <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>Backup Presensi Kiosk</p>
                </div>
              </div>
              <button onClick={() => !submitting && setItemReject(null)} style={{ background: "none", border: 0, color: "#94a3b8", cursor: "pointer", padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ background: "#f8fafc", borderRadius: 14, padding: 14, border: "1px solid #e2e8f0", marginBottom: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{itemReject.pengguna?.nama || "Karyawan"}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                Tanggal: <b>{formatTanggalWIB(itemReject.requestedAt)}</b> • Waktu: <b>{formatJamWIB(itemReject.requestedAt)}</b>
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 8 }}>
                Alasan Penolakan (opsional)
              </label>
              <textarea
                rows={3}
                value={alasanTolak}
                onChange={(e) => setAlasanTolak(e.target.value)}
                placeholder="Contoh: Bukti foto tidak jelas / lokasi presensi tidak valid"
                style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #cbd5e1", fontSize: 12.5, fontFamily: "inherit", boxSizing: "border-box" }}
              />
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                disabled={submitting}
                onClick={() => setItemReject(null)}
                style={{ padding: "10px 18px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff", fontSize: 12.5, fontWeight: 700, color: "#475569", cursor: "pointer" }}
              >
                Batal
              </button>
              <button
                disabled={submitting}
                onClick={confirmReject}
                style={{ padding: "10px 22px", borderRadius: 10, border: 0, background: "#dc2626", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", boxShadow: "0 2px 8px rgba(220,38,38,0.3)" }}
              >
                {submitting ? "Memproses..." : "Tolak Pengajuan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL FEEDBACK NOTIFIKASI */}
      {feedback && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#ffffff", borderRadius: 20, maxWidth: 380, width: "100%", padding: 26, textAlign: "center", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", border: "1px solid #e2e8f0" }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                margin: "0 auto 16px",
                background: feedback.type === "success" ? "#dcfce7" : "#fee2e2",
                color: feedback.type === "success" ? "#15803d" : "#b91c1c",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {feedback.type === "success" ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}
            </div>
            <h4 style={{ fontSize: 17, fontWeight: 800, color: "#0f172a", margin: "0 0 6px" }}>{feedback.title}</h4>
            <p style={{ fontSize: 12.5, color: "#475569", lineHeight: 1.5, margin: "0 0 22px" }}>{feedback.message}</p>
            <button
              onClick={() => setFeedback(null)}
              style={{
                width: "100%",
                padding: "11px",
                borderRadius: 10,
                border: 0,
                background: feedback.type === "success" ? "#16a34a" : "#dc2626",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Tutup
            </button>
          </div>
        </div>
      )}
    </div>
  );
}