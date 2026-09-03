const express = require("express");
const router = express.Router();
const { cekLogin } = require("../middleware/authMiddleware");
const {
  infoPush,
  simpanSubscription,
  hapusSubscription,
} = require("../controllers/pushNotificationController");

router.get("/info", cekLogin, infoPush);
router.post("/subscription", cekLogin, simpanSubscription);
router.delete("/subscription", cekLogin, hapusSubscription);

module.exports = router;
