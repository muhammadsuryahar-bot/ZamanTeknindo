const prisma = require("../utils/prismaClient");

const getManualPending = async (req, res) => {
  try {
    const { status = "PENDING" } = req.query;
    const where = status!== "ALL"? { status } : {};
    let data;
    try {
      data = await prisma.manualAbsenRequest.findMany({
        where,
        select: {
          id: true,
          penggunaId: true,
          tipe: true,
          requestedAt: true,
          fotoBukti: true,
          alasan: true,
          status: true,
          createdAt: true,
          user: { select: { id:true, nama:true, jabatan:true } }
        },
        orderBy: { requestedAt: "desc" },
        take: 100
      });
    } catch (e) {
      const f = where.status? `WHERE status='${where.status}'` : "";
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, pengguna_id as "penggunaId", tipe, requested_at as "requestedAt",
                foto_bukti as "fotoBukti", alasan, status
         FROM manual_absen_request ${f}
         ORDER BY requested_at DESC LIMIT 100`
      );
      data = [];
      for (let r of rows) {
        try {
          const u = await prisma.pengguna.findUnique({ where: { id: Number(r.penggunaId) }, select: { id:true, nama:true } });
          r.user = u;
        } catch {}
        data.push(r);
      }
    }
    res.json({ data });
  } catch(e){ res.status(500).json({ message: e.message }); }
};

const approveManual = async (req, res) => {
  try {
    const id = Number(req.params.id);
    let reqData;
    try {
      reqData = await prisma.manualAbsenRequest.findUnique({
        where: { id },
        select: { id:true, penggunaId:true, tipe:true, requestedAt:true, fotoBukti:true, alasan:true, status:true }
      });
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT id, pengguna_id as "penggunaId", tipe, requested_at as "requestedAt", foto_bukti as "fotoBukti", alasan, status
         FROM manual_absen_request WHERE id=$1 LIMIT 1`, id
      );
      reqData = rows?.[0];
      if (reqData) {
        reqData.penggunaId = Number(reqData.penggunaId);
        reqData.requestedAt = new Date(reqData.requestedAt);
      }
    }

    if(!reqData) return res.status(404).json({ message: "Pengajuan tidak ditemukan" });
    if(reqData.status!== "PENDING") return res.status(400).json({ message: "Sudah diproses" });

    const attemptDate = new Date(reqData.requestedAt);
    const wibDateStr = attemptDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const start = new Date(`${wibDateStr}T00:00:00+07:00`);
    const end = new Date(`${wibDateStr}T23:59:59.999+07:00`);
    const tanggalDate = new Date(`${wibDateStr}T00:00:00.000Z`);

    // Hitung status otomatis: > 08:10 (490 menit) dianggap telat
    const attemptWIBStr = attemptDate.toLocaleTimeString("en-GB", { timeZone: "Asia/Jakarta", hour12: false });
    const [hAttempt, mAttempt] = attemptWIBStr.split(":").map(Number);
    const attemptMenit = (hAttempt || 0) * 60 + (mAttempt || 0);
    const statusHitung = attemptMenit > 490 ? "telat" : "tepat_waktu";

    let absen = await prisma.absensi.findFirst({
      where: { penggunaId: reqData.penggunaId, tanggal: tanggalDate },
      orderBy: { id: "desc" }
    });

    const userKantor = await prisma.pengguna.findUnique({
      where: { id: Number(reqData.penggunaId) },
      include: { kantor: true }
    });
    const kantor = userKantor?.kantor;
    const finalLatitude = kantor ? kantor.latitude : null;
    const finalLongitude = kantor ? kantor.longitude : null;
    const finalAlamat = kantor ? `Absen via Kiosk: ${kantor.namaKantor}${kantor.alamat ? ` - ${kantor.alamat}` : ''}` : null;

    if(reqData.tipe === "masuk"){
      if(absen?.jamMasuk) return res.status(400).json({ message: "Sudah ada absen masuk" });
      if(absen){
        await prisma.absensi.update({
          where: { id: absen.id },
          data: {
            jamMasuk: attemptDate,
            fotoMasuk: reqData.fotoBukti,
            latitudeMasuk: absen.latitudeMasuk == null || absen.latitudeMasuk === 0 ? finalLatitude : absen.latitudeMasuk,
            longitudeMasuk: absen.longitudeMasuk == null || absen.longitudeMasuk === 0 ? finalLongitude : absen.longitudeMasuk,
            alamatMasuk: absen.alamatMasuk || finalAlamat,
            statusOtomatis: statusHitung,
            statusFinal: statusHitung,
            catatanAdmin: `Verifikasi Manual Backup Kiosk: ${reqData.alasan || ""}`
          }
        });
      } else {
        await prisma.absensi.create({
          data: {
            penggunaId: reqData.penggunaId,
            tanggal: tanggalDate,
            jamMasuk: attemptDate,
            fotoMasuk: reqData.fotoBukti,
            latitudeMasuk: finalLatitude,
            longitudeMasuk: finalLongitude,
            alamatMasuk: finalAlamat,
            statusOtomatis: statusHitung,
            statusFinal: statusHitung,
            catatanAdmin: `Verifikasi Manual Backup Kiosk: ${reqData.alasan || ""}`
          }
        });
      }
    } else {
      if(!absen) return res.status(400).json({ message: "Belum absen masuk" });
      if(absen.jamPulang) return res.status(400).json({ message: "Sudah pulang" });
      await prisma.absensi.update({
        where: { id: absen.id },
        data: {
          jamPulang: attemptDate,
          fotoPulang: reqData.fotoBukti,
          latitudePulang: absen.latitudePulang == null || absen.latitudePulang === 0 ? finalLatitude : absen.latitudePulang,
          longitudePulang: absen.longitudePulang == null || absen.longitudePulang === 0 ? finalLongitude : absen.longitudePulang,
          alamatPulang: absen.alamatPulang || finalAlamat
        }
      });
    }

    try {
      await prisma.manualAbsenRequest.update({ where: { id }, data: { status: "APPROVED" }, select: { id:true } });
    } catch {
      await prisma.$queryRawUnsafe(`UPDATE manual_absen_request SET status='APPROVED' WHERE id=$1`, id);
    }

    res.json({ message: `Berhasil menyetujui presensi ${reqData.tipe} (Status: ${statusHitung === "telat" ? "Terlambat" : "Tepat Waktu"})` });
  } catch(e){ console.error(e); res.status(500).json({ message: e.message }); }
};

const rejectManual = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { alasanTolak } = req.body || {};
    try {
      await prisma.manualAbsenRequest.update({
        where: { id },
        data: { status: "REJECTED", alasan: alasanTolak ? `DITOLAK: ${alasanTolak}` : undefined },
        select: { id:true }
      });
    } catch {
      await prisma.$queryRawUnsafe(`UPDATE manual_absen_request SET status='REJECTED' WHERE id=$1`, id);
    }
    res.json({ message: "Pengajuan verifikasi manual berhasil ditolak" });
  } catch(e){ res.status(500).json({ message: e.message }); }
};

module.exports = { getManualPending, approveManual, rejectManual };
