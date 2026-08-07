import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import Login from "./pages/Login";
import Daftar from "./pages/Daftar";
import DashboardKaryawan from "./pages/DashboardKaryawan";
import RiwayatAbsensi from "./pages/RiwayatAbsensi";
import PengajuanIzin from "./pages/PengajuanIzin";
import DashboardAdmin from "./pages/DashboardAdmin";
import { getPenggunaLogin, hapusSesiLogin } from "./utils/api";

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
