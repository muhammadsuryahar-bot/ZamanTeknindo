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
const DashboardKaryawan = lazy(() => import("./pages/DashboardKaryawanStabil"));
const RiwayatAbsensi = lazy(() => import("./pages/RiwayatAbsensi"));
const PengajuanIzin = lazy(() => import("./pages/PengajuanIzin"));
const DashboardAdmin = lazy(() => import("./pages/DashboardAdmin"));
const AdminArsip = lazy(() => import("./pages/AdminArsip"));
const AdminEditKaryawan = lazy(() => import("./pages/AdminEditKaryawan"));
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

function AdminContextBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [tab, setTab] = useState(() => {
    try {
      return sessionStorage.getItem("admin-tab") || "rekap";
    } catch {
      return "rekap";
    }
  });

  useEffect(() => {
    let mounted = true;

    function syncTab() {
      if (!mounted) return;
      try {
        const nilai = sessionStorage.getItem("admin-tab") || "rekap";
        setTab((sebelumnya) => (sebelumnya === nilai ? sebelumnya : nilai));
      } catch {
        // Storage tidak tersedia; biarkan nilai terakhir.
      }
    }

    syncTab();
    const interval = window.setInterval(syncTab, 250);
    window.addEventListener("focus", syncTab);
    window.addEventListener("pageshow", syncTab);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncTab);
      window.removeEventListener("pageshow", syncTab);
    };
  }, []);

  if (location.pathname === "/admin/arsip" || location.pathname === "/admin/edit-karyawan") {
    return null;
  }

  let label = "";
  let aksi = null;

  if (tab === "karyawan") {
    label = "Edit Karyawan";
    aksi = () => navigate("/admin/edit-karyawan");
  } else if (tab === "gaji" || tab === "gaji-massal") {
    label = "Arsip & Data";
    aksi = () => navigate("/admin/arsip");
  }

  if (!label || !aksi) return null;

  return (
    <div style={styles.adminContextBar}>
      <button type="button" onClick={aksi} style={styles.contextButton}>
        {tab === "karyawan" ? "✎" : "▣"}
        <span>{label}</span>
      </button>
    </div>
  );
}

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

      {!arsipTerbuka && <AdminContextBar />}
    </div>
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

        <Route
          path="/admin/edit-karyawan"
          element={
            <RuteTerproteksi
              pengguna={pengguna}
              peranDiizinkan={["admin"]}
            >
              <AdminEditKaryawan />
            </RuteTerproteksi>
          }
        />

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

  adminContextBar: {
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: 10001,
  },

  contextButton: {
    minHeight: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
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
