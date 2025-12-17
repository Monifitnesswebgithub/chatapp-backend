// db.js
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "Mkv@280803", // <-- YOUR REAL MYSQL PASSWORD HERE
  database: "chatapp",
});

module.exports = pool;
