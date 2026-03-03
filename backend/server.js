const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
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
/* ✅ Eslatma: multer va fs yuqorida 1 marta import qilingan, qayta yozilmaydi */

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

    if (!match) return res.status(400).json({ message: "Parol noto‘g‘ri." });

    // (NEW) login paytida expire bo'lsa basic/free ga tushirib qo'yamiz
    await refreshSubscriptionIfExpired(user.id);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
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

/* ================= (NEW) CURRENT USER PROFILE (me) ================= */
/**
 * GET /api/me
 * Authorization: Bearer <token>
 * returns: { id, email, role, plan, expires_at }
 */
app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    // ✅ avval expire bo'lsa free/basic ga tushirib qo'yamiz
    await refreshSubscriptionIfExpired(req.user.id);

    // ✅ plan + expires_at qaytarish (subscriptions LEFT JOIN)
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

/* ================= (NEW) CONTENT API (SKELETON READY) ================= */
/**
 * Bu API hozircha "bo‘sh" qaytaradi (DB’da content yo‘q bo‘lsa).
 * Keyin admin panel orqali yuklashga tayyor.
 *
 * Kerakli tables:
 * - modules(id,slug,title,description,...)
 * - contents(id,module_id,title,body,level,is_published,...)
 * - content_files(id,content_id,file_url,file_type,...)
 * - questions(id,content_id,question_text,option_a,...,correct_option,...)
 */

// public: modul bo‘yicha content ro‘yxati
app.get("/api/modules/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const [mods] = await pool.query("SELECT * FROM modules WHERE slug=? LIMIT 1", [slug]);
    if (!mods.length) {
      return res.json({ module: null, contents: [] });
    }

    const module = mods[0];

    // faqat publishedlarni ko‘rsatamiz (real platforma uchun)
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
app.get("/api/contents/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    const [rows] = await pool.query("SELECT * FROM contents WHERE id=? LIMIT 1", [id]);
    if (!rows.length) return res.json({ content: null, files: [], questions: [] });

    const content = rows[0];

    // published bo‘lmasa userga bermaymiz (admin role bo‘lsa berish mumkin)
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

/* ================= (NEW) ADMIN CONTENT (READY FOR UPLOAD LATER) ================= */
/**
 * Admin uchun: module yaratish + content yaratish + publish/unpublish
 * Hozircha frontdan ishlatmasangiz ham bo‘ladi — skeleton tayyor turadi.
 */

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
    // duplicate slug bo‘lsa
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

/* ================= IELTS PROGRESSION (UNLOCK LOGIC) ================= */
/**
 * Tables used:
 * - materials(id,type,module,order_no,level,is_published,title,content,created_at)
 * - material_questions(id,material_id,question_text,option_a,option_b,option_c,option_d,correct_option,...)
 * - attempts(id,user_id,material_id,correct_count,total_count,score,created_at)
 * - user_progress(id,user_id,material_id,score,best_score,is_unlocked,attempts_count,last_attempt_at,completed_at)
 */

const PASS_SCORE = 75; // 75% dan yuqori bo'lsa keyingi test ochiladi

async function ensureFirstUnlocked(userId, module) {
  // module bo'yicha eng birinchi material (order_no eng kichik)
  const [firstRows] = await pool.query(
    `SELECT id FROM materials
     WHERE module=? AND is_published=1
     ORDER BY order_no ASC, id ASC
     LIMIT 1`,
    [module]
  );
  if (!firstRows.length) return;

  const firstId = firstRows[0].id;

  // user_progress bor-yo'qligini tekshiramiz
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
    await pool.query(
      `UPDATE user_progress SET is_unlocked=1 WHERE id=?`,
      [p[0].id]
    );
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
    score: Number(rows[0].score) || 0
  };
}

/* ================= 1) MODULE LIST (LOCKED/UNLOCKED) ================= */
/**
 * GET /api/modules/:module/list
 * Authorization: Bearer <token>
 * returns:
 *  { module, items:[{id,title,order_no,level,is_published,is_unlocked,best_score}] }
 */
app.get("/api/modules/:module/list", authenticateToken, async (req, res) => {
  try {
    const module = String(req.params.module || "").trim().toLowerCase();
    if (!module) return res.status(400).json({ message: "module kerak." });

    // birinchi test default unlocked bo'lsin
    await ensureFirstUnlocked(req.user.id, module);

    const [items] = await pool.query(
      `SELECT id, title, module, order_no, level, is_published
       FROM materials
       WHERE module=? AND is_published=1
       ORDER BY order_no ASC, id ASC`,
      [module]
    );

    // progresslar
    const ids = items.map((x) => x.id);
    let progressMap = new Map();

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
          best_score: Number(p.best_score) || 0
        });
      });
    }

    const out = items.map((it) => {
      const p = progressMap.get(Number(it.id)) || { is_unlocked: 0, best_score: 0 };
      return {
        ...it,
        is_unlocked: p.is_unlocked,
        best_score: p.best_score
      };
    });

    res.json({ module, items: out });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Module list error." });
  }
});

/* ================= 2) MATERIAL DETAIL + QUESTIONS ================= */
/**
 * GET /api/materials/:id
 * Authorization: Bearer <token>
 * locked bo'lsa -> 403 qaytaradi
 */
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

    // module bo'yicha first unlocked bo'lsin
    await ensureFirstUnlocked(req.user.id, material.module);

    const st = await getUnlockStatus(req.user.id, materialId);
    if (!st.is_unlocked) {
      return res.status(403).json({
        message: `🔒 Locked. Keyingi bosqichga o‘tish uchun natijani ${PASS_SCORE}% qiling.`,
        required: PASS_SCORE
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

/* ================= 3) SUBMIT ATTEMPT + SCORE + UNLOCK NEXT ================= */
/**
 * POST /api/attempts/submit
 * Authorization: Bearer <token>
 * body:
 * { material_id: number, answers: [{question_id:number, answer:"A"|"B"|"C"|"D"}] }
 */
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

    // first unlocked
    // (transaction ichida ham ishlaydi)
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

    // locked check
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
        required: PASS_SCORE
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

    // answer map
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

    const score = Math.round((correct / total) * 10000) / 100; // 2 xonali %
    const passed = score >= PASS_SCORE;

    // attempts insert
    await conn.query(
      `INSERT INTO attempts (user_id, material_id, correct_count, total_count, score, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      [userId, materialId, correct, total, score]
    );

    // user_progress upsert (best_score update)
    const prevBest = pRows.length ? Number(pRows[0].best_score || 0) : 0;
    const newBest = Math.max(prevBest, score);
    const prevAttempts = pRows.length ? Number(pRows[0].attempts_count || 0) : 0;

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

    // unlock next
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
      next_material_id: nextMaterialId
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: "Submit attempt error." });
  } finally {
    conn.release();
  }
});
/* ================= ADMIN ROUTES ================= */

app.get("/admin/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const search = (req.query.search || "").trim(); // id/username/email
    const role = (req.query.role || "").trim(); // user/admin
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit || "20", 10), 1),
      100
    );
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
      users,
    });
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

    await pool.query("UPDATE users SET role = ? WHERE id = ?", [
      role,
      req.params.id,
    ]);

    res.json({ message: "Role yangilandi." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server xatosi." });
  }
});

// BLOCK / UNBLOCK USER
app.put("/admin/users/:id/block", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { is_active } = req.body;

    if (![0, 1].includes(is_active)) {
      return res
        .status(400)
        .json({ message: "is_active 0 yoki 1 bo‘lishi kerak." });
    }

    await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [
      is_active,
      req.params.id,
    ]);

    res.json({
      message: is_active ? "User unblock qilindi." : "User block qilindi.",
    });
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

    // users.plan update
    await pool.query("UPDATE users SET plan = ? WHERE id = ?", [
      plan,
      req.params.id,
    ]);

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
});

/* ================= (NEW) ADMIN PAYMENT REQUESTS ================= */

// list payment requests by status (pending/approved/rejected)
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

// approve request -> subscriptions + 90 days (duration_days)
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
});

// reject request
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
      email_verified: payload.email_verified,
    });
  } catch (err) {
    res.status(400).json({
      message: "Google verify failed",
    });
  }
});

/* ================= START SERVER ================= */

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server ${port} portda ishlayapti`);
});