import { useEffect, useState, lazy, Suspense, Component } from "react";
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

function MemuatHalaman({ penuh = false }) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: penuh ? "100svh" : "48svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
        color: warna.tintaSamar,
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        fontSize: 14,
        background: warna.latar,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 15px",
          borderRadius: 12,
          border: `1px solid ${warna.garis}`,
          background: warna.panel,
          boxShadow: "0 8px 24px rgba(22,35,61,0.06)",
          fontWeight: 650,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: warna.aksen,
            boxShadow: `0 0 0 5px ${warna.aksenLembut}`,
            flexShrink: 0,
          }}
        />
        Memuat halaman...
      </div>
    </div>
  );
}

class BatasKesalahanAplikasi extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Kesalahan render aplikasi:", error, info);
  }

  cobaLagi = () => {
    this.setState({ hasError: false, error: null });
  };

  kembaliKeLogin = () => {
    hapusSesiLogin();
    window.location.href = "/login";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          width: "100%",
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          boxSizing: "border-box",
          background: warna.latar,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 520,
            padding: 24,
            borderRadius: 18,
            border: `1px solid ${warna.garis}`,
            background: warna.panel,
            boxShadow: "0 18px 48px rgba(22,35,61,0.10)",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              display: "grid",
              placeItems: "center",
              borderRadius: 13,
              background: warna.aksenLembut,
              color: warna.aksen,
              fontSize: 21,
              fontWeight: 900,
              marginBottom: 14,
            }}
          >
            !
          </div>
          <h1
            style={{
              margin: 0,
              color: warna.tinta,
              fontSize: 21,
              lineHeight: 1.25,
            }}
          >
            Halaman mengalami kendala
          </h1>
          <p
            style={{
              margin: "9px 0 18px",
              color: warna.tintaLembut,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Sistem tidak dibiarkan menjadi layar putih. Coba muat ulang halaman terlebih dahulu. Jika masih gagal, kembali ke login untuk membuat sesi baru.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              type="button"
              onClick={this.cobaLagi}
              style={{
                minHeight: 42,
                padding: "10px 15px",
                border: 0,
                borderRadius: 11,
                background: warna.aksen,
                color: "#fff",
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
            <button
              type="button"
              onClick={this.kembaliKeLogin}
              style={{
                minHeight: 42,
                padding: "10px 15px",
                border: `1px solid ${warna.garis}`,
                borderRadius: 11,
                background: warna.panel,
                color: warna.tinta,
                fontWeight: 750,
                cursor: "pointer",
              }}
            >
              Kembali ke login
            </button>
          </div>
        </div>
      </div>
    );
  }
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
          className="admin-page-archive"
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
    <Suspense fallback={<MemuatHalaman penuh />}>
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
              <div className="admin-page-edit-karyawan">
                <AdminEditKaryawan />
              </div>
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

  if (pengguna === undefined) return <MemuatHalaman penuh />;

  return (
    <BatasKesalahanAplikasi>
      <BrowserRouter>
        <RuteAplikasi
          pengguna={pengguna}
          setPengguna={setPengguna}
          onLogout={handleLogout}
        />
      </BrowserRouter>
    </BatasKesalahanAplikasi>
  );
}
