// File: src/utils/api.js

const HOST_SEKARANG = window.location.hostname;

// Jika di komputer sendiri, arahkan ke port backend Anda (contoh: 5000)
// Jika sudah online, sesuaikan dengan domain backend Anda
export const API_URL = HOST_SEKARANG === "localhost" || HOST_SEKARANG === "127.0.0.1"
  ? "http://localhost:5000/api" 
  : `https://${HOST_SEKARANG}/api`;

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
