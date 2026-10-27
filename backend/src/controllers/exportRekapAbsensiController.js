const prisma = require("../utils/prismaClient");
const {
  JAM_MASUK_STANDAR_DEFAULT,
  bagianWaktuWIB,
  tanggalHariIniWIBString,
  parseJam,
} = require("../utils/waktuIndonesia");
const { ambilSetHariLibur } = require("../utils/hariLibur");
const { PERIODE_METADATA_HR, ROSTER_HR_REKAP } = require("../config/rosterRekapAbsensi");

const STATUS_VALID = new Set([
  "tepat_waktu",
  "telat",
  "alpha",
  "izin",
  "sakit",
  "cuti",
  "urgent",
]);

const STATUS_TAMPILAN = {
  tepat_waktu: "Tepat Waktu",
  telat: "Telat",
  alpha: "Alpha",
  izin: "Izin",
  sakit: "Sakit",
  cuti: "Cuti",
  urgent: "Urgent",
  belum_absen: "Belum Absen",
};

const WARNA = {
  navy: "FF16233D",
  header: "FF1F4E79",
  garis: "FFD9E0E7",
  teks: "FF243247",
  abu: "FFF7F9FB",
  putih: "FFFFFFFF",
  hijauMuda: "FFEAF5EF",
  kuningMuda: "FFFFF4CC",
  merahMuda: "FFFDECEC",
  biruMuda: "FFEAF2FF",
};

function normalisasiTanggal(raw) {
  const nilai = String(raw || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nilai)) return null;

  const [tahun, bulan, hari] = nilai.split("-").map(Number);
  const kandidat = new Date(Date.UTC(tahun, bulan - 1, hari));

  if (
    kandidat.getUTCFullYear() !== tahun ||
    kandidat.getUTCMonth() !== bulan - 1 ||
    kandidat.getUTCDate() !== hari
  ) {
    return null;
  }

  return nilai;
}

function tanggalUTC(tanggal) {
  return new Date(`${tanggal}T00:00:00.000Z`);
}

function tambahHari(tanggal) {
  const hasil = new Date(tanggal.getTime());
  hasil.setUTCDate(hasil.getUTCDate() + 1);
  return hasil;
}

function daftarTanggal(mulai, selesai) {
  const hasil = [];
  let cursor = tanggalUTC(mulai);
  const akhir = tanggalUTC(selesai);

  while (cursor <= akhir) {
    hasil.push(new Date(cursor.getTime()));
    cursor = tambahHari(cursor);
  }

  return hasil;
}

function formatTanggalIndonesia(tanggal) {
  const bagian = bagianWaktuWIB(tanggal);
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return String(bagian.hari).padStart(2, "0") + " " + bulan[bagian.bulan - 1] + " " + bagian.tahun;
}

function formatTanggalTanpaTahun(tanggal) {
  const bagian = bagianWaktuWIB(tanggal);
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  return String(bagian.hari).padStart(2, "0") + " " + bulan[bagian.bulan - 1];
}

function formatJam(tanggal) {
  if (!tanggal) return "-";
  const bagian = bagianWaktuWIB(tanggal);
  return `${String(bagian.jam).padStart(2, "0")}:${String(
    bagian.menit,
  ).padStart(2, "0")}`;
}

function formatTanggalFile(tanggal, sertakanTahun = true) {
  const bagian = bagianWaktuWIB(tanggal);
  const bulan = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return String(bagian.hari).padStart(2, "0") + bulan[bagian.bulan - 1] + (sertakanTahun ? bagian.tahun : "");
}

function formatDaftarHariLibur(tanggalList, setHariLibur) {
  const bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const kelompok = new Map();

  for (const tanggal of tanggalList) {
    const keyTanggal = tanggal.toISOString().slice(0, 10);
    const hari = tanggal.getUTCDay();
    if (hari !== 0 && hari !== 6 && !setHariLibur.has(keyTanggal)) continue;

    const bagian = bagianWaktuWIB(tanggal);
    const key = String(bagian.tahun) + "-" + String(bagian.bulan).padStart(2, "0");
    if (!kelompok.has(key)) kelompok.set(key, { tahun: bagian.tahun, bulan: bagian.bulan, hari: [] });
    kelompok.get(key).hari.push(String(bagian.hari));
  }

  if (kelompok.size === 0) return "(Tidak ada hari libur pada periode ini)";
  const daftar = Array.from(kelompok.values());
  return "(Tanggal " + daftar.map((item, index) => {
    const hariUnik = Array.from(new Set(item.hari));
    const tahunBerbeda = daftar.some((lain) => lain.tahun !== item.tahun);
    const suffixTahun = index === daftar.length - 1 || tahunBerbeda ? " " + item.tahun : "";
    return hariUnik.join(", ") + " " + bulan[item.bulan - 1] + suffixTahun;
  }).join(", ") + ")";
}

function normalisasiNamaRoster(nilai) {
  return String(nilai || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}


function normalisasiHeaderCheckLog(nilai) {
  return String(nilai == null ? "" : nilai).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function nilaiCellKeTeks(nilai) {
  if (nilai == null) return "";
  if (typeof nilai === "object") {
    if (Array.isArray(nilai.richText)) return nilai.richText.map((bagian) => bagian.text || "").join("");
    if (typeof nilai.text === "string") return nilai.text;
    if (nilai.result != null) return String(nilai.result);
  }
  return String(nilai).trim();
}
function tanggalCheckLog(nilai) {
  if (nilai instanceof Date && !Number.isNaN(nilai.getTime())) return String(nilai.getUTCFullYear()) + "-" + String(nilai.getUTCMonth()+1).padStart(2,"0") + "-" + String(nilai.getUTCDate()).padStart(2,"0");
  if (typeof nilai === "number" && Number.isFinite(nilai) && nilai > 1000) {
    const date=new Date(Math.round((nilai-25569)*86400000));
    if (!Number.isNaN(date.getTime())) return String(date.getUTCFullYear())+"-"+String(date.getUTCMonth()+1).padStart(2,"0")+"-"+String(date.getUTCDate()).padStart(2,"0");
  }
  const teks=nilaiCellKeTeks(nilai); if(!teks) return null;
  let c=teks.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if(c) return normalisasiTanggal(c[1]+"-"+String(c[2]).padStart(2,"0")+"-"+String(c[3]).padStart(2,"0"));
  c=teks.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if(c) return normalisasiTanggal(c[3]+"-"+String(c[2]).padStart(2,"0")+"-"+String(c[1]).padStart(2,"0"));
  const parsed=new Date(teks);
  return Number.isNaN(parsed.getTime()) ? null : String(parsed.getUTCFullYear())+"-"+String(parsed.getUTCMonth()+1).padStart(2,"0")+"-"+String(parsed.getUTCDate()).padStart(2,"0");
}
function menitCheckLog(nilai) {
  if(nilai==null || nilai==="") return null;
  if(nilai instanceof Date && !Number.isNaN(nilai.getTime())) return nilai.getUTCHours()*60+nilai.getUTCMinutes();
  if(typeof nilai==="number" && Number.isFinite(nilai)) return Math.round((((nilai%1)+1)%1)*1440)%1440;
  const c=nilaiCellKeTeks(nilai).match(/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b/);
  if(!c) return null;
  const h=Number(c[1]), m=Number(c[2]);
  return h>=0 && h<=23 && m>=0 && m<=59 ? h*60+m : null;
}
function arahCheckLog(nilai) {
  const s=normalisasiHeaderCheckLog(nilai);
  if(["0","in","masuk","check in","checkin","clock in","sign in","punch in","entry","datang"].includes(s) || /\b(check in|clock in|sign in|punch in|masuk|datang)\b/.test(s)) return "masuk";
  if(["1","out","pulang","check out","checkout","clock out","sign out","punch out","exit","keluar"].includes(s) || /\b(check out|clock out|sign out|punch out|pulang|keluar)\b/.test(s)) return "pulang";
  return null;
}
function buatPetaNamaRosterCheckLog() {
  const p=new Map();
  for(const item of ROSTER_HR_REKAP) for(const nama of [item.nama,...(item.aliases||[])]) {
    const k=normalisasiNamaRoster(nama); if(k) p.set(k,normalisasiNamaRoster(item.nama));
  }
  return p;
}
async function parseCheckLogWorkbook(buffer) {
  if(!Buffer.isBuffer(buffer)||!buffer.length) { const e=new Error("File Excel Check Log belum diterima. Pilih file .xlsx terlebih dahulu."); e.statusCode=400; throw e; }
  const ExcelJS=require("exceljs"), workbook=new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); } catch { const e=new Error("File Check Log tidak dapat dibaca sebagai Excel .xlsx. Unggah file Excel yang benar."); e.statusCode=400; throw e; }
  const namaHeaders=new Set(["nama","nama karyawan","nama pegawai","karyawan","pegawai","name","employee","employee name","person name","personnel name"]);
  const tanggalHeaders=new Set(["tanggal","date","log date","check date","attendance date","punch date","tanggal absen","tanggal check"]);
  const stampHeaders=new Set(["datetime","date time","timestamp","time stamp","time","check time","punch time","log time","scan time","record time","tanggal waktu","waktu check"]);
  const timeHeaders=new Set(["jam","waktu","time","jam check","jam absen","scan time","punch time","log time"]);
  const masukHeaders=new Set(["masuk","jam masuk","waktu masuk","in","in time","time in","clock in","check in","checkin","sign in","punch in","jam datang","check log masuk"]);
  const pulangHeaders=new Set(["pulang","jam pulang","waktu pulang","out","out time","time out","clock out","check out","checkout","sign out","punch out","jam keluar","check log pulang"]);
  const arahHeaders=new Set(["arah","direction","in out","check type","clock type","log type","event","event type","state","status","type","attendance type","punch type","check status","verify state"]);
  let struktur=null;
  for(const worksheet of workbook.worksheets) {
    for(let rn=1;rn<=Math.min(worksheet.rowCount||0,40);rn++) {
      const headers=worksheet.getRow(rn).values.slice(1).map(v=>normalisasiHeaderCheckLog(nilaiCellKeTeks(v)));
      const idx=set=>headers.findIndex(h=>set.has(h));
      const nama=idx(namaHeaders), tanggal=idx(tanggalHeaders), timestamp=idx(stampHeaders), waktu=idx(timeHeaders);
      const masuk=idx(masukHeaders), pulang=idx(pulangHeaders), arah=idx(arahHeaders);
      const lebar=masuk>=0&&pulang>=0&&(tanggal>=0||timestamp>=0);
      const log=arah>=0&&(timestamp>=0||(tanggal>=0&&waktu>=0));
      if(nama>=0&&(lebar||log)){struktur={worksheet,headerRow:rn,nama,tanggal,timestamp,waktu,masuk,pulang,arah,formatLebar:lebar};break;}
    }
    if(struktur) break;
  }
  if(!struktur){const e=new Error("Header file Check Log belum dikenali. Pastikan ada Nama Karyawan/Name dan Tanggal/Date serta Jam Masuk dan Jam Pulang; atau timestamp/waktu dan arah Check In/Check Out.");e.statusCode=400;throw e;}
  const namaRoster=buatPetaNamaRosterCheckLog(), peta=new Map(), namaTidakCocok=new Set(); let jumlahCatatanValid=0;
  const simpan=(rawName,date,direction,minutes)=>{
    if(!rawName||!date||minutes==null||!normalisasiTanggal(date)) return;
    const canonical=namaRoster.get(normalisasiNamaRoster(rawName));
    if(!canonical){namaTidakCocok.add(String(rawName).trim());return;}
    const key=canonical+"_"+date;
    if(!peta.has(key)) peta.set(key,{masuk:null,pulang:null});
    const val=peta.get(key);
    if(direction==="masuk") val.masuk=val.masuk==null?minutes:Math.min(val.masuk,minutes);
    if(direction==="pulang") val.pulang=val.pulang==null?minutes:Math.max(val.pulang,minutes);
    jumlahCatatanValid++;
  };
  const {worksheet,headerRow,nama,tanggal,timestamp,waktu,masuk,pulang,arah,formatLebar}=struktur;
  for(let rn=headerRow+1;rn<=worksheet.rowCount;rn++) {
    const row=worksheet.getRow(rn), rawName=nilaiCellKeTeks(row.getCell(nama+1).value).trim(); if(!rawName) continue;
    const rawDate=tanggal>=0?row.getCell(tanggal+1).value:null, rawTimestamp=timestamp>=0?row.getCell(timestamp+1).value:null;
    const date=tanggalCheckLog(rawDate??rawTimestamp); if(!date) continue;
    if(formatLebar) {
      simpan(rawName,date,"masuk",menitCheckLog(row.getCell(masuk+1).value));
      simpan(rawName,date,"pulang",menitCheckLog(row.getCell(pulang+1).value));
    } else {
      const rawTime=timestamp>=0?rawTimestamp:row.getCell(waktu+1).value, direction=arahCheckLog(row.getCell(arah+1).value);
      if(direction) simpan(rawName,date,direction,menitCheckLog(rawTime));
    }
  }
  if(jumlahCatatanValid===0){const e=new Error("Tidak ada catatan Check Log yang cocok dengan roster HRD dan memiliki tanggal/jam valid. Periksa nama karyawan, header, tanggal, dan jam.");e.statusCode=400;throw e;}
  return {peta,namaTidakCocok,jumlahCatatanValid};
}
function waktuHarianKeMenit(nilai) {
  if(!nilai) return null;
  const c=formatJam(nilai).match(/^(\d{2}):(\d{2})$/);
  return c?Number(c[1])*60+Number(c[2]):null;
}

function punyaKeterangan(nilai) {
  return nilai !== null && nilai !== undefined && String(nilai).trim() !== "";
}

function kodeDariStatus(status, izinItem, keteranganAbsensi) {
  if (status === "tepat_waktu") return "H";
  if (status === "telat") return "T";
  if (status === "cuti" || izinItem?.jenis === "cuti") return "C";
  if (status === "sakit" || izinItem?.jenis === "sakit") {
    return punyaKeterangan(izinItem?.fotoSurat) ? "S" : "SX";
  }
  if (
    status === "izin" ||
    status === "urgent" ||
    izinItem?.jenis === "izin" ||
    izinItem?.jenis === "urgent"
  ) {
    return punyaKeterangan(izinItem?.keterangan) || punyaKeterangan(keteranganAbsensi) ? "I" : "";
  }
  if (status === "alpha") return "A";
  return "";
}

function namaBulanIndonesia(bulan) {
  return ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"][bulan - 1];
}

function excelColumnName(number) {
  let value = number;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function statusDariAbsensi(absensi, jamMasukStandar) {
  if (!absensi) return "alpha";

  const statusFinal = String(absensi.statusFinal || "").trim();
  if (STATUS_VALID.has(statusFinal)) return statusFinal;

  const statusOtomatis = String(absensi.statusOtomatis || "").trim();
  if (STATUS_VALID.has(statusOtomatis)) return statusOtomatis;

  if (!absensi.jamMasuk) return "alpha";

  const batasMenit = parseJam(jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT);
  const waktuMasuk = bagianWaktuWIB(absensi.jamMasuk);
  const masukMenit = waktuMasuk.jam * 60 + waktuMasuk.menit;

  return masukMenit > batasMenit ? "telat" : "tepat_waktu";
}

function hitungKeterlambatan(absensi, jamMasukStandar) {
  if (!absensi?.jamMasuk) return 0;

  const batasMenit = parseJam(jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT);
  const waktuMasuk = bagianWaktuWIB(absensi.jamMasuk);
  const masukMenit = waktuMasuk.jam * 60 + waktuMasuk.menit;

  return Math.max(masukMenit - batasMenit, 0);
}

function formatKeterlambatan(menit) {
  if (!menit) return "-";
  const jam = Math.floor(menit / 60);
  const sisa = menit % 60;
  if (jam > 0) return `${jam} jam ${sisa} menit`;
  return `${sisa} menit`;
}

function isiWarnaStatus(cell, status) {
  const fill =
    status === "Tepat Waktu"
      ? WARNA.hijauMuda
      : status === "Telat"
        ? WARNA.kuningMuda
        : status === "Alpha"
          ? WARNA.merahMuda
          : status === "Belum Absen"
            ? WARNA.abu
            : WARNA.biruMuda;

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: fill },
  };
  cell.font = {
    name: "Arial",
    size: 10,
    bold: true,
    color: { argb: WARNA.teks },
  };
}

function gayaHeader(row, jumlahKolom) {
  for (let index = 1; index <= jumlahKolom; index += 1) {
    const cell = row.getCell(index);
    cell.font = {
      name: "Arial",
      size: 10,
      bold: true,
      color: { argb: WARNA.putih },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: WARNA.header },
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: WARNA.garis } },
      left: { style: "thin", color: { argb: WARNA.garis } },
      bottom: { style: "thin", color: { argb: WARNA.garis } },
      right: { style: "thin", color: { argb: WARNA.garis } },
    };
  }
  row.height = 30;
}

function gayaData(cell, { horizontal = "left", wrapText = false, bold = false } = {}) {
  cell.font = {
    name: "Arial",
    size: 10,
    bold,
    color: { argb: WARNA.teks },
  };
  cell.alignment = {
    horizontal,
    vertical: "middle",
    wrapText,
  };
  cell.border = {
    top: { style: "thin", color: { argb: WARNA.garis } },
    left: { style: "thin", color: { argb: WARNA.garis } },
    bottom: { style: "thin", color: { argb: WARNA.garis } },
    right: { style: "thin", color: { argb: WARNA.garis } },
  };
}

async function exportRekapAbsensi(req, res) {
  try {
    const hariIni = tanggalHariIniWIBString();
    const tanggalMulai = normalisasiTanggal(req.query?.tanggalMulai) || hariIni;
    const tanggalSelesai = normalisasiTanggal(req.query?.tanggalSelesai) || tanggalMulai;

    if (!tanggalMulai || !tanggalSelesai) {
      return res.status(400).json({ pesan: "Rentang tanggal rekap tidak valid." });
    }
    if (tanggalMulai > tanggalSelesai) {
      return res.status(400).json({ pesan: "Tanggal mulai tidak boleh lebih besar dari tanggal selesai." });
    }
    if (tanggalSelesai > hariIni) {
      return res.status(400).json({ pesan: "Rekap tidak boleh mencakup tanggal yang akan datang." });
    }

    const tanggalAwal = tanggalUTC(tanggalMulai);
    const tanggalAkhir = tanggalUTC(tanggalSelesai);
    const jumlahHari = Math.floor((tanggalAkhir - tanggalAwal) / (24 * 60 * 60 * 1000)) + 1;
    if (jumlahHari > 31) {
      return res.status(400).json({ pesan: "Rentang rekap maksimal 31 hari per file." });
    }

    const checkLogData = req.revisiAbsensi ? await parseCheckLogWorkbook(req.file?.buffer) : null;
    if (checkLogData) {
      const checkLogAdaDalamPeriode = Array.from(checkLogData.peta.keys()).some((key) => {
        const tanggalLog = key.slice(key.lastIndexOf("_") + 1);
        return tanggalLog >= tanggalMulai && tanggalLog <= tanggalSelesai;
      });
      if (!checkLogAdaDalamPeriode) {
        const error = new Error("File Check Log tidak berisi waktu karyawan yang cocok pada rentang tanggal yang dipilih. Sesuaikan periode rekap atau unggah file Check Log yang benar.");
        error.statusCode = 400;
        throw error;
      }
    }

    // Kolom tanggal di PostgreSQL adalah DATE. Gunakan batas tanggal UTC
    // pada tengah malam dan batas akhir eksklusif agar filter tidak bergantung
    // pada konversi timezone timestamp WIB.
    const rangeStart = tanggalUTC(tanggalMulai);
    const rangeEndExclusive = tambahHari(tanggalUTC(tanggalSelesai));

    const [karyawan, absensi, pengajuanDisetujui, pengaturan, setHariLibur] = await Promise.all([
      prisma.pengguna.findMany({
        where: { peran: "karyawan" },
        select: { id: true, nama: true, jabatan: true, divisi: true, kantor: { select: { namaKantor: true } } },
        orderBy: { nama: "asc" },
      }),
      prisma.absensi.findMany({
        where: { tanggal: { gte: rangeStart, lt: rangeEndExclusive }, pengguna: { peran: "karyawan" } },
        select: { penggunaId: true, tanggal: true, jamMasuk: true, jamPulang: true, statusOtomatis: true, statusFinal: true, keterangan: true, catatanAdmin: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }],
      }),
      prisma.pengajuanIzin.findMany({
        where: { tanggal: { gte: rangeStart, lt: rangeEndExclusive }, status: "disetujui", pengguna: { peran: "karyawan" } },
        select: { id: true, penggunaId: true, tanggal: true, jenis: true, keterangan: true, fotoSurat: true },
        orderBy: [{ tanggal: "asc" }, { penggunaId: "asc" }, { id: "asc" }],
      }),
      prisma.pengaturanPotongan.findUnique({ where: { id: 1 }, select: { jamMasukStandar: true } }),
      Promise.all(
        [...new Set([Number(tanggalMulai.slice(0, 4)), Number(tanggalSelesai.slice(0, 4))])].map((tahun) => ambilSetHariLibur(tahun)),
      ).then((setList) => new Set(setList.flatMap((setTahun) => [...setTahun]))),
    ]);

    const jamMasukStandar = pengaturan?.jamMasukStandar || JAM_MASUK_STANDAR_DEFAULT;

    // Roster HRD adalah acuan urutan dan nomor karyawan di file ekspor.
    // Pencocokan akun hanya memakai nama kanonis atau alias eksplisit agar
    // akun uji/akun di luar roster tidak ikut tersisip ke rekap resmi.
    // Jika satu nama HR tidak cocok tepat ke satu akun, tetap tampilkan
    // baris roster itu dengan isi absensi kosong; jangan mengarang datanya.
    const karyawanUnik = ROSTER_HR_REKAP.map((hr) => {
      const namaDiizinkan = new Set(
        [hr.nama, ...(hr.aliases || [])].map(normalisasiNamaRoster),
      );
      const kandidat = karyawan.filter((pengguna) =>
        namaDiizinkan.has(normalisasiNamaRoster(pengguna.nama)),
      );
      const pengguna = kandidat.length === 1 ? kandidat[0] : null;

      return {
        id: pengguna?.id ?? null,
        nama: hr.nama,
        nomorHR: hr.nomor,
        tmk: hr.tmk,
        hc2024_2025: hr.hc2024_2025,
        hc2025_2026: hr.hc2025_2026,
      };
    });

    const petaAbsensi = new Map();
    for (const item of absensi) {
      const tanggalKey = item.tanggal instanceof Date ? item.tanggal.toISOString().slice(0, 10) : String(item.tanggal).slice(0, 10);
      petaAbsensi.set(item.penggunaId + "_" + tanggalKey, item);
    }
    const petaIzin = new Map();
    for (const item of pengajuanDisetujui) {
      const tanggalKey =
        item.tanggal instanceof Date
          ? item.tanggal.toISOString().slice(0, 10)
          : String(item.tanggal).slice(0, 10);
      const key = item.penggunaId + "_" + tanggalKey;
      const sebelumnya = petaIzin.get(key);

      if (!sebelumnya) {
        petaIzin.set(key, item);
        continue;
      }

      // Satu karyawan + satu tanggal tetap hanya dihitung satu kali.
      // Jika ada data pengajuan ganda, prioritaskan cuti > sakit > jenis lain.
      const prioritas = { cuti: 3, sakit: 2, izin: 1, urgent: 1 };
      const pilih = (prioritas[item.jenis] || 0) > (prioritas[sebelumnya.jenis] || 0)
        ? item
        : sebelumnya;

      petaIzin.set(key, {
        ...pilih,
        keterangan:
          punyaKeterangan(sebelumnya.keterangan) || punyaKeterangan(item.keterangan)
            ? (punyaKeterangan(pilih.keterangan)
                ? pilih.keterangan
                : sebelumnya.keterangan || item.keterangan)
            : "",
        fotoSurat: pilih.fotoSurat || sebelumnya.fotoSurat || item.fotoSurat || null,
      });
    }

    const tanggalList = daftarTanggal(tanggalMulai, tanggalSelesai);
    const hariKerjaList = tanggalList.filter((tanggal) => {
      const tanggalKey = tanggal.toISOString().slice(0, 10);
      const hari = tanggal.getUTCDay();
      return hari !== 0 && hari !== 6 && !setHariLibur.has(tanggalKey);
    });
    const jumlahHariKerja = hariKerjaList.length;
    const jumlahHariLibur = Math.max(jumlahHari - jumlahHariKerja, 0);

    const ExcelJS = require("exceljs");

    // Data Harian menjadi sumber detail. Hari kosong tidak dipaksa menjadi
    // alpha karena database tidak punya bukti bahwa karyawan memang alpha.
    // Status alpha yang memang dicatat Admin tetap menjadi "A".
    const detailHarianPerKaryawan = karyawanUnik.map((item) => {
      const prefix = item.id == null ? null : item.id + "_";
      const kodeHarian = item.id == null
        ? tanggalList.map(() => null)
        : tanggalList.map((tanggal) => {
        const tanggalKey = tanggal.toISOString().slice(0, 10);
        const absensiItem = petaAbsensi.get(prefix + tanggalKey);
        const izinItem = petaIzin.get(prefix + tanggalKey);

        const punyaCap = Boolean(absensiItem?.jamMasuk || absensiItem?.jamPulang);
        if (punyaCap) {
          const status = statusDariAbsensi(absensiItem, jamMasukStandar);
          return status === "telat" ? "T" : "H";
        }

        if (absensiItem) {
          const kodeStatus = kodeDariStatus(
            statusDariAbsensi(absensiItem, jamMasukStandar),
            izinItem,
            absensiItem.keterangan || absensiItem.catatanAdmin,
          );
          if (kodeStatus) return kodeStatus;

          const adaKeterangan = punyaKeterangan(absensiItem.keterangan);
          if (adaKeterangan) return "I";
        }

        if (izinItem) {
          const kodeIzin = kodeDariStatus(null, izinItem, absensiItem?.keterangan || absensiItem?.catatanAdmin);
          if (kodeIzin) return kodeIzin;
        }

        const hari = tanggal.getUTCDay();
        if (hari === 0 || hari === 6 || setHariLibur.has(tanggalKey)) {
          return "L";
        }

        return "";
      });

      const jamHarian = item.id == null
        ? tanggalList.map(() => ({ masuk: null, pulang: null }))
        : tanggalList.map((tanggal) => {
            const tanggalKey = tanggal.toISOString().slice(0, 10);
            const absensiItem = petaAbsensi.get(prefix + tanggalKey);
            return {
              masuk: waktuHarianKeMenit(absensiItem?.jamMasuk),
              pulang: waktuHarianKeMenit(absensiItem?.jamPulang),
            };
          });

      const hitung = (kode) =>
        kodeHarian.filter((nilai) => nilai === kode).length;

      const jumlahKehadiran = hitung("H") + hitung("T");
      const jumlahTelat = hitung("T");
      const jumlahAdaKeterangan = hitung("I");
      const jumlahTanpaKeterangan = hitung("A");
      const jumlahCuti = hitung("C");
      const jumlahSakitAdaSurat = hitung("S");
      const jumlahSakitTanpaSurat = hitung("SX");

      return {
        id: item.id,
        nomorHR: item.nomorHR,
        tmk: item.tmk,
        hc2024_2025: item.hc2024_2025,
        hc2025_2026: item.hc2025_2026,
        cocokKeAkun: item.id != null,
        nama: item.nama || "-",
        kodeHarian,
        jamHarian,
        jumlahKehadiran,
        jumlahTelat,
        jumlahUangMakan: Math.max(jumlahKehadiran - jumlahTelat, 0),
        jumlahAdaKeterangan,
        jumlahTanpaKeterangan,
        lembur: null,
        cuti: jumlahCuti,
        sakitAdaSurat: jumlahSakitAdaSurat,
        sakitTanpaSurat: jumlahSakitTanpaSurat,
        jumlahHC:
          jumlahKehadiran +
          jumlahAdaKeterangan +
          jumlahTanpaKeterangan +
          jumlahCuti +
          jumlahSakitAdaSurat +
          jumlahSakitTanpaSurat,
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zaman Teknindo";
    workbook.created = new Date();

    const COLORS = {
      navy: "FF2E4E7E",
      titleNavy: "FF1F3864",
      footerBlue: "FFEAF1FB",
      dailyGrid: "FFBFC7D5",
      green: "FF2E7D32",
      blue: "FF1565C0",
      orange: "FFE65100",
      purple: "FF6A1B9A",
      red: "FFC62828",
      brown: "FF795548",
      teal: "FF00695C",
      lightBlue: "FFF2F5FA",
      lightGray: "FFD9D9D9",
      grid: "FF808080",
      text: "FF1F2937",
      white: "FFFFFFFF",
    };

    const border = {
      top: { style: "thin", color: { argb: COLORS.grid } },
      left: { style: "thin", color: { argb: COLORS.grid } },
      bottom: { style: "thin", color: { argb: COLORS.grid } },
      right: { style: "thin", color: { argb: COLORS.grid } },
    };

    // =========================
    // SHEET 1 — REKAP ABSENSI
    // =========================
    const sheet = workbook.addWorksheet("Rekap Absensi", {
      views: [{ state: "frozen", ySplit: 6, xSplit: 2 }],
    });
    sheet.showGridLines = false;
    sheet.properties.defaultRowHeight = 16.5;

    sheet.mergeCells("A1:Q1");
    sheet.getCell("A1").value = "REKAP DATA KEHADIRAN KARYAWAN";
    sheet.getCell("A1").font = {
      name: "Arial",
      size: 16,
      bold: true,
      color: { argb: COLORS.white },
    };
    sheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.titleNavy },
    };
    sheet.getCell("A1").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(1).height = 30;

    const bagianAwal = bagianWaktuWIB(tanggalAwal);
    const bagianAkhir = bagianWaktuWIB(tanggalAkhir);
    sheet.mergeCells("A2:Q2");
    sheet.getCell("A2").value =
      "PERIODE BULAN " +
      namaBulanIndonesia(bagianAkhir.bulan).toUpperCase() +
      " " +
      bagianAkhir.tahun +
      "  (" +
      formatTanggalIndonesia(tanggalAwal).toUpperCase() +
      " – " +
      formatTanggalIndonesia(tanggalAkhir).toUpperCase() +
      ")  •  " +
      jumlahHari +
      " Hari Kalender";
    sheet.getCell("A2").font = {
      name: "Arial",
      size: 11,
      italic: true,
      color: { argb: "FFD9E2F3" },
    };
    sheet.getCell("A2").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.titleNavy },
    };
    sheet.getCell("A2").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    sheet.getRow(2).height = 19.5;
    sheet.getRow(3).height = 6;

    for (const rowNum of [1, 2]) {
      for (let col = 1; col <= 17; col += 1) {
        sheet.getCell(rowNum, col).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.titleNavy },
        };
      }
    }

    [
      "A4:A6",
      "B4:B6",
      "C4:D6",
      "E4:G4",
      "E5:E6",
      "F5:F6",
      "G5:G6",
      "H4:H6",
      "I4:I6",
      "J4:J6",
      "K4:L4",
      "K5:K6",
      "L5:L6",
      "M4:M6",
      "N4:N6",
      "O4:P4",
      "O5:O6",
      "P5:P6",
      "Q4:Q6",
    ].forEach((merge) => sheet.mergeCells(merge));

    const topHeaders = {
      A4: "NO",
      B4: "NAMA",
      C4: "TMK",
      E4: "JUMLAH HAK CUTI",
      H4: "JLH KEHADIRAN",
      I4: "TERLAMBAT",
      J4: "JLH UANG MAKAN\nYANG DIBAYARKAN",
      K4: "TIDAK MASUK",
      M4: "LEMBUR",
      N4: "CUTI",
      O4: "SAKIT",
      Q4: "JLH HC",
    };
    Object.entries(topHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const subHeaders = {
      E5: "HC\n2024/2025",
      F5: "HC\n2025/2026",
      G5: "JLH HC SDH\nDIJALANI/DIPINJAM",
      K5: "ADA KET",
      L5: "TANPA KET",
      O5: "ADA SRT",
      P5: "TANPA SRT",
    };
    Object.entries(subHeaders).forEach(([cell, value]) => {
      sheet.getCell(cell).value = value;
    });

    const groupFills = {
      1: COLORS.navy,
      2: COLORS.navy,
      3: COLORS.navy,
      4: COLORS.navy,
      5: COLORS.green,
      6: COLORS.green,
      7: COLORS.green,
      8: COLORS.blue,
      9: COLORS.orange,
      10: COLORS.purple,
      11: COLORS.red,
      12: COLORS.red,
      13: COLORS.brown,
      14: COLORS.brown,
      15: COLORS.brown,
      16: COLORS.brown,
      17: COLORS.teal,
    };

    for (let rowNum = 4; rowNum <= 6; rowNum += 1) {
      for (let col = 1; col <= 17; col += 1) {
        const cell = sheet.getCell(rowNum, col);
        cell.border = border;
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: groupFills[col] || COLORS.navy },
        };
      }
    }

    sheet.getRow(4).height = 15.75;
    sheet.getRow(5).height = 15.75;
    sheet.getRow(6).height = 27.75;

    const dataStartRow = 7;
    const pakaiSnapshotHakCutiHR =
      tanggalMulai === PERIODE_METADATA_HR.tanggalMulai &&
      tanggalSelesai === PERIODE_METADATA_HR.tanggalSelesai;
    let rowNumber = dataStartRow;

    for (let index = 0; index < detailHarianPerKaryawan.length; index += 1) {
        const item = detailHarianPerKaryawan[index];
        const row = sheet.getRow(rowNumber);

        row.getCell(1).value = item.nomorHR;
        row.getCell(2).value = item.nama;
        row.getCell(3).value = item.tmk ? tanggalUTC(item.tmk) : null;
        row.getCell(3).numFmt = "dd/mm/yyyy";
        row.getCell(4).value = null;
        // Saldo/teks hak cuti tersedia di acuan HR untuk periode ini saja.
        // Di periode lain, biarkan kosong daripada memakai snapshot lama.
        row.getCell(5).value = pakaiSnapshotHakCutiHR ? item.hc2024_2025 : null;
        row.getCell(6).value = pakaiSnapshotHakCutiHR ? item.hc2025_2026 : null;
        // Kolom ini sengaja tetap kosong sesuai ketentuan rekap HR.
        row.getCell(7).value = null;

        if (!item.cocokKeAkun) {
          // Roster ada, akun sumber belum ditemukan: jangan tampilkan angka 0
          // yang tampak seperti hasil perhitungan, dan jangan hitung kode libur.
          for (const col of [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]) {
            row.getCell(col).value = null;
          }
        } else {
          // Ringkasan dihitung langsung dari status dan pengajuan pada database.
          // Data Harian berisi jam Clock In/Clock Out, bukan kode status.
          row.getCell(8).value = item.jumlahKehadiran;
          row.getCell(9).value = item.jumlahTelat;
          row.getCell(10).value = item.jumlahUangMakan;
          row.getCell(11).value = item.jumlahAdaKeterangan;
          row.getCell(12).value = item.jumlahTanpaKeterangan;
          row.getCell(13).value = null;
          row.getCell(14).value = item.cuti;
          row.getCell(15).value = item.sakitAdaSurat;
          row.getCell(16).value = item.sakitTanpaSurat;
          row.getCell(17).value = item.jumlahHC;
        }

        const fill = index % 2 === 0 ? COLORS.lightBlue : COLORS.white;
        row.height = 16.5;

        for (let col = 1; col <= 17; col += 1) {
          const cell = row.getCell(col);
          const isLeaveEntitlement = col === 5 || col === 6;
          const isHCColumn = col === 7 || col === 17;
          cell.font = {
            name: "Arial",
            size: isLeaveEntitlement ? 9 : 10,
            bold: col === 2 || isHCColumn,
            italic: isLeaveEntitlement,
            color: {
              argb: isHCColumn ? "FFC00000" : isLeaveEntitlement ? "FF808080" : COLORS.text,
            },
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: fill },
          };
          cell.border = border;
          cell.alignment = {
            horizontal: col === 2 ? "left" : "center",
            vertical: "middle",
            wrapText: col === 2,
          };
        }

      // TMK tidak tersedia pada model pengguna, tetapi harus tetap mengikuti
      // bentuk gabungan sel dari workbook contoh HRD.
      sheet.mergeCells("C" + rowNumber + ":D" + rowNumber);
      rowNumber += 1;
    }

    // Tidak ada baris TOTAL tambahan pada workbook acuan.
    const adaDataKaryawan = detailHarianPerKaryawan.length > 0;
    const lastDataRow = adaDataKaryawan ? rowNumber - 1 : dataStartRow - 1;
    const footerStart = lastDataRow + 2;
    const rentangPeriode = "(" + formatTanggalIndonesia(tanggalAwal) + " - " + formatTanggalIndonesia(tanggalAkhir) + ")";
    const judulBulan = namaBulanIndonesia(bagianAkhir.bulan) + " " + bagianAkhir.tahun;
    const footerRows = [
      "Jumlah Hari Kalender dalam Bulan " + judulBulan + " " + rentangPeriode,
      "Jumlah Hari Kerja Efektif dalam Bulan " + judulBulan + " " + rentangPeriode,
      "Jumlah Hari Minggu, Libur dan Cuti Bersama Periode Bulan " + judulBulan + " " + rentangPeriode,
    ];
    const footerValues = [
      jumlahHari + " Hari",
      jumlahHariKerja + " HKE",
      String(jumlahHariLibur).padStart(2, "0") + " Hari",
    ];
    const daftarHariLibur = formatDaftarHariLibur(tanggalList, setHariLibur);

    // Ringkasan diletakkan di E:O, berdampingan dengan tanda tangan kiri/kanan.
    sheet.mergeCells("A" + footerStart + ":D" + footerStart);
    sheet.mergeCells("E" + footerStart + ":M" + footerStart);
    sheet.mergeCells("N" + footerStart + ":O" + footerStart);
    sheet.mergeCells("P" + footerStart + ":Q" + footerStart);
    sheet.mergeCells("A" + (footerStart + 1) + ":D" + (footerStart + 1));
    sheet.mergeCells("E" + (footerStart + 1) + ":M" + (footerStart + 1));
    sheet.mergeCells("N" + (footerStart + 1) + ":O" + (footerStart + 1));
    sheet.mergeCells("E" + (footerStart + 2) + ":M" + (footerStart + 2));
    sheet.mergeCells("N" + (footerStart + 2) + ":O" + (footerStart + 2));
    sheet.mergeCells("E" + (footerStart + 3) + ":O" + (footerStart + 3));
    sheet.mergeCells("E" + (footerStart + 4) + ":O" + (footerStart + 4));

    sheet.getCell("A" + footerStart).value = "Dibuat Oleh,";
    sheet.getCell("P" + footerStart).value = "Diketahui Oleh,";
    sheet.getCell("A" + (footerStart + 1)).value = "Pekanbaru, " + formatTanggalIndonesia(new Date());

    for (let index = 0; index < footerRows.length; index += 1) {
      const row = footerStart + index;
      sheet.getCell("E" + row).value = footerRows[index];
      sheet.getCell("N" + row).value = footerValues[index];
    }
    sheet.getCell("E" + (footerStart + 3)).value = daftarHariLibur;

    const styleFooterBlock = (range, options = {}) => {
      const cell = sheet.getCell(range.split(":")[0]);
      cell.font = {
        name: "Arial",
        size: options.size || 10,
        bold: Boolean(options.bold),
        italic: Boolean(options.italic),
        color: { argb: options.color || COLORS.text },
      };
      cell.alignment = {
        horizontal: options.horizontal || "left",
        vertical: "middle",
        wrapText: options.wrapText !== false,
      };
      if (options.fill) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
      }
      if (options.border) {
        const footerBorder = {
          top: { style: "thin", color: { argb: "FFB0B0B0" } },
          left: { style: "thin", color: { argb: "FFB0B0B0" } },
          bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
          right: { style: "thin", color: { argb: "FFB0B0B0" } },
        };
        cell.border = footerBorder;
      }
    };

    styleFooterBlock("A" + footerStart + ":D" + footerStart, { bold: true, horizontal: "center", wrapText: false });
    styleFooterBlock("P" + footerStart + ":Q" + footerStart, { bold: true, horizontal: "center", wrapText: false });
    styleFooterBlock("A" + (footerStart + 1) + ":D" + (footerStart + 1), { italic: true, horizontal: "center", wrapText: false });
    for (let index = 0; index < 3; index += 1) {
      const row = footerStart + index;
      styleFooterBlock("E" + row + ":M" + row, { bold: true, color: COLORS.titleNavy, fill: COLORS.footerBlue, wrapText: false, border: true });
      styleFooterBlock("N" + row + ":O" + row, { bold: true, color: COLORS.red, fill: COLORS.footerBlue, horizontal: "center", wrapText: false, border: true });
    }
    styleFooterBlock("E" + (footerStart + 3) + ":O" + (footerStart + 3), { italic: true, size: 9, color: "FF595959", wrapText: false });

    const signatureNameRow = footerStart + 7;
    const signatureTitleRow = footerStart + 8;
    sheet.mergeCells("A" + signatureNameRow + ":D" + signatureNameRow);
    sheet.mergeCells("P" + signatureNameRow + ":Q" + signatureNameRow);
    sheet.mergeCells("A" + signatureTitleRow + ":D" + signatureTitleRow);
    sheet.mergeCells("P" + signatureTitleRow + ":Q" + signatureTitleRow);
    sheet.getCell("A" + signatureNameRow).value = "Azwar Effendi";
    sheet.getCell("P" + signatureNameRow).value = "R. Nuning Rosita R";
    sheet.getCell("A" + signatureTitleRow).value = "SPV. Umum & Personalia";
    sheet.getCell("P" + signatureTitleRow).value = "Manager Financial";

    for (const [cellRef, options] of [
      ["A" + signatureNameRow, { bold: true, italic: true, size: 11, horizontal: "center" }],
      ["P" + signatureNameRow, { bold: true, italic: true, size: 11, horizontal: "center" }],
      ["A" + signatureTitleRow, { italic: true, size: 9, color: "FF595959", horizontal: "center" }],
      ["P" + signatureTitleRow, { italic: true, size: 9, color: "FF595959", horizontal: "center" }],
    ]) {
      const cell = sheet.getCell(cellRef);
      cell.font = {
        name: "Arial",
        size: options.size || 10,
        bold: Boolean(options.bold),
        italic: Boolean(options.italic),
        color: { argb: options.color || COLORS.text },
      };
      cell.alignment = { horizontal: options.horizontal, vertical: "middle", wrapText: false };
    }

    sheet.getRow(footerStart).height = 19.5;
    sheet.getRow(footerStart + 1).height = 19.5;
    sheet.getRow(footerStart + 2).height = 19.5;
    sheet.getRow(footerStart + 3).height = 15.75;
    sheet.getRow(footerStart + 4).height = 15.75;
    sheet.getRow(footerStart + 5).height = 13.5;
    sheet.getRow(footerStart + 6).height = 13.5;
    sheet.getRow(signatureNameRow).height = 18;
    sheet.getRow(signatureTitleRow).height = 15.75;

    // Lebar kolom diambil dari workbook acuan HRD agar pembungkusan header
    // dan posisi kolom TMK/HC tetap konsisten dengan format aslinya.
    sheet.columns = [
      { key: "no", width: 5.54296875 },
      { key: "nama", width: 22 },
      { key: "tmk", width: 9.54296875 },
      { key: "tmkPart", width: 9.54296875 },
      { key: "hakCuti", width: 16.08984375 },
      { key: "hc2425", width: 16.08984375 },
      { key: "hc2526", width: 13 },
      { key: "hcDipinjam", width: 10 },
      { key: "late", width: 9.6328125 },
      { key: "meal", width: 13 },
      { key: "adaKet", width: 10 },
      { key: "tanpaKet", width: 10 },
      { key: "lembur", width: 9 },
      { key: "cuti", width: 9 },
      { key: "sakitSrt", width: 9 },
      { key: "sakitNoSrt", width: 9 },
      { key: "jumlahHC", width: 11.26953125 },
    ];

    sheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.35,
        bottom: 0.35,
        header: 0.15,
        footer: 0.15,
      },
    };
    sheet.printArea = "A1:Q" + signatureTitleRow;

    // =========================
    // SHEET 2 — DATA HARIAN
    // =========================
    const dailySheet = workbook.addWorksheet("Data Harian", {
      views: [{ state: "frozen", ySplit: 5, xSplit: 2 }],
    });
    dailySheet.showGridLines = false;
    dailySheet.properties.defaultRowHeight = 15;

    const dailyLastCol = 2 + jumlahHari * 2;
    const dailyLastColLetter = excelColumnName(dailyLastCol);
    const dailyDataStartRow = 6;

    dailySheet.mergeCells("A1:" + dailyLastColLetter + "1");
    dailySheet.getCell("A1").value =
      "DATA HARIAN KEHADIRAN — Periode " +
      formatTanggalTanpaTahun(tanggalAwal) +
      " s.d. " +
      formatTanggalIndonesia(tanggalAkhir);
    dailySheet.getCell("A1").font = {
      name: "Arial",
      size: 14,
      bold: true,
      color: { argb: COLORS.white },
    };
    dailySheet.getCell("A1").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: COLORS.titleNavy },
    };
    dailySheet.getCell("A1").alignment = {
      horizontal: "left",
      vertical: "middle",
    };
    dailySheet.getRow(1).height = 17.25;

    dailySheet.mergeCells("A2:" + dailyLastColLetter + "2");
    dailySheet.getCell("A2").value =
      "Clock In dan Clock Out ditampilkan dalam WIB berdasarkan catatan absensi sistem. Sel kosong berarti tidak ada cap waktu pada tanggal tersebut.";
    dailySheet.getCell("A2").font = {
      name: "Arial",
      size: 9,
      italic: true,
      color: { argb: "FF595959" },
    };
    dailySheet.getCell("A2").alignment = {
      horizontal: "left",
      vertical: "middle",
      wrapText: true,
    };
    dailySheet.getRow(2).height = 15;

    const dailyHeaderRows = [4, 5];
    dailySheet.getCell("A4").value = "NO";
    dailySheet.getCell("B4").value = "NAMA";
    dailySheet.mergeCells("A4:A5");
    dailySheet.mergeCells("B4:B5");

    tanggalList.forEach((tanggal, index) => {
      const col = index * 2 + 3;
      dailySheet.mergeCells(4, col, 4, col + 1);
      dailySheet.getCell(4, col).value = new Date(tanggal.getTime());
      dailySheet.getCell(4, col).numFmt = "m/d/yy";
      dailySheet.getCell(5, col).value = "Clock In";
      dailySheet.getCell(5, col + 1).value = "Clock Out";
    });

    for (const rowNum of dailyHeaderRows) {
      for (let col = 1; col <= dailyLastCol; col += 1) {
        const cell = dailySheet.getCell(rowNum, col);
        cell.font = {
          name: "Arial",
          size: 9,
          bold: true,
          color: { argb: COLORS.white },
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: COLORS.navy },
        };
        cell.border = {
          top: { style: "thin", color: { argb: COLORS.dailyGrid } },
          left: { style: "thin", color: { argb: COLORS.dailyGrid } },
          bottom: { style: "thin", color: { argb: COLORS.dailyGrid } },
          right: { style: "thin", color: { argb: COLORS.dailyGrid } },
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
      }
    }
    dailySheet.getRow(4).height = 18;
    dailySheet.getRow(5).height = 18;

    detailHarianPerKaryawan.forEach((item, index) => {
      const rowNum = dailyDataStartRow + index;
      // Identitas disimpan sebagai nilai di dalam berkas, tanpa tautan luar.
      dailySheet.getCell(rowNum, 1).value = item.nomorHR;
      dailySheet.getCell(rowNum, 2).value = item.nama;

      item.jamHarian.forEach((jam, offset) => {
        const colMasuk = offset * 2 + 3;
        const masuk = dailySheet.getCell(rowNum, colMasuk);
        const pulang = dailySheet.getCell(rowNum, colMasuk + 1);
        masuk.value = jam.masuk == null ? null : jam.masuk / 1440;
        pulang.value = jam.pulang == null ? null : jam.pulang / 1440;
        masuk.numFmt = "hh:mm";
        pulang.numFmt = "hh:mm";
      });

      for (let col = 1; col <= dailyLastCol; col += 1) {
        const cell = dailySheet.getCell(rowNum, col);
        const isWeekendOrHoliday =
          col >= 3 &&
          (() => {
            const dateIndex = Math.floor((col - 3) / 2);
            const tanggal = tanggalList[dateIndex];
            const key = tanggal.toISOString().slice(0, 10);
            return tanggal.getUTCDay() === 0 || tanggal.getUTCDay() === 6 || setHariLibur.has(key);
          })();
        cell.font = {
          name: "Arial",
          size: col <= 2 ? 10 : 9,
          bold: col === 2,
          color: { argb: COLORS.text },
        };
        cell.fill = isWeekendOrHoliday
          ? { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.lightGray } }
          : { type: "pattern", pattern: "none" };
        cell.border = {
          top: { style: "thin", color: { argb: COLORS.dailyGrid } },
          left: { style: "thin", color: { argb: COLORS.dailyGrid } },
          bottom: { style: "thin", color: { argb: COLORS.dailyGrid } },
          right: { style: "thin", color: { argb: COLORS.dailyGrid } },
        };
        if (col <= 2) cell.fill = { type: "pattern", pattern: "none" };
        cell.alignment = {
          horizontal: col === 2 ? "left" : "center",
          vertical: "middle",
          wrapText: false,
        };
        dailySheet.getRow(rowNum).height = 15;
      }
    });

    dailySheet.columns = [
      { key: "no", width: 5 },
      { key: "nama", width: 26 },
      ...tanggalList.flatMap(() => [{ width: 12 }, { width: 12 }]),
    ];

    dailySheet.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.15,
        right: 0.15,
        top: 0.3,
        bottom: 0.3,
        header: 0.1,
        footer: 0.1,
      },
    };

    dailySheet.printArea =
      "A1:" +
      dailyLastColLetter +
      (dailyDataStartRow + detailHarianPerKaryawan.length - 1);

    // Sheet tambahan ini dibuat hanya jika Admin mengunggah Check Log.
    if (checkLogData) {
      const compareSheet = workbook.addWorksheet("Perbandingan Jam", { views: [{ state: "frozen", ySplit: 4, xSplit: 2 }] });
      compareSheet.showGridLines = false;
      compareSheet.properties.defaultRowHeight = 18;
      compareSheet.mergeCells("A1:I1");
      compareSheet.getCell("A1").value = "PERBANDINGAN JAM ABSENSI — Periode " + formatTanggalIndonesia(tanggalAwal) + " s.d. " + formatTanggalIndonesia(tanggalAkhir);
      compareSheet.getCell("A1").font = { name: "Arial", size: 14, bold: true, color: { argb: WARNA.putih } };
      compareSheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: WARNA.navy } };
      compareSheet.getCell("A1").alignment = { horizontal: "left", vertical: "middle" };
      compareSheet.getRow(1).height = 26;
      compareSheet.mergeCells("A2:I2");
      const namaTidakCocokPreview = Array.from(checkLogData.namaTidakCocok).slice(0, 5).join(", ");
      const namaTidakCocokTambahan = checkLogData.namaTidakCocok.size > 5 ? ", dan nama lainnya" : "";
      compareSheet.getCell("A2").value = "HP = sistem absensi ZamanTeknindo; Check Log = file unggahan. Result memilih Masuk paling awal dan Pulang paling akhir. Nama Check Log yang tidak cocok dengan roster HRD: " + checkLogData.namaTidakCocok.size + (namaTidakCocokPreview ? " (" + namaTidakCocokPreview + namaTidakCocokTambahan + ")" : "") + ".";
      compareSheet.getCell("A2").font = { name: "Arial", size: 9, italic: true, color: { argb: WARNA.teks } };
      compareSheet.getCell("A2").alignment = { horizontal: "left", vertical: "middle", wrapText: true };
      compareSheet.getRow(2).height = 28;
      compareSheet.mergeCells("A3:A4");
      compareSheet.mergeCells("B3:B4");
      compareSheet.mergeCells("C3:D3");
      compareSheet.mergeCells("E3:F3");
      compareSheet.mergeCells("H3:I3");
      compareSheet.getCell("A3").value = "NAMA KARYAWAN";
      compareSheet.getCell("B3").value = "TANGGAL";
      compareSheet.getCell("C3").value = "HP";
      compareSheet.getCell("E3").value = "Check Log";
      compareSheet.getCell("H3").value = "Result (submit ke atasan)";
      for (const [cell, value] of [["C4","Masuk"],["D4","Pulang"],["E4","Masuk"],["F4","Pulang"],["H4","Masuk"],["I4","Pulang"]]) compareSheet.getCell(cell).value = value;
      for (const rowNumber of [3,4]) {
        const row=compareSheet.getRow(rowNumber);
        for(let col=1;col<=9;col++) {
          const cell=row.getCell(col);
          cell.font={name:"Arial",size:10,bold:true,color:{argb:WARNA.putih}};
          cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:WARNA.header}};
          cell.alignment={horizontal:"center",vertical:"middle",wrapText:true};
          cell.border={top:{style:"thin",color:{argb:WARNA.garis}},left:{style:"thin",color:{argb:WARNA.garis}},bottom:{style:"thin",color:{argb:WARNA.garis}},right:{style:"thin",color:{argb:WARNA.garis}}};
        }
      }
      compareSheet.getRow(3).height=26;
      compareSheet.getRow(4).height=22;
      let compareRowNumber=5;
      for(const employee of karyawanUnik) {
        for(const tanggal of tanggalList) {
          const tanggalKey=tanggal.toISOString().slice(0,10);
          const hp=employee.id==null?null:petaAbsensi.get(employee.id+"_"+tanggalKey);
          const hpMasuk=waktuHarianKeMenit(hp?.jamMasuk), hpPulang=waktuHarianKeMenit(hp?.jamPulang);
          const check=checkLogData.peta.get(normalisasiNamaRoster(employee.nama)+"_"+tanggalKey);
          const checkMasuk=check?.masuk??null, checkPulang=check?.pulang??null;
          const resultMasuk=hpMasuk==null?checkMasuk:checkMasuk==null?hpMasuk:Math.min(hpMasuk,checkMasuk);
          const resultPulang=hpPulang==null?checkPulang:checkPulang==null?hpPulang:Math.max(hpPulang,checkPulang);
          const konflik=(hpMasuk!=null&&checkMasuk!=null&&hpMasuk!==checkMasuk)||(hpPulang!=null&&checkPulang!=null&&hpPulang!==checkPulang);
          const warnaBaris=konflik?WARNA.kuningMuda:WARNA.hijauMuda;
          const row=compareSheet.getRow(compareRowNumber);
          row.getCell(1).value=employee.nama;
          row.getCell(2).value=formatTanggalIndonesia(tanggal);
          row.getCell(3).value=hpMasuk==null?null:hpMasuk/1440;
          row.getCell(4).value=hpPulang==null?null:hpPulang/1440;
          row.getCell(5).value=checkMasuk==null?null:checkMasuk/1440;
          row.getCell(6).value=checkPulang==null?null:checkPulang/1440;
          row.getCell(7).value=null;
          row.getCell(8).value=resultMasuk==null?null:resultMasuk/1440;
          row.getCell(9).value=resultPulang==null?null:resultPulang/1440;
          for(let col=1;col<=9;col++) {
            const cell=row.getCell(col);
            cell.font={name:"Arial",size:10,bold:col>=8,color:{argb:WARNA.teks}};
            cell.fill={type:"pattern",pattern:"solid",fgColor:{argb:col===7?WARNA.putih:warnaBaris}};
            cell.alignment={horizontal:col===1?"left":"center",vertical:"middle",wrapText:false};
            cell.border={top:{style:"thin",color:{argb:WARNA.garis}},left:{style:"thin",color:{argb:WARNA.garis}},bottom:{style:"thin",color:{argb:WARNA.garis}},right:{style:"thin",color:{argb:WARNA.garis}}};
            if(col>=3&&col!==7) cell.numFmt="hh:mm";
          }
          row.height=18;
          compareRowNumber++;
        }
      }
      compareSheet.columns=[{key:"nama",width:28},{key:"tanggal",width:18},{key:"hpMasuk",width:12},{key:"hpPulang",width:12},{key:"checkMasuk",width:12},{key:"checkPulang",width:12},{key:"pemisah",width:3},{key:"resultMasuk",width:14},{key:"resultPulang",width:14}];
      compareSheet.pageSetup={paperSize:9,orientation:"landscape",fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.2,right:0.2,top:0.35,bottom:0.35,header:0.15,footer:0.15}};
      compareSheet.printArea="A1:I"+(compareRowNumber-1);
    }

    // Handshake eksplisit agar UI tidak menganggap file 2-sheet sebagai hasil revisi.
    if (checkLogData) {
      res.setHeader("X-Rekap-Excel-Mode", "revisi-check-log");
      res.setHeader(
        "X-Rekap-Excel-Sheets",
        "Rekap Absensi|Data Harian|Perbandingan Jam",
      );
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=\"Rekap_Absensi_" + formatTanggalFile(tanggalAwal, false) + "-" + formatTanggalFile(tanggalAkhir, true) + ".xlsx\"");
    res.setHeader("Cache-Control", "no-store, private");
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error("Gagal export rekap absensi:", error);
    const status = Number(error?.statusCode);
    if (status >= 400 && status < 500) return res.status(status).json({ pesan: error.message || "File Check Log tidak valid." });
    return res.status(500).json({ pesan: "Gagal membuat rekap absensi. Silakan coba lagi." });
  }
}
module.exports = {
  exportRekapAbsensi,
  parseCheckLogWorkbook,
};
