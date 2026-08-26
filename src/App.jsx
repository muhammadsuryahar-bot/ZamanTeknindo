import { useState, useEffect, lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import { getPenggunaLogin, hapusSesiLogin } from "./utils/api";
import { warna } from "./styles/theme";

// Halaman selain Login di-lazy-load: kodenya baru diunduh browser
// SAAT rutenya benar-benar dibuka, bukan langsung semua sekaligus di
// awal. Efeknya, orang yang baru buka halaman Login (paling sering
// dikunjungi -- semua orang lewat sini dulu) tidak perlu ikut
// mengunduh kode DashboardAdmin/PengaturanGaji dkk yang belum tentu
// kepake olehnya.
const Daftar = lazy(() => import("./pages/Daftar"));
const DashboardKaryawan = lazy(() => import("./pages/DashboardKaryawan"));
const RiwayatAbsensi = lazy(() => import("./pages/RiwayatAbsensi"));
const PengajuanIzin = lazy(() => import("./pages/PengajuanIzin"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const GantiPassword = lazy(() => import("./pages/GantiPassword"));

// Ditampilkan sebentar saat kode halaman tujuan sedang diunduh
// (biasanya cuma kelihatan di koneksi lambat / pertama kali buka
// halaman itu -- setelah itu browser sudah menyimpannya).
function MemuatHalaman() {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: warna.tintaSamar,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      Memuat halaman...
    </div>
  );
}

// Bungkus semua rute yang WAJIB login. Kalau belum login, otomatis
// dilempar balik ke /login -- ini juga yang bikin refresh di tengah
// halaman (misalnya /karyawan/riwayat) tidak lagi "lompat" ke home,
// karena posisi URL-nya sendiri yang jadi sumber kebenaran, bukan
// state React yang hilang tiap refresh.
function RuteTerproteksi({ pengguna, peranDiizinkan, children }) {
  if (!pengguna) return <Navigate to="/login" replace />;
  if (peranDiizinkan && !peranDiizinkan.includes(pengguna.peran)) {
    return <Navigate to={pengguna.peran === "admin" ? "/admin" : "/karyawan"} replace />;
  }
  return children;
}

function RuteAplikasi({ pengguna, setPengguna, onLogout }) {
  const navigate = useNavigate();

  return (
    <Suspense fallback={<MemuatHalaman />}>
      <Routes>
      <Route
        path="/login"
        element={
          pengguna ? (
            <Navigate to={pengguna.peran === "admin" ? "/admin" : "/karyawan"} replace />
          ) : (
            <Login
              onLoginBerhasil={(data) => {
                setPengguna(data);
                navigate(data.peran === "admin" ? "/admin" : "/karyawan", { replace: true });
              }}
              kePendaftaran={() => navigate("/daftar")}
            />
          )
        }
      />

      <Route
        path="/daftar"
        element={
          pengguna ? (
            <Navigate to={pengguna.peran === "admin" ? "/admin" : "/karyawan"} replace />
          ) : (
            <Daftar keLogin={() => navigate("/login")} />
          )
        }
      />

      <Route
        path="/karyawan"
        element={
          <RuteTerproteksi pengguna={pengguna} peranDiizinkan={["karyawan"]}>
            <DashboardKaryawan pengguna={pengguna} onLogout={onLogout} />
          </RuteTerproteksi>
        }
      />
      <Route
        path="/karyawan/riwayat"
        element={
          <RuteTerproteksi pengguna={pengguna} peranDiizinkan={["karyawan"]}>
            <RiwayatAbsensi kembali={() => navigate("/karyawan")} />
          </RuteTerproteksi>
        }
      />
      <Route
        path="/karyawan/izin"
        element={
          <RuteTerproteksi pengguna={pengguna} peranDiizinkan={["karyawan"]}>
            <PengajuanIzin kembali={() => navigate("/karyawan")} />
          </RuteTerproteksi>
        }
      />

      <Route
        path="/ganti-password"
        element={
          <RuteTerproteksi pengguna={pengguna}>
            <GantiPassword kembali={() => navigate(pengguna?.peran === "admin" ? "/admin" : "/karyawan")} />
          </RuteTerproteksi>
        }
      />

      <Route
        path="/admin"
        element={
          <RuteTerproteksi pengguna={pengguna} peranDiizinkan={["admin"]}>
            <DashboardAdmin pengguna={pengguna} onLogout={onLogout} />
          </RuteTerproteksi>
        }
      />

      <Route
        path="*"
        element={<Navigate to={pengguna ? (pengguna.peran === "admin" ? "/admin" : "/karyawan") : "/login"} replace />}
      />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  const [pengguna, setPengguna] = useState(undefined); // undefined = belum dicek, null = tidak login

  useEffect(() => {
    setPengguna(getPenggunaLogin() || null);
  }, []);

  function handleLogout() {
    hapusSesiLogin();
    setPengguna(null);
  }

  // Sambil ngecek localStorage sekali di awal, jangan render apa-apa dulu
  // -- mencegah "kelip" balik ke halaman login sepersekian detik saat refresh.
  if (pengguna === undefined) return null;

  return (
    <BrowserRouter>
      <RuteAplikasi pengguna={pengguna} setPengguna={setPengguna} onLogout={handleLogout} />
    </BrowserRouter>
  );
}
