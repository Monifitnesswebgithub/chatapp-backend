require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const pool = require("./db");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3001",
      "http://localhost:3000",
      "https://gilded-jelly-1e0185.netlify.app"
    ],
    methods: ["GET", "POST"]
  }
});



// ---------------------- DB HELPERS ----------------------
async function findUserByUsername(username) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function createUser({ username, password }) {
  const id = uuidv4();
  const hashed = bcrypt.hashSync(password, 10);

  await pool.query(
    "INSERT INTO users (id, username, password) VALUES (?, ?, ?)",
    [id, username, hashed]
  );

  return { id, username };
}

async function saveMessage({ id, room, username, text }) {
  await pool.query(
    "INSERT INTO messages (id, room, username, text, time) VALUES (?, ?, ?, ?, NOW())",
    [id, room, username, text]
  );
}

async function getMessages(room) {
  const [rows] = await pool.query(
    "SELECT * FROM messages WHERE room = ? ORDER BY time ASC",
    [room]
  );
  return rows;
}

// ---------------------- ROUTES ----------------------
app.get("/", (req, res) => {
  res.json({ status: "Backend running" });
});

app.post("/signup", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: "Missing fields" });

    const exists = await findUserByUsername(username);
    if (exists)
      return res.status(409).json({ error: "User exists" });

    const user = await createUser({ username, password });
    res.json({ success: true, user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await findUserByUsername(username);
    if (!user)
      return res.status(401).json({ error: "Invalid credentials" });

    const ok = bcrypt.compareSync(password, user.password);
    if (!ok)
      return res.status(401).json({ error: "Invalid credentials" });

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ---------------------- SOCKET.IO ----------------------
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", async ({ room, username }) => {
    socket.join(room);
    const messages = await getMessages(room);
    socket.emit("history", messages);
  });

  socket.on("chat-message", async ({ room, text, username }) => {
    const msg = {
      id: uuidv4(),
      room,
      username,
      text,
      time: new Date()
    };

    await saveMessage(msg);
    io.to(room).emit("chat-message", msg);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// ---------------------- START ----------------------
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
