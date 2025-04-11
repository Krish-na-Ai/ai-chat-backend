const Chat = require("../models/chat.model");
const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  const chatId = req.params.id;

  try {
    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    chat.messages.push({ sender: "user", content: message });
    await chat.save();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await openai.chat.completions.create({
      model: "gpt-4",
      stream: true,
      messages: chat.messages.map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.content
      }))
    });

    let aiReply = "";

    for await (const chunk of stream) {
      const token = chunk.choices?.[0]?.delta?.content || "";
      if (token) {
        aiReply += token;
        res.write(`data: ${token}\n\n`);
      }
    }

    chat.messages.push({ sender: "ai", content: aiReply });
    await chat.save();

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    res.status(500).json({ message: "OpenAI failed", error: err.message });
  }
};