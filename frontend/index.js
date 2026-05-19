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
const API_BASE = "https://auraielts.onrender.com";

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
// ✅ TOʻGʻRILANDI: Funksiya nomi tushunarli bo'lishi uchun register deb o'zgartirildi
async function register() {
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

    // Emailni verify sahifasidagi inputga avtomatik joylash
    const vEmail = document.getElementById("verifyEmail");
    if (vEmail) vEmail.value = email;

    // Tasdiqlash sahifasini ko'rsatish
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

    // Agar backend kod to'g'ri bo'lganda avtomatik token qaytarsa (Direct Login)
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

    // Aks holda login sahifasiga yo'naltirish
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
    if (data.step === "verify_required") {
      alert(data.message);
      
      const vEmail = document.getElementById("verifyEmail");
      if (vEmail) vEmail.value = data.email || email;

      await showPage(pages.verify); // Tasdiqlash (OTP) sahifasiga o'tkazish
      return; // Funksiyani shu yerda to'xtatamiz
    }

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
const PLAN_PRICES = { premium: "48 000 so‘m", pro: "72 000 so‘m" };
const PLAN_AMOUNTS = { premium: 48000, pro: 72000 };

const CARD_INFO = {
  number: "9860 1606 2061 2426",
  owner: "Sultonbek Jo'raboyev"
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

  listEl.innerHTML = "<p style='color: #1a4d3a;'>Loading tests...</p>";

  try {
    const res = await fetch(`${API_BASE}/api/writing/tasks`, {
      headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
    });

    const data = await res.json();
    // Backenddan GROUP BY qilingan items keladi
    const items = data.items || []; 

    if (items.length === 0) {
      listEl.innerHTML = "<p style='color: #1a4d3a;'>No tests found.</p>";
      return;
    }

    listEl.innerHTML = ""; 

    items.forEach((set) => {
      const card = document.createElement("div");
      
      card.style.cssText = `
        background: #FDFCF5;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid rgba(0,0,0,0.03);
      `;

      card.innerHTML = `
        <div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
             <span style="background: #E8F5E9; color: #2E7D32; padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: bold;">
                SET #${set.set_id}
             </span>
             <small style="color: #bbb; font-size: 10px;">Full Test</small>
          </div>
          <h4 style="margin: 0 0 8px 0; color: #1a4d3a; font-size: 16px; line-height: 1.2;">
            Writing Practice Test ${set.set_id}
          </h4>
          <p style="color: #777; font-size: 13px; margin-bottom: 12px;">
             ⏱ ${set.total_time} min total • 📝 ${set.total_tasks} Tasks
          </p>
        </div>
        <button onclick="startWriting(${set.set_id})" style="
          background: #D7A97A; 
          color: white; 
          border: none; 
          padding: 10px; 
          border-radius: 8px; 
          width: 100%; 
          cursor: pointer; 
          font-weight: bold; 
          font-size: 14px;
        ">
          Start Test
        </button>
      `;

      listEl.appendChild(card);
    });

  } catch (err) {
    console.error("Error:", err);
    listEl.innerHTML = "<p style='color: #ff6b6b;'>Server error.</p>";
  }
}

// Bu yangi funksiyani ham loadWritingTasks dan keyin qo'shib qo'ying
function startWriting(setId) {
    window.location.href = `writingtest.html?id=${setId}`;
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

    if (items.length === 0) {
        listEl.innerHTML = "<p>No tests found.</p>";
        return;
    }

    items.forEach(it => {
        const card = document.createElement("div");
        card.className = "test-card"; // CSS klassiga moslandi
        
        card.innerHTML = `
            <div class="badge">${it.is_premium ? 'Premium' : '✓ Free'}</div>
            <h3 class="test-title">${it.title}</h3>
            <button class="start-btn">
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
/* ================= FULL MOCK ENGINE (MOCK FLOW INTEGRATION) ================= */

let ACTIVE_MOCK_ID = null;

// 1. Full Mock tugmasi bosilganda sahifani yuklash va kartalar holatini bazadan yangilash
async function loadMockDashboard() {
  // Sahifani ko'rsatish (showPage funksiyangiz orqali)
  if (typeof showPage === "function" && pages.mock) {
    await showPage(pages.mock, "flex");
  } else {
    const mockEl = document.getElementById("mockPage");
    if (mockEl) {
      mockEl.style.display = "flex";
      mockEl.classList.add("active", "show");
    }
  }

  try {
    // Backenddan mock test ma'lumotlarini olamiz
    const res = await fetch(`${API_BASE}/api/mock-tests`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error("Mock API error");
    const data = await res.json();
    
    if (data.items && data.items.length > 0) {
      const activeMock = data.items[0];
      ACTIVE_MOCK_ID = activeMock.id;
      
      // HTML dagi kartalarni o'chirmasdan, ularning holatlarini (status) dinamik yangilaymiz
      updateMockCardsUI(activeMock.attempt);
    }
  } catch (err) {
    console.error("Mock dashboard ma'lumotlarini yuklashda xato:", err);
  }
}

// 2. HTML ichidagi tayyor kartalarni bazadan kelgan holatga qarab yangilovchi funksiya
function updateMockCardsUI(attempt) {
  const att = attempt || { current_section: 'listening' };

  // Har bir bo'limning holatini aniqlaymiz
  const listeningCompleted = att.listening_completed || att.current_section !== 'listening';
  const readingCompleted = att.reading_completed;
  const writingCompleted = att.writing_completed;
  const speakingCompleted = att.speaking_completed;

  // HTML ichidagi mock-cards-list konteynerini topamiz
  const cardsContainer = document.querySelector(".mock-cards-list");
  if (!cardsContainer) return;

  // Kartalarni oqim (Mock Flow) bo'yicha dinamik qayta yozamiz
  cardsContainer.innerHTML = `
    <div class="mock-test-card ${listeningCompleted ? 'completed' : 'active'}" onclick="openMockSection('listening')">
      <div class="mock-card-left">
        <div class="mock-icon listening-icon">🎧</div>
        <div class="mock-info">
          <h3>Listening</h3>
          <div class="mock-meta">
            ${listeningCompleted 
              ? '<span class="status success">✔ Completed</span>' 
              : '<span class="status warning">⚡ In Progress</span>'}
            <span class="duration">⏱ 30 minutes</span>
          </div>
        </div>
      </div>
      <button class="mock-arrow">›</button>
    </div>

    <div class="mock-test-card ${readingCompleted ? 'completed' : (!listeningCompleted ? 'locked' : 'active')}" 
         ${listeningCompleted ? 'onclick="openMockSection(\'reading\')"' : ''}>
      <div class="mock-card-left">
        <div class="mock-icon reading-icon">📖</div>
        <div class="mock-info">
          <h3>Reading</h3>
          <div class="mock-meta">
            ${readingCompleted 
              ? '<span class="status success">✔ Completed</span>' 
              : (!listeningCompleted 
                  ? '<span class="status locked-status">🔒 Complete Listening (75%)</span>' 
                  : '<span class="status warning">⚡ Ready to Start</span>')}
            <span class="duration">⏱ 60 minutes</span>
          </div>
        </div>
      </div>
      <button class="mock-arrow">›</button>
    </div>

    <div class="mock-test-card ${writingCompleted ? 'completed' : (!readingCompleted ? 'locked' : 'active')}" 
         ${readingCompleted ? 'onclick="openMockSection(\'writing\')"' : ''}>
      <div class="mock-card-left">
        <div class="mock-icon writing-icon">✍️</div>
        <div class="mock-info">
          <h3>Writing</h3>
          <div class="mock-meta">
            ${writingCompleted 
              ? '<span class="status success">✔ Completed</span>' 
              : (!readingCompleted 
                  ? '<span class="status locked-status">🔒 Complete Reading (75%)</span>' 
                  : '<span class="status warning">⚡ Ready to Start</span>')}
            <span class="duration">⏱ 60 minutes</span>
          </div>
        </div>
      </div>
      <button class="mock-arrow">›</button>
    </div>

    <div class="mock-test-card ${speakingCompleted ? 'completed' : (!writingCompleted ? 'locked' : 'active')}" 
         ${writingCompleted ? 'onclick="openMockSection(\'speaking\')"' : ''}>
      <div class="mock-card-left">
        <div class="mock-icon speaking-icon">🎤</div>
        <div class="mock-info">
          <h3>Speaking</h3>
          <div class="mock-meta">
            ${speakingCompleted 
              ? '<span class="status success">✔ Completed ✅</span>' 
              : (!writingCompleted 
                  ? '<span class="status locked-status">🔒 Complete Writing First</span>' 
                  : '<span class="status warning">⚡ Ready to Start</span>')}
            <span class="duration">⏱ 15 minutes</span>
          </div>
        </div>
      </div>
      <button class="mock-arrow">›</button>
    </div>
  `;
}

// 3. HTML ichidagi kartalar bosilganda ishlaydigan xavfsiz sahifaga yo'naltirish funksiyasi
async function openMockSection(sectionKey) {
  if (!ACTIVE_MOCK_ID) {
    alert("Faol imtihon seansi topilmadi.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/mock/start/${ACTIVE_MOCK_ID}`, { headers: getAuthHeaders() });
    const data = await res.json();
    
    if (!res.ok) {
      alert(data.message || "Kirish taqiqlangan.");
      return;
    }

    // Har bir bo'limni tegishli test oynasiga yo'naltirish
    if (sectionKey === 'listening') window.location.href = `/listeningtest.html?mock_id=${ACTIVE_MOCK_ID}`;
    else if (sectionKey === 'reading') window.location.href = `/readingtest.html?mock_id=${ACTIVE_MOCK_ID}`;
    else if (sectionKey === 'writing') window.location.href = `/writingtest.html?mock_id=${ACTIVE_MOCK_ID}`;
    else if (sectionKey === 'speaking') window.location.href = `/speakingtest.html?mock_id=${ACTIVE_MOCK_ID}`;
  } catch (e) {
    console.error(e);
    alert("Server bilan bog'lanishda xatolik.");
  }
}

// 4. BACK tugmasi bosilganda (goHome) dashboardga qaytaruvchi kafolatlangan mantiq
function goHome() {
  try {
    const mockPage = document.getElementById('mockPage');
    if (mockPage) {
      mockPage.style.display = 'none';
      mockPage.classList.remove('active', 'show');
    }

    // Dashboardni qayta ochish
    const dashboard = document.getElementById('dashboard') || document.getElementById('dashboardPage');
    if (typeof showPage === "function" && pages.dashboard) {
      showPage(pages.dashboard);
    } else if (dashboard) {
      dashboard.style.display = 'flex';
      dashboard.classList.add('active', 'show');
    } else {
      window.location.reload();
    }
  } catch (e) {
    console.error("Back tugmasida xato:", e);
    window.location.reload();
  }
}

// Global window obyektiga funksiyalarni eksport qilamiz (HTML tanishi uchun)
window.loadMockDashboard = loadMockDashboard;
window.openMockSection = openMockSection;
window.goHome = goHome;


/* ================= LEADERBOARD UI ================= */
async function openLeaderboard(module = "") {
  const top3El = document.getElementById("top3");
  const listEl = document.getElementById("leaderboardList");
  const tabs = document.querySelectorAll(".lb-tab");

  // ===== ACTIVE TAB =====
  tabs.forEach(tab => {
    const m = tab.getAttribute("onclick").match(/'([^']*)'/)[1];
    tab.classList.toggle("active", m === module);
  });

  // ===== LOADING =====
  top3El.innerHTML = "<p style='text-align:center;'>Loading...</p>";
  listEl.innerHTML = "";

  try {
    const qs = module ? `?module=${module}` : "";
    const res = await fetch(`${API_BASE}/api/leaderboard${qs}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json();
    const items = data.items || [];

    if (!items.length) {
      top3El.innerHTML = "<p>No data available</p>";
      return;
    }

    const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

    // ===== TOP 3 PODIUM =====
    const top = items.slice(0, 3);

    top3El.innerHTML = `
      <div class="top3-wrapper">
        
        <!-- 2-o‘rin -->
        ${top[1] ? `
          <div class="top-card rank-2">
            <div class="avatar">${top[1].username.charAt(0).toUpperCase()}</div>
            <h3>${top[1].username}</h3>
            <p>${top[1].best_score}%</p>
          </div>
        ` : ""}

        <!-- 1-o‘rin -->
        ${top[0] ? `
          <div class="top-card rank-1">
            <div class="avatar">${top[0].username.charAt(0).toUpperCase()}</div>
            <h3>${top[0].username}</h3>
            <p>${top[0].best_score}%</p>
          </div>
        ` : ""}

        <!-- 3-o‘rin -->
        ${top[2] ? `
          <div class="top-card rank-3">
            <div class="avatar">${top[2].username.charAt(0).toUpperCase()}</div>
            <h3>${top[2].username}</h3>
            <p>${top[2].best_score}%</p>
          </div>
        ` : ""}

      </div>
    `;

    // ===== STATS =====
    document.getElementById("totalUsers").textContent = items.length;
    document.getElementById("topScore").textContent = `${items[0].best_score}%`;
    document.getElementById("growthStat").textContent = "+23%"; // keyin dynamic qilamiz
    document.getElementById("bestStreak").textContent = "28";   // keyin dynamic qilamiz

    // ===== FULL LIST =====
    listEl.innerHTML = items.map((u, i) => {
      const isMe = u.username === currentUser.username;

      return `
        <div class="lb-row ${i === 0 ? 'first' : ''} ${isMe ? 'me' : ''}">
          
          <div class="left">
            <span class="rank">#${i + 1}</span>
            <div class="avatar small">${u.username.charAt(0).toUpperCase()}</div>

            <div>
              <h4>
                ${u.username}
                ${isMe ? '<span class="you">(You)</span>' : ''}
              </h4>
              <p>Attempts: ${u.attempts_count ?? 0}</p>
            </div>
          </div>

          <div class="right">
            <span class="score">${u.best_score ?? 0}%</span>
          </div>

        </div>
      `;
    }).join("");

    // ===== BAR CHART =====
    setTimeout(() => {
      const barCanvas = document.getElementById("barChart");
      if (barCanvas && window.Chart) {
        new Chart(barCanvas, {
          type: 'bar',
          data: {
            labels: items.slice(0, 5).map(u => u.username),
            datasets: [{
              label: 'Top Scores',
              data: items.slice(0, 5).map(u => u.best_score)
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    }, 300);

    // ===== RADAR CHART =====
    setTimeout(() => {
      const radarCanvas = document.getElementById("radarChart");
      if (radarCanvas && window.Chart) {
        new Chart(radarCanvas, {
          type: 'radar',
          data: {
            labels: ['Speed', 'Accuracy', 'Consistency', 'Streak', 'Practice'],
            datasets: [{
              data: [90, 85, 88, 80, 95]
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    }, 300);

  } catch (err) {
    console.error("Leaderboard error:", err);

    top3El.innerHTML = `
      <div style="text-align:center;">
        <p style="color:red;">⚠️ Error loading leaderboard</p>
        <button onclick="openLeaderboard('${module}')">Retry</button>
      </div>
    `;
  }
}

/* ================= STUDENT RESULTS ================= */
let dashboardCharts = {};
let studentResultsData = null;


/* ================= HELPERS ================= */

const toNum = (v) => {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
};


/* skill filter (robust) */
function getSkillAttempts(attempts, skill) {

    if (!Array.isArray(attempts)) return [];

    return attempts.filter(a => {

        const s = (
            a.skill ||
            a.type ||
            a.module ||
            ""
        ).toString().toLowerCase().trim();

        return s === skill.toLowerCase();
    });
}


/* ================= OPEN ================= */

async function openStudentResults() {

    await showPage(pages.studentResults, "block");

    await loadStudentResults();

    updateOverviewHeader();

    switchTab(
        'overview',
        document.querySelector('.tab-item.active')
    );

    clearInterval(window.resultsAutoRefresh);

    window.resultsAutoRefresh =
        setInterval(async () => {

            await loadStudentResults();

            updateOverviewHeader();

        }, 10000);
}


/* ================= LOAD ================= */

async function loadStudentResults() {

    try {

        const token = localStorage.getItem("token");

        const res = await fetch(
            "https://auraielts.onrender.com/api/results/me",
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await res.json();

        if (!data.success) throw new Error(data.message);

        studentResultsData = data;

    } catch (e) {

        console.error(e);

        studentResultsData = {
            stats: {
                totalAttempts: 0,
                bestScore: 0,
                averageScore: 0,
                accuracy: 0,
                currentRank: "-"
            },
            recentAttempts: [],
            writingStats: {}
        };
    }
}


/* ================= HEADER FIX ================= */

function updateOverviewHeader() {

    const stats = studentResultsData?.stats || {};

    const avg = toNum(stats.averageScore);
    const accuracy = toNum(stats.accuracy);

    const progress = Math.min(Math.round((avg / 9) * 100), 100);

    const overallEl = document.getElementById("overallBandScore");
    if (overallEl) {
        overallEl.innerHTML = `${avg.toFixed(1)} <span>/9.0</span>`;
    }

    const targetEl = document.getElementById("targetBand");
    if (targetEl) {
        targetEl.textContent = "🎯 Target: 8.0";
    }

    const progressEl = document.getElementById("progressPercent");
    if (progressEl) {
        progressEl.textContent = `${progress}%`;
    }

    const circle = document.getElementById("progressCircle");
    if (circle) {
        circle.style.background =
            `conic-gradient(#ffffff ${progress * 3.6}deg, rgba(255,255,255,0.15) 0deg)`;
    }
}


/* ================= SWITCH TAB ================= */

function switchTab(tab, btn) {

    document.querySelectorAll('.tab-item')
        .forEach(e => e.classList.remove('active'));

    if (btn) btn.classList.add('active');

    Object.values(dashboardCharts).forEach(c => c.destroy());
    dashboardCharts = {};

    const container = document.getElementById('dynamicTabContent');

    const stats = studentResultsData?.stats || {};
    const writing = studentResultsData?.writingStats || {};
    const attempts = studentResultsData?.recentAttempts || [];

    const skillAttempts = getSkillAttempts(attempts, tab);
    const scores = skillAttempts.map(a => toNum(a.score));

    const best = toNum(stats.bestScore);
    const avg = toNum(stats.averageScore);
    const acc = toNum(stats.accuracy);


    /* ================= OVERVIEW ================= */

    if (tab === 'overview') {

        const allScores = attempts.map(a => toNum(a.score));

        container.innerHTML = `
        <div class="stats-grid">

            <div class="stat-card reading">
                <span class="label">Best Score</span>
                <div class="val">${best.toFixed(1)}</div>
            </div>

            <div class="stat-card writing">
                <span class="label">Average Score</span>
                <div class="val">${avg.toFixed(1)}</div>
            </div>

            <div class="stat-card listening">
                <span class="label">Accuracy</span>
                <div class="val">${acc.toFixed(1)}%</div>
            </div>

            <div class="stat-card speaking">
                <span class="label">Rank</span>
                <div class="val">#${stats.currentRank || '-'}</div>
            </div>

            <div class="stat-card">
                <span class="label">Attempts</span>
                <div class="val">${stats.totalAttempts || 0}</div>
            </div>

        </div>

        <div class="charts-grid">
            <div class="chart-box">
                <h3>Skills Overview</h3>
                <div class="chart-wrapper">
                    <canvas id="radarChart"></canvas>
                </div>
            </div>

            <div class="chart-box">
                <h3>Progress</h3>
                <div class="chart-wrapper">
                    <canvas id="lineChart"></canvas>
                </div>
            </div>
        </div>
        `;

        requestAnimationFrame(() => {

            renderRadar(
                'radarChart',
                ['Best', 'Average', 'Accuracy', 'Rank', 'Attempts'],
                [
                    best / 10,
                    avg / 10,
                    acc / 10,
                    5,
                    Math.min(stats.totalAttempts || 0, 10)
                ]
            );

            renderLine(
                'lineChart',
                allScores.map((_, i) => `T${i + 1}`),
                allScores
            );
        });
    }


    /* ================= WRITING ================= */

    else if (tab === 'writing') {

        container.innerHTML = `
        <div class="stats-grid">

            <div class="stat-card">
                <span class="label">Essays</span>
                <div class="val">${writing.totalSubmissions || 0}</div>
            </div>

            <div class="stat-card">
                <span class="label">Avg Words</span>
                <div class="val">${writing.averageWords || 0}</div>
            </div>

            <div class="stat-card">
                <span class="label">Max Words</span>
                <div class="val">${writing.maxWords || 0}</div>
            </div>

        </div>

        <div class="charts-grid">
            <div class="chart-box">
                <h3>Writing</h3>
                <div class="chart-wrapper">
                    <canvas id="writingChart"></canvas>
                </div>
            </div>
        </div>
        `;

        requestAnimationFrame(() => {

            renderBar(
                'writingChart',
                ['Essays', 'Avg Words', 'Max Words'],
                [
                    writing.totalSubmissions || 0,
                    writing.averageWords || 0,
                    writing.maxWords || 0
                ],
                '#FF9F43'
            );
        });
    }


    /* ================= SKILLS ================= */

    else {

        const colors = {
            reading: "#4FACFE",
            listening: "#2ED47A",
            speaking: "#FF6B81",
            vocabulary: "#9B59B6"
        };

        container.innerHTML = `
        <div class="stats-grid">

            <div class="stat-card">
                <span class="label">Attempts</span>
                <div class="val">${scores.length}</div>
            </div>

            <div class="stat-card">
                <span class="label">Best</span>
                <div class="val">${scores.length ? Math.max(...scores) : 0}</div>
            </div>

            <div class="stat-card">
                <span class="label">Avg</span>
                <div class="val">
                    ${scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : 0}
                </div>
            </div>

        </div>

        <div class="charts-grid">
            <div class="chart-box">
                <h3>${tab}</h3>
                <div class="chart-wrapper">
                    <canvas id="${tab}Chart"></canvas>
                </div>
            </div>
        </div>
        `;

        requestAnimationFrame(() => {

            renderLine(
                `${tab}Chart`,
                scores.map((_, i) => `T${i + 1}`),
                scores,
                colors[tab] || "#6C5DD3"
            );
        });
    }
}


/* ================= CHARTS ================= */

function renderRadar(id, labels, data) {
    const ctx = document.getElementById(id);
    if (!ctx) return;

    dashboardCharts[id] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: 'rgba(108,93,211,0.2)',
                borderColor: '#6C5DD3'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { r: { min: 0, max: 10 } }
        }
    });
}


function renderLine(id, labels, data, color = '#6C5DD3') {

    const ctx = document.getElementById(id);
    if (!ctx) return;

    dashboardCharts[id] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data,
                borderColor: color,
                backgroundColor: color + '20',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}


function renderBar(id, labels, data, color) {

    const ctx = document.getElementById(id);
    if (!ctx) return;

    dashboardCharts[id] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: color
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
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
// Global window obyektiga funksiyalarni eksport qilamiz (HTML tanishi uchun)
window.loadMockDashboard = loadMockDashboard;
window.openMockSection = openMockSection;
window.goHome = goHome;