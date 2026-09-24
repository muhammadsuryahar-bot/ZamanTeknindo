import { useState, useEffect, useRef } from "react";
import * as faceapi from "face-api.js";
import { API_URL, getToken } from "../utils/api";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ScanFace,
  RefreshCcw,
  ShieldCheck,
  User,
  Sparkles,
  Smile,
  Check,
  Lock
} from "lucide-react";
import { warna, font } from "../styles/theme";

const POSE = [
  { step: 1, label: "Pose 1: Wajah Lurus", hint: "Posisikan wajah tepat di tengah kamera dengan mata terbuka", icon: ScanFace },
  { step: 2, label: "Pose 2: Miringkan Sedikit / Senyum", hint: "Miringkan kepala sedikit atau ekspresi senyum alami", icon: Smile },
  { step: 3, label: "Pose 3: Pandangan Fokus", hint: "Tatap kamera secara fokus dan tahan sebentar", icon: Sparkles }
];

export default function RegistrasiWajah({ kembali, pengguna }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [modelOk, setModelOk] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const [loadingModel, setLoadingModel] = useState(true);
  const [pesan, setPesan] = useState("");
  
  // Enrollment Process States
  const [mode, setMode] = useState("idle"); // idle | scanning | success | error
  const [enrollStep, setEnrollStep] = useState(0);
  const [stableProgress, setStableProgress] = useState(0);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [sudahTerdaftar, setSudahTerdaftar] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Attach webcam stream to video element when camOk becomes true
  useEffect(() => {
    if (camOk && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [camOk]);

  // Load faceapi models & check face status
  useEffect(() => {
    mountedRef.current = true;
    async function loadModels() {
      try {
        setLoadingModel(true);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        if (mountedRef.current) {
          setModelOk(true);
          setLoadingModel(false);
        }
      } catch (e) {
        console.error("Gagal memuat model face-api:", e);
        if (mountedRef.current) {
          setPesan("Gagal memuat model pendeteksi wajah. Pastikan file /models tersedia.");
          setLoadingModel(false);
        }
      }
    }

    void loadModels();
    void cekStatusWajahSaya();

    return () => {
      mountedRef.current = false;
      matikanKamera();
    };
  }, []);

  async function cekStatusWajahSaya() {
    setLoadingStatus(true);
    try {
      const token = getToken();
      const r = await fetch(`${API_URL}/absensi/status-wajah-saya`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        if (d.hasFace) {
          setSudahTerdaftar(true);
        }
      }
    } catch {}
    finally {
      setLoadingStatus(false);
    }
  }

  async function bukaKamera() {
    matikanKamera();
    setPesan("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      setCamOk(true);
    } catch (err) {
      console.error("Akses kamera gagal:", err);
      setCamOk(false);
      setPesan("Gagal mengakses kamera. Pastikan izin kamera aktif pada browser kamu.");
    }
  }

  function matikanKamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCamOk(false);
  }

  async function mulaiMendaftarWajah() {
    if (!camOk || !modelOk) {
      setPesan("Kamera dan model pendeteksi wajah harus siap terlebih dahulu.");
      return;
    }

    setMode("scanning");
    setEnrollStep(0);
    setStableProgress(0);
    setPesan("");

    let fotoSample = null;
    const descriptors = [];
    try {
      for (let i = 0; i < 3; i++) {
        if (!mountedRef.current) return;
        setEnrollStep(i);
        let stable = 0;

        while (stable < 12) {
          if (!mountedRef.current) return;
          const det = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
            )
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (det) {
            stable++;
            setStableProgress((stable / 12) * 100);
          } else {
            stable = 0;
            setStableProgress(0);
          }
          await new Promise((r) => setTimeout(r, 90));
        }

        const fd = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (fd) {
          descriptors.push(Array.from(fd.descriptor));
          if (!fotoSample && videoRef.current) {
            try {
              const canvas = document.createElement("canvas");
              canvas.width = 320;
              canvas.height = 240;
              const ctx = canvas.getContext("2d");
              ctx.drawImage(videoRef.current, 0, 0, 320, 240);
              fotoSample = canvas.toDataURL("image/jpeg", 0.75);
            } catch (errSnap) {
              console.error("Gagal snap foto:", errSnap);
            }
          }
        }
      }

      if (descriptors.length < 3) {
        throw new Error("Perekaman pose wajah tidak lengkap. Silakan coba lagi.");
      }

      // Kirim ke backend
      setLoadingSubmit(true);
      const token = getToken();
      const r = await fetch(`${API_URL}/absensi/enroll-wajah`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ penggunaId: pengguna?.id, descriptors, fotoSample })
      });

      const resData = await r.json();
      if (r.ok) {
        setMode("success");
        setSudahTerdaftar(true);
        matikanKamera();
      } else {
        throw new Error(resData.message || "Gagal menyimpan data wajah ke server.");
      }
    } catch (err) {
      console.error("Proses pendaftaran wajah gagal:", err);
      setMode("error");
      setPesan(err.message || "Gagal merekam wajah. Pastikan pencahayaan cukup dan wajah terlihat jelas.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  const currentPose = POSE[enrollStep] || POSE[0];
  const PoseIcon = currentPose.icon;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {/* Header Navigation */}
        <div style={styles.header}>
          <button onClick={kembali} type="button" style={styles.backButton}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 style={styles.headerTitle}>Pendaftaran Wajah Presensi</h1>
            <p style={styles.headerSubtitle}>Registrasi sampel wajah untuk presensi otomatis di Kiosk</p>
          </div>
        </div>

        {/* User Card Info */}
        <div style={styles.userCard}>
          <div style={styles.userAvatar}>
            <User size={22} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={styles.userNama}>{pengguna?.nama || "Karyawan"}</div>
            <div style={styles.userSub}>{pengguna?.jabatan || "Karyawan"} • {pengguna?.divisi || "PT. Zaman Teknindo"}</div>
          </div>
          <span style={{ ...styles.statusBadge, background: sudahTerdaftar ? "#dcfce7" : "#fef3c7", color: sudahTerdaftar ? "#166534" : "#92400e" }}>
            {sudahTerdaftar ? "✅ Terdaftar di Admin" : "⚠️ Belum Terdaftar"}
          </span>
        </div>

        {/* Main Content Box */}
        {loadingStatus ? (
          <div style={styles.card}>
            <div style={styles.loadingBox}>
              <RefreshCcw size={22} className="spin-icon" style={{ color: "#2563eb", marginBottom: 10 }} />
              <div style={{ fontWeight: 700, fontSize: 13 }}>Mengecek Status Pendaftaran Wajah...</div>
            </div>
          </div>
        ) : sudahTerdaftar && mode !== "success" ? (
          /* JIKA SUDAH TERDAFTAR -> KUNCI KARTU REGISTRASI WAJAH */
          <div style={styles.card}>
            <div style={styles.startPanel}>
              <div style={styles.registeredIconCircle}>
                <ShieldCheck size={38} />
              </div>
              <h2 style={styles.startTitle}>Wajah Kamu Sudah Terdaftar!</h2>
              <p style={styles.startDesc}>
                Data sampel wajah kamu sudah tersimpan di database dan aktif di <b>Dashboard Admin & Kiosk</b>. Kamu tidak perlu melakukan registrasi wajah ulang.
              </p>

              <div style={styles.lockedInfoBadge}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span>Status: <b>Terdaftar & Siap Digunakan di Kiosk</b></span>
              </div>

              <div style={styles.lockNotice}>
                <Lock size={14} style={{ color: "#64748b" }} />
                <span>Jika terdapat perubahan wajah atau butuh pendaftaran ulang, silakan hubungi Administrator untuk menghapus sampel wajah lama.</span>
              </div>

              <button onClick={kembali} style={{ ...styles.primaryBtn, marginTop: 24 }} type="button">
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        ) : mode === "success" ? (
          /* SETELAH PENDAFTARAN BARU BERHASIL */
          <div style={styles.successCard}>
            <div style={styles.successIconCircle}>
              <CheckCircle2 size={36} />
            </div>
            <h2 style={styles.successTitle}>Pendaftaran Wajah Berhasil!</h2>
            <p style={styles.successDesc}>
              Data sampel wajah kamu telah berhasil terenkripsi dan tersimpan di database. Sekarang kamu dapat melakukan presensi otomatis di Kiosk.
            </p>
            <div style={styles.successMeta}>
              <ShieldCheck size={16} /> <span>Terdaftar di Kelola Wajah Admin Dashboard</span>
            </div>
            <div style={{ marginTop: 24 }}>
              <button onClick={kembali} style={styles.primaryBtn} type="button">
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        ) : (
          /* JIKA BELUM TERDAFTAR -> TAMPILKAN KAMERA UNTUK DAFTAR */
          <div style={styles.card}>
            {loadingModel ? (
              <div style={styles.loadingBox}>
                <RefreshCcw size={24} className="spin-icon" style={{ color: "#2563eb", marginBottom: 10 }} />
                <div style={{ fontWeight: 700, fontSize: 14 }}>Memuat Model Pendeteksi Wajah...</div>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Menyiapkan kecerdasan AI kamera</p>
              </div>
            ) : !camOk ? (
              <div style={styles.startPanel}>
                <div style={styles.camIconCircle}>
                  <ScanFace size={36} />
                </div>
                <h2 style={styles.startTitle}>Registrasi Wajah Baru</h2>
                <p style={styles.startDesc}>
                  Pendaftaran wajah membutuhkan akses kamera depan. Sistem akan merekam 3 pose wajah untuk akurasi presensi di Kiosk.
                </p>
                <button onClick={bukaKamera} style={styles.primaryBtn} type="button">
                  <Camera size={18} /> Aktifkan Kamera Belajar Wajah
                </button>
              </div>
            ) : (
              <div style={styles.camSection}>
                {/* Mode Scanning Indicator */}
                {mode === "scanning" && (
                  <div style={styles.poseHeader}>
                    <div style={styles.poseStepBadge}>
                      <PoseIcon size={16} />
                      <span>{currentPose.label}</span>
                    </div>
                    <div style={styles.progressTrack}>
                      <div style={{ ...styles.progressBar, width: `${stableProgress}%` }} />
                    </div>
                    <p style={styles.poseHint}>{currentPose.hint}</p>
                  </div>
                )}

                {/* Video Camera Container */}
                <div style={styles.videoBox}>
                  <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
                  <div style={styles.overlayFrame}>
                    <div style={{ ...styles.guideCircle, borderColor: mode === "scanning" ? "#22c55e" : "#3b82f6" }} />
                    <div style={styles.guideText}>
                      {mode === "scanning" ? `Tahan Posisi (${Math.round(stableProgress)}%)` : "Posisikan Wajah di Lingkaran"}
                    </div>
                  </div>
                </div>

                {/* Steps Indicator */}
                <div style={styles.stepsRow}>
                  {POSE.map((p, idx) => (
                    <div
                      key={p.step}
                      style={{
                        ...styles.stepItem,
                        background: idx < enrollStep ? "#dcfce7" : idx === enrollStep && mode === "scanning" ? "#eff6ff" : "#f8fafc",
                        borderColor: idx === enrollStep && mode === "scanning" ? "#3b82f6" : "#e2e8f0",
                        color: idx < enrollStep ? "#166534" : idx === enrollStep && mode === "scanning" ? "#1d4ed8" : "#64748b"
                      }}
                    >
                      {idx < enrollStep ? <Check size={14} /> : <span>{p.step}</span>}
                      <span>{p.label.split(":")[0]}</span>
                    </div>
                  ))}
                </div>

                {/* Submit / Scan Buttons */}
                <div style={{ marginTop: 18 }}>
                  {mode === "scanning" ? (
                    <div style={styles.scanningNotice}>
                      <RefreshCcw size={16} className="spin-icon" />
                      <span>Sedang Merekam Pose {enrollStep + 1} dari 3... Tahan wajah kamu</span>
                    </div>
                  ) : (
                    <button onClick={mulaiMendaftarWajah} disabled={loadingSubmit} style={styles.primaryBtn} type="button">
                      <Sparkles size={18} /> Mulai Registrasi Wajah (3 Pose)
                    </button>
                  )}
                </div>
              </div>
            )}

            {pesan && (
              <div style={styles.errorAlert}>
                <AlertCircle size={18} />
                <span>{pesan}</span>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .spin-icon { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100dvh",
    background: "#f8fafc",
    fontFamily: font.display,
    padding: "20px 14px",
    boxSizing: "border-box"
  },
  shell: {
    maxWidth: 480,
    margin: "0 auto"
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 18
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#0f172a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
    margin: 0,
    letterSpacing: "-0.01em"
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    margin: "2px 0 0"
  },
  userCard: {
    background: "#ffffff",
    borderRadius: 14,
    padding: "14px 16px",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
    boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    background: "#eff6ff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  userNama: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0f172a"
  },
  userSub: {
    fontSize: 11.5,
    color: "#64748b",
    marginTop: 2
  },
  statusBadge: {
    padding: "4px 10px",
    borderRadius: 99,
    fontSize: 10.5,
    fontWeight: 700,
    whiteSpace: "nowrap"
  },
  card: {
    background: "#ffffff",
    borderRadius: 16,
    padding: 20,
    border: "1px solid #e2e8f0",
    boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
  },
  loadingBox: {
    textAlign: "center",
    padding: "40px 20px"
  },
  startPanel: {
    textAlign: "center",
    padding: "24px 12px"
  },
  camIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: "#eff6ff",
    color: "#2563eb",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px"
  },
  registeredIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px"
  },
  lockedInfoBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    borderRadius: 12,
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    fontSize: 12.5,
    margin: "16px 0 12px"
  },
  lockNotice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 10,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11.5,
    lineHeight: 1.45,
    textAlign: "left",
    margin: "0 auto",
    maxWidth: 380
  },
  startTitle: {
    fontSize: 17,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 6px"
  },
  startDesc: {
    fontSize: 12.5,
    color: "#64748b",
    lineHeight: 1.5,
    margin: "0 0 16px"
  },
  camSection: {
    textAlign: "center"
  },
  poseHeader: {
    marginBottom: 14,
    textAlign: "center"
  },
  poseStepBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 14px",
    borderRadius: 99,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 10
  },
  progressTrack: {
    height: 6,
    background: "#e2e8f0",
    borderRadius: 99,
    overflow: "hidden",
    maxWidth: 240,
    margin: "0 auto 8px"
  },
  progressBar: {
    height: "100%",
    background: "#22c55e",
    transition: "width 0.15s ease"
  },
  poseHint: {
    fontSize: 11.5,
    color: "#64748b",
    margin: 0
  },
  videoBox: {
    position: "relative",
    width: "100%",
    aspectRatio: "4/3",
    borderRadius: 16,
    overflow: "hidden",
    background: "#0f172a"
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: "scaleX(-1)"
  },
  overlayFrame: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center"
  },
  guideCircle: {
    width: 170,
    height: 170,
    borderRadius: 999,
    border: "3px dashed #3b82f6",
    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
    transition: "border-color 0.2s ease"
  },
  guideText: {
    marginTop: 12,
    background: "rgba(15, 23, 42, 0.75)",
    backdropFilter: "blur(4px)",
    color: "#ffffff",
    padding: "4px 12px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700
  },
  stepsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    marginTop: 16
  },
  stepItem: {
    padding: "8px 6px",
    borderRadius: 10,
    border: "1px solid #e2e8f0",
    fontSize: 11,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  scanningNotice: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12.5,
    fontWeight: 700
  },
  primaryBtn: {
    width: "100%",
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 12,
    border: 0,
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 13.5,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 4px 12px rgba(37, 99, 235, 0.25)"
  },
  secondaryBtn: {
    flex: 1,
    minHeight: 46,
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  errorAlert: {
    marginTop: 14,
    padding: "10px 12px",
    borderRadius: 10,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#dc2626",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    gap: 8
  },
  successCard: {
    background: "#ffffff",
    borderRadius: 18,
    padding: 28,
    border: "1px solid #e2e8f0",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    background: "#dcfce7",
    color: "#166534",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px"
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 800,
    color: "#0f172a",
    margin: "0 0 8px"
  },
  successDesc: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.55,
    margin: "0 0 20px"
  },
  successMeta: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 99,
    background: "#f1f5f9",
    color: "#334155",
    fontSize: 11.5,
    fontWeight: 700
  }
};
