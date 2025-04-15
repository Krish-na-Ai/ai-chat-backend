const Chat = require("../models/chat.model");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateChatTitle } = require("../utils/ai-helpers");

// Initialize Google Generative AI with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

let io; // Will be initialized in the setupSocketIo function

// Function to set up socket.io reference
exports.setupSocketIo = (socketIo) => {
  io = socketIo;
};

exports.sendMessage = async (req, res) => {
  const { message } = req.body;
  const chatId = req.params.id;
  const userId = req.user._id.toString();

  try {
    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) return res.status(404).json({ message: "Chat not found" });

    // Add user message to the chat history
    chat.messages.push({ sender: "user", content: message });
    
    // For first message, we'll generate a title later
    const isFirstMessage = chat.messages.length === 1;
    
    await chat.save();

    // Signal that processing has started
    if (io) {
      io.to(userId).emit('processing', { chatId, status: 'started' });
    }

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

    // Process the stream chunks and emit to socket
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        aiReply += chunkText;
        // Send chunk via socket.io if available
        if (io) {
          io.to(userId).emit('message-chunk', { 
            chatId, 
            chunk: chunkText 
          });
        }
      }
    }

    // Save AI response to database
    chat.messages.push({ sender: "ai", content: aiReply });
    
    // For the first message, generate a title based on conversation
    if (isFirstMessage) {
      const titlePrompt = `Based on this conversation, generate a very brief title (max 5 words):\nUser: ${message}\nAI: ${aiReply}`;
      try {
        const titleResponse = await model.generateContent(titlePrompt);
        const suggestedTitle = titleResponse.response.text().trim();
        chat.title = suggestedTitle.length > 50 
          ? suggestedTitle.substring(0, 47) + "..." 
          : suggestedTitle;
      } catch (titleErr) {
        console.error("Error generating title:", titleErr);
        // Fallback title based on user message
        chat.title = message.length > 30 
          ? message.substring(0, 27) + "..." 
          : message;
      }
    }
    
    await chat.save();

    // Signal completion via socket
    if (io) {
      io.to(userId).emit('processing', { 
        chatId, 
        status: 'completed', 
        title: chat.title 
      });
    }

    // For traditional HTTP response
    res.json({ 
      success: true, 
      message: "Message sent and processed",
      response: aiReply,
      title: chat.title
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    
    // Inform client of error via socket
    if (io) {
      io.to(userId).emit('error', { 
        chatId, 
        error: err.message 
      });
    }
    
    // Check if the error response contains details
    const errorMessage = err.response?.data?.error?.message || err.message;
    res.status(500).json({ message: "Gemini API failed", error: errorMessage });
  }
};