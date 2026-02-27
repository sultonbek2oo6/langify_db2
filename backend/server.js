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

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

/* ================= (NEW) UPLOADS / MULTER ================= */

const multer = require("multer");
const fs = require("fs");

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(null, `receipt_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only JPG/PNG/WEBP allowed"), false);
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
});

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

    req.user = decoded; // { id, email, role }
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

/* ================= (NEW) SUBSCRIPTION HELPERS ================= */
/**
 * subscriptions.plan: enum('basic','premium','pro')
 * users.plan: enum('free','premium','pro')
 * mapping: basic <-> free
 */

async function ensureSubscriptionRow(userId) {
  const [rows] = await pool.query(
    "SELECT id, user_id, plan, expires_at, status FROM subscriptions WHERE user_id=? LIMIT 1",
    [userId]
  );

  if (rows.length) return rows[0];

  await pool.query(
    "INSERT INTO subscriptions (user_id, plan, expires_at, status, created_at, updated_at) VALUES (?, 'basic', NULL, 'active', NOW(), NOW())",
    [userId]
  );
  await pool.query("UPDATE users SET plan='free' WHERE id=?", [userId]);

  const [again] = await pool.query(
    "SELECT id, user_id, plan, expires_at, status FROM subscriptions WHERE user_id=? LIMIT 1",
    [userId]
  );
  return again[0];
}

async function refreshSubscriptionIfExpired(userId) {
  const sub = await ensureSubscriptionRow(userId);

  if (sub.expires_at && new Date(sub.expires_at) <= new Date()) {
    await pool.query(
      "UPDATE subscriptions SET plan='basic', expires_at=NULL, status='expired', updated_at=NOW() WHERE user_id=?",
      [userId]
    );
    await pool.query("UPDATE users SET plan='free' WHERE id=?", [userId]);
    return { plan: "basic", expires_at: null, status: "expired" };
  }

  return sub;
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

    const [result] = await pool.query(
      `INSERT INTO users 
      (username, email, password, full_name, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'user', 1, NOW(), NOW())`,
      [username, email, hashed, full_name || null]
    );

    // (NEW) Yangi user uchun subscription row yaratib qo'yamiz
    await pool.query(
      "INSERT INTO subscriptions (user_id, plan, expires_at, status, created_at, updated_at) VALUES (?, 'basic', NULL, 'active', NOW(), NOW())",
      [result.insertId]
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

    // (NEW) login paytida expire bo'lsa basic/free ga tushirib qo'yamiz
    await refreshSubscriptionIfExpired(user.id);

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

/* ================= (NEW) USER PAYMENT REQUEST (payment_requests) ================= */
/**
 * POST /api/payments/request
 * form-data:
 * - plan_requested: premium|pro
 * - amount: number
 * - transaction_ref (optional)
 * - paid_at (optional)
 * - receipt: file (jpg/png/webp)
 */
app.post(
  "/api/payments/request",
  authenticateToken,
  upload.single("receipt"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { plan_requested, amount, transaction_ref, paid_at } = req.body;

      if (!req.file) {
        return res.status(400).json({ message: "Chek rasmni yuklang." });
      }

      if (!["premium", "pro"].includes(plan_requested)) {
        return res.status(400).json({ message: "plan_requested noto‘g‘ri." });
      }

      const duration_days = 90;
      const receipt_url = `/uploads/${req.file.filename}`;

      await pool.query(
        `INSERT INTO payment_requests
          (user_id, plan_requested, duration_days, amount, currency, transaction_ref, paid_at, receipt_url, status, created_at)
         VALUES (?, ?, ?, ?, 'UZS', ?, ?, ?, 'pending', NOW())`,
        [
          userId,
          plan_requested,
          duration_days,
          Number(amount || 0),
          transaction_ref || null,
          paid_at ? new Date(paid_at) : null,
          receipt_url,
        ]
      );

      res.json({ message: "So‘rov yuborildi. Admin tekshiradi.", receipt_url });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Payment request error." });
    }
  }
);

/* ================= ADMIN ROUTES ================= */

app.get("/admin/users",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const search = (req.query.search || "").trim(); // id/username/email
      const role = (req.query.role || "").trim();     // user/admin
      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 100);
      const offset = (page - 1) * limit;

      const where = [];
      const params = [];

      if (search) {
        where.push(`(CAST(id AS CHAR) LIKE ? OR username LIKE ? OR email LIKE ?)`);
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (role) {
        if (!["user", "admin"].includes(role)) {
          return res.status(400).json({ message: "Role noto‘g‘ri." });
        }
        where.push(`role = ?`);
        params.push(role);
      }
      // ✅ PLAN FILTER
      const plan = (req.query.plan || "").trim();
      if (plan) {
        if (!["free", "premium", "pro"].includes(plan)) {
          return res.status(400).json({ message: "Plan noto‘g‘ri." });
        }
        where.push(`plan = ?`);
        params.push(plan);
      }
      const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

      // total count
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total FROM users ${whereSQL}`,
        params
      );
      const total = countRows[0].total;
      const totalPages = Math.max(Math.ceil(total / limit), 1);

      // paged data
      const [users] = await pool.query(
        `
        SELECT id, username, email, role, plan, is_active, created_at
        FROM users
        ${whereSQL}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
        `,
        [...params, limit, offset]
      );

      res.json({
        page,
        limit,
        total,
        totalPages,
        users
      });

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

// BLOCK / UNBLOCK USER
app.put("/admin/users/:id/block",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { is_active } = req.body;

      if (![0, 1].includes(is_active)) {
        return res.status(400).json({ message: "is_active 0 yoki 1 bo‘lishi kerak." });
      }

      await pool.query(
        "UPDATE users SET is_active = ? WHERE id = ?",
        [is_active, req.params.id]
      );

      res.json({
        message: is_active ? "User unblock qilindi." : "User block qilindi."
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi." });
    }
  }
);

app.put("/admin/users/:id/plan",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const { plan } = req.body;

      if (!["free", "premium", "pro"].includes(plan)) {
        return res.status(400).json({ message: "Plan noto‘g‘ri." });
      }

      // users.plan update
      await pool.query(
        "UPDATE users SET plan = ? WHERE id = ?",
        [plan, req.params.id]
      );

      // (NEW) subscriptions ham sync (free -> basic mapping)
      const subPlan = plan === "free" ? "basic" : plan;
      await pool.query(
        "UPDATE subscriptions SET plan=?, updated_at=NOW() WHERE user_id=?",
        [subPlan, req.params.id]
      );

      res.json({ message: "Plan yangilandi." });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Server xatosi." });
    }
  }
);

/* ================= (NEW) ADMIN PAYMENT REQUESTS ================= */

// list payment requests by status (pending/approved/rejected)
app.get(
  "/admin/payment-requests",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const status = (req.query.status || "pending").trim();
      if (!["pending", "approved", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Status noto‘g‘ri." });
      }

      const [rows] = await pool.query(
        `SELECT pr.*, u.username, u.email
         FROM payment_requests pr
         JOIN users u ON u.id = pr.user_id
         WHERE pr.status=?
         ORDER BY pr.created_at DESC`,
        [status]
      );

      res.json(rows);

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Admin payment-requests list error." });
    }
  }
);

// approve request -> subscriptions + 90 days (duration_days)
app.post(
  "/admin/payment-requests/:id/approve",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    const conn = await pool.getConnection();
    try {
      const reqId = Number(req.params.id);
      const adminId = req.user.id;

      await conn.beginTransaction();

      const [rows] = await conn.query(
        "SELECT * FROM payment_requests WHERE id=? FOR UPDATE",
        [reqId]
      );

      if (rows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ message: "So‘rov topilmadi." });
      }

      const pr = rows[0];
      if (pr.status !== "pending") {
        await conn.rollback();
        return res.status(400).json({ message: "Bu so‘rov allaqachon ko‘rilgan." });
      }

      const days = pr.duration_days || 90;

      const [subs] = await conn.query(
        "SELECT * FROM subscriptions WHERE user_id=? FOR UPDATE",
        [pr.user_id]
      );

      let baseDate = new Date();
      if (
        subs.length &&
        subs[0].expires_at &&
        new Date(subs[0].expires_at) > new Date()
      ) {
        baseDate = new Date(subs[0].expires_at);
      }

      const newExpires = new Date(baseDate.getTime() + days * 24 * 60 * 60 * 1000);

      if (subs.length === 0) {
        await conn.query(
          "INSERT INTO subscriptions (user_id, plan, expires_at, status, created_at, updated_at) VALUES (?, ?, ?, 'active', NOW(), NOW())",
          [pr.user_id, pr.plan_requested, newExpires]
        );
      } else {
        await conn.query(
          "UPDATE subscriptions SET plan=?, expires_at=?, status='active', updated_at=NOW() WHERE user_id=?",
          [pr.plan_requested, newExpires, pr.user_id]
        );
      }

      // users.plan sync (premium/pro)
      await conn.query("UPDATE users SET plan=? WHERE id=?", [
        pr.plan_requested,
        pr.user_id,
      ]);

      await conn.query(
        "UPDATE payment_requests SET status='approved', reviewed_by=?, reviewed_at=NOW() WHERE id=?",
        [adminId, reqId]
      );

      await conn.commit();

      res.json({
        message: "Approve qilindi.",
        plan: pr.plan_requested,
        expires_at: newExpires,
      });

    } catch (err) {
      await conn.rollback();
      console.error(err);
      res.status(500).json({ message: "Approve error." });
    } finally {
      conn.release();
    }
  }
);

// reject request
app.post(
  "/admin/payment-requests/:id/reject",
  authenticateToken,
  isAdmin,
  async (req, res) => {
    try {
      const reqId = Number(req.params.id);
      const admin_note = (req.body.admin_note || "").slice(0, 255);

      const [result] = await pool.query(
        "UPDATE payment_requests SET status='rejected', admin_note=?, reviewed_by=?, reviewed_at=NOW() WHERE id=? AND status='pending'",
        [admin_note || null, req.user.id, reqId]
      );

      if (result.affectedRows === 0) {
        return res.status(400).json({ message: "So‘rov topilmadi yoki pending emas." });
      }

      res.json({ message: "Reject qilindi." });

    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Reject error." });
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