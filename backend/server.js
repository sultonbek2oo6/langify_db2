const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

console.log("ENV SMTP_HOST =", process.env.SMTP_HOST);
console.log("ENV SMTP_USER =", process.env.SMTP_USER);
console.log("ENV SMTP_PORT =", process.env.SMTP_PORT);
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const multer = require("multer");
const fs = require("fs");
const nodemailer = require("nodemailer");
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

const UPLOAD_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    cb(
      null,
      `receipt_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`
    );
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

/* ================= SPEAKING AUDIO UPLOAD ================= */

const AUDIO_UPLOAD_DIR = path.join(UPLOAD_DIR, "audio");
if (!fs.existsSync(AUDIO_UPLOAD_DIR)) fs.mkdirSync(AUDIO_UPLOAD_DIR, { recursive: true });

const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "") || ".webm";
    cb(
      null,
      `speaking_${Date.now()}_${Math.random().toString(16).slice(2)}${ext}`
    );
  },
});

function audioFileFilter(req, file, cb) {
  const allowed = [
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/x-m4a",
    "video/webm" // ba'zi brauzerlar shuni yuboradi
  ];

  if (!allowed.includes(file.mimetype)) {
    return cb(new Error("Only audio files allowed"), false);
  }

  cb(null, true);
}

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

/* ================= EMAIL OTP (NEW) ================= */

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// (ixtiyoriy) SMTP ishlayaptimi tekshirish
transporter.verify().catch((e) => {
  console.log("SMTP verify failed:", e?.message || e);
});

function genCode6() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 xonali
}

async function sendVerifyCodeEmail(toEmail, username, code) {
  await transporter.sendMail({
    from: `"Langify" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "Langify tasdiqlash kodi",
    html: `
      <h3>Assalomu alaykum, ${username || "user"}!</h3>
      <p>Ro‘yxatdan o‘tishni yakunlash uchun tasdiqlash kodini kiriting:</p>
      <h2 style="letter-spacing:2px;">${code}</h2>
      <p>Kod 10 daqiqa amal qiladi.</p>
    `,
  });
}

/* ================= AUTH MIDDLEWARE ================= */

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) return res.status(401).json({ message: "Token kerak." });

  const token = authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Token topilmadi." });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err)
      return res
        .status(403)
        .json({ message: "Token noto‘g‘ri yoki muddati tugagan." });

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

/* ================= SUBSCRIPTION HELPERS ================= */
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

/* ================= REGISTER (OTP) ================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    let { username, email, password, full_name } = req.body;

    username = String(username || "").trim();
    email = String(email || "").trim().toLowerCase();
    password = String(password || "").trim();

    if (!username || !email || !password) {
      return res.status(400).json({ message: "Maydonlar to‘liq emas." });
    }

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email mavjud." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const code = genCode6();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 daqiqa

    const [result] = await pool.query(
      `INSERT INTO users
        (username, email, password, full_name, role, is_active, is_verified, verify_code, verify_code_expires, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'user', 1, 0, ?, ?, NOW(), NOW())`,
      [username, email, hashed, full_name || null, code, expires]
    );

    // subscription row
    await pool.query(
      "INSERT INTO subscriptions (user_id, plan, expires_at, status, created_at, updated_at) VALUES (?, 'basic', NULL, 'active', NOW(), NOW())",
      [result.insertId]
    );

    // emailga kod yuborish
    await sendVerifyCodeEmail(email, username, code);

    res.status(201).json({
      message: "Tasdiqlash kodi emailingizga yuborildi.",
      step: "verify_required",
    });
  } catch (err) {
  console.error("REGISTER ERROR:", err);
  return res.status(500).json({
    message: err?.sqlMessage || err?.message || "Server xatosi.",
    code: err?.code || null
  });
}
});

/* ================= VERIFY EMAIL CODE (OTP) ================= */

app.post("/api/auth/verify-code", async (req, res) => {
  try {
    let { email, code } = req.body;

    email = String(email || "").trim().toLowerCase();
    code = String(code || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "Email va kod kerak." });
    }

    // ✅ role/is_active/plan ham olamiz (token va yo‘naltirish uchun)
    const [rows] = await pool.query(
      `SELECT id, email, role, plan, is_active, is_verified, verify_code, verify_code_expires
       FROM users
       WHERE email=? LIMIT 1`,
      [email]
    );

    if (!rows.length) return res.status(404).json({ message: "User topilmadi." });

    const u = rows[0];

    if (Number(u.is_active) !== 1) {
      return res.status(403).json({ message: "Account block qilingan." });
    }

    if (Number(u.is_verified) === 1) {
      // (ixtiyoriy) bu holatda token bermaymiz, chunki password tekshirilmagan
      return res.json({ message: "Allaqachon tasdiqlangan. Endi login qiling." });
    }

    if (!u.verify_code || String(u.verify_code) !== String(code)) {
      return res.status(400).json({ message: "Kod noto‘g‘ri." });
    }

    if (u.verify_code_expires && new Date(u.verify_code_expires).getTime() < Date.now()) {
      return res.status(400).json({
        message: "Kod vaqti tugagan. Resend qilib qayta kod oling.",
      });
    }

    await pool.query(
      `UPDATE users
       SET is_verified=1, verify_code=NULL, verify_code_expires=NULL, updated_at=NOW()
       WHERE id=?`,
      [u.id]
    );

    // ✅ subscription expire bo'lsa basic/free ga tushirish
    await refreshSubscriptionIfExpired(u.id);

    // ✅ AUT0-LOGIN: token qaytaramiz
    const token = jwt.sign(
      { id: u.id, email: u.email, role: u.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.json({
      message: "✅ Email tasdiqlandi. Xush kelibsiz!",
      token,
      role: u.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= RESEND CODE ================= */

app.post("/api/auth/resend-code", async (req, res) => {
  try {
    let { email } = req.body;
    email = String(email || "").trim().toLowerCase();

    if (!email) return res.status(400).json({ message: "Email kerak." });

    const [rows] = await pool.query(
      `SELECT id, username, is_verified FROM users WHERE email=? LIMIT 1`,
      [email]
    );
    if (!rows.length) return res.status(404).json({ message: "User topilmadi." });

    const u = rows[0];
    if (Number(u.is_verified) === 1) {
      return res.json({ message: "Allaqachon tasdiqlangan." });
    }

    const code = genCode6();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      `UPDATE users SET verify_code=?, verify_code_expires=?, updated_at=NOW() WHERE id=?`,
      [code, expires, u.id]
    );

    await sendVerifyCodeEmail(email, u.username, code);

    res.json({ message: "Kod qayta yuborildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= FORGOT PASSWORD (SEND RESET CODE) ================= */

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    let { email } = req.body;
    email = String(email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "Email kerak." });

    const [rows] = await pool.query(
      "SELECT id, username, is_active FROM users WHERE email=? LIMIT 1",
      [email]
    );

    // email mavjud/yo‘qligini oshkor qilmaslik uchun
    if (!rows.length) {
      return res.json({ message: "Agar email mavjud bo‘lsa, kod yuborildi." });
    }

    const u = rows[0];
    if (Number(u.is_active) !== 1) {
      return res.status(403).json({ message: "Account block qilingan." });
    }

    const code = genCode6();
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      "UPDATE users SET reset_code=?, reset_code_expires=?, updated_at=NOW() WHERE id=?",
      [code, expires, u.id]
    );

    await transporter.sendMail({
      from: `"Langify" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Langify parolni tiklash kodi",
      html: `
        <h3>Assalomu alaykum, ${u.username || "user"}!</h3>
        <p>Parolni tiklash uchun kod:</p>
        <h2 style="letter-spacing:2px;">${code}</h2>
        <p>Kod 10 daqiqa amal qiladi.</p>
      `,
    });

    res.json({ message: "Kod emailingizga yuborildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= RESET PASSWORD (CODE + NEW PASSWORD) ================= */

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    let { email, code, newPassword } = req.body;

    email = String(email || "").trim().toLowerCase();
    code = String(code || "").trim();
    newPassword = String(newPassword || "").trim();

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, kod va yangi parol kerak." });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Parol kamida 6 ta belgi bo‘lsin." });
    }

    const [rows] = await pool.query(
      "SELECT id, reset_code, reset_code_expires FROM users WHERE email=? LIMIT 1",
      [email]
    );

    if (!rows.length) return res.status(404).json({ message: "User topilmadi." });

    const u = rows[0];

    if (!u.reset_code || String(u.reset_code) !== String(code)) {
      return res.status(400).json({ message: "Kod noto‘g‘ri." });
    }

    if (u.reset_code_expires && new Date(u.reset_code_expires).getTime() < Date.now()) {
      return res.status(400).json({ message: "Kod vaqti tugagan." });
    }

    const hashed = await bcrypt.hash(newPassword, 10);

    await pool.query(
      "UPDATE users SET password=?, reset_code=NULL, reset_code_expires=NULL, updated_at=NOW() WHERE id=?",
      [hashed, u.id]
    );

    res.json({ message: "✅ Parol yangilandi. Endi login qiling." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});
/* ================= LOGIN (FIXED ORDER) ================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    let { email, password } = req.body;

    email = String(email || "").trim().toLowerCase();
    password = String(password || "").trim();

    if (!email || !password) {
      return res.status(400).json({ message: "Email va parolni kiriting." });
    }

    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? LIMIT 1",
      [email]
    );

    if (rows.length === 0)
      return res.status(400).json({ message: "Email topilmadi." });

    const user = rows[0];

    // 1) avval parol tekshirish
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Parol noto‘g‘ri." });

    // 2) keyin verify/active tekshiruvlar
    if (Number(user.is_verified) !== 1) {
      return res.status(403).json({
        message: "Email tasdiqlanmagan. Emailga kelgan kodni kiriting.",
      });
    }

    if (Number(user.is_active) !== 1) {
      return res.status(403).json({ message: "Account block qilingan." });
    }

    // expire bo'lsa basic/free ga tushirib qo'yamiz
    await refreshSubscriptionIfExpired(user.id);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login muvaffaqiyatli.",
      token,
      role: user.role,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

/* ================= CURRENT USER PROFILE (me) ================= */
/**
 * GET /api/me
 * Authorization: Bearer <token>
 * returns: { id, email, role, plan, expires_at }
 */
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    await refreshSubscriptionIfExpired(req.user.id);

    const [rows] = await pool.query(
      `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.plan,
        s.expires_at
      FROM users u
      LEFT JOIN subscriptions s ON s.user_id = u.id
      WHERE u.id = ?
      LIMIT 1
      `,
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User topilmadi." });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

//* ================= CONTENT API (SKELETON READY) ================= */

// public: modul bo‘yicha content ro‘yxati
app.get("/api/content/modules/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [mods] = await pool.query("SELECT * FROM modules WHERE slug=? LIMIT 1", [slug]);
    if (!mods.length) {
      return res.json({ module: null, contents: [] });
    }

    const module = mods[0];

    const [contents] = await pool.query(
      `
      SELECT id, title, level, is_published, created_at
      FROM contents
      WHERE module_id=? AND is_published=1
      ORDER BY id DESC
      `,
      [module.id]
    );

    res.json({ module, contents });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Content fetch error." });
  }
});

// public: content detail (files + questions)
app.get("/api/content/contents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [rows] = await pool.query("SELECT * FROM contents WHERE id=? LIMIT 1", [id]);
    if (!rows.length) return res.json({ content: null, files: [], questions: [] });

    const content = rows[0];

    if (!content.is_published) {
      return res.status(404).json({ message: "Content topilmadi." });
    }

    const [files] = await pool.query("SELECT * FROM content_files WHERE content_id=?", [id]);
    const [questions] = await pool.query("SELECT * FROM questions WHERE content_id=?", [id]);

    res.json({ content, files, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Content detail error." });
  }
});

/* ================= ADMIN CONTENT (READY FOR UPLOAD LATER) ================= */

// admin: modules seed/create
app.post("/api/admin/modules", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { slug, title, description } = req.body;

    if (!slug || !title) {
      return res.status(400).json({ message: "slug va title kerak." });
    }

    await pool.query(
      "INSERT INTO modules (slug, title, description, created_at) VALUES (?, ?, ?, NOW())",
      [String(slug).trim(), String(title).trim(), description || null]
    );

    res.json({ message: "Module yaratildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Module create error." });
  }
});

// admin: content create (draft)
app.post("/api/admin/contents", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { module_slug, title, body, level } = req.body;

    if (!module_slug || !title) {
      return res.status(400).json({ message: "module_slug va title kerak." });
    }

    const [mods] = await pool.query("SELECT id FROM modules WHERE slug=? LIMIT 1", [module_slug]);
    if (!mods.length) return res.status(400).json({ message: "Module topilmadi." });

    const module_id = mods[0].id;

    const [result] = await pool.query(
      "INSERT INTO contents (module_id, title, body, level, is_published, created_at) VALUES (?, ?, ?, ?, 0, NOW())",
      [module_id, title, body || "", level || "easy"]
    );

    res.json({ message: "Content yaratildi (draft).", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Admin content create error." });
  }
});

// admin: publish/unpublish
app.put("/api/admin/contents/:id/publish", authenticateToken, isAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { is_published } = req.body;

    if (![0, 1].includes(is_published)) {
      return res.status(400).json({ message: "is_published 0 yoki 1 bo‘lishi kerak." });
    }

    await pool.query("UPDATE contents SET is_published=? WHERE id=?", [is_published, id]);

    res.json({ message: is_published ? "Published ✅" : "Unpublished ✅" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Publish update error." });
  }
});

/* ================= USER PAYMENT REQUEST (payment_requests) ================= */

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

/* ================= MATERIALS LIST API (PUBLIC) ================= */
/**
 * GET /api/materials?type=reading|listening&module=reading&level=easy
 * Public: token shart emas (xohlasang keyin token qo'yamiz)
 */
app.get("/api/materials", async (req, res) => {
  try {
    const { type, module, level } = req.query;

    let sql = `
      SELECT id, type, module, order_no, level, is_published, title, content, created_at
      FROM materials
      WHERE is_published = 1
    `;
    const params = [];

    if (type)   { sql += " AND type = ?"; params.push(type); }
    if (module) { sql += " AND module = ?"; params.push(module); }
    if (level)  { sql += " AND level = ?"; params.push(level); }

    sql += " ORDER BY order_no ASC, id ASC";

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error("GET /api/materials error:", err);
    res.status(500).json({ message: "Server error" });
  }
});
/* ================= IELTS PROGRESSION (UNLOCK LOGIC) ================= */

const PASS_SCORE = 75;

async function ensureFirstUnlocked(userId, module) {
  const [firstRows] = await pool.query(
    `SELECT id FROM materials
     WHERE module=? AND is_published=1
     ORDER BY order_no ASC, id ASC
     LIMIT 1`,
    [module]
  );
  if (!firstRows.length) return;

  const firstId = firstRows[0].id;

  const [p] = await pool.query(
    `SELECT id, is_unlocked FROM user_progress WHERE user_id=? AND material_id=? LIMIT 1`,
    [userId, firstId]
  );

  if (!p.length) {
    await pool.query(
      `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count, last_attempt_at, completed_at)
       VALUES (?, ?, 0, 0, 1, 0, NULL, NULL)`,
      [userId, firstId]
    );
  } else if (p[0].is_unlocked !== 1) {
    await pool.query(`UPDATE user_progress SET is_unlocked=1 WHERE id=?`, [p[0].id]);
  }
}

async function getUnlockStatus(userId, materialId) {
  const [rows] = await pool.query(
    `SELECT is_unlocked, best_score, score FROM user_progress
     WHERE user_id=? AND material_id=? LIMIT 1`,
    [userId, materialId]
  );
  if (!rows.length) return { is_unlocked: 0, best_score: 0, score: 0 };
  return {
    is_unlocked: Number(rows[0].is_unlocked) || 0,
    best_score: Number(rows[0].best_score) || 0,
    score: Number(rows[0].score) || 0,
  };
}

app.get("/api/modules/:module/list", authenticateToken, async (req, res) => {
  try {
    const module = String(req.params.module || "").trim().toLowerCase();
    if (!module) return res.status(400).json({ message: "module kerak." });

    await ensureFirstUnlocked(req.user.id, module);

    const [items] = await pool.query(
      `SELECT id, title, module, order_no, level, is_published
       FROM materials
       WHERE module=? AND is_published=1
       ORDER BY order_no ASC, id ASC`,
      [module]
    );

    const ids = items.map((x) => x.id);
    const progressMap = new Map();

    if (ids.length) {
      const [progress] = await pool.query(
        `SELECT material_id, is_unlocked, best_score
         FROM user_progress
         WHERE user_id=? AND material_id IN (${ids.map(() => "?").join(",")})`,
        [req.user.id, ...ids]
      );
      progress.forEach((p) => {
        progressMap.set(Number(p.material_id), {
          is_unlocked: Number(p.is_unlocked) || 0,
          best_score: Number(p.best_score) || 0,
        });
      });
    }

    const out = items.map((it) => {
      const p = progressMap.get(Number(it.id)) || { is_unlocked: 0, best_score: 0 };
      return { ...it, is_unlocked: p.is_unlocked, best_score: p.best_score };
    });

    res.json({ module, items: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Module list error." });
  }
});

app.get("/api/materials/:id", authenticateToken, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) return res.status(400).json({ message: "material id noto‘g‘ri." });

    const [mRows] = await pool.query(
      `SELECT id, type, module, order_no, level, is_published, title, content, created_at
       FROM materials
       WHERE id=? LIMIT 1`,
      [materialId]
    );
    if (!mRows.length) return res.status(404).json({ message: "Material topilmadi." });

    const material = mRows[0];
    if (!material.is_published) return res.status(404).json({ message: "Material topilmadi." });

    await ensureFirstUnlocked(req.user.id, material.module);

    const st = await getUnlockStatus(req.user.id, materialId);
    if (!st.is_unlocked) {
      return res.status(403).json({
        message: `🔒 Locked. Keyingi bosqichga o‘tish uchun natijani ${PASS_SCORE}% qiling.`,
        required: PASS_SCORE,
      });
    }

    const [qs] = await pool.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d
       FROM material_questions
       WHERE material_id=?
       ORDER BY id ASC`,
      [materialId]
    );

    res.json({ material, questions: qs, progress: st });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Material detail error." });
  }
});

/* ================= VOCABULARY QUIZ ================= */
app.get("/api/vocabulary/:id/questions", authenticateToken, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) {
      return res.status(400).json({ message: "material id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `SELECT id, question_text, option_a, option_b, option_c, option_d
       FROM vocabulary_questions
       WHERE material_id = ?
       ORDER BY id ASC`,
      [materialId]
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Vocabulary quiz error." });
  }
});

app.post("/api/vocabulary/:id/submit", authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const userId = req.user.id;
    const materialId = Number(req.params.id);
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const PASS_SCORE = 75;

    if (!materialId) {
      return res.status(400).json({ message: "material id noto‘g‘ri." });
    }

    await conn.beginTransaction();

    // 1) Materialni olish
    const [mRows] = await conn.query(
      `SELECT id, module, order_no, is_published
       FROM materials
       WHERE id = ? LIMIT 1`,
      [materialId]
    );

    if (!mRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Material topilmadi." });
    }

    const material = mRows[0];

    if (!material.is_published) {
      await conn.rollback();
      return res.status(404).json({ message: "Material topilmadi." });
    }

    // 2) Birinchi lessonni avtomatik unlock qilib qo'yish
    const [firstRows] = await conn.query(
      `SELECT id
       FROM materials
       WHERE module = ? AND is_published = 1
       ORDER BY order_no ASC, id ASC
       LIMIT 1`,
      [material.module]
    );

    if (firstRows.length) {
      const firstId = firstRows[0].id;

      await conn.query(
        `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count)
         VALUES (?, ?, 0, 0, 1, 0)
         ON DUPLICATE KEY UPDATE is_unlocked = 1`,
        [userId, firstId]
      );
    }

    // 3) Hozirgi material unlock bo‘lganmi?
    const [pRows] = await conn.query(
      `SELECT is_unlocked, best_score, attempts_count
       FROM user_progress
       WHERE user_id = ? AND material_id = ?
       LIMIT 1`,
      [userId, materialId]
    );

    const isUnlocked = pRows.length ? Number(pRows[0].is_unlocked) : 0;

    if (!isUnlocked) {
      await conn.rollback();
      return res.status(403).json({
        message: `🔒 Locked. Avval oldingi lessondan ${PASS_SCORE}% oling.`,
        required: PASS_SCORE
      });
    }

    // 4) Quiz savollarini olish
    const [questions] = await conn.query(
      `SELECT id, correct_option
       FROM vocabulary_questions
       WHERE material_id = ?`,
      [materialId]
    );

    if (!questions.length) {
      await conn.rollback();
      return res.status(400).json({ message: "Bu lesson uchun quiz yo‘q." });
    }

    // 5) Javoblarni tekshirish
    const answerMap = new Map();
    answers.forEach((a) => {
      const qid = Number(a.question_id);
      const val = String(a.answer || "").toUpperCase().trim();

      if (qid && ["A", "B", "C", "D"].includes(val)) {
        answerMap.set(qid, val);
      }
    });

    let correct = 0;

    questions.forEach((q) => {
      const given = answerMap.get(Number(q.id));
      const right = String(q.correct_option || "").toUpperCase().trim();
      if (given && given === right) correct++;
    });

    const total = questions.length;
    const wrong = total - correct;
    const score = Math.round((correct / total) * 100);
    const passed = score >= PASS_SCORE;

    // 6) attempts jadvaliga yozish
    await conn.query(
      `INSERT INTO attempts (user_id, material_id, correct_count, total_count, score, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, materialId, correct, total, score]
    );
      await conn.query(
         `
         INSERT INTO leaderboard
         (user_id, module, attempts_count, best_score, score_sum, avg_score, correct_sum, total_sum, last_attempt_at, updated_at)
         VALUES
         (?, ?, 1, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         attempts_count = attempts_count + 1,
         best_score     = GREATEST(best_score, VALUES(best_score)),
         score_sum      = score_sum + VALUES(score_sum),
         avg_score      = ROUND((score_sum + VALUES(score_sum)) / (attempts_count + 1), 2),
         correct_sum    = correct_sum + VALUES(correct_sum),
         total_sum      = total_sum + VALUES(total_sum),
         last_attempt_at= NOW(),
         updated_at     = NOW()
         `,
         [
         userId,
         material.module,
         score,
         score,
         score,
         correct,
         total
         ]
     );
    // 7) user_progress ni update qilish
    const prevBest = pRows.length ? Number(pRows[0].best_score || 0) : 0;
    const newBest = Math.max(prevBest, score);

    await conn.query(
      `INSERT INTO user_progress
       (user_id, material_id, score, best_score, is_unlocked, attempts_count, last_attempt_at, completed_at)
       VALUES (?, ?, ?, ?, 1, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         score = VALUES(score),
         best_score = GREATEST(best_score, VALUES(best_score)),
         attempts_count = attempts_count + 1,
         last_attempt_at = NOW(),
         completed_at = NOW()`,
      [userId, materialId, score, newBest]
    );

    // 8) Agar passed bo‘lsa keyingi lessonni unlock qilish
    let nextUnlocked = false;
    let nextMaterialId = null;

    if (passed) {
      const [nextRows] = await conn.query(
        `SELECT id
         FROM materials
         WHERE module = ?
           AND is_published = 1
           AND (order_no > ? OR (order_no = ? AND id > ?))
         ORDER BY order_no ASC, id ASC
         LIMIT 1`,
        [material.module, material.order_no, material.order_no, materialId]
      );

      if (nextRows.length) {
        nextMaterialId = nextRows[0].id;

        await conn.query(
          `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count)
           VALUES (?, ?, 0, 0, 1, 0)
           ON DUPLICATE KEY UPDATE is_unlocked = 1`,
          [userId, nextMaterialId]
        );

        nextUnlocked = true;
      }
    }

    await conn.commit();

    res.json({
      correct_count: correct,
      wrong_count: wrong,
      total_count: total,
      score,
      passed,
      next_unlocked: nextUnlocked,
      next_material_id: nextMaterialId
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Vocabulary submit error." });
  } finally {
    conn.release();
  }
});

app.post("/api/attempts/submit", authenticateToken, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user.id;
    const materialId = Number(req.body.material_id);
    const answers = Array.isArray(req.body.answers) ? req.body.answers : [];

    if (!materialId) return res.status(400).json({ message: "material_id kerak." });

    await conn.beginTransaction();

    const [mRows] = await conn.query(
      `SELECT id, module, order_no, is_published FROM materials WHERE id=? LIMIT 1`,
      [materialId]
    );
    if (!mRows.length) {
      await conn.rollback();
      return res.status(404).json({ message: "Material topilmadi." });
    }
    const material = mRows[0];
    if (!material.is_published) {
      await conn.rollback();
      return res.status(404).json({ message: "Material topilmadi." });
    }

    const [firstRows] = await conn.query(
      `SELECT id FROM materials WHERE module=? AND is_published=1 ORDER BY order_no ASC, id ASC LIMIT 1`,
      [material.module]
    );
    if (firstRows.length) {
      const firstId = firstRows[0].id;
      await conn.query(
        `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count)
         VALUES (?, ?, 0, 0, 1, 0)
         ON DUPLICATE KEY UPDATE is_unlocked=1`,
        [userId, firstId]
      );
    }

    const [pRows] = await conn.query(
      `SELECT is_unlocked, best_score, attempts_count FROM user_progress
       WHERE user_id=? AND material_id=? LIMIT 1`,
      [userId, materialId]
    );
    const isUnlocked = pRows.length ? Number(pRows[0].is_unlocked) : 0;
    if (!isUnlocked) {
      await conn.rollback();
      return res.status(403).json({
        message: `🔒 Locked. Avval oldingi testdan ${PASS_SCORE}% oling.`,
        required: PASS_SCORE,
      });
    }

    const [qRows] = await conn.query(
      `SELECT id, correct_option FROM material_questions WHERE material_id=?`,
      [materialId]
    );

    const total = qRows.length;
    if (total === 0) {
      await conn.rollback();
      return res.status(400).json({ message: "Bu materialda savollar yo‘q." });
    }

    const ansMap = new Map();
    answers.forEach((a) => {
      const qid = Number(a.question_id);
      const val = String(a.answer || "").toUpperCase().trim();
      if (qid && ["A", "B", "C", "D"].includes(val)) ansMap.set(qid, val);
    });

    let correct = 0;
    qRows.forEach((q) => {
      const given = ansMap.get(Number(q.id));
      const right = String(q.correct_option || "").toUpperCase().trim();
      if (given && right && given === right) correct++;
    });

    const score = Math.round((correct / total) * 10000) / 100;
    const passed = score >= PASS_SCORE;

    await conn.query(
      `INSERT INTO attempts (user_id, material_id, correct_count, total_count, score, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, materialId, correct, total, score]
    );

    // ================= LEADERBOARD UPSERT (REAL) =================
    await conn.query(
    `
    INSERT INTO leaderboard
    (user_id, module, attempts_count, best_score, score_sum, avg_score, correct_sum, total_sum, last_attempt_at, updated_at)
    VALUES
    (?, ?, 1, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE
    attempts_count = attempts_count + 1,
    best_score     = GREATEST(best_score, VALUES(best_score)),
    score_sum      = score_sum + VALUES(score_sum),
    avg_score      = ROUND((score_sum + VALUES(score_sum)) / (attempts_count + 1), 2),
    correct_sum    = correct_sum + VALUES(correct_sum),
    total_sum      = total_sum + VALUES(total_sum),
    last_attempt_at= NOW(),
    updated_at     = NOW()
    `,
    [
    userId,
    material.module,   // 👈 materials jadvalidan olingan module (reading/listening)
    score,
    score,
    score,
    correct,
    total
   ]
    );

    const prevBest = pRows.length ? Number(pRows[0].best_score || 0) : 0;
    const newBest = Math.max(prevBest, score);

    await conn.query(
      `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count, last_attempt_at, completed_at)
       VALUES (?, ?, ?, ?, 1, 1, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         score=VALUES(score),
         best_score=GREATEST(best_score, VALUES(best_score)),
         attempts_count=attempts_count+1,
         last_attempt_at=NOW(),
         completed_at=NOW()`,
      [userId, materialId, score, newBest]
    );

    let nextUnlocked = false;
    let nextMaterialId = null;

    if (passed) {
      const [nextRows] = await conn.query(
        `SELECT id FROM materials
         WHERE module=? AND is_published=1
           AND (order_no > ? OR (order_no = ? AND id > ?))
         ORDER BY order_no ASC, id ASC
         LIMIT 1`,
        [material.module, material.order_no, material.order_no, materialId]
      );

      if (nextRows.length) {
        nextMaterialId = nextRows[0].id;

        await conn.query(
          `INSERT INTO user_progress (user_id, material_id, score, best_score, is_unlocked, attempts_count)
           VALUES (?, ?, 0, 0, 1, 0)
           ON DUPLICATE KEY UPDATE is_unlocked=1`,
          [userId, nextMaterialId]
        );

        nextUnlocked = true;
      }
    }

    await conn.commit();

    res.json({
      material_id: materialId,
      correct_count: correct,
      total_count: total,
      score,
      passed,
      required: PASS_SCORE,
      next_unlocked: nextUnlocked,
      next_material_id: nextMaterialId,
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Submit attempt error." });
  } finally {
    conn.release();
  }
});

// ================= LEADERBOARD GET =================
// GET /api/leaderboard?module=reading|listening
app.get("/api/leaderboard", authenticateToken, async (req, res) => {
  try {
    const module = String(req.query.module || "").trim().toLowerCase();

    const params = [];
    let where = "";
    if (module) {
      where = "WHERE l.module = ?";
      params.push(module);
    }

    const [rows] = await pool.query(
      `
      SELECT
        l.user_id,
        u.username,
        u.email,
        l.module,
        l.attempts_count,
        l.best_score,
        l.avg_score,
        l.correct_sum,
        l.total_sum,
        l.last_attempt_at
      FROM leaderboard l
      JOIN users u ON u.id = l.user_id
      ${where}
      ORDER BY l.best_score DESC, l.avg_score DESC, l.attempts_count DESC
      LIMIT 50
      `,
      params
    );

    res.json({ module: module || "all", items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Leaderboard error" });
  }
});

/* ================= STUDENT RESULTS ================= */
// GET /api/results/me
app.get("/api/results/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1) Quiz/Test stats
    const [statsRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS totalAttempts,
        COALESCE(MAX(score), 0) AS bestScore,
        COALESCE(ROUND(AVG(score), 2), 0) AS averageScore,
        COALESCE(SUM(correct_count), 0) AS totalCorrect,
        COALESCE(SUM(total_count), 0) AS totalQuestions
      FROM attempts
      WHERE user_id = ?
      `,
      [userId]
    );

    const stats = statsRows[0] || {};
    const totalCorrect = Number(stats.totalCorrect || 0);
    const totalQuestions = Number(stats.totalQuestions || 0);
    const accuracy =
      totalQuestions > 0
        ? Number(((totalCorrect / totalQuestions) * 100).toFixed(2))
        : 0;

    // 2) Recent attempts
    const [recentRows] = await pool.query(
      `
      SELECT id, material_id, correct_count, total_count, score, created_at
      FROM attempts
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
      `,
      [userId]
    );

    // 3) Current rank
    const [rankRows] = await pool.query(
      `
      SELECT ranked.user_id, ranked.rank_position
      FROM (
        SELECT
          a.user_id,
          DENSE_RANK() OVER (ORDER BY MAX(a.score) DESC, AVG(a.score) DESC) AS rank_position
        FROM attempts a
        GROUP BY a.user_id
      ) AS ranked
      WHERE ranked.user_id = ?
      `,
      [userId]
    );

    const currentRank = rankRows.length ? rankRows[0].rank_position : null;

    // 4) Writing stats
    const [writingRows] = await pool.query(
      `
      SELECT
        COUNT(*) AS totalSubmissions,
        COALESCE(SUM(CASE WHEN status = 'checked' THEN 1 ELSE 0 END), 0) AS checkedSubmissions,
        COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) AS pendingSubmissions,
        COALESCE(MAX(word_count), 0) AS maxWords,
        COALESCE(ROUND(AVG(word_count), 2), 0) AS averageWords,
        MAX(submitted_at) AS lastSubmittedAt
      FROM writing_submissions
      WHERE user_id = ?
      `,
      [userId]
    );

    const writing = writingRows[0] || {};

    // 5) Recent writing submissions
    const [recentWritingRows] = await pool.query(
      `
      SELECT
        ws.id,
        ws.word_count,
        ws.status,
        ws.submitted_at,
        wt.title,
        wt.task_type
      FROM writing_submissions ws
      JOIN writing_tasks wt ON wt.id = ws.task_id
      WHERE ws.user_id = ?
      ORDER BY ws.submitted_at DESC, ws.id DESC
      LIMIT 5
      `,
      [userId]
    );

    res.json({
      totalAttempts: Number(stats.totalAttempts || 0),
      bestScore: Number(stats.bestScore || 0),
      averageScore: Number(stats.averageScore || 0),
      totalCorrect,
      totalQuestions,
      accuracy,
      currentRank,
      recentAttempts: recentRows || [],

      writingStats: {
        totalSubmissions: Number(writing.totalSubmissions || 0),
        checkedSubmissions: Number(writing.checkedSubmissions || 0),
        pendingSubmissions: Number(writing.pendingSubmissions || 0),
        maxWords: Number(writing.maxWords || 0),
        averageWords: Number(writing.averageWords || 0),
        lastSubmittedAt: writing.lastSubmittedAt || null
      },
      recentWritingSubmissions: recentWritingRows || []
    });
  } catch (error) {
    console.error("Student results error:", error);
    res.status(500).json({ message: "Student resultsni olishda xatolik" });
  }
});
// GET /api/results/leaderboard
app.get("/api/results/leaderboard", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        a.user_id,
        u.username,
        COUNT(*) AS attemptsCount,
        ROUND(MAX(a.score), 2) AS bestScore,
        ROUND(AVG(a.score), 2) AS averageScore,
        DENSE_RANK() OVER (ORDER BY MAX(a.score) DESC, AVG(a.score) DESC) AS rankPosition
      FROM attempts a
      JOIN users u ON u.id = a.user_id
      GROUP BY a.user_id, u.username
      ORDER BY rankPosition ASC, bestScore DESC, averageScore DESC
      LIMIT 10
      `
    );

    res.json({
      items: rows || []
    });
  } catch (error) {
    console.error("Student ranking error:", error);
    res.status(500).json({ message: "Student rankingni olishda xatolik" });
  }
});
/* ================= ADMIN ROUTES ================= */

app.get("/admin/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim();
    const role = (req.query.role || "").trim();
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

    const plan = (req.query.plan || "").trim();
    if (plan) {
      if (!["free", "premium", "pro"].includes(plan)) {
        return res.status(400).json({ message: "Plan noto‘g‘ri." });
      }
      where.push(`plan = ?`);
      params.push(plan);
    }

    const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM users ${whereSQL}`,
      params
    );
    const total = countRows[0].total;
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [users] = await pool.query(
      `
        SELECT id, username, email, role, plan, is_active, is_verified, created_at
        FROM users
        ${whereSQL}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    res.json({ page, limit, total, totalPages, users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

app.delete("/admin/users/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM users WHERE id = ?", [req.params.id]);
    res.json({ message: "User o‘chirildi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

app.put("/admin/users/:id/role", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "admin"].includes(role)) {
      return res.status(400).json({ message: "Role noto‘g‘ri." });
    }

    await pool.query("UPDATE users SET role = ? WHERE id = ?", [role, req.params.id]);
    res.json({ message: "Role yangilandi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

app.put("/admin/users/:id/block", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;

    if (![0, 1].includes(is_active)) {
      return res.status(400).json({ message: "is_active 0 yoki 1 bo‘lishi kerak." });
    }

    await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [
      is_active,
      req.params.id,
    ]);

    res.json({ message: is_active ? "User unblock qilindi." : "User block qilindi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

app.put("/admin/users/:id/plan", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { plan } = req.body;

    if (!["free", "premium", "pro"].includes(plan)) {
      return res.status(400).json({ message: "Plan noto‘g‘ri." });
    }

    await pool.query("UPDATE users SET plan = ? WHERE id = ?", [plan, req.params.id]);

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
});

/* ================= ADMIN PAYMENT REQUESTS ================= */

app.get("/admin/payment-requests", authenticateToken, isAdmin, async (req, res) => {
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
});

app.post("/admin/payment-requests/:id/approve", authenticateToken, isAdmin, async (req, res) => {
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
    if (subs.length && subs[0].expires_at && new Date(subs[0].expires_at) > new Date()) {
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
});

app.post("/admin/payment-requests/:id/reject", authenticateToken, isAdmin, async (req, res) => {
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
});

/* ================= GOOGLE VERIFY (OPTIONAL, OLD) ================= */

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
      email_verified: payload.email_verified,
    });
  } catch (err) {
    res.status(400).json({ message: "Google verify failed" });
  }
});

/* ================= WRITING PRACTICE API ================= */

// GET /api/writing/tasks
app.get("/api/writing/tasks", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, title, task_type, prompt, min_words, time_limit, created_at
      FROM writing_tasks
      WHERE is_active = 1
      ORDER BY id ASC
      `
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /api/writing/tasks error:", err);
    res.status(500).json({ message: "Writing tasksni olishda xatolik." });
  }
});

// GET /api/writing/tasks/:id
app.get("/api/writing/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ message: "Task id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `
      SELECT id, title, task_type, prompt, min_words, time_limit, created_at
      FROM writing_tasks
      WHERE id = ? AND is_active = 1
      LIMIT 1
      `,
      [taskId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Writing task topilmadi." });
    }

    res.json({ task: rows[0] });
  } catch (err) {
    console.error("GET /api/writing/tasks/:id error:", err);
    res.status(500).json({ message: "Writing taskni olishda xatolik." });
  }
});

// POST /api/writing/submit
app.post("/api/writing/submit", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const task_id = Number(req.body.task_id);
    const essay_text = String(req.body.essay_text || "").trim();

    if (!task_id) {
      return res.status(400).json({ message: "task_id kerak." });
    }

    if (!essay_text) {
      return res.status(400).json({ message: "Essay matni bo‘sh bo‘lmasligi kerak." });
    }

    const [taskRows] = await pool.query(
      `
      SELECT id, min_words, is_active
      FROM writing_tasks
      WHERE id = ?
      LIMIT 1
      `,
      [task_id]
    );

    if (!taskRows.length || Number(taskRows[0].is_active) !== 1) {
      return res.status(404).json({ message: "Writing task topilmadi." });
    }

    const minWords = Number(taskRows[0].min_words || 0);
    const word_count = essay_text.split(/\s+/).filter(Boolean).length;

    if (word_count < minWords) {
      return res.status(400).json({
        message: `Kamida ${minWords} ta so‘z yozing. Hozir ${word_count} ta.`,
      });
    }

    const [result] = await pool.query(
      `
      INSERT INTO writing_submissions
      (user_id, task_id, essay_text, word_count, status, submitted_at)
      VALUES (?, ?, ?, ?, 'submitted', NOW())
      `,
      [userId, task_id, essay_text, word_count]
    );

    res.json({
      message: "Essay muvaffaqiyatli yuborildi.",
      submission_id: result.insertId,
      word_count,
      status: "submitted",
    });
  } catch (err) {
    console.error("POST /api/writing/submit error:", err);
    res.status(500).json({ message: "Essay yuborishda xatolik." });
  }
});

// GET /api/writing/my-submissions
app.get("/api/writing/my-submissions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ws.id,
        ws.task_id,
        wt.title,
        wt.task_type,
        ws.word_count,
        ws.status,
        ws.submitted_at
      FROM writing_submissions ws
      JOIN writing_tasks wt ON wt.id = ws.task_id
      WHERE ws.user_id = ?
      ORDER BY ws.submitted_at DESC, ws.id DESC
      LIMIT 20
      `,
      [userId]
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /api/writing/my-submissions error:", err);
    res.status(500).json({ message: "Writing submissionsni olishda xatolik." });
  }
});
/* ================= SPEAKING PRACTICE API ================= */

// GET /api/speaking/tasks
app.get("/api/speaking/tasks", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT id, title, task_type, prompt, cue_points, prep_time, speak_time, created_at
      FROM speaking_tasks
      WHERE is_active = 1 AND review_status = 'approved'
      ORDER BY id ASC
      `
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /api/speaking/tasks error:", err);
    res.status(500).json({ message: "Speaking tasklarni olishda xatolik." });
  }
});

// GET /api/speaking/tasks/:id
app.get("/api/speaking/tasks/:id", authenticateToken, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ message: "Task id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `
      SELECT id, title, task_type, prompt, cue_points, prep_time, speak_time, created_at
      FROM speaking_tasks
      WHERE id = ? AND is_active = 1 AND review_status = 'approved'
      LIMIT 1
      `,
      [taskId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Speaking task topilmadi." });
    }

    res.json({ task: rows[0] });
  } catch (err) {
    console.error("GET /api/speaking/tasks/:id error:", err);
    res.status(500).json({ message: "Speaking taskni olishda xatolik." });
  }
});

// POST /api/speaking/submit-audio
app.post(
  "/api/speaking/submit-audio",
  authenticateToken,
  audioUpload.single("audio"),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const task_id = Number(req.body.task_id);
      const duration_seconds = Number(req.body.duration_seconds || 0);

      if (!task_id) {
        return res.status(400).json({ message: "task_id kerak." });
      }

      if (!req.file) {
        return res.status(400).json({ message: "Audio fayl kerak." });
      }

      const [taskRows] = await pool.query(
        `
        SELECT id, is_active
        FROM speaking_tasks
        WHERE id = ?
        LIMIT 1
        `,
        [task_id]
      );

      if (!taskRows.length || Number(taskRows[0].is_active) !== 1) {
        return res.status(404).json({ message: "Speaking task topilmadi." });
      }

      const audio_url = `/uploads/audio/${req.file.filename}`;

      const [result] = await pool.query(
        `
        INSERT INTO speaking_submissions
        (user_id, task_id, audio_url, mime_type, duration_seconds, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, 'submitted', NOW())
        `,
        [userId, task_id, audio_url, req.file.mimetype || null, duration_seconds]
      );

      res.json({
        message: "Speaking audio muvaffaqiyatli yuborildi.",
        submission_id: result.insertId,
        audio_url,
        status: "submitted"
      });
    } catch (err) {
      console.error("POST /api/speaking/submit-audio error:", err);
      res.status(500).json({ message: "Speaking audio yuborishda xatolik." });
    }
  }
);

// GET /api/speaking/my-submissions
app.get("/api/speaking/my-submissions", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const [rows] = await pool.query(
      `
      SELECT
        ss.id,
        ss.task_id,
        st.title,
        st.task_type,
        ss.audio_url,
        ss.duration_seconds,
        ss.status,
        ss.submitted_at
      FROM speaking_submissions ss
      JOIN speaking_tasks st ON st.id = ss.task_id
      WHERE ss.user_id = ?
      ORDER BY ss.submitted_at DESC, ss.id DESC
      LIMIT 20
      `,
      [userId]
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /api/speaking/my-submissions error:", err);
    res.status(500).json({ message: "Speaking submissionsni olishda xatolik." });
  }
});

/* ================= ADMIN MATERIAL APPROVAL ================= */

// Pending / approved / rejected materials list
app.get("/admin/materials", authenticateToken, isAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "pending").trim().toLowerCase();
    const module = String(req.query.module || "").trim().toLowerCase();

    const allowedStatuses = ["pending", "approved", "rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "status noto‘g‘ri." });
    }

    let sql = `
      SELECT
        m.id,
        m.type,
        m.module,
        m.order_no,
        m.level,
        m.is_published,
        m.review_status,
        m.title,
        m.created_at,
        m.approved_at,
        u.username AS approved_by_name,
        (
          SELECT COUNT(*)
          FROM material_questions mq
          WHERE mq.material_id = m.id
        ) AS questions_count
      FROM materials m
      LEFT JOIN users u ON u.id = m.approved_by
      WHERE m.review_status = ?
    `;
    const params = [status];

    if (module) {
      sql += ` AND m.module = ?`;
      params.push(module);
    }

    sql += ` ORDER BY m.created_at DESC, m.id DESC`;

    const [rows] = await pool.query(sql, params);
    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /admin/materials error:", err);
    res.status(500).json({ message: "Materials list error." });
  }
});

// Single material detail + questions
app.get("/admin/materials/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) {
      return res.status(400).json({ message: "Material id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `
      SELECT
        m.*,
        u.username AS approved_by_name
      FROM materials m
      LEFT JOIN users u ON u.id = m.approved_by
      WHERE m.id = ?
      LIMIT 1
      `,
      [materialId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Material topilmadi." });
    }

    const [questions] = await pool.query(
      `
      SELECT id, question_text, option_a, option_b, option_c, option_d, correct_option
      FROM material_questions
      WHERE material_id = ?
      ORDER BY id ASC
      `,
      [materialId]
    );

    res.json({
      material: rows[0],
      questions: questions || []
    });
  } catch (err) {
    console.error("GET /admin/materials/:id error:", err);
    res.status(500).json({ message: "Material detail error." });
  }
});

// Approve material
app.post("/admin/materials/:id/approve", authenticateToken, isAdmin, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) {
      return res.status(400).json({ message: "Material id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `SELECT id FROM materials WHERE id = ? LIMIT 1`,
      [materialId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Material topilmadi." });
    }

    await pool.query(
      `
      UPDATE materials
      SET
        review_status = 'approved',
        is_published = 1,
        approved_by = ?,
        approved_at = NOW()
      WHERE id = ?
      `,
      [req.user.id, materialId]
    );

    res.json({ message: "Material approved qilindi." });
  } catch (err) {
    console.error("POST /admin/materials/:id/approve error:", err);
    res.status(500).json({ message: "Approve error." });
  }
});

// Reject material
app.post("/admin/materials/:id/reject", authenticateToken, isAdmin, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) {
      return res.status(400).json({ message: "Material id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `SELECT id FROM materials WHERE id = ? LIMIT 1`,
      [materialId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Material topilmadi." });
    }

    await pool.query(
      `
      UPDATE materials
      SET
        review_status = 'rejected',
        is_published = 0,
        approved_by = NULL,
        approved_at = NULL
      WHERE id = ?
      `,
      [materialId]
    );

    res.json({ message: "Material reject qilindi." });
  } catch (err) {
    console.error("POST /admin/materials/:id/reject error:", err);
    res.status(500).json({ message: "Reject error." });
  }
});

// Optional: published materialni qayta yopish
app.post("/admin/materials/:id/unpublish", authenticateToken, isAdmin, async (req, res) => {
  try {
    const materialId = Number(req.params.id);
    if (!materialId) {
      return res.status(400).json({ message: "Material id noto‘g‘ri." });
    }

    await pool.query(
      `
      UPDATE materials
      SET
        is_published = 0,
        review_status = 'pending',
        approved_by = NULL,
        approved_at = NULL
      WHERE id = ?
      `,
      [materialId]
    );

    res.json({ message: "Material unpublished qilindi." });
  } catch (err) {
    console.error("POST /admin/materials/:id/unpublish error:", err);
    res.status(500).json({ message: "Unpublish error." });
  }
});

/* ================= ADMIN SPEAKING APPROVAL ================= */

// pending / approved / rejected speaking tasks list
app.get("/admin/speaking-tasks", authenticateToken, isAdmin, async (req, res) => {
  try {
    const status = String(req.query.status || "pending").trim().toLowerCase();

    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `
      SELECT
        st.id,
        st.title,
        st.task_type,
        st.prompt,
        st.cue_points,
        st.prep_time,
        st.speak_time,
        st.is_active,
        st.review_status,
        st.created_at,
        st.approved_at,
        u.username AS approved_by_name
      FROM speaking_tasks st
      LEFT JOIN users u ON u.id = st.approved_by
      WHERE st.review_status = ?
      ORDER BY st.created_at DESC, st.id DESC
      `,
      [status]
    );

    res.json({ items: rows || [] });
  } catch (err) {
    console.error("GET /admin/speaking-tasks error:", err);
    res.status(500).json({ message: "Speaking tasks list error." });
  }
});

// single speaking task detail
app.get("/admin/speaking-tasks/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ message: "Task id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `
      SELECT
        st.*,
        u.username AS approved_by_name
      FROM speaking_tasks st
      LEFT JOIN users u ON u.id = st.approved_by
      WHERE st.id = ?
      LIMIT 1
      `,
      [taskId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Speaking task topilmadi." });
    }

    res.json({ task: rows[0] });
  } catch (err) {
    console.error("GET /admin/speaking-tasks/:id error:", err);
    res.status(500).json({ message: "Speaking task detail error." });
  }
});

// approve speaking task
app.post("/admin/speaking-tasks/:id/approve", authenticateToken, isAdmin, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ message: "Task id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `SELECT id FROM speaking_tasks WHERE id = ? LIMIT 1`,
      [taskId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Speaking task topilmadi." });
    }

    await pool.query(
      `
      UPDATE speaking_tasks
      SET
        review_status = 'approved',
        is_active = 1,
        approved_by = ?,
        approved_at = NOW()
      WHERE id = ?
      `,
      [req.user.id, taskId]
    );

    res.json({ message: "Speaking task approved qilindi." });
  } catch (err) {
    console.error("POST /admin/speaking-tasks/:id/approve error:", err);
    res.status(500).json({ message: "Speaking approve error." });
  }
});

// reject speaking task
app.post("/admin/speaking-tasks/:id/reject", authenticateToken, isAdmin, async (req, res) => {
  try {
    const taskId = Number(req.params.id);
    if (!taskId) {
      return res.status(400).json({ message: "Task id noto‘g‘ri." });
    }

    const [rows] = await pool.query(
      `SELECT id FROM speaking_tasks WHERE id = ? LIMIT 1`,
      [taskId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Speaking task topilmadi." });
    }

    await pool.query(
      `
      UPDATE speaking_tasks
      SET
        review_status = 'rejected',
        is_active = 0,
        approved_by = NULL,
        approved_at = NULL
      WHERE id = ?
      `,
      [taskId]
    );

    res.json({ message: "Speaking task rejected qilindi." });
  } catch (err) {
    console.error("POST /admin/speaking-tasks/:id/reject error:", err);
    res.status(500).json({ message: "Speaking reject error." });
  }
});
/* ================= START SERVER ================= */

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server ${port} portda ishlayapti`);
});