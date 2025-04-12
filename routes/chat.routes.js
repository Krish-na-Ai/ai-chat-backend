const express = require("express");
const router = express.Router();
const { protect } = require("../middlewares/auth.middleware");
const { startChat, getUserChats, getChatById } = require("../controllers/chat.controller");
const { sendMessage } = require("../controllers/gemini.controller");

router.post("/start", protect, startChat);
router.get("/history", protect, getUserChats);
router.get("/:id", protect, getChatById);
router.post("/:id/message", protect, sendMessage);

module.exports = router;