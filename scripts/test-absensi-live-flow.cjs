const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const root = path.resolve(__dirname, "..");
const NativeDate = Date;
let fixedNowMs = NativeDate.parse("2026-10-13T04:59:00.000Z");

class FixedDate extends NativeDate {
  constructor(...args) {
    if (args.length === 0) super(fixedNowMs);
    else super(...args);
  }

  static now() {
    return fixedNowMs;
  }
}

global.Date = FixedDate;

function setNow(iso) {
  fixedNowMs = NativeDate.parse(iso);
  assert.ok(Number.isFinite(fixedNowMs), \`Waktu uji tidak valid: \${iso}\`);
}

function cloneRecord(record) {
  return record ? { ...record } : null;
}

function prismaError(code) {
  const error = new Error(\`Mock Prisma \${code}\`);
  error.code = code;
  return error;
}

let dbState;
let storageUploadCount = 0;
let storageDeleteCount = 0;

const prisma = {
  pengajuanIzin: {
    async findFirst() {
      dbState.calls.findLeave += 1;
      return dbState.approvedLeave;
    },
  },
  absensi: {
    async findUnique() {
      dbState.calls.findUnique += 1;
      const state = dbState;
      const snapshot = cloneRecord(state.record);

      // In the race test both requests must read jamPulang=null before either
      // reaches the conditional database update.
      if (
        state.concurrentInitialReads &&
        state.initialReads < 2 &&
        (!snapshot || !snapshot.jamPulang)
      ) {
        state.initialReads += 1;
        if (state.initialReads === 2) state.releaseInitialReads();
        await state.initialReadBarrier;
        return snapshot;
      }

      return cloneRecord(state.record);
    },
    async update(args) {
      dbState.calls.updateAttempts += 1;
      if (
        !dbState.record ||
        dbState.record.id !== args.where.id ||
        (args.where.jamPulang === null && dbState.record.jamPulang !== null)
      ) {
        throw prismaError("P2025");
      }

      dbState.record = { ...dbState.record, ...args.data };
      dbState.calls.successfulUpdates += 1;
      return cloneRecord(dbState.record);
    },
    async create(args) {
      dbState.calls.createAttempts += 1;
      if (dbState.record) throw prismaError("P2002");

      dbState.record = { id: 9001, ...args.data };
      dbState.calls.successfulCreates += 1;
      return cloneRecord(dbState.record);
    },
  },
};

function installMock(relativePath, exportsValue) {
  const filename = require.resolve(path.join(root, relativePath));
  const mock = new Module(filename, module);
  mock.filename = filename;
  mock.loaded = true;
  mock.exports = exportsValue;
  require.cache[filename] = mock;
}

installMock("backend/src/utils/prismaClient.js", prisma);
installMock("backend/src/utils/supabaseStorage.js", {
  async uploadFotoAbsensi() {
    storageUploadCount += 1;
    return \`mock-upload-\${storageUploadCount}.jpg\`;
  },
  async deleteFotoAbsensi() {
    storageDeleteCount += 1;
  },
});

const { absenPulang } = require("../backend/src/controllers/absensiController.js");
const kompresFoto = require("../backend/src/middleware/kompresFoto.js");

const absensiRoutesSource = fs.readFileSync(
  path.join(root, "backend/src/routes/absensiRoutes.js"),
  "utf8",
);
assert.match(absensiRoutesSource, /router\.use\(cekLogin\)/);
assert.match(
  absensiRoutesSource,
  /router\.post\("\/pulang",\s*upload\.single\("foto"\),\s*kompresFoto,\s*absenPulang\)/,
  "Rute pulang production harus tetap menjalankan login, upload middleware, cutoff middleware, dan controller berurutan.",
);

function makeRecord({ jamPulang = null } = {}) {
  return {
    id: 545,
    penggunaId: 3,
    tanggal: new NativeDate("2026-10-13T00:00:00.000Z"),
    jamMasuk: new NativeDate("2026-10-13T00:57:00.000Z"),
    jamPulang,
    fotoMasuk: "existing-clock-in.jpg",
    fotoPulang: jamPulang ? "existing-clock-out.jpg" : null,
  };
}

function resetDb(record = null, { concurrentInitialReads = false } = {}) {
  let releaseInitialReads;
  const initialReadBarrier = new Promise((resolve) => {
    releaseInitialReads = resolve;
  });
  dbState = {
    record: cloneRecord(record),
    approvedLeave: null,
    calls: {
      findLeave: 0,
      findUnique: 0,
      updateAttempts: 0,
      successfulUpdates: 0,
      createAttempts: 0,
      successfulCreates: 0,
    },
    concurrentInitialReads,
    initialReads: 0,
    initialReadBarrier,
    releaseInitialReads,
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    once() {},
  };
}

function makeRequest({ withUploadedPhoto = true, filename = "test-pulang.jpg" } = {}) {
  return {
    path: "/pulang",
    user: { id: 3, nama: "Pengguna Uji" },
    body: {
      latitude: "-0.5071",
      longitude: "101.4478",
      akurasi: "10",
      alamat: "Lokasi pengujian terisolasi",
    },
    file: withUploadedPhoto
      ? {
          fieldname: "foto",
          originalname: "absen.jpg",
          mimetype: "image/jpeg",
          buffer: Buffer.from("fake-image-for-controller-test"),
          size: 32,
          filename,
          path: filename,
        }
      : undefined,
    get() {
      return null;
    },
  };
}

async function runMiddleware(req) {
  const res = makeResponse();
  let nextCalled = false;
  await kompresFoto(req, res, () => {
    nextCalled = true;
  });
  return { res, nextCalled };
}

async function runController(filename = "test-pulang.jpg") {
  const req = makeRequest({ filename });
  const res = makeResponse();
  await absenPulang(req, res);
  return res;
}

async function main() {
  // Exact cutoff boundaries are exercised against the real middleware and controller.
  setNow("2026-10-13T04:59:00.000Z"); // 11:59 WIB
  resetDb(makeRecord());
  const beforeNoonMiddleware = await runMiddleware(makeRequest({ filename: undefined }));
  assert.equal(beforeNoonMiddleware.res.statusCode, 409);
  assert.equal(beforeNoonMiddleware.res.body.kode, "ABSEN_PULANG_TERLALU_AWAL");
  assert.equal(beforeNoonMiddleware.nextCalled, false);
  assert.equal(dbState.calls.findUnique, 0, "Middleware harus menolak sebelum query absensi.");
  assert.equal(storageUploadCount, 0, "Request yang ditolak tidak boleh upload foto ke Storage.");

  resetDb(makeRecord());
  const beforeNoonController = await runController(null);
  assert.equal(beforeNoonController.statusCode, 409);
  assert.equal(beforeNoonController.body.kode, "ABSEN_PULANG_TERLALU_AWAL");
  assert.equal(dbState.calls.findLeave, 0, "Controller harus menolak sebelum query izin/database.");
  assert.equal(dbState.calls.findUnique, 0);
  assert.equal(dbState.calls.successfulUpdates, 0);
  assert.equal(dbState.calls.successfulCreates, 0);
  assert.equal(dbState.record.jamPulang, null, "Tidak boleh ada perubahan DB sebelum pukul 12:00.");

  // At/after 12:00 WIB, the real middleware treats an already-saved send as
  // success without a second Storage upload or calling next().
  setNow("2026-10-13T05:30:00.000Z"); // 12:30 WIB
  resetDb(makeRecord({ jamPulang: new NativeDate("2026-10-13T05:20:00.000Z") }));
  const uploadsBeforeIdempotentMiddleware = storageUploadCount;
  const duplicateMiddleware = await runMiddleware(makeRequest({ filename: undefined }));
  assert.equal(duplicateMiddleware.res.statusCode, 200);
  assert.match(duplicateMiddleware.res.body.pesan, /sudah tercatat/i);
  assert.equal(duplicateMiddleware.nextCalled, false);
  assert.equal(storageUploadCount, uploadsBeforeIdempotentMiddleware);

  // Real controller success: one write is saved. Repeating the same request
  // returns the saved result rather than creating/updating a second checkout.
  resetDb(makeRecord());
  const firstSend = await runController("first-send.jpg");
  assert.equal(firstSend.statusCode, 200);
  assert.match(firstSend.body.pesan, /berhasil/i);
  assert.ok(dbState.record.jamPulang instanceof NativeDate);
  assert.equal(dbState.calls.successfulUpdates, 1);

  const repeatSend = await runController("repeat-send.jpg");
  assert.equal(repeatSend.statusCode, 200);
  assert.match(repeatSend.body.pesan, /sudah tercatat/i);
  assert.equal(dbState.calls.successfulUpdates, 1, "Request ulang tidak boleh menulis jam pulang kedua.");
  assert.equal(dbState.calls.successfulCreates, 0);

  // Concurrent request simulation: both handlers first observe jamPulang=null.
  // The database's conditional update lets one win; P2025 loser then reads the
  // winner's saved result and also returns 200, with only one DB write.
  resetDb(makeRecord(), { concurrentInitialReads: true });
  const [raceA, raceB] = await Promise.all([
    runController("race-a.jpg"),
    runController("race-b.jpg"),
  ]);
  assert.equal(raceA.statusCode, 200);
  assert.equal(raceB.statusCode, 200);
  assert.ok(dbState.record.jamPulang instanceof NativeDate);
  assert.equal(dbState.calls.updateAttempts, 2);
  assert.equal(dbState.calls.successfulUpdates, 1, "Dua request bersamaan hanya boleh menghasilkan satu update berhasil.");
  assert.equal(dbState.calls.successfulCreates, 0);
  assert.equal(storageDeleteCount >= 1, true, "Foto dari request yang kalah harus dibersihkan.");

  console.log("Absensi live controller cutoff + repeat-send + concurrent-send integration test: PASS");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.Date = NativeDate;
  });
