from pathlib import Path


def replace_once(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")


# Keep the existing Admin DOM bridge scoped to the Admin shell again.
replace_once(
    Path("src/pages/DashboardAdmin.jsx"),
    '<main style={styles.main}>',
    '<main style={styles.main} className="main-area-admin">',
    "DashboardAdmin main shell",
)

# Keep reverse-geocoding alive after camera cleanup and let the submit action
# wait briefly for the address lookup instead of falling back to coordinates.
karyawan = Path("src/pages/DashboardKaryawan.jsx")
replace_once(
    karyawan,
    "  const sesiKirimRef = useRef(false);\n",
    "  const sesiKirimRef = useRef(false);\n  const alamatLookupRef = useRef(0);\n  const alamatLookupPromiseRef = useRef(null);\n",
    "DashboardKaryawan lookup refs",
)
replace_once(
    karyawan,
    "    setFotoTerambil(null);\n    setLokasi(null);\n",
    "    alamatLookupRef.current += 1;\n    alamatLookupPromiseRef.current = null;\n    setFotoTerambil(null);\n    setLokasi(null);\n",
    "DashboardKaryawan cancel lookup",
)
replace_once(
    karyawan,
    """      setLokasi({ latitude, longitude, akurasi, alamat: null });
      setStatusLokasi("ditemukan");
      void ambilAlamatDariKoordinat(latitude, longitude).then((alamatLengkap) => {
        if (!mountedRef.current || !sesiMasihAktif()) return;
        setLokasi((prev) => prev ? { ...prev, alamat: alamatLengkap } : prev);
      }).catch((err) => console.error("Reverse geocoding gagal:", err));
""",
    """      setLokasi({ latitude, longitude, akurasi, alamat: null });
      setStatusLokasi("ditemukan");
      const alamatLookupId = ++alamatLookupRef.current;
      const alamatLookupPromise = ambilAlamatDariKoordinat(latitude, longitude)
        .then((alamatLengkap) => {
          if (!mountedRef.current || alamatLookupId !== alamatLookupRef.current) return alamatLengkap;
          setLokasi((prev) => prev ? { ...prev, alamat: alamatLengkap } : prev);
          return alamatLengkap;
        })
        .catch((err) => {
          console.error("Reverse geocoding gagal:", err);
          return "";
        });
      alamatLookupPromiseRef.current = alamatLookupPromise;
      void alamatLookupPromise;
""",
    "DashboardKaryawan reverse geocoding lifecycle",
)
replace_once(
    karyawan,
    """  async function kirimAbsen() {
    if (sesiKirimRef.current || loading) return;
    if (!fotoTerambil) { setPesan("Silakan ambil foto terlebih dahulu."); return; }
""",
    """  async function kirimAbsen() {
    if (sesiKirimRef.current || loading) return;
    if (!fotoTerambil) { setPesan("Silakan ambil foto terlebih dahulu."); return; }
    if (!statusTerverifikasi) { setPesan("Status absensi belum diverifikasi oleh server. Tunggu sampai verifikasi selesai, lalu coba lagi."); return; }
    if (!TAHAP_VALID.has(tahap) || tahap === "selesai") { setPesan("Status absensi belum siap untuk dikirim. Muat ulang status absensi."); return; }
    if (!Number.isFinite(Number(lokasi?.latitude)) || !Number.isFinite(Number(lokasi?.longitude)) || !Number.isFinite(Number(lokasi?.akurasi))) { setPesan("Lokasi belum berhasil diperoleh. Tunggu sampai lokasi ditemukan lalu coba lagi."); return; }

    let alamatDariLookup = String(lokasi?.alamat || "").trim();
    if (!alamatDariLookup && alamatLookupPromiseRef.current) {
      setPesan("Menyelesaikan alamat lokasi...");
      try {
        alamatDariLookup = String(await Promise.race([
          alamatLookupPromiseRef.current,
          new Promise((resolve) => setTimeout(() => resolve(""), 3000)),
        ]) || "").trim();
      } catch {
        alamatDariLookup = "";
      }
    }

    sesiKirimRef.current = true;
""",
    "DashboardKaryawan wait for address",
)
replace_once(
    karyawan,
    '    const alamatDasar = lokasi.alamat || `${lokasi.latitude}, ${lokasi.longitude}`;\n',
    '    const alamatDasar = alamatDariLookup || lokasi.alamat || `${lokasi.latitude}, ${lokasi.longitude}`;\n',
    "DashboardKaryawan address submit",
)

# Restore the legacy Rekap action bridge without changing other page tables.
index = Path("index.html")
replace_once(
    index,
    """          const cells = row.querySelectorAll('td');
          if (!cells.length) return null;
          const nama = cells[0]?.textContent?.trim() || '';
          const jamMasuk = cells[3]?.textContent?.trim() || '';
""",
    """          const cells = row.querySelectorAll('td');
          if (!cells.length) return null;
          const nama = cells[0]?.textContent?.trim() || '';
          const headerCells = row.closest('table')?.querySelectorAll('thead th') || [];
          const headers = [...headerCells].map((th) => (th.textContent || '').trim().toLowerCase());
          const jamIndex = headers.indexOf('masuk');
          const jamMasuk = cells[jamIndex >= 0 ? jamIndex : 3]?.textContent?.trim() || '';
""",
    "index Rekap row mapping",
)
replace_once(
    index,
    """            <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:800;color:#344054">Alamat lengkap lokasi</label>
            <textarea data-alamat rows="5" maxlength="500" placeholder="Alamat lokasi absensi">${String(item?.alamatMasuk || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
            <div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px;font-size:11px;color:#667085"><span>Hanya alamat yang diubah. Koordinat GPS tetap tersimpan.</span><span data-count></span></div>
""",
    """            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div><label style="display:block;margin-bottom:6px;font-size:12px;font-weight:800;color:#344054">Latitude</label><input data-lat type="number" step="any" min="-90" max="90" value="${item?.latitudeMasuk ?? ''}" style="width:100%;box-sizing:border-box;border:1px solid #D0D5DD;border-radius:12px;padding:10px;font:inherit" /></div>
              <div><label style="display:block;margin-bottom:6px;font-size:12px;font-weight:800;color:#344054">Longitude</label><input data-lng type="number" step="any" min="-180" max="180" value="${item?.longitudeMasuk ?? ''}" style="width:100%;box-sizing:border-box;border:1px solid #D0D5DD;border-radius:12px;padding:10px;font:inherit" /></div>
            </div>
            <label style="display:block;margin-bottom:8px;font-size:12px;font-weight:800;color:#344054">Alamat lengkap lokasi</label>
            <textarea data-alamat rows="5" maxlength="500" placeholder="Alamat lokasi absensi">${String(item?.alamatMasuk || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>
            <div style="display:flex;justify-content:space-between;gap:10px;margin-top:7px;font-size:11px;color:#667085"><span>Koordinat dan alamat disimpan sebagai satu data lokasi absensi.</span><span data-count></span></div>
""",
    "index Edit Lokasi form",
)
replace_once(
    index,
    "          const textarea = box.querySelector('[data-alamat]');\n          const count = box.querySelector('[data-count]');\n          const error = box.querySelector('[data-error]');\n",
    "          const latitudeInput = box.querySelector('[data-lat]');\n          const longitudeInput = box.querySelector('[data-lng]');\n          const textarea = box.querySelector('[data-alamat]');\n          const count = box.querySelector('[data-count]');\n          const error = box.querySelector('[data-error]');\n",
    "index Edit Lokasi refs",
)
replace_once(
    index,
    """            const alamatMasuk = textarea.value.trim();
            error.textContent = '';
            if (!alamatMasuk) { error.textContent = 'Alamat lokasi wajib diisi.'; textarea.focus(); return; }
            if (alamatMasuk.length > 500) { error.textContent = 'Alamat maksimal 500 karakter.'; textarea.focus(); return; }
""",
    """            const alamatMasuk = textarea.value.trim();
            const latitudeMasuk = Number(latitudeInput.value);
            const longitudeMasuk = Number(longitudeInput.value);
            error.textContent = '';
            if (!Number.isFinite(latitudeMasuk) || latitudeMasuk < -90 || latitudeMasuk > 90) { error.textContent = 'Latitude harus berada antara -90 dan 90.'; latitudeInput.focus(); return; }
            if (!Number.isFinite(longitudeMasuk) || longitudeMasuk < -180 || longitudeMasuk > 180) { error.textContent = 'Longitude harus berada antara -180 dan 180.'; longitudeInput.focus(); return; }
            if (!alamatMasuk) { error.textContent = 'Alamat lokasi wajib diisi.'; textarea.focus(); return; }
            if (alamatMasuk.length > 500) { error.textContent = 'Alamat maksimal 500 karakter.'; textarea.focus(); return; }
""",
    "index Edit Lokasi validation",
)
replace_once(
    index,
    "                body: JSON.stringify({ alamatMasuk }),\n",
    "                body: JSON.stringify({ latitudeMasuk, longitudeMasuk, alamatMasuk }),\n",
    "index Edit Lokasi payload",
)

print("Focused rekap/location fixes applied successfully.")
