const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,       // .env dan o'qiydi
  user: process.env.DB_USER,       // .env dan o'qiydi
  password: process.env.DB_PASSWORD, // .env dan o'qiydi
  database: process.env.DB_NAME,   // .env dan o'qiydi
  port: process.env.DB_PORT || 25051, 
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Aiven uchun SSL shart
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
