// Token desain dipakai bersama di semua halaman, supaya konsisten
// dan gampang diubah dari satu tempat kalau nanti mau reskin.
//
// `aksen` diambil langsung dari warna logo PT. Zaman Teknindo (hijau pinus,
// #0B6E45) -- bukan warna template. Merah dari wordmark logo sengaja TIDAK
// dipakai sebagai warna aksi UI, karena merah di sistem ini sudah bermakna
// "Alpha/bahaya"; motif merah brand cukup hidup lewat logo saja.

export const warna = {
  latar: "#F4F5F7",
  panel: "#FFFFFF",
  panelAlt: "#EDEFF3",
  garis: "#DADFE6",
  tinta: "#16233D",
  tintaLembut: "#5B6472",
  tintaSamar: "#8A93A3",
  aksen: "#0B6E45",
  aksenGelap: "#08402A",
  aksenLembut: "#E1F0E8",
  sukses: "#2F855A",
  suksesLembut: "#E4F3EA",
  peringatan: "#C77800",
  peringatanLembut: "#FBEDD9",
  bahaya: "#C0392B",
  bahayaLembut: "#FBE7E4",
};

export const font = {
  display: "'IBM Plex Sans', system-ui, sans-serif",
  mono: "'IBM Plex Mono', monospace",
};

export const bayangan = "0 1px 2px rgba(22,35,61,0.04), 0 8px 24px rgba(22,35,61,0.06)";

// Skala ukuran font -- SENGAJA cuma 6 pilihan (bukan angka bebas kayak
// 13.5/14/14.5 dst). Dipakai berulang di semua halaman supaya hierarki
// teksnya konsisten dan kerasa "dirancang", bukan ditambal komponen per
// komponen dengan angka acak.
export const teks = {
  kecil: 11,      // label kecil, keterangan tambahan, badge
  badan: 13,      // teks isi/body biasa -- paling sering dipakai
  subjudul: 15,   // sub-judul di dalam kartu
  judul: 18,      // judul halaman/section
  besar: 24,      // angka statistik besar
  hero: 32,       // judul utama (halaman Login, dsb)
};

// Skala jarak (padding/margin/gap) -- kelipatan 4px, konvensi umum di
// design system (Material, Apple HIG, Tailwind) supaya jarak antar elemen
// terasa beraturan, bukan angka acak yang bedanya nyaris tak kerasa.
export const jarak = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Skala sudut kartu/tombol -- cuma 3 pilihan.
export const radius = { kecil: 6, sedang: 10, besar: 16 };
