const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: (process.env.DB_HOST || "").trim(),       // ✅ Ortiqcha probellarni tozalaydi
  user: (process.env.DB_USER || "").trim(),       // ✅ Ortiqcha probellarni tozalaydi
  password: (process.env.DB_PASSWORD || "").trim(), // ✅ Ortiqcha probellarni tozalaydi
  database: (process.env.DB_NAME || "").trim(),   // ✅ Ortiqcha probellarni tozalaydi
  port: parseInt((String(process.env.DB_PORT || "25051")).trim(), 10), // ✅ Raqamga o'giradi va tozalaydi
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Aiven uchun SSL shart
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
