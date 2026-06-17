import express from "express";
const router = express.Router();

// 1. Fetch all conversations for the frontend sidebar dashboard list
router.get("/conversations", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT * FROM conversations ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Fetch all individual dialogue messages inside a specific conversation
router.get("/conversations/:id/messages", async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT * FROM chat_history_messages WHERE conversation_id = ? ORDER BY created_at ASC", 
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Create a new conversation entry when a user kicks off a fresh chat topic
router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    const [result] = await db.query("INSERT INTO conversations (title) VALUES (?)", [title]);
    res.json({ conversationId: result.insertId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});