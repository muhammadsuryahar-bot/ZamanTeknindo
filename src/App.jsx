import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Daftar from "./pages/Daftar";
import DashboardKaryawan from "./pages/DashboardKaryawan";
import DashboardAdmin from "./pages/DashboardAdmin";
import { getPenggunaLogin, hapusSesiLogin } from "./utils/api";

export default function App() {
  const [halaman, setHalaman] = useState("login"); // "login" | "daftar"
  const [pengguna, setPengguna] = useState(null);

  // Saat pertama kali dibuka, cek apakah sudah pernah login sebelumnya
  useEffect(() => {
    const penggunaTersimpan = getPenggunaLogin();
    if (penggunaTersimpan) {
      setPengguna(penggunaTersimpan);
    }
  }, []);

  function handleLogout() {
    hapusSesiLogin();
    setPengguna(null);
    setHalaman("login");
  }

  // Kalau sudah login, tampilkan dashboard sesuai peran 
  if (pengguna) {
    if (pengguna.peran === "admin") {
      return <DashboardAdmin pengguna={pengguna} onLogout={handleLogout} />;
    }
    return <DashboardKaryawan pengguna={pengguna} onLogout={handleLogout} />;
  }

  // Kalau belum login, tampilkan halaman Login atau Daftar
  if (halaman === "daftar") {
    return <Daftar keLogin={() => setHalaman("login")} />;
  }

  return (
    <Login
      onLoginBerhasil={(dataPengguna) => setPengguna(dataPengguna)}
      kePendaftaran={() => setHalaman("daftar")}
    />
  );
}
