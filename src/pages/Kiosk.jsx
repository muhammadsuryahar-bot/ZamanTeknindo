import { useEffect, useRef, useState, useMemo } from "react";
import * as faceapi from "face-api.js";
import { warna, font } from "../styles/theme";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const KIOSK_KEY = import.meta.env.VITE_KIOSK_KEY || "kiosk_rahasia_zaman_2025";

const JAM_MASUK_MAX = 8 * 60 + 10;
const JAM_PULANG_MIN = 17 * 60;
const POPUP_DURATION_SECONDS = 15;

async function ambilAlamatKiosk(latitude, longitude) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) throw new Error(`Nominatim HTTP ${response.status}`);
    const data = await response.json();
    const alamat = data.address || {};
    const jalan = alamat.road || alamat.pedestrian || alamat.residential || null;
    const kecamatan = alamat.suburb || alamat.city_district || alamat.district || alamat.village || null;
    const kota = alamat.city || alamat.town || alamat.municipality || alamat.county || null;
    const provinsi = alamat.state || alamat.province || null;
    const bagian = [jalan, kecamatan, kota, provinsi].filter(Boolean);
    return bagian.length ? bagian.join(", ") : null;
  } catch {
    return null;
  }
}

function useWIBClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const wib = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }),
  );
  const menit = wib.getHours() * 60 + wib.getMinutes();
  const jam = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(now);
  const tanggal = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const isTerlambat = menit > JAM_MASUK_MAX && menit <= JAM_MASUK_MAX + 120;
  const isMasukDitutup = menit > JAM_MASUK_MAX + 120 && menit < JAM_PULANG_MIN;
  const isPulang = menit >= JAM_PULANG_MIN;
  const statusJam = isTerlambat
    ? `TERLAMBAT • Lewat 08:10`
    : isMasukDitutup
      ? `Masuk Ditutup • Pulang 17:00`
      : isPulang
        ? `Jam Pulang • Mulai 17:00`
        : `Jam Masuk • Max 08:10`;
  return {
    jam,
    tanggal,
    menit,
    isTerlambat,
    isMasukDitutup,
    isPulang,
    statusJam,
  };
}

const POSE = [
  { label: "HADAP DEPAN", sub: "Lihat lurus", icon: "◉" },
  { label: "TENGOK KIRI", sub: "Putar 30° kiri", icon: "◐" },
  { label: "TENGOK KANAN", sub: "Putar 30° kanan", icon: "◑" },
];

export default function Kiosk() {
  const videoRef = useRef(null);
  const { jam, tanggal, isTerlambat, isMasukDitutup, isPulang, statusJam } =
    useWIBClock();
  const [modelOk, setModelOk] = useState(false);
  const [camOk, setCamOk] = useState(false);
  const [mode, setMode] = useState("idle");
  const [status, setStatus] = useState("Memuat model...");
  const [users, setUsers] = useState([]);
  const [cari, setCari] = useState("");
  const [tab, setTab] = useState("belum");
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [selected, setSelected] = useState(null);
  const [enrollStep, setEnrollStep] = useState(0);
  const [stableProgress, setStableProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);
  const [guidance, setGuidance] = useState("Posisikan wajah di dalam kotak");
  const [loadingAbsen, setLoadingAbsen] = useState(false);
  const [detectedUser, setDetectedUser] = useState(null);
  const recognizeLockRef = useRef(false);
  const [showHasil, setShowHasil] = useState(false);
  const [hasilAbsen, setHasilAbsen] = useState(null);
  const [countdown, setCountdown] = useState(POPUP_DURATION_SECONDS);
  const [toast, setToast] = useState(null);
  const [toastCountdown, setToastCountdown] = useState(POPUP_DURATION_SECONDS);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const cachedFacesRef = useRef([]);

  const [showFallback, setShowFallback] = useState(false);
  const [fallbackCari, setFallbackCari] = useState("");
  const [fallbackSelected, setFallbackSelected] = useState(null);
  const [fallbackAlasan, setFallbackAlasan] = useState(
    "Wajah tidak terdeteksi",
  );
  const [fallbackPin, setFallbackPin] = useState("");
  const [attemptAt, setAttemptAt] = useState(null); // Jam asli klik pertama - solusi telat 08.09 -> 08.11
  const [fallbackError, setFallbackError] = useState("");
  const [fallbackConflict, setFallbackConflict] = useState(null);
  const [fallbackStatusInfo, setFallbackStatusInfo] = useState(null);
  const [fallbackLoading, setFallbackLoading] = useState(false);

  const [showManual, setShowManual] = useState(false);
  const [manualUser, setManualUser] = useState(null);
  const [manualAlasan, setManualAlasan] = useState(
    "Deteksi wajah tidak tersedia",
  );
  const [manualCari, setManualCari] = useState("");

  // Request izin lokasi langsung saat halaman Kiosk diakses
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log("Izin lokasi Kiosk disetujui:", pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn("Izin lokasi Kiosk ditolak/gagal:", err.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri("/models"),
          faceapi.nets.faceLandmark68Net.loadFromUri("/models"),
          faceapi.nets.faceRecognitionNet.loadFromUri("/models"),
        ]);
        setModelOk(true);
        setStatus("Posisikan wajah di dalam kotak");
      } catch {
        setStatus("Model gagal load - cek public/models");
      }
    })();
  }, []);

  useEffect(() => {
    if (!modelOk) return;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          await videoRef.current.play();
          setCamOk(true);
        }
      } catch {
        setStatus("Klik ikon gembok di address bar > Allow camera");
      }
    })();
  }, [modelOk]);

  // GUIDANCE - OPTIMIZED: interval 300ms, inputSize 160 (jauh lebih cepat)
  useEffect(() => {
    if (!modelOk || !camOk || !videoRef.current) return;
    const id = setInterval(async () => {
      try {
        const det = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 160 }),
          )
          .withFaceLandmarks();
        if (det) {
          setFaceDetected(true);
          const box = det.detection.box;
          const vw = videoRef.current.videoWidth || 1280;
          const vh = videoRef.current.videoHeight || 720;
          const cx = (box.x + box.width / 2) / vw;
          const cy = (box.y + box.height / 2) / vh;
          const sr = box.width / vw;
          let g = "";
          if (sr < 0.15) g = "Mendekat sedikit → kekecilan";
          else if (sr > 0.45) g = "Menjauh sedikit → kebesaran";
          else if (cx < 0.35) g = "Geser ke kanan sedikit";
          else if (cx > 0.65) g = "Geser ke kiri sedikit";
          else if (cy < 0.3) g = "Turunkan kepala sedikit";
          else if (cy > 0.7) g = "Angkat kepala sedikit";
          else
            g =
              mode === "scanning-enroll"
                ? `${POSE[enrollStep].label} - tahan ${Math.round(stableProgress)}%`
                : "Posisi bagus - siap";
          setGuidance(g);
          if (mode === "idle" && !selected) setStatus(g);
        } else {
          setFaceDetected(false);
          setGuidance("Posisikan wajah di dalam kotak");
          if (mode === "idle") setStatus("Posisikan wajah di dalam kotak");
        }
      } catch {}
    }, 300);
    return () => clearInterval(id);
  }, [modelOk, camOk, mode, enrollStep, stableProgress, selected]);

  // LIVE PRE-RECOGNITION LOOP (Bahkan Sebelum Klik Presensi!)
  useEffect(() => {
    if (
      !modelOk ||
      !camOk ||
      !videoRef.current ||
      mode !== "idle" ||
      loadingAbsen ||
      showHasil ||
      showFallback
    ) {
      setDetectedUser(null);
      return;
    }

    const iv = setInterval(async () => {
      if (recognizeLockRef.current) return;
      try {
        recognizeLockRef.current = true;
        const det = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.45 }),
          )
          .withFaceDescriptor();

        if (det) {
          const pengguna = await recognizeDescriptor(det.descriptor);
          setDetectedUser(pengguna);
        } else {
          setDetectedUser(null);
        }
      } catch {
        // quiet error
      } finally {
        recognizeLockRef.current = false;
      }
    }, 700);

    return () => clearInterval(iv);
  }, [modelOk, camOk, mode, loadingAbsen, showHasil, showFallback]);

  useEffect(() => {
    if (!showHasil) return;
    setCountdown(POPUP_DURATION_SECONDS);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setShowHasil(false);
          setHasilAbsen(null);
          return POPUP_DURATION_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [showHasil]);

  useEffect(() => {
    if (!toast) return;
    setToastCountdown(POPUP_DURATION_SECONDS);
    const iv = setInterval(() => {
      setToastCountdown((c) => {
        if (c <= 1) {
          clearInterval(iv);
          setToast(null);
          return POPUP_DURATION_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [toast]);

  const checkOfflineQueueCount = () => {
    try {
      const q = JSON.parse(localStorage.getItem("kiosk_offline_queue") || "[]");
      setOfflineQueueCount(q.length);
    } catch {
      setOfflineQueueCount(0);
    }
  };

  async function syncKioskOfflineQueue() {
    try {
      const q = JSON.parse(localStorage.getItem("kiosk_offline_queue") || "[]");
      if (!q || !q.length) return;
      const sisa = [];
      for (const item of q) {
        try {
          const endpoint = item.isManual
            ? `${API_BASE}/kiosk/manual-fallback`
            : `${API_BASE}/kiosk/absen`;
          const r = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-kiosk-key": KIOSK_KEY,
              "X-Zaman-Background": "offline-sync",
            },
            body: JSON.stringify(item.payload),
          });
          let responseData = {};
          try {
            responseData = await r.json();
          } catch {}
          const responseText = String(
            responseData.message || responseData.pesan || "",
          ).toLowerCase();
          const sudahTercatat =
            r.ok ||
            r.status === 409 ||
            (r.status === 400 &&
              (responseText.includes("sudah absen") ||
                responseText.includes("sudah melakukan absen") ||
                responseText.includes("presensi hari ini telah lengkap") ||
                responseText.includes("pengajuan verifikasi sudah ada")));
          if (!sudahTercatat) {
            sisa.push(item);
          }
        } catch {
          sisa.push(item);
        }
      }
      localStorage.setItem("kiosk_offline_queue", JSON.stringify(sisa));
      setOfflineQueueCount(sisa.length);
    } catch {}
  }

  useEffect(() => {
    checkOfflineQueueCount();
    const handleOnline = () => {
      setIsOnline(true);
      syncKioskOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = setInterval(() => {
      checkOfflineQueueCount();
      if (navigator.onLine) {
        syncKioskOfflineQueue();
      }
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      const cached = JSON.parse(
        localStorage.getItem("kiosk_cached_users") || "[]",
      );
      if (Array.isArray(cached)) setUsers(cached);
      cachedFacesRef.current = JSON.parse(
        localStorage.getItem("kiosk_cached_faces") || "[]",
      );
    } catch {
      cachedFacesRef.current = [];
    }
    void loadUsers();
  }, []);
  async function loadUsers() {
    const usersPromise = fetch(`${API_BASE}/kiosk/pengguna-list`, {
      headers: { "x-kiosk-key": KIOSK_KEY },
    });
    const facesPromise = fetch(`${API_BASE}/kiosk/faces`, {
      headers: { "x-kiosk-key": KIOSK_KEY },
    });

    try {
      const usersResponse = await usersPromise;
      if (usersResponse.ok) {
        const d = await usersResponse.json();
        const list = Array.isArray(d) ? d : d.data || [];
        setUsers(list);
        localStorage.setItem("kiosk_cached_users", JSON.stringify(list));
      }
    } catch {}

    try {
      const facesResponse = await facesPromise;
      if (facesResponse.ok) {
        const faces = await facesResponse.json();
        cachedFacesRef.current = Array.isArray(faces) ? faces : [];
        localStorage.setItem("kiosk_cached_faces", JSON.stringify(cachedFacesRef.current));
      }
    } catch {}
  }

  function recognizeFromCache(descriptor) {
    let bestFace = null;
    let bestDistance = Infinity;
    for (const face of cachedFacesRef.current) {
      for (const savedDescriptor of face.descriptors || []) {
        if (!Array.isArray(savedDescriptor) || savedDescriptor.length !== descriptor.length) continue;
        const distance = faceapi.euclideanDistance(descriptor, savedDescriptor);
        if (distance < bestDistance) {
          bestDistance = distance;
          bestFace = face;
        }
      }
    }
    if (!bestFace || bestDistance >= 0.5) return null;
    return users.find((user) => user.id === bestFace.penggunaId) || null;
  }

  async function recognizeDescriptor(descriptor) {
    const descriptorArray = Array.from(descriptor);
    if (!navigator.onLine) return recognizeFromCache(descriptorArray);

    try {
      const response = await fetch(`${API_BASE}/kiosk/recognize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": KIOSK_KEY,
        },
        body: JSON.stringify({ descriptor: descriptorArray }),
      });
      if (!response.ok) throw new Error("Pengenalan wajah gagal");
      const result = await response.json();
      return result.matched ? result.pengguna : null;
    } catch {
      return recognizeFromCache(descriptorArray);
    }
  }
  async function verifyPin() {
    if (!pin.trim()) {
      setPinError("PIN tidak boleh kosong");
      return;
    }
    try {
      const r = await fetch(`${API_BASE}/kiosk/verify-admin-pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": KIOSK_KEY,
        },
        body: JSON.stringify({ pin }),
      });
      if (r.ok) {
        setUnlocked(true);
        setShowPin(false);
        setPin("");
        setPinError("");
        loadUsers();
      } else {
        setPinError("PIN salah!");
        setPin("");
      }
    } catch {
      setPinError("Gagal verifikasi");
    }
  }

  const filtered = useMemo(() => {
    let list =
      tab === "belum"
        ? users.filter((u) => !u.hasFace)
        : users.filter((u) => u.hasFace);
    if (cari)
      list = list.filter((u) =>
        u.nama.toLowerCase().includes(cari.toLowerCase()),
      );
    return list;
  }, [users, cari, tab]);
  const belumCount = users.filter((u) => !u.hasFace).length;
  const sudahCount = users.filter((u) => u.hasFace).length;

  async function handleEnroll() {
    if (!selected) return;
    setMode("scanning-enroll");
    setEnrollStep(0);
    setStableProgress(0);
    let fotoSample = null;
    const descriptors = [];
    try {
      for (let i = 0; i < 3; i++) {
        setEnrollStep(i);
        let stable = 0;
        while (stable < 14) {
          const det = await faceapi
            .detectSingleFace(
              videoRef.current,
              new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
            )
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (det) {
            stable++;
            setStableProgress((stable / 14) * 100);
          } else {
            stable = 0;
            setStableProgress(0);
          }
          await new Promise((r) => setTimeout(r, 80));
        }
        const fd = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224 }),
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
              console.error("Gagal ambil sampel foto Kiosk:", errSnap);
            }
          }
        }
      }
      const r = await fetch(`${API_BASE}/kiosk/enroll`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-kiosk-key": KIOSK_KEY,
        },
        body: JSON.stringify({ penggunaId: selected.id, descriptors, fotoSample }),
      });
      if (r.ok) {
        setToast({
          nama: selected.nama,
          jabatan: selected.jabatan,
          divisi: selected.divisi,
          message: "Wajah tersimpan!",
          detail: "3 pose berhasil - siap presensi",
        });
        setSelected(null);
        loadUsers();
      }
    } catch (e) {
      alert(e.message);
    }
    setMode("idle");
    setStableProgress(0);
  }

  async function handlePresensi() {
    if (loadingAbsen) return;
    try {
      const attempt = new Date();
      const startTime = Date.now();
      setAttemptAt(attempt); // SIMPAN JAM KLIK PERTAMA
      setLoadingAbsen(true);
      setStatus("Scanning & Verifikasi Biometrik...");

      let pengguna = detectedUser;

      if (!pengguna) {
        // FAST: inputSize 224, scoreThreshold 0.5
        const det = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({
              inputSize: 224,
              scoreThreshold: 0.5,
            }),
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!det) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed));
          setHasilAbsen({
            type: "error",
            message: "Wajah tidak terdeteksi!",
            detail: "Posisikan wajah tepat di area sensor kamera",
            status: "gagal",
          });
          setShowHasil(true);
          setLoadingAbsen(false);
          return;
        }

        pengguna = await recognizeDescriptor(det.descriptor);
        if (!pengguna) {
          const elapsed = Date.now() - startTime;
          if (elapsed < 900) await new Promise((r) => setTimeout(r, 900 - elapsed));
          setHasilAbsen({
            type: "tidak_dikenal",
            message: "Wajah tidak dikenali!",
            detail: "Daftarkan wajah terlebih dahulu di menu Kiosk",
            status: "tidak_dikenal",
          });
          setShowHasil(true);
          setLoadingAbsen(false);
          return;
        }
      }

      // Pastikan animasi laser scanner tayang minimal 1 detik untuk pengalaman visual menarik
      const elapsed = Date.now() - startTime;
      if (elapsed < 900) {
        await new Promise((r) => setTimeout(r, 900 - elapsed));
      }

      let lat = null,
        lng = null,
        akurasi = null;
      try {
        const p = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 }),
        );
        lat = p.coords.latitude;
        lng = p.coords.longitude;
        akurasi = Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null;
      } catch {}
      const alamat = lat !== null && lng !== null ? await ambilAlamatKiosk(lat, lng) : null;

      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoRef.current, 0, 0, 320, 240);
      const foto = canvas.toDataURL("image/jpeg", 0.5);

      let r2;
      try {
        r2 = await fetch(`${API_BASE}/kiosk/absen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiosk-key": KIOSK_KEY,
          },
          body: JSON.stringify({
            penggunaId: pengguna.id,
            foto,
            latitude: lat,
            longitude: lng,
            akurasi,
            alamat,
            tipe: "auto",
            waktuAsli: (attempt || new Date()).toISOString(),
          }),
        });
        if (r2.status >= 500) {
          throw new Error(`Server belum tersedia (${r2.status})`);
        }
      } catch (netErr) {
        const itemOffline = {
          id: Date.now(),
          isManual: false,
          payload: {
            penggunaId: pengguna.id,
            foto,
            latitude: lat,
            longitude: lng,
            akurasi,
            alamat,
            tipe: "auto",
            waktuAsli: (attempt || new Date()).toISOString(),
          },
        };
        const currentQueue = JSON.parse(
          localStorage.getItem("kiosk_offline_queue") || "[]",
        );
        currentQueue.push(itemOffline);
        localStorage.setItem(
          "kiosk_offline_queue",
          JSON.stringify(currentQueue),
        );
        checkOfflineQueueCount();

        const jamNow = new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setHasilAbsen({
          type: "sukses",
          nama: pengguna.nama,
          jabatan: pengguna.jabatan,
          divisi: pengguna.divisi,
          email: pengguna.email,
          message: "ABSENSI TERSIMPAN (OFFLINE)",
          statusOtomatis: "tercatat_offline",
          jam: jamNow,
          tipe: "masuk",
          detail:
            "Koneksi internet terputus. Data absensi Anda telah disimpan di Kiosk dan akan disinkronkan otomatis ke server saat jaringan kembali pulih.",
          isOffline: true,
        });
        setShowHasil(true);
        setDetectedUser(null);
        setLoadingAbsen(false);
        return;
      }
      const j2 = await r2.json();
      if (r2.ok) {
        setHasilAbsen({
          type: "sukses",
          nama: pengguna.nama,
          jabatan: pengguna.jabatan,
          divisi: pengguna.divisi,
          email: pengguna.email,
          message: j2.message || "Presensi berhasil",
          statusOtomatis: j2.statusOtomatis || j2.status || "tepat_waktu",
          jam:
            j2.jamMasuk ||
            j2.jamPulang ||
            new Date().toLocaleTimeString("id-ID"),
          tipe: j2.tipe || (j2.jamPulang ? "pulang" : "masuk"),
          data: j2.data,
          detail: j2.detail,
        });
      } else {
        setHasilAbsen({
          type: "gagal",
          nama: pengguna.nama,
          jabatan: pengguna.jabatan,
          message: j2.message || "Gagal absen",
          status: j2.status || "gagal",
        });
      }
      setShowHasil(true);
      setDetectedUser(null);
    } catch (e) {
      setHasilAbsen({
        type: "error",
        message: "Error sistem",
        detail: e.message,
        status: "error",
      });
      setShowHasil(true);
    }
    setLoadingAbsen(false);
  }

  async function checkFallbackUserStatus(userId) {
    try {
      const r = await fetch(`${API_BASE}/kiosk/status/${userId}`, {
        headers: { "x-kiosk-key": KIOSK_KEY },
      });
      if (r.ok) {
        const d = await r.json();
        setFallbackStatusInfo(d);
        // Cegah bentrok: kalau sudah absen lengkap
        if (d.sudahLengkap) {
          setFallbackConflict(
            `User ini sudah absen lengkap (masuk ${d.data?.jamMasuk ? new Date(d.data.jamMasuk).toLocaleTimeString("id-ID") : "-"} + pulang ${d.data?.jamPulang ? new Date(d.data.jamPulang).toLocaleTimeString("id-ID") : "-"}). Jika salah pilih, batalkan.`,
          );
        } else if (d.sudahMasuk && d.tipeSelanjutnya === "pulang") {
          setFallbackConflict(
            `User ini sudah absen masuk jam ${d.data?.jamMasuk ? new Date(d.data.jamMasuk).toLocaleTimeString("id-ID") : "-"} hari ini. Apakah ini absen PULANG atau salah pilih user?`,
          );
        } else {
          setFallbackConflict(null);
        }
        return d;
      }
    } catch {}
    return null;
  }

  async function handleFallbackAbsen() {
    if (!fallbackSelected) {
      setFallbackError("Pilih karyawan dulu");
      return;
    }
    setFallbackLoading(true);
    setFallbackError("");
    setFallbackConflict(null);
    try {
      let lat = null,
        lng = null,
        akurasi = null;
      try {
        const p = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2000 }),
        );
        lat = p.coords.latitude;
        lng = p.coords.longitude;
        akurasi = Number.isFinite(p.coords.accuracy) ? Math.round(p.coords.accuracy) : null;
      } catch {}
      const alamat = lat !== null && lng !== null ? await ambilAlamatKiosk(lat, lng) : null;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0, 320, 240);
      const foto = canvas.toDataURL("image/jpeg", 0.5);
      // Kirim attemptAt = jam asli klik pertama, bukan jam sekarang (solusi 08.09 error -> 08.11 tetap tepat waktu)
      let r;
      try {
        r = await fetch(`${API_BASE}/kiosk/manual-fallback`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-kiosk-key": KIOSK_KEY,
          },
          body: JSON.stringify({
            penggunaId: fallbackSelected.id,
            foto,
            latitude: lat,
            longitude: lng,
            akurasi,
            alamat,
            alasan: fallbackAlasan,
            attemptAt: attemptAt
              ? attemptAt.toISOString()
              : new Date().toISOString(),
            tipe: "auto",
          }),
        });
      } catch (netErr) {
        const itemOffline = {
          id: Date.now(),
          isManual: true,
          payload: {
            penggunaId: fallbackSelected.id,
            foto,
            latitude: lat,
            longitude: lng,
            akurasi,
            alamat,
            alasan: fallbackAlasan,
            attemptAt: attemptAt
              ? attemptAt.toISOString()
              : new Date().toISOString(),
            tipe: "auto",
          },
        };
        const currentQueue = JSON.parse(
          localStorage.getItem("kiosk_offline_queue") || "[]",
        );
        currentQueue.push(itemOffline);
        localStorage.setItem(
          "kiosk_offline_queue",
          JSON.stringify(currentQueue),
        );
        checkOfflineQueueCount();

        setShowFallback(false);
        const attemptJam = attemptAt
          ? `${String(attemptAt.getHours()).padStart(2, "0")}:${String(attemptAt.getMinutes()).padStart(2, "0")}`
          : new Date().toLocaleTimeString("id-ID");
        setFallbackSelected(null);
        setFallbackCari("");
        setFallbackAlasan("Wajah tidak terdeteksi");
        setFallbackStatusInfo(null);
        setFallbackConflict(null);
        setHasilAbsen({
          type: "sukses",
          nama: fallbackSelected.nama,
          jabatan: fallbackSelected.jabatan,
          divisi: fallbackSelected.divisi,
          email: fallbackSelected.email,
          message: "PENGAJUAN MANUAL TERSIMPAN (OFFLINE)",
          statusOtomatis: "manual_offline",
          jam: attemptJam,
          tipe: "masuk",
          isManualPending: true,
          detail: `Diajukan jam ${attemptJam} WIB • Tersimpan offline di Kiosk • Akan disinkronkan otomatis ke admin begitu koneksi online kembali.`,
          isOffline: true,
        });
        setShowHasil(true);
        setAttemptAt(null);
        setFallbackLoading(false);
        return;
      }
      const j = await r.json();
      if (r.ok) {
        setShowFallback(false);
        const attemptJam = attemptAt
          ? `${String(attemptAt.getHours()).padStart(2, "0")}:${String(attemptAt.getMinutes()).padStart(2, "0")}`
          : new Date().toLocaleTimeString("id-ID");
        setFallbackSelected(null);
        setFallbackCari("");
        setFallbackAlasan("Wajah tidak terdeteksi");
        setFallbackStatusInfo(null);
        setFallbackConflict(null);
        setHasilAbsen({
          type: "sukses",
          nama: j.data?.pengguna?.nama || fallbackSelected.nama,
          jabatan: j.data?.pengguna?.jabatan || fallbackSelected.jabatan,
          divisi: fallbackSelected.divisi,
          email: fallbackSelected.email,
          message:
            j.message + (j.conflict ? " (Ada konflik - admin akan cek)" : ""),
          statusOtomatis: j.statusOtomatis || "manual",
          jam: j.attemptJam || attemptJam,
          tipe: j.data?.tipe || "masuk",
          data: j.data,
          isManualPending: true,
          detail: `Diajukan jam ${attemptJam} WIB (asli klik) • Alasan: ${fallbackAlasan} • Menunggu verifikasi admin`,
        });
        setShowHasil(true);
        setAttemptAt(null);
      } else {
        setFallbackError(j.message || "Gagal ajukan manual");
        if (j.message?.includes("pending") || j.message?.includes("lengkap")) {
          setFallbackConflict(j.message);
        }
      }
    } catch (e) {
      setFallbackError(e.message);
    }
    setFallbackLoading(false);
  }

  const isEnrolling = mode === "scanning-enroll";
  const currentPose = POSE[enrollStep] || POSE[0];
  const buttonColor = selected
    ? "#2563EB"
    : isTerlambat
      ? "#EAB308"
      : isMasukDitutup
        ? "#6b7280"
        : "#0B6E45";

  // Warna popup sesuai status kehadiran
  const getStatusColor = (status) => {
    if (!status)
      return {
        bg: "#F3F4F6",
        badgeBg: "#E5E7EB",
        badgeColor: "#374151",
        iconBg: "#6B7280",
        label: "-",
      };
    const s = status.toLowerCase();
    if (s.includes("telat") || s.includes("terlambat"))
      return {
        bg: "#FEF3C7",
        badgeBg: "#FDE68A",
        badgeColor: "#92400E",
        iconBg: "#EAB308",
        label: "TERLAMBAT",
      };
    if (s.includes("tepat") || s.includes("tepat_waktu"))
      return {
        bg: "#DCFCE7",
        badgeBg: "#BBF7D0",
        badgeColor: "#166534",
        iconBg: "#16A34A",
        label: "TEPAT WAKTU",
      };
    if (s.includes("pulang"))
      return {
        bg: "#DBEAFE",
        badgeBg: "#BFDBFE",
        badgeColor: "#1E40AF",
        iconBg: "#2563EB",
        label: "PULANG",
      };
    if (s.includes("masuk"))
      return {
        bg: "#DCFCE7",
        badgeBg: "#BBF7D0",
        badgeColor: "#166534",
        iconBg: "#16A34A",
        label: "MASUK",
      };
    return {
      bg: "#F3F4F6",
      badgeBg: "#E5E7EB",
      badgeColor: "#374151",
      iconBg: "#6B7280",
      label: status.toUpperCase(),
    };
  };
  const statusStyle = getStatusColor(
    hasilAbsen?.statusOtomatis || hasilAbsen?.status,
  );

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0B1215",
        fontFamily: font.display,
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: "scaleX(-1)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 28%, rgba(11,18,21,0.75) 78%)",
          pointerEvents: "none",
        }}
      />

      {!unlocked && (
        <div style={{ position: "absolute", top: 16, left: 16, zIndex: 20 }}>
          <button
            onClick={() => setShowPin(true)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #e5e7eb",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#16233D"
              strokeWidth="2"
            >
              <rect x="3" y="11" width="18" height="11" rx="3" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          </button>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            padding: "12px 18px",
            borderRadius: 16,
            background: "#16233D",
            border: "1px solid rgba(255,255,255,0.12)",
            minWidth: 150,
            textAlign: "right",
          }}
        >
          <div
            style={{
              color: "#fff",
              fontSize: 28,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {jam}
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: 11,
              marginTop: 4,
            }}
          >
            {tanggal}
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "4px 10px",
              borderRadius: 99,
              background: isTerlambat
                ? "#FEF3C7"
                : isMasukDitutup
                  ? "#FEE2E2"
                  : isPulang
                    ? "#DBEAFE"
                    : "#DCFCE7",
              color: isTerlambat
                ? "#92400E"
                : isMasukDitutup
                  ? "#991B1B"
                  : isPulang
                    ? "#1E40AF"
                    : "#065F46",
              fontSize: 9.5,
              fontWeight: 800,
              textAlign: "center",
            }}
          >
            {statusJam}
          </div>
          {!isOnline && (
            <div
              style={{
                marginTop: 4,
                padding: "2px 8px",
                borderRadius: 99,
                background: "#EF4444",
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              ⚡ OFFLINE MODE
            </div>
          )}
          {offlineQueueCount > 0 && (
            <div
              style={{
                marginTop: 4,
                padding: "2px 8px",
                borderRadius: 99,
                background: "#F59E0B",
                color: "#fff",
                fontSize: 9,
                fontWeight: 800,
                textAlign: "center",
              }}
            >
              📦 {offlineQueueCount} Absen Offline
            </div>
          )}
        </div>
        <div
          style={{
            pointerEvents: "auto",
            padding: "6px 12px",
            borderRadius: 99,
            background: faceDetected
              ? "rgba(16,185,129,0.95)"
              : "rgba(0,0,0,0.55)",
            color: "#fff",
            fontSize: 10.5,
            fontWeight: 600,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: 99,
              background: faceDetected ? "#4ade80" : "#f87171",
            }}
          />
          {guidance}
        </div>
      </div>

      {unlocked && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            bottom: 0,
            width: 360,
            background: "#fff",
            borderRight: "1px solid #e5e7eb",
            zIndex: 25,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "#E4F3EA",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  🔒
                </div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>Wajah</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  padding: "4px 10px",
                  borderRadius: 99,
                  background: "#f1f5f9",
                  fontWeight: 700,
                }}
              >
                {users.length} karyawan
              </span>
            </div>
            <input
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama karyawan..."
              style={{
                marginTop: 12,
                width: "100%",
                height: 40,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                padding: "0 14px",
                fontSize: 13,
                boxSizing: "border-box",
                background: "#f8fafc",
              }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setTab("belum")}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border:
                    tab === "belum" ? "1px solid #dc2626" : "1px solid #e5e7eb",
                  background: tab === "belum" ? "#dc2626" : "#fff",
                  color: tab === "belum" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ● Belum ({belumCount})
              </button>
              <button
                onClick={() => setTab("sudah")}
                style={{
                  flex: 1,
                  height: 38,
                  borderRadius: 10,
                  border:
                    tab === "sudah" ? "1px solid #16a34a" : "1px solid #e5e7eb",
                  background: tab === "sudah" ? "#16a34a" : "#fff",
                  color: tab === "sudah" ? "#fff" : "#334155",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                ● Sudah ({sudahCount})
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", background: "#f8fafc" }}>
            {filtered.map((u) => {
              const isSel = selected?.id === u.id;
              return (
                <div
                  key={u.id}
                  onClick={() => !u.hasFace && setSelected(u)}
                  style={{
                    margin: "8px 10px",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: `1px solid ${isSel ? "#2563EB" : u.hasFace ? "#bbf7d0" : "#fecaca"}`,
                    background: isSel
                      ? "#EFF6FF"
                      : u.hasFace
                        ? "#f0fdf4"
                        : "#fff",
                    borderLeft: `4px solid ${isSel ? "#2563EB" : u.hasFace ? "#16a34a" : "#dc2626"}`,
                    cursor: !u.hasFace ? "pointer" : "default",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 10, alignItems: "center" }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: isSel
                          ? "#2563EB"
                          : u.hasFace
                            ? "#dcfce7"
                            : "#fee2e2",
                        color: isSel
                          ? "#fff"
                          : u.hasFace
                            ? "#166534"
                            : "#991b1b",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 800,
                      }}
                    >
                      {u.nama[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: isSel ? 800 : 700,
                          color: isSel ? "#1e40af" : "#0f172a",
                        }}
                      >
                        {u.nama}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: isSel
                            ? "#2563EB"
                            : u.hasFace
                              ? "#16a34a"
                              : "#dc2626",
                          fontWeight: 600,
                          marginTop: 2,
                        }}
                      >
                        {isSel
                          ? "● Dipilih"
                          : u.hasFace
                            ? "✓ Sudah"
                            : "• Belum"}
                      </div>
                      <div style={{ fontSize: 10, color: "#64748b" }}>
                        {u.jabatan || "-"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              padding: 12,
              borderTop: "1px solid #e5e7eb",
              display: "flex",
              gap: 8,
            }}
          >
            <button
              onClick={() => {
                setUnlocked(false);
                setSelected(null);
              }}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              🔒 Kunci
            </button>
            <button
              onClick={loadUsers}
              style={{
                flex: 1,
                height: 38,
                borderRadius: 10,
                border: 0,
                background: "#f1f5f9",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          left: unlocked ? 360 : 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "90px 20px 140px",
          gap: 16,
          zIndex: 5,
          pointerEvents: "none",
        }}
      >
        {isEnrolling && (
          <div
            style={{
              pointerEvents: "auto",
              width: "min(92vw, 420px)",
              background: "#fff",
              borderRadius: 16,
              padding: 14,
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
              border: "1px solid #e5e7eb",
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: "#2563EB",
                color: "#fff",
                display: "grid",
                placeItems: "center",
                fontSize: 22,
                fontWeight: 800,
              }}
            >
              {currentPose.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2563EB" }}>
                LANGKAH {enrollStep + 1} DARI 3
              </div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>
                {currentPose.label}
              </div>
              <div style={{ fontSize: 11, color: "#64748b" }}>
                {currentPose.sub}
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                {POSE.map((_, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: 5,
                      borderRadius: 99,
                      background:
                        i < enrollStep
                          ? "#16a34a"
                          : i === enrollStep
                            ? "#2563EB"
                            : "#e5e7eb",
                    }}
                  />
                ))}
              </div>
            </div>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 99,
                border: "3px solid #e5e7eb",
                display: "grid",
                placeItems: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: -3,
                  borderRadius: 99,
                  border: "3px solid #2563EB",
                  borderRightColor: "transparent",
                  transform: `rotate(${(stableProgress / 100) * 360}deg)`,
                }}
              />
              <span style={{ fontSize: 11, fontWeight: 800 }}>
                {Math.round(stableProgress)}%
              </span>
            </div>
          </div>
        )}
        {/* DYNAMIC CSS KEYFRAMES UNTUK KIOSK HIGH-TECH UI */}
        <style>{`
          @keyframes scanLaser {
            0% { top: 0%; opacity: 0.85; }
            50% { top: 96%; opacity: 1; }
            100% { top: 0%; opacity: 0.85; }
          }
          @keyframes radarSpin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          @keyframes slideDownPulse {
            0% { opacity: 0; transform: translate(-50%, -16px) scale(0.94); }
            100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
          }
          @keyframes liveDotPulse {
            0%, 100% { transform: scale(1); opacity: 0.8; }
            50% { transform: scale(1.4); opacity: 1; }
          }
        `}</style>

        <div
          style={{
            pointerEvents: "none",
            position: "relative",
            width: "min(78vw, 640px)",
            height: "min(62vh, 480px)",
            flexShrink: 0,
          }}
        >
          {/* CAMERA BOUNDING BOX & GLOW */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 28,
              border: `2.5px solid ${
                detectedUser
                  ? "#10b981"
                  : faceDetected
                    ? "#4ade80"
                    : "rgba(255,255,255,0.7)"
              }`,
              boxShadow: detectedUser
                ? "0 0 30px rgba(16,185,129,0.35), inset 0 0 20px rgba(16,185,129,0.15)"
                : faceDetected
                  ? "0 0 20px rgba(74,222,128,0.25)"
                  : "0 8px 32px rgba(0,0,0,0.3)",
              transition: "all 0.35s ease",
            }}
          />

          {/* CORNER BRACKETS */}
          {["tl", "tr", "bl", "br"].map((p) => (
            <div
              key={p}
              style={{
                position: "absolute",
                width: 42,
                height: 42,
                borderColor: detectedUser
                  ? "#10b981"
                  : faceDetected
                    ? "#4ade80"
                    : "#0B6E45",
                borderStyle: "solid",
                filter: detectedUser ? "drop-shadow(0 0 8px #10b981)" : "none",
                transition: "all 0.3s ease",
                ...(p === "tl"
                  ? {
                      top: -4,
                      left: -4,
                      borderWidth: "7px 0 0 7px",
                      borderTopLeftRadius: 26,
                    }
                  : {}),
                ...(p === "tr"
                  ? {
                      top: -4,
                      right: -4,
                      borderWidth: "7px 7px 0 0",
                      borderTopRightRadius: 26,
                    }
                  : {}),
                ...(p === "bl"
                  ? {
                      bottom: -4,
                      left: -4,
                      borderWidth: "0 0 7px 7px",
                      borderBottomLeftRadius: 26,
                    }
                  : {}),
                ...(p === "br"
                  ? {
                      bottom: -4,
                      right: -4,
                      borderWidth: "0 7px 7px 0",
                      borderBottomRightRadius: 26,
                    }
                  : {}),
              }}
            />
          ))}

          {/* POP UP TERDETEKSI SEBELUM KLIK PRESENSI (LIVE PRE-RECOGNITION BADGE) */}
          {detectedUser && !loadingAbsen && !showHasil && (
            <div
              style={{
                position: "absolute",
                top: 16,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 25,
                background: "rgba(11, 19, 41, 0.92)",
                backdropFilter: "blur(16px)",
                border: "1.5px solid rgba(16, 185, 129, 0.65)",
                boxShadow:
                  "0 12px 35px rgba(16, 185, 129, 0.3), 0 0 25px rgba(16, 185, 129, 0.2)",
                borderRadius: 999,
                padding: "8px 20px 8px 10px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                pointerEvents: "auto",
                animation: "slideDownPulse 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  boxShadow: "0 0 14px rgba(16, 185, 129, 0.6)",
                }}
              >
                {detectedUser.nama[0]}
              </div>
              <div style={{ textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 99,
                      background: "#10b981",
                      boxShadow: "0 0 10px #10b981",
                      display: "inline-block",
                      animation: "liveDotPulse 1.5s infinite ease-in-out",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "#6ee7b7",
                      textTransform: "uppercase",
                    }}
                  >
                    Wajah Terdeteksi
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#ffffff",
                    lineHeight: 1.2,
                    marginTop: 1,
                  }}
                >
                  Halo, {detectedUser.nama}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    color: "#94a3b8",
                    lineHeight: 1,
                    marginTop: 1,
                  }}
                >
                  {detectedUser.jabatan || "Karyawan"}{" "}
                  {detectedUser.divisi ? `• ${detectedUser.divisi}` : ""}
                </div>
              </div>
            </div>
          )}

          {/* HIGH-TECH LASER BEAM SCANNING OVERLAY JIKA KLIK PRESENSI */}
          {loadingAbsen && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 28,
                overflow: "hidden",
                pointerEvents: "none",
                zIndex: 20,
                background: "rgba(11, 19, 41, 0.45)",
                backdropFilter: "blur(3px)",
              }}
            >
              {/* LASER BEAM LINE */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  height: "4px",
                  background:
                    "linear-gradient(90deg, transparent 0%, #10b981 20%, #06b6d4 50%, #10b981 80%, transparent 100%)",
                  boxShadow:
                    "0 0 18px #10b981, 0 0 35px #06b6d4, 0 0 50px rgba(16,185,129,0.8)",
                  animation: "scanLaser 1.2s ease-in-out infinite alternate",
                }}
              />

              {/* RADAR SCANNER SPINNER & STATUS */}
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "rgba(11, 19, 41, 0.94)",
                  backdropFilter: "blur(14px)",
                  border: "1.5px solid rgba(16, 185, 129, 0.55)",
                  borderRadius: 20,
                  padding: "18px 26px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  boxShadow: "0 0 45px rgba(16, 185, 129, 0.35)",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 99,
                    border: "3px solid rgba(16, 185, 129, 0.2)",
                    borderTopColor: "#10b981",
                    borderRightColor: "#06b6d4",
                    animation: "radarSpin 0.75s linear infinite",
                  }}
                />
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      color: "#6ee7b7",
                      fontSize: 13.5,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                    }}
                  >
                    MEMPROSES PRESENSI...
                  </div>
                  <div
                    style={{
                      color: "#94a3b8",
                      fontSize: 11,
                      marginTop: 3,
                      fontWeight: 500,
                    }}
                  >
                    Scanning biometrik & memverifikasi lokasi
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            pointerEvents: "auto",
            padding: "8px 18px",
            borderRadius: 99,
            background: detectedUser
              ? "rgba(16, 185, 129, 0.95)"
              : isEnrolling
                ? "#fff"
                : "rgba(0,0,0,0.65)",
            color: isEnrolling ? "#0f172a" : "#fff",
            fontSize: 11.5,
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "min(92vw, 440px)",
            backdropFilter: "blur(8px)",
            boxShadow: detectedUser
              ? "0 4px 20px rgba(16, 185, 129, 0.4)"
              : "0 4px 12px rgba(0,0,0,0.2)",
            transition: "all 0.3s ease",
          }}
        >
          {detectedUser
            ? `✨ Wajah Terdeteksi: ${detectedUser.nama}`
            : isEnrolling
              ? `${currentPose.label}: ${guidance}`
              : selected
                ? `Siap daftar: ${selected.nama}`
                : status}
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: 20,
          left: unlocked ? 360 : 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          zIndex: 10,
          padding: "0 20px",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            pointerEvents: "auto",
            width: "min(92vw, 640px)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {selected ? (
            <>
              <button
                onClick={handleEnroll}
                disabled={loadingAbsen}
                style={{
                  width: "100%",
                  height: 52,
                  borderRadius: 14,
                  background: "#2563EB",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 13,
                  border: 0,
                  cursor: "pointer",
                  boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
                }}
              >
                {loadingAbsen
                  ? "PROSES..."
                  : `DAFTARKAN ${selected.nama.toUpperCase()}`}
              </button>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => {
                    setSelected(null);
                    setMode("idle");
                    setStableProgress(0);
                  }}
                  disabled={loadingAbsen || isEnrolling}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 12,
                    border: "1px solid rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    backdropFilter: "blur(6px)",
                  }}
                >
                  ✕ Batal
                </button>
                <button
                  onClick={handlePresensi}
                  disabled={loadingAbsen}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    background: "#fff",
                    color: "#0f172a",
                    fontWeight: 700,
                    fontSize: 12,
                    border: 0,
                    cursor: "pointer",
                  }}
                >
                  Presensi Biasa
                </button>
              </div>
            </>
          ) : (
            <button
              onClick={handlePresensi}
              disabled={loadingAbsen}
              style={{
                width: "100%",
                height: 54,
                borderRadius: 14,
                background: buttonColor,
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                border: 0,
                cursor: "pointer",
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {loadingAbsen
                ? "PROSES..."
                : isTerlambat
                  ? "MULAI PRESENSI • TERLAMBAT"
                  : isMasukDitutup
                    ? "MASUK DITUTUP"
                    : "MULAI PRESENSI"}
            </button>
          )}
        </div>
      </div>

      {showPin && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 50,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(12px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: 360,
              padding: 22,
              borderRadius: 18,
              background: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14 }}>PIN Admin Kiosk</div>
            <input
              type="password"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (pinError) setPinError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") verifyPin();
              }}
              placeholder="••••"
              autoFocus
              style={{
                marginTop: 16,
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: `1px solid ${pinError ? "#dc2626" : "#e5e7eb"}`,
                padding: "0 14px",
                fontSize: 16,
                letterSpacing: "0.4em",
                textAlign: "center",
              }}
            />
            {pinError && (
              <div
                style={{
                  marginTop: 10,
                  padding: "9px 12px",
                  borderRadius: 10,
                  background: "#fef2f2",
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                ⚠️ {pinError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                onClick={() => {
                  setShowPin(false);
                  setPin("");
                  setPinError("");
                }}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                onClick={verifyPin}
                style={{
                  flex: 1,
                  height: 42,
                  borderRadius: 12,
                  border: 0,
                  background: "#0B6E45",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Buka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP LENGKAP DENGAN DETAIL USER + WARNA SESUAI STATUS */}
      {showHasil && hasilAbsen && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 60,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(14px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(94vw, 420px)",
              background: "#fff",
              borderRadius: 22,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                padding: 22,
                background: statusStyle.bg,
                textAlign: "center",
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: 4,
                  width: `${(countdown / 5) * 100}%`,
                  background: statusStyle.iconBg,
                  transition: "width 1s linear",
                }}
              />
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 99,
                  background: statusStyle.iconBg,
                  display: "grid",
                  placeItems: "center",
                  margin: "6px auto 12px",
                  color: "#fff",
                  fontSize: 36,
                  boxShadow: `0 8px 20px ${statusStyle.iconBg}66`,
                }}
              >
                {hasilAbsen.type === "sukses" ? "✓" : "✕"}
              </div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>
                {hasilAbsen.type === "sukses"
                  ? "Presensi Berhasil!"
                  : hasilAbsen.message}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#374151",
                  marginTop: 6,
                  fontWeight: 600,
                }}
              >
                {hasilAbsen.message}
              </div>
              {hasilAbsen.detail && (
                <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                  {hasilAbsen.detail}
                </div>
              )}
              <div
                style={{
                  marginTop: 12,
                  display: "inline-flex",
                  padding: "6px 14px",
                  borderRadius: 99,
                  background: statusStyle.badgeBg,
                  color: statusStyle.badgeColor,
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.03em",
                }}
              >
                {statusStyle.label}{" "}
                {hasilAbsen.tipe ? `• ${hasilAbsen.tipe.toUpperCase()}` : ""}
              </div>
            </div>
            <div style={{ padding: 18 }}>
              {hasilAbsen.nama && (
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    padding: "12px",
                    background: "#f9fafb",
                    borderRadius: 12,
                    border: "1px solid #f3f4f6",
                  }}
                >
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      background: statusStyle.iconBg,
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    {hasilAbsen.nama[0]}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      {hasilAbsen.nama}
                    </div>
                    <div
                      style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}
                    >
                      {hasilAbsen.jabatan || "-"}{" "}
                      {hasilAbsen.divisi ? `• ${hasilAbsen.divisi}` : ""}
                    </div>
                    {hasilAbsen.email && (
                      <div
                        style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}
                      >
                        {hasilAbsen.email}
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                {hasilAbsen.jam && (
                  <div
                    style={{
                      padding: "10px 12px",
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: "#6b7280",
                        fontWeight: 600,
                      }}
                    >
                      JAM
                    </div>
                    <div
                      style={{ fontSize: 14, fontWeight: 800, marginTop: 2 }}
                    >
                      {hasilAbsen.jam} WIB
                    </div>
                  </div>
                )}
                <div
                  style={{
                    padding: "10px 12px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{ fontSize: 10, color: "#6b7280", fontWeight: 600 }}
                  >
                    STATUS
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      marginTop: 2,
                      color: statusStyle.badgeColor,
                    }}
                  >
                    {statusStyle.label}
                  </div>
                </div>
              </div>
              <div
                style={{
                  marginTop: 12,
                  padding: "10px 12px",
                  background: "#f9fafb",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "#6b7280",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span>Auto close dalam {countdown}s</span>
                <div
                  style={{
                    flex: 1,
                    marginLeft: 12,
                    height: 4,
                    background: "#e5e7eb",
                    borderRadius: 99,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(countdown / POPUP_DURATION_SECONDS) * 100}%`,
                      height: "100%",
                      background: statusStyle.iconBg,
                      transition: "width 1s linear",
                    }}
                  />
                </div>
              </div>
            </div>
            <div
              style={{
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                background: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              {hasilAbsen.type !== "sukses" && (
                <button
                  onClick={() => {
                    setShowHasil(false);
                    setShowFallback(true);
                    loadUsers();
                  }}
                  style={{
                    width: "100%",
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid #EAB308",
                    background: "#FEF3C7",
                    color: "#92400E",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  ⚠️ Gunakan Absen Manual (Butuh Verifikasi Admin)
                </button>
              )}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setShowHasil(false);
                    setHasilAbsen(null);
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    background: "#fff",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Tutup
                </button>
                <button
                  onClick={() => {
                    setShowHasil(false);
                    setHasilAbsen(null);
                  }}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 12,
                    border: 0,
                    background: statusStyle.iconBg,
                    color: "#fff",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  OK • {countdown}s
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL BACKUP MANUAL - JIKA ERROR / WAJAH GAK KEDETEKSI */}
      {showFallback && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.8)",
            backdropFilter: "blur(14px)",
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <div
            style={{
              width: "min(94vw, 440px)",
              background: "#fff",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                padding: 20,
                background: "#FEF3C7",
                borderBottom: "1px solid #FDE68A",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "#EAB308",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 20,
                  }}
                >
                  ⚠️
                </div>
                <div>
                  <div
                    style={{ fontWeight: 800, fontSize: 15, color: "#92400E" }}
                  >
                    Backup Absen Manual
                  </div>
                  <div style={{ fontSize: 11, color: "#B45309", marginTop: 2 }}>
                    Wajah error / tidak dikenali • Butuh verifikasi Admin
                  </div>
                </div>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginBottom: 8,
                }}
              >
                1. Pilih Karyawan
              </div>
              <input
                value={fallbackCari}
                onChange={(e) => setFallbackCari(e.target.value)}
                placeholder="Cari nama karyawan..."
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  padding: "0 14px",
                  fontSize: 13,
                  boxSizing: "border-box",
                  background: "#f8fafc",
                }}
              />
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 160,
                  overflowY: "auto",
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                }}
              >
                {users
                  .filter(
                    (u) =>
                      !fallbackCari ||
                      u.nama.toLowerCase().includes(fallbackCari.toLowerCase()),
                  )
                  .slice(0, 10)
                  .map((u) => (
                    <div
                      key={u.id}
                      onClick={() => {
                        setFallbackSelected(u);
                        checkFallbackUserStatus(u.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderBottom: "1px solid #f1f5f9",
                        background:
                          fallbackSelected?.id === u.id ? "#EFF6FF" : "#fff",
                        cursor: "pointer",
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 8,
                          background:
                            fallbackSelected?.id === u.id
                              ? "#2563EB"
                              : "#f1f5f9",
                          color:
                            fallbackSelected?.id === u.id ? "#fff" : "#334155",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 700,
                        }}
                      >
                        {u.nama[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color:
                              fallbackSelected?.id === u.id
                                ? "#1e40af"
                                : "#0f172a",
                          }}
                        >
                          {u.nama}
                        </div>
                        <div style={{ fontSize: 10, color: "#64748b" }}>
                          {u.jabatan || "-"}
                        </div>
                      </div>
                      {fallbackSelected?.id === u.id && (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#2563EB",
                            fontWeight: 700,
                          }}
                        >
                          ✓ Dipilih
                        </span>
                      )}
                    </div>
                  ))}
                {users.length === 0 && (
                  <div
                    style={{
                      padding: 20,
                      textAlign: "center",
                      fontSize: 12,
                      color: "#6b7280",
                    }}
                  >
                    Memuat karyawan...
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#0f172a",
                  marginTop: 16,
                  marginBottom: 8,
                }}
              >
                2. Alasan Manual
              </div>
              <select
                value={fallbackAlasan}
                onChange={(e) => setFallbackAlasan(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  padding: "0 12px",
                  fontSize: 12,
                }}
              >
                <option>Wajah tidak terdeteksi</option>
                <option>Wajah tidak dikenali</option>
                <option>Kamera buram / gelap</option>
                <option>Karyawan lupa daftar wajah</option>
                <option>Lainnya</option>
              </select>

              {fallbackStatusInfo && (
                <div
                  style={{
                    marginTop: 8,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: fallbackStatusInfo.sudahLengkap
                      ? "#FEE2E2"
                      : fallbackStatusInfo.sudahMasuk
                        ? "#FEF3C7"
                        : "#DCFCE7",
                    border: `1px solid ${fallbackStatusInfo.sudahLengkap ? "#FECACA" : fallbackStatusInfo.sudahMasuk ? "#FDE68A" : "#BBF7D0"}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: fallbackStatusInfo.sudahLengkap
                        ? "#991B1B"
                        : fallbackStatusInfo.sudahMasuk
                          ? "#92400E"
                          : "#166534",
                    }}
                  >
                    Status hari ini:{" "}
                    {fallbackStatusInfo.sudahLengkap
                      ? "Sudah lengkap (masuk+pulang)"
                      : fallbackStatusInfo.sudahMasuk
                        ? `Sudah masuk jam ${fallbackStatusInfo.data?.jamMasuk ? new Date(fallbackStatusInfo.data.jamMasuk).toLocaleTimeString("id-ID") : "-"}`
                        : "Belum absen"}
                  </div>
                  <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                    Tipe selanjutnya: {fallbackStatusInfo.tipeSelanjutnya}
                  </div>
                </div>
              )}
              {fallbackConflict && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#FEF3C7",
                    border: "1px solid #FDE68A",
                    color: "#92400E",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {fallbackConflict}
                </div>
              )}
              {attemptAt && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    fontSize: 11,
                    color: "#1E40AF",
                  }}
                >
                  🕐 Jam asli klik:{" "}
                  <b>
                    {String(attemptAt.getHours()).padStart(2, "0")}:
                    {String(attemptAt.getMinutes()).padStart(2, "0")}:
                    {String(attemptAt.getSeconds()).padStart(2, "0")} WIB
                  </b>{" "}
                  • Ini yang akan dicatat
                </div>
              )}
              {fallbackError && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "#fef2f2",
                    color: "#dc2626",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  ⚠️ {fallbackError}
                </div>
              )}
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "#f8fafc",
                  fontSize: 10,
                  color: "#64748b",
                }}
              >
                Pengajuan akan jadi{" "}
                <b>PENDING</b> dan admin verifikasi di dashboard. Foto bukti
                otomatis diambil. Jika salah pilih user, admin bisa tolak.
              </div>
            </div>
            <div
              style={{
                padding: 14,
                display: "flex",
                gap: 10,
                background: "#f9fafb",
                borderTop: "1px solid #e5e7eb",
              }}
            >
              <button
                onClick={() => {
                  setShowFallback(false);
                  setFallbackSelected(null);
                  setFallbackPin("");
                  setFallbackError("");
                }}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                onClick={handleFallbackAbsen}
                disabled={fallbackLoading}
                style={{
                  flex: 1,
                  height: 44,
                  borderRadius: 12,
                  border: 0,
                  background: fallbackLoading ? "#9ca3af" : "#0B6E45",
                  color: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {fallbackLoading ? "Memproses..." : "Kirim Manual ✓"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 20,
            zIndex: 70,
            width: 360,
            background: "#fff",
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 4,
              width: `${(toastCountdown / POPUP_DURATION_SECONDS) * 100}%`,
              background: "#2563EB",
              transition: "width 1s linear",
            }}
          />
          <div style={{ padding: 14, display: "flex", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "#EFF6FF",
                display: "grid",
                placeItems: "center",
                fontSize: 20,
              }}
            >
              ✓
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>
                Wajah Tersimpan!
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1e40af",
                  marginTop: 2,
                }}
              >
                {toast.nama}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {toast.jabatan || ""}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8 }}>
                Auto close {toastCountdown}s
              </div>
            </div>
            <button
              onClick={() => setToast(null)}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
