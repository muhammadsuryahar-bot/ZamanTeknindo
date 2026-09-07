import { useState, useEffect, useRef, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL, getToken } from "../utils/api";
import { warna, font } from "../styles/theme";
import logoHorizontal from "../assets/logo-horizontal.png";
import logo from "../assets/logo.png";
import AdminIzin from "./AdminIzin";
import PengaturanGaji from "./PengaturanGaji";
import AdminGajiMassal from "./AdminGajiMassal";
import { labelStatusKehadiran } from "../utils/statusKehadiran";
import {
  ClipboardList,
  Clock,
  Users,
  FileEdit,
  Wallet,
  Building2,
  BarChart3,
  ThumbsUp,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Info,
  AlertTriangle,
  FileText,
  UserX,
  Bell,
  UserPlus,
  FileCheck2,
  X,
} from "lucide-react";

const DAFTAR_STATUS = [
  "tepat_waktu",
  "telat",
  "alpha",
  "izin",
  "sakit",
  "cuti",
  "urgent",
];

// Ikon navigasi sidebar -- pakai komponen SVG (lucide-react), bukan emoji.
// Emoji tampilannya beda-beda tergantung OS (Windows/Mac/Android beda gaya
// gambarnya), jadi kesannya gak konsisten/kurang "produk jadi". Ikon SVG
// gini tampilannya SAMA PERSIS di semua perangkat.
const IKON_TAB = {
  rekap: ClipboardList,
  approval: Clock,
  karyawan: Users,
  izin: FileEdit,
  gaji: Wallet,
  "gaji-massal": Wallet,
  kantor: Building2,
};

// Kartu abu-abu berkedip pelan, dipakai sebagai placeholder saat data masih dimuat
function SkeletonBaris({ jumlah = 4 }) {
  return (
    <>
      {Array.from({ length: jumlah }).map((_, i) => (
        <tr key={i} className="skeleton-pulse">
          <td colSpan={99} style={{ padding: "14px 16px" }}>
            <div
              style={{
                height: 12,
                width: `${40 + (i % 3) * 15}%`,
                background: warna.panelAlt,
                borderRadius: 6,
              }}
            />
          </td>
        </tr>
      ))}
    </>
  );
}

export default function DashboardAdmin({ pengguna, onLogout }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => {
    const tabTersimpan = sessionStorage.getItem("admin-tab");

    const tabValid = [
      "rekap",
      "approval",
      "karyawan",
      "izin",
      "gaji",
      "gaji-massal",
      "kantor",
    ];

    return tabValid.includes(tabTersimpan) ? tabTersimpan : "rekap";
  });
  const [rekap, setRekap] = useState([]);
  const [belumAbsen, setBelumAbsen] = useState([]);
  const [belumAbsenTerbuka, setBelumAbsenTerbuka] = useState(false);
  const [menunggu, setMenunggu] = useState([]);
  const [karyawan, setKaryawan] = useState([]);
  const [jumlahKaryawanAktif, setJumlahKaryawanAktif] = useState(0);

  // Loading dibuat per menu supaya perpindahan tab tidak menahan seluruh halaman.
  const [loading, setLoading] = useState(true);
  const [loadingKaryawan, setLoadingKaryawan] = useState(false);
  const [loadingKantor, setLoadingKantor] = useState(false);

  // Cache sederhana: data hanya diambil sekali sampai diminta refresh.
  const [karyawanSudahDimuat, setKaryawanSudahDimuat] = useState(false);
  const [kantorSudahDimuat, setKantorSudahDimuat] = useState(false);

  // Komponen Izin/Gaji tetap mounted setelah pertama kali dibuka.
  // Gunakan key yang SAMA dengan id tab agar klik "gaji-massal" benar-benar
  // menandai komponen sudah pernah dibuka. Bug lama memakai gajiMassal,
  // sedangkan pindahTab menyimpan key "gaji-massal", sehingga klik pertama
  // menghasilkan area kosong dan baru muncul setelah refresh.
  const [tabPernahDibuka, setTabPernahDibuka] = useState(() => {
    const tabAwal = [
      "rekap",
      "approval",
      "karyawan",
      "izin",
      "gaji",
      "gaji-massal",
      "kantor",
    ].includes(tab)
      ? tab
      : "rekap";

    return {
      rekap: true,
      approval: tabAwal === "approval",
      karyawan: tabAwal === "karyawan",
      izin: tabAwal === "izin",
      gaji: tabAwal === "gaji",
      "gaji-massal": tabAwal === "gaji-massal",
      kantor: tabAwal === "kantor",
    };
  });

  const [pesan, setPesan] = useState("");
  const [pesanSukses, setPesanSukses] = useState("");

  // Kata kunci pencarian, terpisah untuk tiap tab supaya tidak saling ganggu
  const [cariRekap, setCariRekap] = useState("");
  const [cariKaryawan, setCariKaryawan] = useState("");

  // Form aktivasi akun yang lagi dibuka (ganti prompt() bawaan browser)
  const [formAktivasiTerbuka, setFormAktivasiTerbuka] = useState(null); // id akun atau null
  const [formAktivasi, setFormAktivasi] = useState({
    jabatan: "",
    divisi: "",
    kantorId: "",
  });

  // Daftar kantor/cabang, dipakai di dropdown aktivasi & tab Kantor
  const [daftarKantorState, setDaftarKantorState] = useState([]);
  const [formKantor, setFormKantor] = useState({
    namaKantor: "",
    alamat: "",
    latitude: "",
    longitude: "",
  });
  const [kantorEditId, setKantorEditId] = useState(null); // id kantor yang lagi diedit, atau null = mode tambah baru
  const [sedangSimpanKantor, setSedangSimpanKantor] = useState(false);

  // Konfirmasi ubah status karyawan yang lagi dibuka (ganti confirm() bawaan browser)
  const [konfirmasiStatusTerbuka, setKonfirmasiStatusTerbuka] = useState(null); // id karyawan atau null

  // Hasil reset password (password sementara) yang baru saja digenerate,
  // ditampilkan sekali ke Admin supaya bisa disalin & disampaikan manual
  const [resetPasswordHasil, setResetPasswordHasil] = useState(null); // { id, password } atau null

  // Form edit status kehadiran manual yang lagi dibuka
  const [editStatusTerbuka, setEditStatusTerbuka] = useState(null); // id absensi atau null
  const [formEditStatus, setFormEditStatus] = useState({
    statusFinal: "",
    catatanAdmin: "",
  });

  // Sidebar mobile (dibuka lewat hamburger di topbar kecil)
  const [sidebarMobileTerbuka, setSidebarMobileTerbuka] = useState(false);

  // Notifikasi Admin -- jumlah dihitung dari akun baru + pengajuan izin
  // yang masih menunggu diproses. Badge menunjukkan "hal yang masih perlu
  // diproses", bukan "notif yang belum pernah dilihat", supaya tidak
  // hilang begitu saja hanya karena admin sempat membuka panelnya.
  const [notifikasi, setNotifikasi] = useState({
    akunBaru: 0,
    izinBaru: 0,
    total: 0,
  });
  const [notifikasiTerbuka, setNotifikasiTerbuka] = useState(false);
  const notifikasiRef = useRef(null);
  const notifikasiMemuatRef = useRef(false);

  // Tutup panel notifikasi kalau admin klik di luar area panel/tombolnya --
  // tanpa ini, panel cuma bisa ditutup dengan klik tombol X, yang terasa
  // aneh dibanding pola dropdown pada umumnya.
  useEffect(() => {
    if (!notifikasiTerbuka) return;

    function tanganiKlikLuar(e) {
      if (notifikasiRef.current && !notifikasiRef.current.contains(e.target)) {
        setNotifikasiTerbuka(false);
      }
    }

    document.addEventListener("mousedown", tanganiKlikLuar);
    return () => document.removeEventListener("mousedown", tanganiKlikLuar);
  }, [notifikasiTerbuka]);

  // Penanda "tabel sudah digeser sampai ujung kanan" (khusus HP) — kalau
  // sudah di ujung, gradient fade di tepi kanan disembunyikan karena tidak
  // ada lagi yang perlu diisyaratkan ke pengguna
  const [rekapDiUjung, setRekapDiUjung] = useState(false);

  // Panel "Tren & Analisis" -- sengaja TIDAK ikut di-fetch bareng data utama
  // (muatData), supaya buka dashboard tetap ringan/cepat setiap hari. Data ini
  // baru diambil kalau admin sendiri yang membuka panelnya.
  const [ringkasanTerbuka, setRingkasanTerbuka] = useState(false);
  const [ringkasan, setRingkasan] = useState(null);
  const [loadingRingkasan, setLoadingRingkasan] = useState(false);

  async function bukaTutupRingkasan() {
    const mauDibuka = !ringkasanTerbuka;
    setRingkasanTerbuka(mauDibuka);
    if (mauDibuka && !ringkasan) {
      setLoadingRingkasan(true);
      try {
        const res = await fetch(`${API_URL}/admin/ringkasan`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        setRingkasan(data.data || null);
      } catch (err) {
        console.error(err);
        setPesan("Gagal memuat tren & analisis.");
      } finally {
        setLoadingRingkasan(false);
      }
    }
  }

  function namaHariSingkat(tanggalISO) {
    const hari = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    return hari[new Date(`${tanggalISO}T00:00:00.000Z`).getUTCDay()];
  }
  const [karyawanDiUjung, setKaryawanDiUjung] = useState(false);
  function cekUjungScroll(e, setDiUjung) {
    const el = e.target;
    setDiUjung(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }

  useEffect(() => {
    muatData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab === "karyawan") {
      muatKaryawan();
    }

    // Tab Kantor baru mengambil datanya saat benar-benar dibuka.
    // Tab Menunggu tidak perlu data kantor sampai Admin menekan
    // tombol "Aktifkan Akun".
    if (tab === "kantor") {
      muatKantor();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    if (!pesan && !pesanSukses) return;

    const timer = window.setTimeout(() => {
      setPesan("");
      setPesanSukses("");
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [pesan, pesanSukses]);

  // Notifikasi Admin dicek saat dashboard dibuka, saat tab kembali terlihat,
  // dan berkala ketika halaman sedang aktif. Saat tab browser disembunyikan,
  // polling dihentikan agar tidak membebani DB untuk halaman yang tidak sedang
  // dipakai Admin. Ref in-flight mencegah request notifikasi bertumpuk apabila
  // server sedang lambat.
  useEffect(() => {
    function jadwalkanMuatNotifikasi() {
      if (document.hidden) return;
      void muatNotifikasi();
    }

    jadwalkanMuatNotifikasi();

    const interval = window.setInterval(() => {
      jadwalkanMuatNotifikasi();
    }, 30000);

    const tanganiVisibilitas = () => {
      if (!document.hidden) jadwalkanMuatNotifikasi();
    };

    document.addEventListener("visibilitychange", tanganiVisibilitas);
    window.addEventListener("focus", tanganiVisibilitas);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tanganiVisibilitas);
      window.removeEventListener("focus", tanganiVisibilitas);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function muatNotifikasi() {
    if (notifikasiMemuatRef.current) return;

    const token = getToken();

    if (!token) return;

    notifikasiMemuatRef.current = true;

    try {
      const res = await fetch(`${API_URL}/admin/notifikasi`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;

      const data = await res.json();

      if (!data?.data) return;

      setNotifikasi({
        akunBaru: Number(data.data.akunBaru) || 0,
        izinBaru: Number(data.data.izinBaru) || 0,
        total: Number(data.data.total) || 0,
      });
    } catch (error) {
      // Notifikasi bukan bagian yang boleh membuat seluruh dashboard
      // ikut gagal kalau gagal dimuat -- cukup dicatat di console.
      console.error("Gagal memuat notifikasi Admin:", error);
    } finally {
      notifikasiMemuatRef.current = false;
    }
  }

  async function muatData() {
    setLoading(true);
    setPesan("");

    const token = getToken();

    if (!token) {
      setPesan("Sesi login tidak ditemukan. Silakan login kembali.");
      setLoading(false);
      return;
    }

    const headers = {
      Authorization: `Bearer ${token}`,
    };

    try {
      // Initial load hanya mengambil data yang diperlukan untuk
      // dashboard/rekap dan badge Menunggu.
      const responses = await Promise.all([
        fetch(`${API_URL}/admin/rekap-hari-ini`, { headers }),
        fetch(`${API_URL}/admin/akun-menunggu`, { headers }),
      ]);

      const [resRekap, resMenunggu] = responses;

      const daftarResponse = [
        { response: resRekap, nama: "rekap absensi" },
        { response: resMenunggu, nama: "akun menunggu" },
      ];

      for (const item of daftarResponse) {
        if (!item.response.ok) {
          let dataError = {};

          try {
            dataError = await item.response.json();
          } catch {
            // Response bukan JSON; gunakan pesan umum di bawah.
          }

          if (item.response.status === 401 || item.response.status === 403) {
            throw new Error(
              dataError?.pesan ||
                "Sesi login tidak valid atau Anda tidak memiliki akses.",
            );
          }

          throw new Error(dataError?.pesan || `Gagal memuat ${item.nama}.`);
        }
      }

      const [dataRekap, dataMenunggu] = await Promise.all([
        resRekap.json(),
        resMenunggu.json(),
      ]);

      if (!Array.isArray(dataRekap.data)) {
        throw new Error("Format data rekap absensi dari server tidak valid.");
      }

      if (
        dataRekap.belumAbsen !== undefined &&
        !Array.isArray(dataRekap.belumAbsen)
      ) {
        throw new Error(
          "Format data karyawan yang belum absen dari server tidak valid.",
        );
      }

      if (!Array.isArray(dataMenunggu.data)) {
        throw new Error("Format data akun menunggu dari server tidak valid.");
      }

      setRekap(dataRekap.data);
      setBelumAbsen(dataRekap.belumAbsen || []);
      setMenunggu(dataMenunggu.data);
      setJumlahKaryawanAktif(Number(dataRekap.jumlahKaryawanAktif) || 0);
    } catch (error) {
      console.error(error);
      setPesan(error.message || "Gagal memuat data dashboard.");
    } finally {
      setLoading(false);
    }
  }
