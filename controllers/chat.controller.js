const Chat = require("../models/chat.model");

exports.startChat = async (req, res) => {
  try {
    const chat = await Chat.create({ userId: req.user._id });
    res.status(201).json({ chatId: chat._id });
  } catch (err) {
    res.status(500).json({ message: "Could not create chat", error: err.message });
  }
};

exports.getUserChats = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id }).select("_id title createdAt").sort({ createdAt: -1 });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ message: "Failed to load chats", error: err.message });
  }
};

exports.getChatById = async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });
    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: "Error getting chat", error: err.message });
  }
};