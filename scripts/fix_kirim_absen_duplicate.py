from pathlib import Path

path = Path("src/pages/DashboardKaryawan.jsx")
text = path.read_text(encoding="utf-8")
old = '''    sesiKirimRef.current = true;
    if (!statusTerverifikasi) { setPesan("Status absensi belum diverifikasi oleh server. Tunggu sampai verifikasi selesai, lalu coba lagi."); return; }
    if (!TAHAP_VALID.has(tahap) || tahap === "selesai") { setPesan("Status absensi belum siap untuk dikirim. Muat ulang status absensi."); return; }
    if (!Number.isFinite(Number(lokasi?.latitude)) || !Number.isFinite(Number(lokasi?.longitude)) || !Number.isFinite(Number(lokasi?.akurasi))) { setPesan("Lokasi belum berhasil diperoleh. Tunggu sampai lokasi ditemukan lalu coba lagi."); return; }

    sesiKirimRef.current = true;
    setLoading(true);
'''
new = '''    sesiKirimRef.current = true;
    setLoading(true);
'''
if text.count(old) != 1:
    raise SystemExit(f"duplicate block expected once, found {text.count(old)}")
path.write_text(text.replace(old, new), encoding="utf-8")
print("Duplicate attendance validation block removed.")
