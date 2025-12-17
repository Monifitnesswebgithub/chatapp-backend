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

app.use(cors());
app.use(express.json());
app.get("/", (req, res) => {
  res.json({
    status: "Backend running 🚀",
    service: "Realtime Chat API"
  });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ---------------- DB HELPERS ----------------
async function findUserByUsername(username) {
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [username]
  );
  return rows[0] || null;
}

async function saveMessage({ id, room, username, text }) {
  await pool.query(
    "INSERT INTO messages (id, room, username, text, time) VALUES (?, ?, ?, ?, NOW())",
    [id, room, username, text]
  );
}

async function getMessagesForRoom(room) {
  const [rows] = await pool.query(
    "SELECT * FROM messages WHERE room = ? ORDER BY time ASC LIMIT 500",
    [room]
  );
  return rows;
}

// ---------------- SOCKET.IO ----------------
const onlineByRoom = {};

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  // PUBLIC ROOM
  socket.on("join-room", async ({ room = "global", username }) => {
    if (!username) return;

    socket.join(room);
    socket.data.username = username;

    onlineByRoom[room] = onlineByRoom[room] || new Set();
    onlineByRoom[room].add(username);

    io.to(room).emit("online-users", [...onlineByRoom[room]]);
    socket.emit("history", await getMessagesForRoom(room));
  });

  // 🔥 DISCORD-STYLE GROUP ROOM
  socket.on("join-group-room", async ({ roomName, username }) => {
    if (!roomName || !username) return;

    const room = `room:${roomName}`;
    socket.join(room);
    socket.data.username = username;

    socket.emit("history", await getMessagesForRoom(room));
    io.to(room).emit("system", {
      text: `${username} joined #${roomName}`,
    });
  });

  // SEND MESSAGE (works for all room types)
  socket.on("chat-message", async ({ room, text, username }) => {
    if (!room || !text || !username) return;

    const msg = {
      id: uuidv4(),
      room,
      username,
      text,
      time: new Date(),
    };

    await saveMessage(msg);
    io.to(room).emit("chat-message", msg);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
