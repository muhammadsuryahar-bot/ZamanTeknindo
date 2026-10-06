const express = require('express');
const router = express.Router();
const kioskController = require('../controllers/kioskController');
const { batasKioskPin } = require('../middleware/rateLimiter');

const {
  checkKioskAdminSession,
  checkKioskAttendanceToken,
} = kioskController;

// Public: configuration + server-side face recognition.
// The browser no longer receives a kiosk secret or the face-descriptor database.
router.get('/config', kioskController.getConfigKiosk);
router.post('/recognize', kioskController.recognize);

// Attendance requires a short-lived token issued by /recognize.
// This prevents arbitrary penggunaId submissions from the public kiosk.
router.post('/absen', checkKioskAttendanceToken, kioskController.kioskAbsen);
router.post('/absen-via-kiosk', checkKioskAttendanceToken, kioskController.kioskAbsen);

// Admin session: employee list, attendance status, face data and maintenance.
router.get('/pengguna-list', checkKioskAdminSession, kioskController.getPenggunaListKiosk);
router.get('/status/:penggunaId', checkKioskAdminSession, kioskController.getStatusKiosk);
router.get('/faces', checkKioskAdminSession, kioskController.getAllFaces);
router.get('/faces-detailed', checkKioskAdminSession, kioskController.getFacesDetailed);
router.post('/enroll', checkKioskAdminSession, kioskController.enrollFace);
router.post('/manual-fallback', checkKioskAdminSession, kioskController.submitManualFallback);
router.delete('/face/:penggunaId', checkKioskAdminSession, kioskController.hapusFace);

// PIN is the only public gate to obtain a short-lived admin session.
// Rate limiting remains active.
router.post('/verify-admin-pin', batasKioskPin, kioskController.verifyAdminPin);
router.post('/verify-pin', batasKioskPin, kioskController.verifyAdminPin);

module.exports = router;
