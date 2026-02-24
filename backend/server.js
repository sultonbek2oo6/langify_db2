const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const path = require("path");

require("dotenv").config();

const app = express();

/* ================= CONFIG ================= */

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

/* ================= MIDDLEWARE ================= */

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

/* ================= AUTH MIDDLEWARE ================= */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader)
    return res.status(401).json({ message: "Token kerak." });

  const token = authHeader.split(" ")[1];

  if (!token)
    return res.status(401).json({ message: "Token topilmadi." });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res.status(403).json({ message: "Token noto‘g‘ri yoki muddati tugagan." });

    req.user = decoded;
    next();
  });
}

/* ================= ADMIN MIDDLEWARE ================= */

function isAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Faqat admin kirishi mumkin!" });
  }
  next();
}

/* ================= REGISTER ================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email mavjud." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users 
      (username, email, password, full_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 1, NOW(), NOW())`,
      [username, email, hashed, full_name || null]
    );

    res.status(201).json({ message: "Register muvaffaqiyatli." });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= LOGIN ================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Email topilmadi." });

    const user = rows[0];

    const match = await bcrypt.compare(password, user.password);

    if (!match)
      return res.status(400).json({ message: "Parol noto‘g‘ri." });

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login muvaffaqiyatli.",
      token,
      role: user.role
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= ADMIN ROUTES ================= */

app.get("/admin/users",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const [users] = await pool.query(`
        SELECT id, username, email, role, created_at
        FROM users
        ORDER BY created_at DESC
      `);

      res.json(users);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi." });
    }
  }
);

app.delete("/admin/users/:id",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
      res.json({ message: "User o‘chirildi." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi." });
    }
  }
);

app.put("/admin/users/:id/role",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { role } = req.body;

      if (!["user", "admin"].includes(role)) {
        return res.status(400).json({ message: "Role noto‘g‘ri." });
      }

      await pool.query(
        "UPDATE users SET role = ? WHERE id = ?",
        [role, req.params.id]
      );

      res.json({ message: "Role yangilandi." });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi." });
    }
  }
);

/* ================= GOOGLE EMAIL VERIFY ================= */

const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

app.post("/api/auth/google-verify", async (req, res) => {

  try {

    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({

      idToken,

      audience: process.env.GOOGLE_CLIENT_ID,

    });

    const payload = ticket.getPayload();

    res.json({

      email: payload.email,

      email_verified: payload.email_verified

    });

  } catch (err) {

    res.status(400).json({

      message: "Google verify failed"

    });

  }

});

/* ================= START SERVER ================= */

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server ${port} portda ishlayapti`);
});