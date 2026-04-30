/* ================= PAGE REFERENCES ================= */
const pages = {
  login: document.getElementById("loginPage"),
  register: document.getElementById("registerPage"),
  main: document.getElementById("mainPage"),
  payment: document.getElementById("paymentPage"),
  dashboard: document.getElementById("dashboard"),
  forgot: document.getElementById("forgotPage"),
  verify: document.getElementById("verifyPage"),
  listening: document.getElementById("listeningPage"),
  leaderboard: document.getElementById("leaderboardPage"),
  studentResults: document.getElementById("studentResultsPage"),
  vocabulary: document.getElementById("vocabularyPage"),
  reading: document.getElementById("readingPage"),
  writing: document.getElementById("writingPage"),
  speaking: document.getElementById("speakingPage"),
  band9: document.getElementById("band9Page"),
  mock: document.getElementById("mockPage")
};

/* ================= API BASE ================= */
const API_BASE = "http://localhost:3000";

/* ================= GOOGLE VERIFY ================= */
const GOOGLE_VERIFY = {
  idToken: null,
  email: null,
  verified: false
};

const GOOGLE_CLIENT_ID =
  "1081668585971-ee2gmg3f7rvjsf0g2nnfcqgvkpvdnsg3.apps.googleusercontent.com";

function setGoogleVerifyStatus(msg, ok = false) {
  const el = document.getElementById("googleVerifyStatus");
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? "green" : "crimson";
}

function resetGoogleVerify() {
  GOOGLE_VERIFY.idToken = null;
  GOOGLE_VERIFY.email = null;
  GOOGLE_VERIFY.verified = false;
  setGoogleVerifyStatus("Google verify qilinmagan");
}

function initGoogleVerifyButton() {
  const btnWrap = document.getElementById("googleVerifyBtn");
  if (!btnWrap) return;

  if (!window.google?.accounts?.id) {
    setGoogleVerifyStatus("Google script yuklanmadi. (gsi/client) qo‘shilganini tekshiring.");
    return;
  }

  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
    setGoogleVerifyStatus("GOOGLE_CLIENT_ID qo‘yilmagan. index.js dagi GOOGLE_CLIENT_ID ni to‘ldiring.");
    return;
  }

  btnWrap.innerHTML = "";

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      GOOGLE_VERIFY.idToken = response?.credential || null;
      GOOGLE_VERIFY.verified = !!GOOGLE_VERIFY.idToken;
      GOOGLE_VERIFY.email = null;

      if (GOOGLE_VERIFY.idToken) {
        setGoogleVerifyStatus("✅ Google token olindi. Endi Register bosing.", true);
      } else {
        setGoogleVerifyStatus("❌ Google token olinmadi.");
      }
    }
  });

  google.accounts.id.renderButton(btnWrap, {
    theme: "outline",
    size: "large",
    text: "continue_with"
  });

  setGoogleVerifyStatus("Google orqali emailni tasdiqlang (Verify).");
}

/* ================= ROLE HELPERS ================= */
function getRole() {
  return localStorage.getItem("role") || "user";
}

function isAdminRole() {
  return getRole() === "admin";
}

/* ================= PLAN HELPERS ================= */
const PLAN_RANK = { basic: 1, premium: 2, pro: 3 };

function getCurrentPlan() {
  return localStorage.getItem("plan") || "basic";
}

function getDaysLeft() {
  const exp = localStorage.getItem("expires_at");
  if (!exp) return null;

  const end = new Date(exp);
  const now = new Date();
  const diffMs = end - now;

  if (diffMs <= 0) return 0;

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/* ================= SYNC PLAN FROM SERVER ================= */
async function syncPlanFromServer() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;

    if (data.plan) {
      localStorage.setItem("plan", data.plan === "free" ? "basic" : data.plan);
    }

    if (data.role) {
      localStorage.setItem("role", data.role);
    }

    if (data.expires_at) {
      localStorage.setItem("expires_at", data.expires_at);
    } else {
      localStorage.removeItem("expires_at");
    }
  } catch (e) {
    console.error("syncPlanFromServer error", e);
  }
}

/* ================= PAGE CONTROLLER ================= */
function hideAllPages() {
  Object.values(pages).forEach((page) => {
    if (!page) return;
    page.style.display = "none";
    page.classList.remove("show", "active");
  });
}

async function showPage(page, display = "flex") {
  if (!page) return;

  // 1. Agar 'page' matn (string) bo'lsa, uni 'pages' obyektidan qidirib topamiz
  let targetPage = typeof page === "string" ? pages[page] : page;

  // Agar sahifa topilmasa, konsolda xato chiqarib, to'xtaydi
  if (!targetPage) {
    console.error("Xatolik: Sahifa topilmadi ->", page);
    return;
  }

  // Barcha sahifalarni yashirish
  hideAllPages();
  
  // Maqsadli sahifani ko'rsatish
  targetPage.style.display = display;

  // Animatsiya uchun klasslarni boshqarish
  requestAnimationFrame(() => {
    targetPage.classList.add("show", "active");
  });

  // Body klasslarini tozalash va yangilash
  document.body.classList.remove("is-auth", "is-main", "is-dashboard");

  // Auth sahifalari (Login, Register, etc.)
  if (
    targetPage === pages.login ||
    targetPage === pages.register ||
    targetPage === pages.forgot ||
    targetPage === pages.verify
  ) {
    document.body.classList.add("is-auth");
  }

  // Asosiy kontent sahifalari
  if (
    targetPage === pages.main ||
    targetPage === pages.payment ||
    targetPage === pages.listening ||
    targetPage === pages.studentResults ||
    targetPage === pages.vocabulary ||
    targetPage === pages.reading ||
    targetPage === pages.writing ||
    targetPage === pages.speaking ||
    targetPage === pages.band9 ||
    targetPage === pages.mock ||
    targetPage === pages.leaderboard
  ) {
    document.body.classList.add("is-main");
  }

  // Dashboard sahifasi
  if (targetPage === pages.dashboard) {
    document.body.classList.add("is-dashboard");
  }

  // --- MAXSUS MODULLARNI ISHGA TUSHIRISH ---
  // Har bir modul o'z ID-si bilan chaqirilganda avtomatik yuklanadi
  if (page === 'listening') await openListeningModule();
  if (page === 'reading') await openReadingModule();
  if (page === 'vocabulary') await openVocabularyModule();
  if (page === 'writing') await openWritingModule();
  if (page === 'speaking') await openSpeakingModule();
  if (page === 'students') await openStudentResults();
  if (page === 'leaderboard') await openLeaderboard();

  // Reveal animatsiyalarini qayta tekshirish (Skrol bo'lmasa ham chiqishi uchun)
  setTimeout(() => {
    initRevealObserver();
  }, 100);

  // --- DASHBOARD SOZLAMALARI ---
  if (targetPage === pages.dashboard) {
    await initDashboard();

    const adminBtn = document.getElementById("adminToggleBtn");
    if (adminBtn) {
      adminBtn.style.display = isAdminRole() ? "flex" : "none";
    }

    const upgradeTop = document.getElementById("upgradeBtnTop");
    if (upgradeTop) {
      upgradeTop.style.display = isAdminRole() ? "none" : "inline-flex";
    }

    // Foydalanuvchi ma'lumotlarini yuklash (Email va Avatar uchun)
    loadUser();
    cleanupAdminArtifacts();
  }

  // Admin bo'lsa, main sahifadan dashboardga otib yuborish
  if (targetPage === pages.main && isAdminRole()) {
    await showPage('dashboard');
    return;
  }

  // Register sahifasi yuklanganda Google Verify'ni yoqish
  if (targetPage === pages.register) {
    resetGoogleVerify();
    initGoogleVerifyButton();
  }

  // Sidebar menyusini yopish (Mobilda sahifa bosilganda yopilishi uchun)
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  if (sidebar && sidebar.classList.contains('active')) {
    sidebar.classList.remove('active');
    if(overlay) overlay.classList.remove('active');
  }

  initFeatureClick();
}

/* ================= DROPDOWN ================= */
function setupUserDropdown() {
  const avatarBtn = document.getElementById("avatarBtn");
  const dropdown = document.getElementById("userDropdown");

  if (!avatarBtn || !dropdown) return;

  if (avatarBtn.dataset.bound === "1") return;
  avatarBtn.dataset.bound = "1";

  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("open");
  });
}

/* ================= INIT ================= */
window.addEventListener("DOMContentLoaded", async () => {
  setupUserDropdown();

  const savedUser = localStorage.getItem("userEmail");
  const token = localStorage.getItem("token");
  const goDash = localStorage.getItem("goDashboard") === "1";

  if (goDash) localStorage.removeItem("goDashboard");

  if (savedUser && token) {
    await syncPlanFromServer();

    if (goDash) {
      await showPage(pages.dashboard);
    } else {
      if (isAdminRole()) {
        await showPage(pages.dashboard);
      } else {
        const p = getCurrentPlan();
        if (p !== "basic") {
          await showPage(pages.dashboard);
        } else {
          await showPage(pages.main);
        }
      }
    }
  } else {
    await showPage(pages.login);
  }
});

/* ================= AUTH ================= */
function goRegister() {
  showPage(pages.register);
}

function goLogin() {
  showPage(pages.login);
}

/* -------- REGISTER -------- */
async function goMain() {
  const username = document.getElementById("registerUsername")?.value.trim() || "";
  const email = document.getElementById("registerEmail")?.value.trim() || "";
  const password = document.getElementById("registerPassword")?.value.trim() || "";

  if (!username || !email || !password) {
    alert("Barcha maydonlarni to‘ldiring");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, full_name: username })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Xatolik yuz berdi");
      return;
    }

    alert(data.message || "Kod emailingizga yuborildi. Endi kodni kiriting.");

    const vEmail = document.getElementById("verifyEmail");
    if (vEmail) vEmail.value = email;

    await showPage(pages.verify);
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

/* ================= VERIFY EMAIL (OTP) ================= */
async function verifyEmailCode() {
  const email = document.getElementById("verifyEmail")?.value?.trim() || "";
  const code = document.getElementById("verifyCode")?.value?.trim() || "";

  if (!email || !code) {
    alert("Email va 6 xonali kodni kiriting");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/verify-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Kod noto‘g‘ri yoki muddati tugagan");
      return;
    }

    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("role", data.role || "user");

      await syncPlanFromServer();
      cleanupAdminArtifacts();

      if ((data.role || getRole()) === "admin") {
        await showPage(pages.dashboard);
      } else {
        const p = getCurrentPlan();
        if (p !== "basic") {
          await showPage(pages.dashboard);
        } else {
          await showPage(pages.main);
        }
      }

      return;
    }

    alert(data.message || "Email tasdiqlandi. Endi login qiling.");
    await showPage(pages.login);
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

async function resendVerifyCode() {
  const email = document.getElementById("verifyEmail")?.value?.trim() || "";
  if (!email) {
    alert("Emailni kiriting");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/resend-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Qayta yuborishda xatolik");
      return;
    }

    alert(data.message || "Kod qayta yuborildi");
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

/* -------- LOGIN -------- */
async function login() {
  const email = document.getElementById("loginEmail")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value.trim() || "";

  if (!email || !password) {
    alert("Email va parolni kiriting");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Login xato");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("role", data.role || "user");

    await syncPlanFromServer();
    cleanupAdminArtifacts();

    if (data.role === "admin") {
      await showPage(pages.dashboard);
    } else {
      const p = getCurrentPlan();
      if (p !== "basic") {
        await showPage(pages.dashboard);
      } else {
        await showPage(pages.main);
      }
    }
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

/* -------- LOGOUT -------- */
function logout() {
  cleanupAdminArtifacts();
  localStorage.clear();
  showPage(pages.login);
}

/* ================= PLAN ================= */
function choosePlan(plan) {
  if (isAdminRole()) {
    showPage(pages.dashboard);
    return;
  }

  const currentPlan = getCurrentPlan();
  const curRank = PLAN_RANK[currentPlan] || 1;
  const wantRank = PLAN_RANK[plan] || 1;

  if (plan === "basic") {
    localStorage.setItem("plan", "basic");
    showPage(pages.dashboard);
    return;
  }

  if (curRank >= wantRank && currentPlan !== "basic") {
    const daysLeft = getDaysLeft();

    if (daysLeft !== null) {
      alert(`✅ Siz allaqachon "${currentPlan.toUpperCase()}" planidasiz.\n⏳ Qolgan muddat: ${daysLeft} kun.`);
    } else {
      alert(`✅ Siz allaqachon "${currentPlan.toUpperCase()}" planidasiz.`);
    }

    showPage(pages.dashboard);
    return;
  }

  preparePayment(plan);
  showPage(pages.payment, "flex");
}

function goDashboard() {
  showPage(pages.dashboard);
}

/* ================= DASHBOARD ================= */
async function initDashboard() {
  loadUser();
  await syncPlanFromServer();
  applyFeatureLock();
}

/* ================= LOAD USER ================= */
function loadUser() {
  const email = localStorage.getItem("userEmail") || "User";
  const emailEl = document.getElementById("headerUserEmail");
  const avatarEl = document.getElementById("userAvatarLetter");

  if (emailEl) emailEl.textContent = email;
  if (avatarEl) {
    avatarEl.textContent = email.charAt(0).toUpperCase();
  }
}

/* ================= ACCESS CONTROL ================= */
const accessControl = {
  basic: { sidebarLimit: 3, topLimit: 3 },
  premium: { sidebarLimit: 4, topLimit: 5 },
  pro: { sidebarLimit: Infinity, topLimit: Infinity }
};

/* ================= FEATURE LOCK ================= */
function applyFeatureLock() {
  if (isAdminRole()) {
    document.querySelectorAll(".locked").forEach((el) => el.classList.remove("locked"));
    return;
  }

  const plan = getCurrentPlan();
  const limits = accessControl[plan] || accessControl.basic;

  const sidebarItems = document.querySelectorAll(".sidebar [data-feature]");
  const topItems = document.querySelectorAll(".feature-buttons [data-feature]");

  sidebarItems.forEach((el, index) => {
    el.classList.toggle("locked", index >= limits.sidebarLimit);
  });

  topItems.forEach((el, index) => {
    el.classList.toggle("locked", index >= limits.topLimit);
  });
}

/* ================= FEATURE DATA ================= */
const featureData = {
  vocabulary: { title: "Learn Vocabulary", body: "<p>📘 Practice new words with smart repetition.</p>" },
  reading: { title: "Reading Practice", body: "<p>📖 Read IELTS-style passages and answer questions.</p>" },
  writing: { title: "Writing Practice", body: `<textarea placeholder="Write your essay here..."></textarea><button>Submit Essay</button>` },
  speaking: { title: "Speaking Practice", body: "<p>🎤 Practice speaking topics with guidance.</p>" },
  band9: { title: "Band 9.0 Samples", body: "<p>⭐ View high-scoring IELTS answers.</p>" },
  mock: { title: "Full Mock Test", body: "<p>📝 Take a complete IELTS mock exam.</p>" },
  leaderboard: { title: "Leaderboard", body: "<p>🏆 See top students and rankings.</p>" },
  translation: { title: "Translation Practice", body: "<p>🌍 Translate texts and improve accuracy.</p>" },
  lessons: { title: "Join My Lessons", body: "<p>📚 Join live lessons with teachers.</p>" },
  students: { title: "Student Results", body: "<p>📊 View student performance statistics.</p>" }
};

/* ================= FEATURE CLICK ================= */
function initFeatureClick() {
  const buttons = document.querySelectorAll("[data-feature]");

  buttons.forEach((btn) => {
    if (btn.dataset.featureBound === "1") return;
    btn.dataset.featureBound = "1";

    btn.addEventListener("click", async () => {
      if (!isAdminRole() && btn.classList.contains("locked")) {
        alert("🔒 This feature is locked. Upgrade your plan.");
        return;
      }

      const feature = btn.dataset.feature;

      if (feature === "leaderboard") {
        await showPage(pages.leaderboard, "block");
        openLeaderboard("");
        return;
      }

      if (feature === "listening") {
        openListeningModule();
        return;
      }

      if (feature === "students") {
        openStudentResults();
        return;
      }

      const skeletonMap = {
       band9: pages.band9,
       mock: pages.mock
      };

      if (feature === "vocabulary") {
        openVocabularyModule();
        return;
      }

      if (feature === "reading") {
       openReadingModule();
       return;
      }

      if (feature === "writing") {
       openWritingModule();
       return;
      }
      if (feature === "speaking") {
        openSpeakingModule();
        return;
      }

      if (skeletonMap[feature]) {
       showPage(skeletonMap[feature], "block");
       return;
      }

      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const featureTitle = document.getElementById("featureTitle");
      const featureBody = document.getElementById("featureBody");
      const data = featureData[feature];

      if (!data || !featureTitle || !featureBody) return;

      featureTitle.textContent = data.title;
      featureBody.innerHTML = data.body;
    });
  });
}

/* ================= PASSWORD RESET (OTP) ================= */
function openForgot() {
  showPage(pages.forgot);
}

function backToLogin() {
  showPage(pages.login);
}

async function sendResetCode() {
  const emailEl = document.getElementById("forgotEmail");
  const email = (emailEl?.value || "").trim().toLowerCase();

  if (!email) {
    alert("Emailni kiriting");
    if (emailEl) emailEl.focus();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Xatolik");
      return;
    }

    alert(data.message || "Kod yuborildi");

    const step2 = document.getElementById("resetStep2");
    if (step2) step2.style.display = "block";

    const rEmail = document.getElementById("resetEmail");
    if (rEmail) rEmail.value = email;

    const codeEl = document.getElementById("resetCode");
    if (codeEl) codeEl.focus();
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

async function resetPassword() {
  const resetEmailEl = document.getElementById("resetEmail");
  const forgotEmailEl = document.getElementById("forgotEmail");

  const email = ((resetEmailEl?.value || forgotEmailEl?.value) || "").trim().toLowerCase();

  const codeEl = document.getElementById("resetCode");
  const pass1El = document.getElementById("resetNewPassword");
  const pass2El = document.getElementById("resetNewPassword2");

  const code = (codeEl?.value || "").trim();
  const pass1 = (pass1El?.value || "").trim();
  const pass2 = (pass2El?.value || "").trim();

  if (!email) {
    alert("Email topilmadi. Avval emailingizni kiriting.");
    if (forgotEmailEl) forgotEmailEl.focus();
    return;
  }

  if (!code || !pass1 || !pass2) {
    alert("Hamma maydonlarni to‘ldiring");
    if (!code && codeEl) codeEl.focus();
    else if (!pass1 && pass1El) pass1El.focus();
    else if (!pass2 && pass2El) pass2El.focus();
    return;
  }

  if (pass1.length < 6) {
    alert("Parol kamida 6 ta belgi bo‘lsin");
    if (pass1El) pass1El.focus();
    return;
  }

  if (pass1 !== pass2) {
    alert("Parollar mos emas");
    if (pass2El) pass2El.focus();
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword: pass1 })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Xatolik");
      return;
    }

    alert(data.message || "Parol yangilandi");

    if (codeEl) codeEl.value = "";
    if (pass1El) pass1El.value = "";
    if (pass2El) pass2El.value = "";

    const step2 = document.getElementById("resetStep2");
    if (step2) step2.style.display = "none";

    await showPage(pages.login);
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

function sendReset() {
  return sendResetCode();
}

/* ================= SOCIAL LOGIN ================= */
function loginWithGoogle() {
  window.location.href = `${API_BASE}/api/auth/google`;
}

function loginWithApple() {
  window.location.href = `${API_BASE}/api/auth/apple`;
}

/* ================= ADMIN PANEL ================= */
function toggleAdminPanel() {
  const role = localStorage.getItem("role");
  if (role !== "admin") {
    alert("Access denied");
    return;
  }
  window.location.href = "admin.html";
}

/* ================= UPGRADE ================= */
function goUpgrade() {
  if (isAdminRole()) {
    alert("Admin uchun Upgrade kerak emas.");
    return;
  }

  const currentPlan = getCurrentPlan();
  const daysLeft = getDaysLeft();

  if (currentPlan === "pro") {
    const msg = daysLeft !== null
      ? `✅ Siz allaqachon PRO planidasiz.\n⏳ Qolgan muddat: ${daysLeft} kun.`
      : `✅ Siz allaqachon PRO planidasiz.`;

    alert(msg);
    showPage(pages.dashboard);
    return;
  }

  const nextPlan = currentPlan === "premium" ? "pro" : "premium";
  preparePayment(nextPlan);
  showPage(pages.payment, "flex");
}

/* ================= CLEANUP HELPERS ================= */
function cleanupAdminArtifacts() {
  const oldTable = document.getElementById("adminUsersTable");
  if (oldTable) oldTable.remove();

  const dropdown = document.getElementById("userDropdown");
  if (dropdown) {
    dropdown.classList.remove("open");
    dropdown.style.display = "";
  }
}

/* ================= PAYMENT ================= */
const PLAN_PRICES = { premium: "99 000 so‘m", pro: "149 000 so‘m" };
const PLAN_AMOUNTS = { premium: 99000, pro: 149000 };

const CARD_INFO = {
  number: "9860 3501 4364 6296",
  owner: "Sultonbek"
};

function preparePayment(plan) {
  const payPage = pages.payment;
  if (!payPage) {
    console.warn("paymentPage topilmadi. index.html da id='paymentPage' bormi?");
    return;
  }

  const email = localStorage.getItem("userEmail") || "";
  const username = email.includes("@") ? email.split("@")[0] : "user";
  const planLabel = plan === "pro" ? "Pro" : "Premium";

  const elPlan = document.getElementById("payPlanLabel");
  const elAmount = document.getElementById("payAmountLabel");
  const elCard = document.getElementById("payCardNumber");
  const elOwner = document.getElementById("payCardOwner");
  const elComment = document.getElementById("payComment");

  if (elPlan) elPlan.textContent = planLabel;
  if (elAmount) elAmount.textContent = PLAN_PRICES[plan] || "";
  if (elCard) elCard.textContent = CARD_INFO.number;
  if (elOwner) elOwner.textContent = CARD_INFO.owner;
  if (elComment) elComment.textContent = `LANGIFY ${planLabel} – username: ${username}`;

  localStorage.setItem("pending_plan", plan);

  const file = document.getElementById("receiptFile");
  const tx = document.getElementById("txId");
  if (file) file.value = "";
  if (tx) tx.value = "";
}

function copyText(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const text = el.textContent || "";
  navigator.clipboard.writeText(text);
  alert("Copied ✅");
}

async function submitPaymentRequest() {
  const token = localStorage.getItem("token");
  if (!token) {
    alert("Avval login qiling!");
    showPage(pages.login);
    return;
  }

  const file = document.getElementById("receiptFile")?.files?.[0];
  const txId = document.getElementById("txId")?.value?.trim() || "";
  const plan = localStorage.getItem("pending_plan") || "premium";

  if (!file) {
    alert("Chek rasmini yuklang!");
    return;
  }

  if (!["premium", "pro"].includes(plan)) {
    alert("Plan noto‘g‘ri. Qaytadan tanlang!");
    showPage(pages.main);
    return;
  }

  const amount = PLAN_AMOUNTS[plan] || 0;

  const fd = new FormData();
  fd.append("receipt", file);
  fd.append("plan_requested", plan);
  fd.append("amount", String(amount));
  if (txId) fd.append("transaction_ref", txId);

  try {
    const res = await fetch(`${API_BASE}/api/payments/request`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: fd
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data.message || "Chek yuborishda xatolik!");
      return;
    }

    alert("✅ So‘rov yuborildi! Admin tekshiradi va tasdiqlasa plan yoqiladi.");

    const f = document.getElementById("receiptFile");
    const t = document.getElementById("txId");
    if (f) f.value = "";
    if (t) t.value = "";

    showPage(pages.dashboard);
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi (backend ishlayaptimi?)");
  }
}

/* ================= AUTH HEADER ================= */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

/* ================= LISTENING MODULE ================= */
async function openListeningModule() {
  await showPage(pages.listening, "block");
  await loadListeningList();
}

async function loadListeningList() {
  const grid = document.getElementById("listeningTestGrid");
  const right = document.getElementById("listeningRight");

  if (!grid) {
    console.warn("listeningTestGrid topilmadi. index.html ga id='listeningTestGrid' qo‘shing.");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    grid.innerHTML = `<div style="opacity:.8;">Avval login qiling 🔑</div>`;
    if (right) right.innerHTML = "";
    return;
  }

  grid.innerHTML = "Loading...";
  if (right) right.innerHTML = "";

  try {
    const res = await fetch(`${API_BASE}/api/modules/listening/list`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      grid.innerHTML = `<div style="color:crimson;">${data.message || "Failed"}</div>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      grid.innerHTML = `<div>No listening tests yet</div>`;
      return;
    }

    grid.innerHTML = "";

    items.forEach((it) => {
      const unlocked = Number(it.is_unlocked) === 1;

      const card = document.createElement("div");
      card.className = "test-card" + (unlocked ? "" : " premium");
      card.style.cursor = unlocked ? "pointer" : "not-allowed";
      card.style.opacity = unlocked ? "1" : "0.6";

      card.innerHTML = `
        <span class="badge ${unlocked ? "free" : "premium"}">${unlocked ? "Open" : "Locked"}</span>
        <h4>${it.order_no}. ${it.title}</h4>
        <button style="padding:10px;width:90%;margin-top:6px;background:blueviolet;color:#fff;border:none;border-radius:10px;"
          ${unlocked ? "" : "disabled"}>${unlocked ? "Start" : "75% kerak"}</button>
      `;

      if (unlocked) {
        card.addEventListener("click", () => {
        window.location.href = `/listeningtest.html?id=${it.id}`;
        });
      }

      grid.appendChild(card);
    });
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div style="color:crimson;">Server error</div>`;
  }
}

async function submitListening(materialId, answers) {
  const resultEl = document.getElementById("listeningResult");
  if (resultEl) resultEl.innerHTML = "Submitting...";

  try {
    const res = await fetch(`${API_BASE}/api/attempts/submit`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ material_id: materialId, answers })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (resultEl) {
        resultEl.innerHTML = `<p style="color:crimson;">${data.message || "Submit error"}</p>`;
      }
      return;
    }

    const correct = Number(data.correct_count || 0);
    const total = Number(data.total_count || 0);
    const wrong = Math.max(total - correct, 0);
    const score = Number(data.score || 0);
    const passed = !!data.passed;
    const unlockedNext = !!data.next_unlocked;

    if (resultEl) {
      resultEl.innerHTML = `
        <div style="background:#ffffffb3;border:1px solid rgba(15,23,42,.08);padding:12px;border-radius:14px;">
          <p style="margin:0 0 8px 0;font-weight:800;">
            Natija: <span style="color:${passed ? "green" : "orangered"}">${score}%</span> ${passed ? "✅" : "🔒"}
          </p>
          <p style="margin:0;">✅ To‘g‘ri: <b>${correct}</b> / ${total} | ❌ Xato: <b>${wrong}</b></p>
          ${unlockedNext ? `<p style="margin:8px 0 0 0;color:green;font-weight:700;">✅ Keyingi test ochildi!</p>` : ""}
        </div>
      `;
    }
// Har bir savolni ranglash
if (Array.isArray(data.results)) {
  data.results.forEach(r => {
    // input testlar uchun
    const input = document.querySelector(`[name="q_${r.question_id}"]`);
    if (input) {
      if (r.is_correct) {
        input.style.border = "2px solid green";
        input.style.background = "#e6ffe6";
      } else {
        input.style.border = "2px solid red";
        input.style.background = "#ffe6e6";
      }
    }

    // multiple-choice testlar uchun
    const options = document.querySelectorAll(`input[name="q_${r.question_id}"]`);
    options.forEach(opt => {
      if (opt.value === r.correct_option) {
        opt.parentElement.style.color = "green";
        opt.parentElement.style.fontWeight = "bold";
      } else if (opt.checked) {
        opt.parentElement.style.color = "red";
      }
    });
  });
}

    await loadListeningList();
  } catch (e) {
    console.error(e);
    if (resultEl) resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

/* ================= VOCABULARY MODULE ================= */
async function openVocabularyModule() {
  await showPage(pages.vocabulary, "block");
  
  // Mobil uchun: har gal kirganda o'ng tomonni yashirib qo'yish (tozalash)
  const rightSide = document.querySelector('#vocabularyPage .reading-right');
  if (rightSide) {
    rightSide.classList.remove('active');
  }

  await loadVocabularyList();
}

async function loadVocabularyList() {
  const listEl = document.getElementById("vocabularyList");
  const titleEl = document.getElementById("vocabularyTitle");
  const bodyEl = document.getElementById("vocabularyBody");

  if (!listEl || !titleEl || !bodyEl) {
    console.warn("vocabularyPage elementlari topilmadi.");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    listEl.innerHTML = `<li>Avval login qiling 🔑</li>`;
    titleEl.textContent = "Login required";
    bodyEl.innerHTML = `<p>Vocabulary lessonlarni ko‘rish uchun login qiling.</p>`;
    return;
  }

  listEl.innerHTML = `<li>Loading...</li>`;
  titleEl.textContent = "Select a lesson";
  bodyEl.innerHTML = `<p>Chapdan vocabulary lesson tanlang.</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/materials?module=vocabulary`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => []);
    if (!res.ok) {
      listEl.innerHTML = `<li>Xatolik: ${data.message || "Failed"}</li>`;
      return;
    }

    const items = Array.isArray(data) ? data : [];
    if (!items.length) {
      listEl.innerHTML = `<li>Vocabulary lessonlar hali yo‘q</li>`;
      return;
    }

    listEl.innerHTML = "";

    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.order_no || item.id}. ${item.title}`;
      li.style.cursor = "pointer";
      li.style.padding = "10px 12px";
      li.style.borderRadius = "10px";
      li.style.background = "#ffffff10";
      li.style.transition = "0.2s ease";

      li.addEventListener("click", async () => {
        listEl.querySelectorAll("li").forEach((x) => {
          x.style.background = "#ffffff10";
          x.style.fontWeight = "500";
        });

        li.style.background = "rgba(255,255,255,0.55)";
        li.style.fontWeight = "800";

        // Darsni ochish
        await openVocabularyLesson(item.id);
      });

      li.addEventListener("mouseenter", () => {
        if (li.style.fontWeight !== "800") {
          li.style.background = "#ffffff22";
        }
      });

      li.addEventListener("mouseleave", () => {
        if (li.style.fontWeight !== "800") {
          li.style.background = "#ffffff10";
        }
      });

      listEl.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<li>Server error</li>`;
  }
}

async function openVocabularyLesson(materialId) {
  const titleEl = document.getElementById("vocabularyTitle");
  const bodyEl = document.getElementById("vocabularyBody");
  const rightSide = document.querySelector('#vocabularyPage .reading-right');

  // --- MOBIL UCHUN: O'ng tomonni ko'rsatish ---
  if (rightSide) {
    rightSide.classList.add('active');
  }

  if (!titleEl || !bodyEl) return;

  titleEl.textContent = "Loading lesson...";
  bodyEl.innerHTML = `<p>Loading...</p>`;

  try {
    const res = await fetch(`${API_BASE}/api/materials/${materialId}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      bodyEl.innerHTML = `<p>${data.message || "Failed to load"}</p>`;
      return;
    }

    const material = data.material || {};
    titleEl.textContent = material.title || "Vocabulary Lesson";

    let lessonContent = material.content || "Content yo‘q";

    try {
      const obj = typeof lessonContent === "string" ? JSON.parse(lessonContent) : lessonContent;
      if (obj && obj.words) {
        lessonContent = `
          <div style="display:grid;gap:14px;">
            ${obj.words.map((w, i) => `
              <div style="
                background: rgba(255,255,255,0.78);
                border: 1px solid rgba(15,23,42,0.08);
                padding: 16px;
                border-radius: 16px;
                box-shadow: 0 6px 18px rgba(0,0,0,0.06);
                color: #173d35;
               ">
                <h4 style="margin:0 0 10px 0;font-size:24px;font-weight:800;">
                 ${i + 1}. ${w.word || "-"}
                </h4>
                <p style="margin:6px 0;font-size:18px;line-height:1.6;">
                 <b>Meaning:</b> ${w.meaning || "-"}
                </p>
                <p style="margin:6px 0;font-size:17px;line-height:1.6;">
                 <b>Example:</b> ${w.example || "-"}
                </p>
              </div>
            `).join("")}
          </div>
        `;
      } else {
        lessonContent = `<p style="line-height:1.7;">${String(material.content || "").replace(/\n/g, "<br>")}</p>`;
      }
    } catch (_) {
      lessonContent = `<p style="line-height:1.7;">${String(material.content || "").replace(/\n/g, "<br>")}</p>`;
    }

    bodyEl.innerHTML = `
      <div style="background:#ffffff14;padding:14px;border-radius:12px;">
        <div style="background:rgba(255,255,255,0.75);padding:12px 14px;border-radius:12px;margin-bottom:14px;color:#173d35;">
          <b>How to use this lesson:</b>
          <p style="margin:8px 0 0 0;">
           Avval so‘zlarni o‘qing, meaning va examplelarni tushunib chiqing. So‘ng quizni ishlang.
          </p>
        </div>
        ${lessonContent}
        <div style="margin-top:16px;">
          <button
            onclick="startVocabularyQuiz(${materialId})"
            style="padding:12px 18px;border:none;border-radius:12px;background:blueviolet;color:#fff;font-weight:700;cursor:pointer;width:100%;">
            Start Quiz
          </button>
        </div>
        <div id="vocabularyQuizBox" style="margin-top:16px;"></div>
      </div>
    `;

    // --- MOBIL UCHUN: Ekranni test qismiga surish ---
    if (window.innerWidth <= 768 && rightSide) {
      rightSide.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (e) {
    console.error(e);
    bodyEl.innerHTML = `<p>Server error</p>`;
  }
}

async function startVocabularyQuiz(materialId) {
  const quizBox = document.getElementById("vocabularyQuizBox");
  if (!quizBox) return;

  quizBox.innerHTML = "<p>Loading quiz...</p>";

  try {
    const res = await fetch(`${API_BASE}/api/vocabulary/${materialId}/questions`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      quizBox.innerHTML = `<p style="color:crimson;">${data.message || "Quiz yuklanmadi"}</p>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      quizBox.innerHTML = `<p>Bu lesson uchun quiz hali qo‘shilmagan.</p>`;
      return;
    }

    let html = `
      <form id="vocabularyQuizForm">
        <h3 style="margin:0 0 12px 0;">Vocabulary Quiz</h3>
    `;

    items.forEach((q, idx) => {
      html += `
        <div style="background:rgba(255,255,255,0.78);padding:14px;border-radius:14px;margin-bottom:12px;color:#173d35;">
          <b>${idx + 1}) ${q.question_text}</b>
          <div style="display:grid;gap:8px;margin-top:10px;">
            ${["A", "B", "C", "D"].map((k) => `
              <label style="display:flex;gap:8px;align-items:center;">
                <input type="radio" name="vq_${q.id}" value="${k}">
                <span>${k}) ${q["option_" + k.toLowerCase()]}</span>
              </label>
            `).join("")}
          </div>
        </div>
      `;
    });

    html += `
        <button type="submit" style="padding:12px 18px;border:none;border-radius:12px;background:#198754;color:#fff;font-weight:700;cursor:pointer;width:100%;">
          Submit Quiz
        </button>
        <div id="vocabularyQuizResult" style="margin-top:14px;"></div>
      </form>
    `;

    quizBox.innerHTML = html;

    const form = document.getElementById("vocabularyQuizForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const answers = items.map((q) => {
        const value = form.querySelector(`input[name="vq_${q.id}"]:checked`)?.value || "";
        return { question_id: q.id, answer: value };
      });
      await submitVocabularyQuiz(materialId, answers);
    });
  } catch (e) {
    console.error(e);
    quizBox.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

async function submitVocabularyQuiz(materialId, answers) {
  const resultEl = document.getElementById("vocabularyQuizResult");
  if (resultEl) resultEl.innerHTML = "Submitting...";

  try {
    const res = await fetch(`${API_BASE}/api/vocabulary/${materialId}/submit`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ answers })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (resultEl) resultEl.innerHTML = `<p style="color:crimson;">${data.message || "Submit error"}</p>`;
      return;
    }

    if (resultEl) {
      resultEl.innerHTML = `
        <div style="background:#ffffffcc;padding:14px;border-radius:14px;color:#173d35;border:1px solid rgba(15,23,42,.08);">
         <p style="margin:0 0 8px 0;font-weight:800;">Natija: ${data.score}% ${data.passed ? "✅" : "🔒"}</p>
         <p style="margin:0;">✅ To‘g‘ri: <b>${data.correct_count}</b> / ${data.total_count}</p>
         <p style="margin:6px 0 0 0;">❌ Xato: <b>${data.wrong_count}</b></p>
         ${data.next_unlocked ? `<p style="margin:8px 0 0 0;color:green;font-weight:700;">✅ Keyingi lesson ochildi!</p>` : ""}
        </div>
      `;
    }
  } catch (e) {
    console.error(e);
    if (resultEl) resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

/* ================= WRITING MODULE ================= */

let CURRENT_WRITING_TASK_ID = null;

function countWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

async function openWritingModule() {
  await showPage(pages.writing, "block");
  await loadWritingTasks();
  await loadMyWritingSubmissions();
  bindWritingWordCounter();
}

function bindWritingWordCounter() {
  const textarea = document.getElementById("writingEssay");
  const counter = document.getElementById("writingWordCount");

  if (!textarea || !counter) return;

  if (textarea.dataset.bound === "1") return;
  textarea.dataset.bound = "1";

  textarea.addEventListener("input", () => {
    counter.textContent = `Words: ${countWords(textarea.value)}`;
  });
}

async function loadWritingTasks() {
  const listEl = document.getElementById("writingTaskList");
  if (!listEl) return;

  listEl.innerHTML = "<p style='color: white;'>Loading tasks...</p>";

  try {
    const res = await fetch(`${API_BASE}/api/writing/tasks`, {
      headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    });

    const data = await res.json();
    const items = data.items || data; 

    if (!items || items.length === 0) {
      listEl.innerHTML = "<p style='color: white;'>No tasks found.</p>";
      return;
    }

    listEl.innerHTML = ""; 

    items.forEach((item, index) => {
      const card = document.createElement("div");
      
      // Ixchamroq kartochka stili
      card.style.cssText = `
        background: #FDFCF5;
        border-radius: 12px;
        padding: 15px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid rgba(0,0,0,0.03);
      `;

      card.onmouseover = () => {
        card.style.transform = "translateY(-3px)";
        card.style.boxShadow = "0 5px 12px rgba(0,0,0,0.1)";
      };
      card.onmouseout = () => {
        card.style.transform = "translateY(0)";
        card.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
      };

      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
             <span style="background: #E8F5E9; color: #2E7D32; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">
                ${(item.task_type || 'task').toUpperCase()}
             </span>
             <small style="color: #bbb; font-size: 10px;">#${index + 1}</small>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #1a4d3a; font-size: 15px; line-height: 1.2;">
            ${item.title}
          </h4>
          <p style="color: #777; font-size: 12px; margin-bottom: 12px;">
             ⏱ ${item.time_limit}m • 📝 ${item.min_words}w
          </p>
        </div>
        <button style="
          background: #D7A97A; 
          color: white; 
          border: none; 
          padding: 8px; 
          border-radius: 8px; 
          width: 100%; 
          cursor: pointer; 
          font-weight: bold; 
          font-size: 13px;
        ">
          Start
        </button>
      `;

      card.onclick = () => {
        window.location.href = `writingtest.html?id=${item.id}`;
      };

      listEl.appendChild(card);
    });

  } catch (err) {
    console.error("Error:", err);
    listEl.innerHTML = "<p style='color: #ff6b6b;'>Server error.</p>";
  }
}

async function submitWritingEssay() {
  const resultEl = document.getElementById("writingSubmitResult");
  const essayEl = document.getElementById("writingEssay");

  if (!resultEl || !essayEl) return;

  if (!CURRENT_WRITING_TASK_ID) {
    alert("Avval writing task tanlang.");
    return;
  }

  const essayText = essayEl.value.trim();
  if (!essayText) {
    alert("Essay yozing.");
    return;
  }

  resultEl.innerHTML = "Submitting...";

  try {
    const res = await fetch(`${API_BASE}/api/writing/submit`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        task_id: CURRENT_WRITING_TASK_ID,
        essay_text: essayText
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      resultEl.innerHTML = `<p style="color:crimson;">${data.message || "Submit error"}</p>`;
      return;
    }

    resultEl.innerHTML = `
      <div style="background:#ffffffcc;padding:14px;border-radius:14px;color:#173d35;border:1px solid rgba(15,23,42,.08);">
        <p style="margin:0 0 8px 0;font-weight:800;">✅ Essay yuborildi</p>
        <p style="margin:0;">Word count: <b>${data.word_count || 0}</b></p>
        <p style="margin:6px 0 0 0;">Status: <b>${data.status || "submitted"}</b></p>
      </div>
    `;

    essayEl.value = "";
    const counterEl = document.getElementById("writingWordCount");
    if (counterEl) counterEl.textContent = "Words: 0";

    await loadMyWritingSubmissions();
  } catch (e) {
    console.error(e);
    resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

async function loadMyWritingSubmissions() {
  const box = document.getElementById("myWritingSubmissions");
  if (!box) return;

  box.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${API_BASE}/api/writing/my-submissions`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      box.innerHTML = `<p style="color:crimson;">${data.message || "Failed"}</p>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      box.innerHTML = `<p>Hozircha writing submission yo‘q.</p>`;
      return;
    }

    let html = `
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;background:#ffffff10;border-radius:12px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Task</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Type</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Words</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Status</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Date</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach((it) => {
      html += `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.title || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.task_type || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.word_count || 0}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.status || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.submitted_at ? new Date(it.submitted_at).toLocaleString() : "-"}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    box.innerHTML = html;
  } catch (e) {
    console.error(e);
    box.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}


/* ================= SPEAKING MODULE ================= */

let CURRENT_SPEAKING_TASK_ID = null;
let speakingMediaRecorder = null;
let speakingChunks = [];
let speakingAudioBlob = null;
let speakingAudioUrl = "";
let speakingStream = null;
let speakingTimerInterval = null;
let speakingDurationSeconds = 0;

async function openSpeakingModule() {
  await showPage(pages.speaking, "block");
  resetSpeakingRecorderUI();
  await loadSpeakingTasks();
  await loadMySpeakingSubmissions();
}

function resetSpeakingRecorderUI() {
  speakingChunks = [];
  speakingAudioBlob = null;
  speakingAudioUrl = "";
  speakingDurationSeconds = 0;

  if (speakingTimerInterval) {
    clearInterval(speakingTimerInterval);
    speakingTimerInterval = null;
  }

  const statusEl = document.getElementById("speakingRecordingStatus");
  const timerEl = document.getElementById("speakingTimer");
  const previewEl = document.getElementById("speakingAudioPreviewWrap");
  const startBtn = document.getElementById("startSpeakingBtn");
  const stopBtn = document.getElementById("stopSpeakingBtn");
  const submitBtn = document.getElementById("submitSpeakingBtn");

  if (statusEl) statusEl.textContent = "Status: Ready";
  if (timerEl) timerEl.textContent = "Duration: 0 sec";
  if (previewEl) previewEl.innerHTML = "";
  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
  if (submitBtn) submitBtn.disabled = true;
}

async function loadSpeakingTasks() {
  const listEl = document.getElementById("speakingTaskList");
  const titleEl = document.getElementById("speakingTaskTitle");
  const metaEl = document.getElementById("speakingTaskMeta");
  const promptEl = document.getElementById("speakingTaskPrompt");
  const cueEl = document.getElementById("speakingCuePoints");
  const resultEl = document.getElementById("speakingSubmitResult");

  if (!listEl || !titleEl || !metaEl || !promptEl || !cueEl || !resultEl) {
    console.warn("speakingPage elementlari topilmadi.");
    return;
  }

  listEl.innerHTML = `<li>Loading...</li>`;
  titleEl.textContent = "Select a task";
  metaEl.innerHTML = "";
  promptEl.innerHTML = `<p>Chapdan speaking task tanlang.</p>`;
  cueEl.innerHTML = "";
  resultEl.innerHTML = "";
  CURRENT_SPEAKING_TASK_ID = null;

  try {
    const res = await fetch(`${API_BASE}/api/speaking/tasks`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      listEl.innerHTML = `<li>${data.message || "Failed"}</li>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      listEl.innerHTML = `<li>Speaking tasklar hali yo‘q</li>`;
      return;
    }

    listEl.innerHTML = "";

    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = `${item.id}. ${item.title}`;
      li.style.cursor = "pointer";
      li.style.padding = "10px 12px";
      li.style.borderRadius = "10px";
      li.style.background = "#ffffff10";
      li.style.transition = "0.2s ease";

      li.addEventListener("click", async () => {
        listEl.querySelectorAll("li").forEach((x) => {
          x.style.background = "#ffffff10";
          x.style.fontWeight = "500";
        });

        li.style.background = "rgba(255,255,255,0.55)";
        li.style.fontWeight = "800";

        await openSpeakingTask(item.id);
      });

      li.addEventListener("mouseenter", () => {
        if (li.style.fontWeight !== "800") {
          li.style.background = "#ffffff22";
        }
      });

      li.addEventListener("mouseleave", () => {
        if (li.style.fontWeight !== "800") {
          li.style.background = "#ffffff10";
        }
      });

      listEl.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<li>Server error</li>`;
  }
}

async function openSpeakingTask(taskId) {
  const titleEl = document.getElementById("speakingTaskTitle");
  const metaEl = document.getElementById("speakingTaskMeta");
  const promptEl = document.getElementById("speakingTaskPrompt");
  const cueEl = document.getElementById("speakingCuePoints");
  const resultEl = document.getElementById("speakingSubmitResult");

  if (!titleEl || !metaEl || !promptEl || !cueEl || !resultEl) return;

  titleEl.textContent = "Loading task...";
  metaEl.innerHTML = "";
  promptEl.innerHTML = `<p>Loading...</p>`;
  cueEl.innerHTML = "";
  resultEl.innerHTML = "";

  resetSpeakingRecorderUI();

  try {
    const res = await fetch(`${API_BASE}/api/speaking/tasks/${taskId}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      titleEl.textContent = "Error";
      promptEl.innerHTML = `<p>${data.message || "Failed to load"}</p>`;
      return;
    }

    const task = data.task || {};
    CURRENT_SPEAKING_TASK_ID = task.id;

    titleEl.textContent = task.title || "Speaking Task";

    metaEl.innerHTML = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <span style="background:#ffffff22;padding:6px 10px;border-radius:999px;">Type: ${task.task_type || "-"}</span>
        <span style="background:#ffffff22;padding:6px 10px;border-radius:999px;">Prep: ${task.prep_time || 0} min</span>
        <span style="background:#ffffff22;padding:6px 10px;border-radius:999px;">Speak: ${task.speak_time || 0} min</span>
      </div>
    `;

    promptEl.innerHTML = `
      <div style="background:rgba(255,255,255,0.75);padding:12px 14px;border-radius:12px;color:#173d35;line-height:1.7;">
        ${String(task.prompt || "").replace(/\n/g, "<br>")}
      </div>
    `;

    if (task.cue_points) {
      const cueLines = String(task.cue_points)
        .split("\n")
        .filter(Boolean)
        .map((line) => `<li>${line}</li>`)
        .join("");

      cueEl.innerHTML = `
        <div style="background:rgba(255,255,255,0.65);padding:12px 14px;border-radius:12px;color:#173d35;">
          <b>Cue points:</b>
          <ul style="margin:8px 0 0 18px;">
            ${cueLines}
          </ul>
        </div>
      `;
    }
  } catch (e) {
    console.error(e);
    titleEl.textContent = "Server error";
    promptEl.innerHTML = `<p>Server error</p>`;
  }
}

async function startSpeakingRecording() {
  if (!CURRENT_SPEAKING_TASK_ID) {
    alert("Avval speaking task tanlang.");
    return;
  }

  const statusEl = document.getElementById("speakingRecordingStatus");
  const timerEl = document.getElementById("speakingTimer");
  const startBtn = document.getElementById("startSpeakingBtn");
  const stopBtn = document.getElementById("stopSpeakingBtn");
  const submitBtn = document.getElementById("submitSpeakingBtn");

  try {
    speakingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    speakingChunks = [];
    speakingAudioBlob = null;
    speakingDurationSeconds = 0;

    speakingMediaRecorder = new MediaRecorder(speakingStream);

    speakingMediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        speakingChunks.push(event.data);
      }
    };

    speakingMediaRecorder.onstop = () => {
      speakingAudioBlob = new Blob(speakingChunks, {
        type: speakingChunks[0]?.type || "audio/webm"
      });

      if (speakingAudioUrl) {
        URL.revokeObjectURL(speakingAudioUrl);
      }

      speakingAudioUrl = URL.createObjectURL(speakingAudioBlob);

      const previewEl = document.getElementById("speakingAudioPreviewWrap");
      if (previewEl) {
        previewEl.innerHTML = `
          <div style="background:#ffffffcc;padding:14px;border-radius:14px;color:#173d35;border:1px solid rgba(15,23,42,.08);">
            <p style="margin:0 0 10px 0;font-weight:800;">Audio Preview</p>
            <audio controls style="width:100%;">
              <source src="${speakingAudioUrl}">
            </audio>
          </div>
        `;
      }

      if (statusEl) statusEl.textContent = "Status: Recorded";
      if (startBtn) startBtn.disabled = false;
      if (stopBtn) stopBtn.disabled = true;
      if (submitBtn) submitBtn.disabled = false;
    };

    speakingMediaRecorder.start();

    if (statusEl) statusEl.textContent = "Status: Recording...";
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    if (submitBtn) submitBtn.disabled = true;

    if (speakingTimerInterval) clearInterval(speakingTimerInterval);
    speakingTimerInterval = setInterval(() => {
      speakingDurationSeconds += 1;
      if (timerEl) timerEl.textContent = `Duration: ${speakingDurationSeconds} sec`;
    }, 1000);
  } catch (e) {
    console.error(e);
    alert("Mikrofonga ruxsat berilmadi yoki recording ishlamadi.");
  }
}

function stopSpeakingRecording() {
  if (speakingMediaRecorder && speakingMediaRecorder.state !== "inactive") {
    speakingMediaRecorder.stop();
  }

  if (speakingStream) {
    speakingStream.getTracks().forEach((track) => track.stop());
  }

  if (speakingTimerInterval) {
    clearInterval(speakingTimerInterval);
    speakingTimerInterval = null;
  }
}

async function submitSpeakingRecording() {
  const resultEl = document.getElementById("speakingSubmitResult");
  if (!resultEl) return;

  if (!CURRENT_SPEAKING_TASK_ID) {
    alert("Avval speaking task tanlang.");
    return;
  }

  if (!speakingAudioBlob) {
    alert("Avval audio yozib oling.");
    return;
  }

  resultEl.innerHTML = "Uploading...";

  try {
    const formData = new FormData();

    const ext = speakingAudioBlob.type.includes("mp4") ? "m4a" : "webm";
    const file = new File([speakingAudioBlob], `speaking_record.${ext}`, {
      type: speakingAudioBlob.type || "audio/webm"
    });

    formData.append("audio", file);
    formData.append("task_id", String(CURRENT_SPEAKING_TASK_ID));
    formData.append("duration_seconds", String(speakingDurationSeconds));

    const res = await fetch(`${API_BASE}/api/speaking/submit-audio`, {
      method: "POST",
      headers: {
        ...getAuthHeaders()
      },
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      resultEl.innerHTML = `<p style="color:crimson;">${data.message || "Upload error"}</p>`;
      return;
    }

    resultEl.innerHTML = `
      <div style="background:#ffffffcc;padding:14px;border-radius:14px;color:#173d35;border:1px solid rgba(15,23,42,.08);">
        <p style="margin:0 0 8px 0;font-weight:800;">✅ Speaking audio yuborildi</p>
        <p style="margin:0;">Status: <b>${data.status || "submitted"}</b></p>
      </div>
    `;

    resetSpeakingRecorderUI();
    await loadMySpeakingSubmissions();
  } catch (e) {
    console.error(e);
    resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

async function loadMySpeakingSubmissions() {
  const box = document.getElementById("mySpeakingSubmissions");
  if (!box) return;

  box.innerHTML = "<p>Loading...</p>";

  try {
    const res = await fetch(`${API_BASE}/api/speaking/my-submissions`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      box.innerHTML = `<p style="color:crimson;">${data.message || "Failed"}</p>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      box.innerHTML = `<p>Hozircha speaking submission yo‘q.</p>`;
      return;
    }

    let html = `
      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;background:#ffffff10;border-radius:12px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Task</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Type</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Audio</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Duration</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Status</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Date</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach((it) => {
      html += `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.title || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.task_type || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">
            ${it.audio_url ? `<audio controls style="max-width:220px;"><source src="${it.audio_url}"></audio>` : "-"}
          </td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.duration_seconds || 0} sec</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.status || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${it.submitted_at ? new Date(it.submitted_at).toLocaleString() : "-"}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    box.innerHTML = html;
  } catch (e) {
    console.error(e);
    box.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}
/* ================= READING MODULE ================= */
async function openReadingModule() {
  await showPage(pages.reading, "block");
  loadReadingList();
}

let allReadingMaterials = []; // Testlarni saqlab turish uchun

async function loadReadingList() {
    const listEl = document.getElementById("readingTestList");
    listEl.innerHTML = "Loading...";

    try {
        const res = await fetch(`${API_BASE}/api/modules/reading/list`, {
            headers: getAuthHeaders()
        });

        const data = await res.json();
        allReadingMaterials = data.items || [];
        
        // Filtr raqamlarini yangilash
        updateFilterCounts();
        // Testlarni ekranga chiqarish
        renderTests(allReadingMaterials);

    } catch (err) {
        listEl.innerHTML = "Error loading tests";
    }
}

function updateFilterCounts() {
    document.getElementById('count-all').textContent = allReadingMaterials.length;
    // Premium/Free maydoni API-da qanday nomlanishiga qarab o'zgartiring (masalan: it.is_premium)
    const freeCount = allReadingMaterials.filter(it => !it.is_premium).length;
    const premiumCount = allReadingMaterials.filter(it => it.is_premium).length;
    
    document.getElementById('count-free').textContent = freeCount;
    document.getElementById('count-premium').textContent = premiumCount;
}

function renderTests(items) {
    const listEl = document.getElementById("readingTestList");
    listEl.innerHTML = "";

    items.forEach(it => {
        const card = document.createElement("div");
        card.className = "reading-card";
        
        card.innerHTML = `
            <div>
                <div class="badge-free">✓ ${it.is_premium ? 'Premium' : 'Free'}</div>
                <h3 class="card-title">${it.title}</h3>
            </div>
            <button class="start-btn-blue" onclick="window.location.href='readingtest.html?id=${it.id}'">
                <span>▶</span> Start
            </button>
        `;
        listEl.appendChild(card);
    });
}

function changeFilter(type) {
    // Tugmalarni aktiv qilish
    document.querySelectorAll('.filter-item').forEach(btn => btn.classList.remove('active'));
    event.currentTarget.classList.add('active');

    // Filtrlash
    let filtered = [];
    if (type === 'all') {
        filtered = allReadingMaterials;
        document.getElementById('currentFilterTitle').textContent = "🟦 All Reading Tests";
    } else if (type === 'free') {
        filtered = allReadingMaterials.filter(it => !it.is_premium);
        document.getElementById('currentFilterTitle').textContent = "🟩 Free Reading Tests";
    } else if (type === 'premium') {
        filtered = allReadingMaterials.filter(it => it.is_premium);
        document.getElementById('currentFilterTitle').textContent = "🟨 Premium Reading Tests";
    }
    
    renderTests(filtered);
}
function renderTests(items) {
    const listEl = document.getElementById("readingTestList");
    listEl.innerHTML = "";

    items.forEach(it => {
        const card = document.createElement("div");
        card.className = "reading-card"; // Yuqoridagi CSS klassi
        
        card.innerHTML = `
            <div>
                <div class="badge-free">✓ ${it.is_premium ? 'Premium' : 'Free'}</div>
                <h3 class="card-title">${it.title}</h3>
            </div>
            <button class="start-btn-blue">
                <span>▶</span> Start
            </button>
        `;
        
        // Kartochkani butunlay bosiladigan qilish
        card.onclick = () => {
            window.location.href = `readingtest.html?id=${it.id}`;
        };
        
        listEl.appendChild(card);
    });
}

async function submitReading(materialId, answers) {
  const resultEl = document.getElementById("readingResult");
  if (resultEl) resultEl.innerHTML = "Submitting...";

  try {
    const res = await fetch(`${API_BASE}/api/attempts/submit`, {
      method: "POST",
      headers: {
        ...getAuthHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ material_id: materialId, answers })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (resultEl) {
        resultEl.innerHTML = `<p style="color:crimson;">${data.message || "Submit error"}</p>`;
      }
      return;
    }

    const correct = Number(data.correct_count || 0);
    const total = Number(data.total_count || 0);
    const wrong = Math.max(total - correct, 0);
    const score = Number(data.score || 0);
    const passed = !!data.passed;
    const unlockedNext = !!data.next_unlocked;

    if (resultEl) {
      resultEl.innerHTML = `
        <div style="background:#ffffffb3;border:1px solid rgba(15,23,42,.08);padding:12px;border-radius:14px;">
          <p style="margin:0 0 8px 0;font-weight:800;">
            Natija: <span style="color:${passed ? "green" : "orangered"}">${score}%</span>
            ${passed ? "✅" : "🔒"}
          </p>
          <p style="margin:0;">
            ✅ To‘g‘ri: <b>${correct}</b> / ${total}
            &nbsp; | &nbsp;
            ❌ Xato: <b>${wrong}</b>
          </p>
          ${unlockedNext ? `<p style="margin:8px 0 0 0;color:green;font-weight:700;">✅ Keyingi test ochildi!</p>` : ""}
        </div>
      `;
    }

    await loadReadingList();
  } catch (e) {
    console.error(e);
    if (resultEl) resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

/* ================= LEADERBOARD UI ================= */
async function openLeaderboard(module = "") {
  const titleEl = document.querySelector("#leaderboardPage h1");
  const bodyEl = document.getElementById("leaderboardBody");

  if (!titleEl || !bodyEl) return;

  titleEl.textContent = "Leaderboard";
  bodyEl.innerHTML = "Loading...";

  try {
    const qs = module ? `?module=${encodeURIComponent(module)}` : "";
    const res = await fetch(`${API_BASE}/api/leaderboard${qs}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      bodyEl.innerHTML = `<p style="color:crimson;">${data.message || "Failed"}</p>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      bodyEl.innerHTML = "<p>Leaderboard hozircha bo‘sh.</p>";
      return;
    }

    let html = `
      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <button onclick="openLeaderboard('reading')" style="padding:8px 12px;border-radius:10px;border:none;background:#ffffff22;color:#fff;">Reading</button>
        <button onclick="openLeaderboard('listening')" style="padding:8px 12px;border-radius:10px;border:none;background:#ffffff22;color:#fff;">Listening</button>
        <button onclick="openLeaderboard('')" style="padding:8px 12px;border-radius:10px;border:none;background:#ffffff22;color:#fff;">All</button>
      </div>

      <div style="overflow:auto;">
        <table style="width:100%;border-collapse:collapse;background:#ffffff14;border-radius:12px;">
          <thead>
            <tr>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">#</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">User</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Best</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Avg</th>
              <th style="text-align:left;padding:10px;border-bottom:1px solid #ffffff22;">Attempts</th>
            </tr>
          </thead>
          <tbody>
    `;

    items.forEach((u, i) => {
      html += `
        <tr>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${i + 1}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${u.username || "-"}</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${u.best_score}%</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${u.avg_score}%</td>
          <td style="padding:10px;border-bottom:1px solid #ffffff22;">${u.attempts_count}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    bodyEl.innerHTML = html;
  } catch (err) {
    console.error(err);
    bodyEl.innerHTML = "<p style='color:crimson;'>Error loading leaderboard</p>";
  }
}

/* ================= STUDENT RESULTS ================= */
async function openStudentResults() {
  await showPage(pages.studentResults, "block");

  const totalAttemptsEl = document.getElementById("totalAttempts");
  const bestScoreEl = document.getElementById("bestScore");
  const averageScoreEl = document.getElementById("averageScore");
  const totalCorrectEl = document.getElementById("totalCorrect");
  const accuracyEl = document.getElementById("accuracy");
  const currentRankEl = document.getElementById("currentRank");

  const recentAttemptsList = document.getElementById("recentAttemptsList");
  const studentRankingList = document.getElementById("studentRankingList");

  // ✅ Writing elements
  const writingTotalSubmissionsEl = document.getElementById("writingTotalSubmissions");
  const writingCheckedSubmissionsEl = document.getElementById("writingCheckedSubmissions");
  const writingPendingSubmissionsEl = document.getElementById("writingPendingSubmissions");
  const writingMaxWordsEl = document.getElementById("writingMaxWords");
  const writingAverageWordsEl = document.getElementById("writingAverageWords");
  const writingLastSubmittedEl = document.getElementById("writingLastSubmitted");
  const recentWritingList = document.getElementById("recentWritingList");

  if (recentAttemptsList) {
    recentAttemptsList.innerHTML = `<tr><td colspan="4">Loading...</td></tr>`;
  }

  if (studentRankingList) {
    studentRankingList.innerHTML = `<tr><td colspan="6">Loading...</td></tr>`;
  }

  if (recentWritingList) {
    recentWritingList.innerHTML = `<tr><td colspan="5">Loading...</td></tr>`;
  }

  try {
    const meRes = await fetch(`${API_BASE}/api/results/me`, {
      headers: getAuthHeaders()
    });

    const meData = await meRes.json().catch(() => ({}));

    if (!meRes.ok) {
      alert(meData.message || "Student resultsni yuklashda xatolik");
      return;
    }

    // ================= MAIN STATS =================
    if (totalAttemptsEl) totalAttemptsEl.textContent = meData.totalAttempts ?? 0;
    if (bestScoreEl) bestScoreEl.textContent = meData.bestScore ?? 0;
    if (averageScoreEl) averageScoreEl.textContent = meData.averageScore ?? 0;
    if (totalCorrectEl) totalCorrectEl.textContent = meData.totalCorrect ?? 0;
    if (accuracyEl) accuracyEl.textContent = `${meData.accuracy ?? 0}%`;
    if (currentRankEl) currentRankEl.textContent = meData.currentRank ? `#${meData.currentRank}` : "-";

    // ================= RECENT ATTEMPTS =================
    const attempts = Array.isArray(meData.recentAttempts) ? meData.recentAttempts : [];

    if (!attempts.length) {
      if (recentAttemptsList) {
        recentAttemptsList.innerHTML = `<tr><td colspan="4">No attempts yet</td></tr>`;
      }
    } else {
      let attemptsHtml = "";
      attempts.forEach((item) => {
        attemptsHtml += `
          <tr>
            <td>${item.material_id ?? "-"}</td>
            <td>${item.correct_count ?? 0} / ${item.total_count ?? 0}</td>
            <td>${item.score ?? 0}</td>
            <td>${item.created_at ? new Date(item.created_at).toLocaleString() : "-"}</td>
          </tr>
        `;
      });

      if (recentAttemptsList) {
        recentAttemptsList.innerHTML = attemptsHtml;
      }
    }

    // ================= WRITING STATS =================
    const writingStats = meData.writingStats || {};

    if (writingTotalSubmissionsEl) {
      writingTotalSubmissionsEl.textContent = writingStats.totalSubmissions ?? 0;
    }

    if (writingCheckedSubmissionsEl) {
      writingCheckedSubmissionsEl.textContent = writingStats.checkedSubmissions ?? 0;
    }

    if (writingPendingSubmissionsEl) {
      writingPendingSubmissionsEl.textContent = writingStats.pendingSubmissions ?? 0;
    }

    if (writingMaxWordsEl) {
      writingMaxWordsEl.textContent = writingStats.maxWords ?? 0;
    }

    if (writingAverageWordsEl) {
      writingAverageWordsEl.textContent = writingStats.averageWords ?? 0;
    }

    if (writingLastSubmittedEl) {
      writingLastSubmittedEl.textContent = writingStats.lastSubmittedAt
        ? new Date(writingStats.lastSubmittedAt).toLocaleString()
        : "-";
    }

    // ================= RECENT WRITING =================
    const recentWriting = Array.isArray(meData.recentWritingSubmissions)
      ? meData.recentWritingSubmissions
      : [];

    if (!recentWriting.length) {
      if (recentWritingList) {
        recentWritingList.innerHTML = `<tr><td colspan="5">No writing submissions yet</td></tr>`;
      }
    } else {
      let writingHtml = "";

      recentWriting.forEach((item) => {
        writingHtml += `
          <tr>
            <td>${item.title || "-"}</td>
            <td>${item.task_type || "-"}</td>
            <td>${item.word_count || 0}</td>
            <td>${item.status || "-"}</td>
            <td>${item.submitted_at ? new Date(item.submitted_at).toLocaleString() : "-"}</td>
          </tr>
        `;
      });

      if (recentWritingList) {
        recentWritingList.innerHTML = writingHtml;
      }
    }

    // ================= RANKING =================
    const rankingRes = await fetch(`${API_BASE}/api/results/leaderboard`, {
      headers: getAuthHeaders()
    });

    const rankingData = await rankingRes.json().catch(() => ({}));

    if (!rankingRes.ok) {
      if (studentRankingList) {
        studentRankingList.innerHTML = `<tr><td colspan="6">Failed to load ranking</td></tr>`;
      }
      return;
    }

    const items = Array.isArray(rankingData.items) ? rankingData.items : [];

    if (!items.length) {
      if (studentRankingList) {
        studentRankingList.innerHTML = `<tr><td colspan="6">No ranking data yet</td></tr>`;
      }
      return;
    }

    let rankingHtml = "";
    items.forEach((user) => {
      let badge = "-";
      if (Number(user.rankPosition) === 1) badge = "🥇 Top 1";
      else if (Number(user.rankPosition) === 2) badge = "🥈 Top 2";
      else if (Number(user.rankPosition) === 3) badge = "🥉 Top 3";

      rankingHtml += `
        <tr>
          <td>#${user.rankPosition}</td>
          <td>${user.username || "-"}</td>
          <td>${user.bestScore ?? 0}</td>
          <td>${user.averageScore ?? 0}</td>
          <td>${user.attemptsCount ?? 0}</td>
          <td>${badge}</td>
        </tr>
      `;
    });

    if (studentRankingList) {
      studentRankingList.innerHTML = rankingHtml;
    }
  } catch (error) {
    console.error("openStudentResults error:", error);

    if (recentAttemptsList) {
      recentAttemptsList.innerHTML = `<tr><td colspan="4">Server bilan bog‘lanib bo‘lmadi</td></tr>`;
    }

    if (studentRankingList) {
      studentRankingList.innerHTML = `<tr><td colspan="6">Server bilan bog‘lanib bo‘lmadi</td></tr>`;
    }

    if (recentWritingList) {
      recentWritingList.innerHTML = `<tr><td colspan="5">Server bilan bog‘lanib bo‘lmadi</td></tr>`;
    }
  }
}

/* ================= REVEAL OBSERVER ================= */
function initRevealObserver() {
  const items = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
  if (!items.length) return;

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("show");
        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -40px 0px"
  });

  items.forEach((item) => observer.observe(item));
}
// Sidebar menyusini boshqarish
const menuToggle = document.getElementById('menuToggle');
const sidebar = document.querySelector('.sidebar');

// Orqa fon uchun overlay yaratish (ixtiyoriy, lekin UX uchun zo'r)
const overlay = document.createElement('div');
overlay.className = 'sidebar-overlay';
document.body.appendChild(overlay);

menuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
});

overlay.addEventListener('click', () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
});

// Menyu ichidagi link bosilganda menyu yopilishi uchun
document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    });
});

window.addEventListener("load", initRevealObserver);

/* ================= GLOBAL EXPORTS ================= */
window.goRegister = goRegister;
window.goLogin = goLogin;
window.goMain = goMain;
window.login = login;
window.logout = logout;

window.verifyEmailCode = verifyEmailCode;
window.resendVerifyCode = resendVerifyCode;

window.choosePlan = choosePlan;
window.goDashboard = goDashboard;

window.openForgot = openForgot;
window.backToLogin = backToLogin;
window.sendResetCode = sendResetCode;
window.resetPassword = resetPassword;
window.sendReset = sendReset;

window.loginWithGoogle = loginWithGoogle;
window.loginWithApple = loginWithApple;

window.toggleAdminPanel = toggleAdminPanel;
window.goUpgrade = goUpgrade;

window.submitPaymentRequest = submitPaymentRequest;
window.copyText = copyText;

window.openReadingModule = openReadingModule;
window.openListeningModule = openListeningModule;
window.openLeaderboard = openLeaderboard;
window.openStudentResults = openStudentResults;
window.openVocabularyModule = openVocabularyModule;
window.startVocabularyQuiz = startVocabularyQuiz;
window.openWritingModule = openWritingModule;
window.submitWritingEssay = submitWritingEssay;
window.openSpeakingModule = openSpeakingModule;
window.startSpeakingRecording = startSpeakingRecording;
window.stopSpeakingRecording = stopSpeakingRecording;
window.submitSpeakingRecording = submitSpeakingRecording;
