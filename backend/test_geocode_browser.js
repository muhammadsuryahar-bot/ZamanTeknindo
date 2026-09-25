/**
 * Script untuk update alamat di DB menggunakan Nominatim (dipanggil dari console browser)
 * Paste script ini ke DevTools Console saat sedang buka dashboard admin/karyawan
 */
async function fixAlamatDB(token) {
  const API = window.location.origin; // atau ganti dengan URL backend

  // 1. Ambil semua absensi yang alamatnya belum ada nama jalan
  const r = await fetch(`${API}/absensi/riwayat-saya`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await r.json();
  console.log('Total absensi:', data.length);

  async function geocode(lat, lng) {
    for (const zoom of [19, 18, 17]) {
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=${zoom}&addressdetails=1`, { headers: { Accept: 'application/json' } });
        if (!r.ok) continue;
        const d = await r.json();
        const a = d.address || {};
        const jalan = a.road || a.pedestrian || a.residential || a.living_street || a.footway || null;
        const kecamatan = a.suburb || a.city_district || a.district || a.village || null;
        const kota = a.city || a.town || a.municipality || a.county || null;
        const provinsi = a.state || a.province || null;
        const bagian = [jalan, kecamatan, kota, provinsi].filter(Boolean);
        if (bagian.length && jalan) return bagian.join(', ');
      } catch (e) { break; }
    }
    return null;
  }

  for (const item of data) {
    const perlu = (field, latF, lngF) => {
      const v = item[field] || '';
      const sudahJalan = /^jalan|^jl\./i.test(v);
      const lat = item[latF], lng = item[lngF];
      return !sudahJalan && lat && lng && !(lat === 0 && lng === 0);
    };
    
    if (perlu('alamatMasuk', 'latitudeMasuk', 'longitudeMasuk')) {
      console.log(`Geocoding masuk ID ${item.id}...`);
      const hasil = await geocode(item.latitudeMasuk, item.longitudeMasuk);
      if (hasil) console.log(`  → ${hasil}`);
      await new Promise(r => setTimeout(r, 1200));
    }
    if (perlu('alamatPulang', 'latitudePulang', 'longitudePulang')) {
      console.log(`Geocoding pulang ID ${item.id}...`);
      const hasil = await geocode(item.latitudePulang, item.longitudePulang);
      if (hasil) console.log(`  → ${hasil}`);
      await new Promise(r => setTimeout(r, 1200));
    }
  }
  console.log('Done!');
}
// Jalankan: fixAlamatDB('TOKEN_ANDA');
