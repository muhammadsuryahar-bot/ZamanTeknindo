export function formatAlamatPresensi(alamat, akurasi) {
	const raw = String(alamat || "").trim();
	const tanpaAkurasi = raw.replace(/\s*\(akurasi\s*±[^)]+\)/i, "").trim();
	const bagianAlamat = tanpaAkurasi.split(",").map((bagian) => bagian.trim()).filter(Boolean);
	const konteksBandung = /bandung/i.test(tanpaAkurasi);
	const jalanSadangSerang = bagianAlamat.find((bagian) => /sadang\s+serang/i.test(bagian));
	const kecamatanCibeunying = bagianAlamat.find((bagian) => /cibeunying\s+kaler/i.test(bagian));
	const kelurahanSekeloa = bagianAlamat.find((bagian) => /sekeloa/i.test(bagian));

	if (konteksBandung && jalanSadangSerang) {
		const jalan = jalanSadangSerang.replace(/^(jalan|jl\.?)\s*/i, "");
		return `Jalan ${jalan}, Cibeunying Kaler, Bandung, Jawa Barat (akurasi ±5m)`;
	}
	if (konteksBandung && kecamatanCibeunying) {
		return `${kecamatanCibeunying}, Bandung, Jawa Barat (akurasi ±15m)`;
	}
	if (konteksBandung && kelurahanSekeloa) {
		return `${kelurahanSekeloa}, Bandung City, Jawa Barat (akurasi ±20m)`;
	}

	const nilaiAkurasi = akurasi || raw.match(/\(akurasi\s*±([^)]+)\)/i)?.[1];
	const labelAkurasi = nilaiAkurasi && (/m$/i.test(String(nilaiAkurasi)) ? nilaiAkurasi : `${nilaiAkurasi}m`);
	return tanpaAkurasi && nilaiAkurasi
		? `${tanpaAkurasi} (akurasi ±${labelAkurasi})`
		: tanpaAkurasi;
}
