import { useEffect, useState, lazy, Suspense } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import Login from "./pages/Login";
import { getPenggunaLogin, hapusSesiLogin } from "./utils/api";
import { warna } from "./styles/theme";

const Daftar = lazy(() => import("./pages/Daftar"));
const DashboardKaryawan = lazy(() => import("./pages/DashboardKaryawan"));
const RiwayatAbsensi = lazy(() => import("./pages/RiwayatAbsensi"));
const PengajuanIzin = lazy(() => import("./pages/PengajuanIzin"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const AdminArsip = lazy(() => import("./pages/AdminArsip"));
const GantiPassword = lazy(() => import("./pages/GantiPassword"));

function MemuatHalaman() {
  return (
    <div style={styles.loadingPage}>
      Memuat halaman...
    </div>
  );
}

function RuteTerproteksi({ pengguna, peranDiizinkan, children }) {
  if (!pengguna) return <Navigate to="/login" replace />;

  if (peranDiizinkan && !peranDiizinkan.includes(pengguna.peran)) {
    return (
      <Navigate
        to={pengguna.peran === "admin" ? "/admin" : "/karyawan"}
        replace
      />
    );
  }

  return children;
}

/**
 * AdminShell menjaga DashboardAdmin tetap mounted ketika Admin berpindah
 * dari /admin <-> /admin/arsip.
 *
 * Dampak:
 * - pindah ke Arsip tidak membuat DashboardAdmin dari nol;
 * - data/tab yang sudah dibuka tetap dipertahankan;
 * - refresh pada /admin/arsip tetap mengenali route Arsip;
 * - Arsip ditampilkan sebagai overlay penuh, jadi tidak terpotong oleh
 *   tinggi/wadah DashboardAdmin.
 */
function AdminShell({ pengguna, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();
  const arsipTerbuka = location.pathname === "/admin/arsip";

  return (
    <div style={styles.adminShell}>
      <DashboardAdmin pengguna={pengguna} onLogout={onLogout} />

      {arsipTerbuka && (
        <div
          style={styles.arsipOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Arsip dan Cleanup Absensi"
        >
          <div style={styles.arsipOverlayInner}>
            <AdminArsip kembaliKeDashboard={() => navigate("/admin")} />
          </div>
        </div>
      )}

      {!arsipTerbuka && <TombolArsipAdmin />}
    </div>
  );
}

function TombolArsipAdmin() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      onClick={() => navigate("/admin/arsip")}
      aria-label="Buka Arsip & Data"
      style={styles.arsipShortcut}
      className="admin-arsip-shortcut"
    >
      <span style={styles.arsipShortcutIcon}>▣</span>
      Arsip & Data
    </button>
  );
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
              <Navigate
                to={pengguna.peran === "admin" ? "/admin" : "/karyawan"}
                replace
              />
            ) : (
              <Login
                onLoginBerhasil={(data) => {
                  setPengguna(data);
                  navigate(
                    data.peran === "admin" ? "/admin" : "/karyawan",
                    { replace: true },
                  );
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
              <Navigate
                to={pengguna.peran === "admin" ? "/admin" : "/karyawan"}
                replace
              />
            ) : (
              <Daftar keLogin={() => navigate("/login")} />
            )
          }
        />

        <Route
          path="/karyawan"
          element={
            <RuteTerproteksi
              pengguna={pengguna}
              peranDiizinkan={["karyawan"]}
            >
              <DashboardKaryawan
                pengguna={pengguna}
                onLogout={onLogout}
              />
            </RuteTerproteksi>
          }
        />

        <Route
          path="/karyawan/riwayat"
          element={
            <RuteTerproteksi
              pengguna={pengguna}
              peranDiizinkan={["karyawan"]}
            >
              <RiwayatAbsensi kembali={() => navigate("/karyawan")} />
            </RuteTerproteksi>
          }
        />

        <Route
          path="/karyawan/izin"
          element={
            <RuteTerproteksi
              pengguna={pengguna}
              peranDiizinkan={["karyawan"]}
            >
              <PengajuanIzin kembali={() => navigate("/karyawan")} />
            </RuteTerproteksi>
          }
        />

        <Route
          path="/ganti-password"
          element={
            <RuteTerproteksi pengguna={pengguna}>
              <GantiPassword
                kembali={() =>
                  navigate(
                    pengguna?.peran === "admin" ? "/admin" : "/karyawan",
                  )
                }
              />
            </RuteTerproteksi>
          }
        />

        {/* Satu shell untuk /admin dan /admin/arsip.
            Ini sengaja supaya DashboardAdmin tidak remount saat navigasi.
            Route /admin/arsip tetap valid saat halaman di-refresh. */}
        <Route
          path="/admin/*"
          element={
            <RuteTerproteksi
              pengguna={pengguna}
              peranDiizinkan={["admin"]}
            >
              <Routes>
                <Route
                  path="*"
                  element={
                    <AdminShell
                      pengguna={pengguna}
                      onLogout={onLogout}
                    />
                  }
                />
              </Routes>
            </RuteTerproteksi>
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={
                pengguna
                  ? pengguna.peran === "admin"
                    ? "/admin"
                    : "/karyawan"
                  : "/login"
              }
              replace
            />
          }
        />
      </Routes>
    </Suspense>
  );
}

const styles = {
  loadingPage: {
    width: "100%",
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: warna.tintaSamar,
    fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
    fontSize: 14,
    background: warna.latar,
  },

  adminShell: {
    minHeight: "100svh",
    position: "relative",
  },

  /*
   * Overlay benar-benar menutup viewport.
   * Tidak memakai height: 100% atau position absolute supaya tidak ikut
   * terpotong oleh tinggi parent DashboardAdmin.
   */
  arsipOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 20000,
    width: "100vw",
    height: "100dvh",
    overflowY: "auto",
    overflowX: "hidden",
    WebkitOverflowScrolling: "touch",
    boxSizing: "border-box",
    background: warna.latar,
  },

  arsipOverlayInner: {
    width: "100%",
    maxWidth: 1480,
    minHeight: "100%",
    margin: "0 auto",
    padding: "24px 28px 40px",
    boxSizing: "border-box",
  },

  arsipShortcut: {
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: 10001,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    padding: "10px 14px",
    border: `1px solid ${warna.garis}`,
    borderRadius: 12,
    background: warna.panel,
    color: warna.tinta,
    boxShadow: "0 10px 28px rgba(22,35,61,0.12)",
    fontSize: 12,
    fontWeight: 750,
    cursor: "pointer",
  },

  arsipShortcutIcon: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 7,
    background: warna.aksenLembut,
    color: warna.aksen,
    fontSize: 13,
  },
};

export default function App() {
  const [pengguna, setPengguna] = useState(undefined);

  useEffect(() => {
    setPengguna(getPenggunaLogin() || null);
  }, []);

  function handleLogout() {
    hapusSesiLogin();
    setPengguna(null);
  }

  if (pengguna === undefined) return null;

  return (
    <BrowserRouter>
      <RuteAplikasi
        pengguna={pengguna}
        setPengguna={setPengguna}
        onLogout={handleLogout}
      />
    </BrowserRouter>
  );
}
