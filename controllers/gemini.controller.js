const Chat = require("../models/chat.model");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  const chatId = req.params.id;

  try {
    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // Add user message to the chat history
    chat.messages.push({ sender: "user", content: message });
    await chat.save();

    // Set up the response as a stream
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Format previous messages for Gemini's history format
    const history = [];
    
    // Process previous messages (excluding the latest user message)
    for (let i = 0; i < chat.messages.length - 1; i++) {
      const msg = chat.messages[i];
      history.push({
        role: msg.sender === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      });
    }

    // Get the model - using gemini-2.0-flash as requested
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    });

    // Create a chat session with history
    const chatSession = model.startChat({
      history,
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });

    // Send the message and get a streaming response
    const result = await chatSession.sendMessageStream(message);
    
    let aiReply = "";

    // Process the stream chunks
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        aiReply += chunkText;
        res.write(`data: ${chunkText}\n\n`);
      }
    }

    // Save AI response to database
    chat.messages.push({ sender: "ai", content: aiReply });
    await chat.save();

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("Gemini API error:", err);
    // Check if the error response contains details
    const errorMessage = err.response?.data?.error?.message || err.message;
    res.status(500).json({ message: "Gemini API failed", error: errorMessage });
  }
};