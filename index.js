const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST"]
}));

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["websocket"]
});

/* ================================
   IN-MEMORY STORAGE (TEMP)
================================ */
const messagesByRoom = {};
const onlineUsersByRoom = {};

/* ================================
   SOCKET LOGIC
================================ */
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join-room", ({ room, username }) => {
    if (!room || !username) return;

    socket.join(room);
    socket.room = room;
    socket.username = username;

    // init room storage
    if (!messagesByRoom[room]) messagesByRoom[room] = [];
    if (!onlineUsersByRoom[room]) onlineUsersByRoom[room] = new Set();

    onlineUsersByRoom[room].add(username);

    // send message history
    socket.emit("history", messagesByRoom[room]);

    // send online users
    io.to(room).emit("online-users", Array.from(onlineUsersByRoom[room]));
  });

  socket.on("chat-message", ({ room, text, username }) => {
    if (!room || !text || !username) return;

    const message = {
      id: Date.now(),
      room,
      username,
      text,
      time: new Date()
    };

    messagesByRoom[room].push(message);

    io.to(room).emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    const { room, username } = socket;

    if (room && username && onlineUsersByRoom[room]) {
      onlineUsersByRoom[room].delete(username);
      io.to(room).emit(
        "online-users",
        Array.from(onlineUsersByRoom[room])
      );
    }

    console.log("Socket disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
