const express = require('express');
const router = express.Router();
const kioskController = require('../controllers/kioskController');
const { checkKioskKey } = kioskController;

// List & Status
router.get('/pengguna-list', checkKioskKey, kioskController.getPenggunaListKiosk);
router.get('/status/:penggunaId', checkKioskKey, kioskController.getStatusKiosk);
router.get('/faces', checkKioskKey, kioskController.getAllFaces);
router.get('/faces-detailed', kioskController.getFacesDetailed);

// Absen
router.post('/enroll', checkKioskKey, kioskController.enrollFace);
router.post('/recognize', checkKioskKey, kioskController.recognize);
router.post('/absen', checkKioskKey, kioskController.kioskAbsen);
router.post('/absen-via-kiosk', checkKioskKey, kioskController.kioskAbsen);
router.post('/manual-fallback', checkKioskKey, kioskController.submitManualFallback);

// PIN - tanpa checkKioskKey biar gak dobel error
router.post('/verify-admin-pin', kioskController.verifyAdminPin);
router.post('/verify-pin', kioskController.verifyAdminPin);

// Hapus wajah - INI YANG BIKIN 404 KEMARIN, sekarang ada
router.delete('/face/:penggunaId', kioskController.hapusFace);
router.delete('/face/:id', kioskController.hapusFace);

module.exports = router;
