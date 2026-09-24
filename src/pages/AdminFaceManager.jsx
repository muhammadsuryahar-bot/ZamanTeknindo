import { useEffect, useState } from "react";
import { warna } from "../styles/theme";
import { getToken } from "../utils/api";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const KIOSK_KEY = import.meta.env.VITE_KIOSK_KEY || "kiosk_rahasia_zaman_2025";

export default function AdminFaceManager() {
  const [faces, setFaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cari, setCari] = useState("");
  const [selected, setSelected] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ nama: "", jabatan: "", divisi: "" });

  const [kioskPin, setKioskPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [pinData, setPinData] = useState({});

  const [toast, setToast] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }

  async function loadData() {
    setLoading(true);
    try {
      const [facesRes, usersRes, pinRes] = await Promise.all([
        fetch(`${API_BASE}/kiosk/faces-detailed`, { headers: { "x-kiosk-key": KIOSK_KEY } }),
        fetch(`${API_BASE}/kiosk/pengguna-list`, { headers: { "x-kiosk-key": KIOSK_KEY } }),
        fetch(`${API_BASE}/admin/pengaturan-potongan`, { headers: { Authorization: `Bearer ${getToken()}` } })
      ]);
      if (facesRes.ok) {
        const data = await facesRes.json();
        setFaces(Array.isArray(data) ? data : data.data || []);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.data || []);
      }
      if (pinRes.ok) {
        const data = await pinRes.json();
        setKioskPin(data.data?.kioskPin || "246810");
        setPinData(data.data || {});
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleDelete() {
    if (!selected) return;
    setDeleting(true);
    try {
      const r = await fetch(`${API_BASE}/kiosk/face/${selected.penggunaId}`, { method: "DELETE", headers: { "x-kiosk-key": KIOSK_KEY } });
      if (r.ok) {
        showToast("sukses", `Wajah ${selected.pengguna?.nama || selected.nama} berhasil dihapus`);
        setShowDeleteModal(false); setSelected(null); loadData();
      } else {
        const j = await r.json();
        showToast("error", "Gagal hapus: " + j.message);
      }
    } catch (e) {
      showToast("error", "Error: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  async function handleEditSave() {
    if (!selected) return;
    try {
      const r = await fetch(`${API_BASE}/kiosk/pengguna/${selected.penggunaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-kiosk-key": KIOSK_KEY },
        body: JSON.stringify(editData)
      });
      if (r.ok) {
        showToast("sukses", "Data pengguna berhasil diupdate");
        setShowEditModal(false); loadData();
      } else {
        const j = await r.json();
        showToast("error", "Gagal edit: " + j.message);
      }
    } catch (e) {
      showToast("error", "Error: " + e.message);
    }
  }

  async function handleSavePin() {
    if (!kioskPin) return;
    setSavingPin(true);
    try {
      const r = await fetch(`${API_BASE}/admin/pengaturan-potongan`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({
          ...pinData,
          kioskPin
        })
      });
      if (r.ok) {
        showToast("sukses", "PIN Kiosk berhasil diperbarui");
      } else {
        const j = await r.json();
        showToast("error", "Gagal menyimpan PIN: " + j.pesan);
      }
    } catch (e) {
      showToast("error", "Error: " + e.message);
    } finally {
      setSavingPin(false);
    }
  }

  function openEdit(face) {
    setSelected(face);
    setEditData({ nama: face.pengguna?.nama || "", jabatan: face.pengguna?.jabatan || "", divisi: face.pengguna?.divisi || "" });
    setShowEditModal(true);
  }

  function openDelete(face) {
    setSelected(face);
    setShowDeleteModal(true);
  }

  const filtered = faces.filter(f => {
    if (!cari) return true;
    const q = cari.toLowerCase();
    return (f.pengguna?.nama?.toLowerCase().includes(q) || f.pengguna?.jabatan?.toLowerCase().includes(q) || f.pengguna?.email?.toLowerCase().includes(q));
  });

  const stats = {
    totalFace: faces.length,
    belum: users.filter(u => !u.hasFace).length,
    sudah: faces.length,
    totalUser: users.length
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7f9", padding: 20, fontFamily: "Inter, system-ui", position: "relative" }}>
      {/* Toast Alert System */}
      {toast && (
        <div style={{
          position: "fixed",
          top: 24,
          right: 24,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 18px",
          borderRadius: 12,
          background: toast.type === "sukses" ? "#E4F3EA" : "#FBE7E4",
          border: `1px solid ${toast.type === "sukses" ? "#C6E2D3" : "#F5C6C1"}`,
          color: toast.type === "sukses" ? "#0B6E45" : "#C0392B",
          boxShadow: "0 10px 25px -5px rgba(0,0,0,0.08)",
          animation: "slideIn 0.2s ease-out"
        }}>
          <span style={{
            fontSize: 16,
            fontWeight: 800,
            display: "grid",
            placeItems: "center",
            width: 26,
            height: 26,
            borderRadius: 13,
            background: toast.type === "sukses" ? "#0B6E45" : "#C0392B",
            color: "#fff"
          }}>
            {toast.type === "sukses" ? "✓" : "✕"}
          </span>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{toast.message}</div>
          <button onClick={() => setToast(null)} style={{ border: 0, background: "transparent", cursor: "pointer", color: "inherit", fontWeight: 700, marginLeft: 8, fontSize: 14 }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, border: "1px solid #e5e7eb", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#16233D" }}>Face Manager</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Kelola data wajah karyawan - edit, hapus, dan monitoring</div>
            </div>
            <button onClick={loadData} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>↻ Refresh</button>
          </div>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
            <div style={{ background: "#E4F3EA", borderRadius: 12, padding: 14, border: "1px solid #c6e2d3" }}>
              <div style={{ fontSize: 11, color: "#0B6E45", fontWeight: 700 }}>SUDAH DAFTAR</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0B6E45", marginTop: 4 }}>{stats.sudah}</div>
            </div>
            <div style={{ background: "#FBE7E4", borderRadius: 12, padding: 14, border: "1px solid #f5c6c1" }}>
              <div style={{ fontSize: 11, color: "#C0392B", fontWeight: 700 }}>BELUM DAFTAR</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#C0392B", marginTop: 4 }}>{stats.belum}</div>
            </div>
            <div style={{ background: "#D6EAF8", borderRadius: 12, padding: 14, border: "1px solid #a9cce3" }}>
              <div style={{ fontSize: 11, color: "#2980B9", fontWeight: 700 }}>TOTAL USER</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#2980B9", marginTop: 4 }}>{stats.totalUser}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 14, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>PERSENTASE</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#16233D", marginTop: 4 }}>{stats.totalUser ? Math.round((stats.sudah / stats.totalUser) * 100) : 0}%</div>
            </div>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 16, alignItems: "center" }}>
            <div style={{ display: "flex", gap: 8, flex: 2 }}>
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, jabatan, email..." style={{ flex: 1, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 14px", fontSize: 13 }} />
            </div>
            
            <div style={{ flex: 1, display: "flex", gap: 8, alignItems: "center", background: "#f9fafb", padding: "4px 8px 4px 12px", borderRadius: 10, border: "1px solid #e5e7eb" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>PIN Kiosk Admin:</div>
              <input value={kioskPin} onChange={e => setKioskPin(e.target.value)} placeholder="PIN" style={{ flex: 1, height: 32, borderRadius: 6, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, width: 80 }} />
              <button onClick={handleSavePin} disabled={savingPin} style={{ height: 32, padding: "0 12px", borderRadius: 6, border: 0, background: warna.aksen, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: savingPin ? 0.7 : 1 }}>{savingPin ? "..." : "Simpan"}</button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 13 }}>Daftar Wajah Terdaftar ({filtered.length})</div>
          
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Memuat data wajah...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Tidak ada data wajah</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead style={{ background: "#f9fafb", textAlign: "left", fontSize: 11, color: "#6b7280" }}>
                  <tr>
                    <th style={{ padding: "10px 16px" }}>KARYAWAN</th>
                    <th style={{ padding: "10px 16px" }}>JABATAN</th>
                    <th style={{ padding: "10px 16px" }}>FACE DATA</th>
                    <th style={{ padding: "10px 16px" }}>TERDAFTAR</th>
                    <th style={{ padding: "10px 16px", textAlign: "right" }}>AKSI</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {f.fotoSample ? (
                            <img
                              src={f.fotoSample}
                              alt={f.pengguna?.nama || "Wajah"}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) e.currentTarget.nextSibling.style.display = "grid";
                              }}
                              style={{ width: 38, height: 38, borderRadius: 19, objectFit: "cover", border: "2px solid #10B981" }}
                            />
                          ) : null}
                          <div style={{ display: f.fotoSample ? "none" : "grid", width: 36, height: 36, borderRadius: 18, background: "#E4F3EA", placeItems: "center", fontWeight: 700, color: "#0B6E45" }}>
                            {(f.pengguna?.nama || "?")[0]}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: "#16233D" }}>{f.pengguna?.nama || "-"}</div>
                            <div style={{ fontSize: 11, color: "#6b7280" }}>{f.pengguna?.email || "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ fontWeight: 600 }}>{f.pengguna?.jabatan || "-"}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>{f.pengguna?.divisi || "-"}</div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <span style={{ background: "#E4F3EA", color: "#0B6E45", padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{f.descriptors?.length || 0} pose</span>
                          <span style={{ background: "#f3f4f6", color: "#6b7280", padding: "3px 8px", borderRadius: 99, fontSize: 10 }}>{f.quality || "KIOSK"}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: 11, color: "#6b7280" }}>
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString("id-ID") : "-"}<br/>
                        <span style={{ fontSize: 10 }}>{f.createdAt ? new Date(f.createdAt).toLocaleTimeString("id-ID") : ""}</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                          <button onClick={() => openEdit(f)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                          <button onClick={() => openDelete(f)} style={{ height: 28, padding: "0 10px", borderRadius: 6, border: 0, background: "#C0392B", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Delete Alert UI Consistent */}
      {showDeleteModal && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div style={{ width: 420, maxWidth: "100%", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 28, background: "#FBE7E4", border: "4px solid #FDF2F0", display: "grid", placeItems: "center", fontSize: 26, color: "#C0392B", marginBottom: 14 }}>
                🗑️
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#16233D" }}>Konfirmasi Hapus Wajah</div>
              <div style={{ fontSize: 13, color: "#5B6472", marginTop: 6, lineHeight: 1.5 }}>
                Apakah Anda yakin ingin menghapus sampel data wajah karyawan ini?
              </div>
            </div>

            {/* Target User Card */}
            <div style={{ marginTop: 16, padding: 12, borderRadius: 14, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", gap: 12 }}>
              {selected.fotoSample ? (
                <img src={selected.fotoSample} alt={selected.pengguna?.nama || "Wajah"} style={{ width: 44, height: 44, borderRadius: 22, objectFit: "cover", border: "2px solid #C0392B" }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 22, background: "#FBE7E4", color: "#C0392B", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 16 }}>
                  {(selected.pengguna?.nama || "?")[0]}
                </div>
              )}
              <div style={{ textAlign: "left", flex: 1, overflow: "hidden" }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#16233D", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selected.pengguna?.nama || "Karyawan"}
                </div>
                <div style={{ fontSize: 12, color: "#6B7280" }}>
                  {selected.pengguna?.jabatan || "-"} • {selected.pengguna?.divisi || "-"}
                </div>
              </div>
            </div>

            {/* Alert Notice */}
            <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "#FFFBEB", border: "1px solid #FCD34D", color: "#92400E", fontSize: 12, lineHeight: 1.4, display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <div>
                <b>Perhatian:</b> Setelah dihapus, karyawan tidak dapat melakukan presensi wajah di Kiosk sebelum mendaftarkan wajahnya kembali.
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                style={{ flex: 1, height: 42, borderRadius: 12, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
                Batal
              </button>
              <button
                disabled={deleting}
                onClick={handleDelete}
                style={{ flex: 1, height: 42, borderRadius: 12, border: 0, background: "#C0392B", color: "#FFFFFF", fontWeight: 700, fontSize: 13, cursor: deleting ? "not-allowed" : "pointer", opacity: deleting ? 0.7 : 1, transition: "all 0.15s" }}>
                {deleting ? "Menghapus..." : "Ya, Hapus Wajah"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit */}
      {showEditModal && selected && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.65)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }}>
          <div style={{ width: 420, maxWidth: "100%", background: "#fff", borderRadius: 20, padding: 24, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#16233D" }}>Edit Data - {selected.pengguna?.nama}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Edit data profil pengguna. Untuk ubah sampel wajah, silakan daftar ulang di Kiosk.</div>
            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Nama Lengkap</div>
                <input value={editData.nama} onChange={e => setEditData({ ...editData, nama: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 12px", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Jabatan</div>
                <input value={editData.jabatan} onChange={e => setEditData({ ...editData, jabatan: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 12px", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>Divisi</div>
                <input value={editData.divisi} onChange={e => setEditData({ ...editData, divisi: e.target.value })} style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #e5e7eb", padding: "0 12px", fontSize: 13, outline: "none" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowEditModal(false)} style={{ flex: 1, height: 42, borderRadius: 12, border: "1px solid #e5e7eb", background: "#fff", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Batal</button>
              <button onClick={handleEditSave} style={{ flex: 1, height: 42, borderRadius: 12, border: 0, background: warna.aksen, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
