// File ini berisi alamat backend & fungsi bantu untuk komunikasi ke API

// Ganti ini kalau nanti backend sudah online (bukan localhost lagi)
const HOST_SEKARANG = window.location.hostname;
export const API_URL = "/api";

// Fungsi bantu: ambil token yang tersimpan di browser (setelah login)
export function getToken() {
  return localStorage.getItem("token");
}

export function simpanSesiLogin(token, pengguna) {
  localStorage.setItem("token", token);
  localStorage.setItem("pengguna", JSON.stringify(pengguna));
}

export function getPenggunaLogin() {
  const data = localStorage.getItem("pengguna");
  return data ? JSON.parse(data) : null;
}

export function hapusSesiLogin() {
  localStorage.removeItem("token");
  localStorage.removeItem("pengguna");
}
