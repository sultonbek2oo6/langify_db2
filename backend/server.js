const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const pool = require("./db");
const path = require("path");

const app = express();

/* ================= MIDDLEWARE ================= */

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

/* ================= VALIDATION ================= */

function validateRegister(body) {
  const errors = [];

  if (!body.username || body.username.trim().length < 3)
    errors.push("Username kamida 3 ta belgi.");

  if (!body.email || body.email.trim().length < 5)
    errors.push("Email noto‘g‘ri.");

  if (!body.password || body.password.length < 4)
    errors.push("Parol kamida 4 ta belgi.");

  return errors;
}

/* ================= CHECK USER EXISTS ================= */

app.get("/api/auth/status", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id FROM users LIMIT 1");

    if (rows.length === 0) {
      return res.json({ registered: false });
    }

    res.json({ registered: true });

  } catch (err) {
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= REGISTER (MULTI USER) ================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const errors = validateRegister(req.body);
    if (errors.length) return res.status(400).json({ errors });

    const { username, email, password, full_name } = req.body;

    // Email mavjudligini tekshiramiz
    const [existingEmail] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email.trim()]
    );

    if (existingEmail.length > 0) {
      return res.status(400).json({
        message: "Bu email allaqachon ro‘yxatdan o‘tgan."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users 
      (username, email, password, full_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 1, NOW(), NOW())`,
      [
        username.trim(),
        email.trim(),
        hashedPassword,
        full_name ? full_name.trim() : null
      ]
    );

    res.status(201).json({
      message: "Register muvaffaqiyatli."
    });

  } catch (err) {
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= LOGIN ================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email va parol kerak."
      });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email.trim()]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: "Email topilmadi." });
    }

    const user = rows[0];

    if (user.is_active !== 1) {
      return res.status(403).json({ message: "Account aktiv emas." });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({ message: "Parol noto‘g‘ri." });
    }

    res.json({
      message: "Login muvaffaqiyatli.",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= SERVER ================= */

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server ${port} portda ishlayapti`);
});
