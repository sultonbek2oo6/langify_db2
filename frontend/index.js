/* ================= PAGE REFERENCES ================= */
const pages = {
  login: document.getElementById("loginPage"),
  register: document.getElementById("registerPage"),
  main: document.getElementById("mainPage"),
  payment: document.getElementById("paymentPage"), // ✅ NEW: payment page
  dashboard: document.getElementById("dashboard"),
  forgot: document.getElementById("forgotPage"),
  verify: document.getElementById("verifyPage"),
  listening: document.getElementById("listeningPage"),

  // ✅ NEW: Skeleton pages (index.html da shu idlar bo‘lishi kerak)
  vocabulary: document.getElementById("vocabularyPage"),
  reading: document.getElementById("readingPage"),
  writing: document.getElementById("writingPage"),
  speaking: document.getElementById("speakingPage"),
  band9: document.getElementById("band9Page"),
  mock: document.getElementById("mockPage")
};

/* ================= API BASE (NEW) ================= */
const API_BASE = "http://localhost:3000";

/* ================= GOOGLE VERIFY (NEW) ================= */
/**
 * Maqsad:
 * - User registerdan oldin Google orqali emailini tasdiqlaydi
 * - Backend /api/auth/google-verify ga ID token yuboriladi
 */
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

  // Google script yuklanmagan bo‘lsa
  if (!window.google?.accounts?.id) {
    setGoogleVerifyStatus(
      "Google script yuklanmadi. (gsi/client) qo‘shilganini tekshiring."
    );
    return;
  }

  // Client ID qo‘yilmagan bo‘lsa
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
    setGoogleVerifyStatus(
      "GOOGLE_CLIENT_ID qo‘yilmagan. index.js dagi GOOGLE_CLIENT_ID ni to‘ldiring."
    );
    return;
  }

  // qayta render bo‘lganda button ko‘payib ketmasin
  btnWrap.innerHTML = "";

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      GOOGLE_VERIFY.idToken = response?.credential || null;
      GOOGLE_VERIFY.verified = !!GOOGLE_VERIFY.idToken;
      GOOGLE_VERIFY.email = null; // emailni backend verify qaytaradi
      if (GOOGLE_VERIFY.idToken) {
        setGoogleVerifyStatus("✅ Google token olindi. Endi Register bosing.", true);
      } else {
        setGoogleVerifyStatus("❌ Google token olinmadi.");
      }
    }
  });

  // tugma chizish
  google.accounts.id.renderButton(btnWrap, {
    theme: "outline",
    size: "large",
    text: "continue_with"
  });

  setGoogleVerifyStatus("Google orqali emailni tasdiqlang (Verify).");
}

/* ================= ROLE HELPERS (NEW) ================= */
function getRole() {
  return localStorage.getItem("role") || "user";
}
function isAdminRole() {
  return getRole() === "admin";
}

/* ================= PLAN HELPERS (NEW) ================= */
const PLAN_RANK = { basic: 1, premium: 2, pro: 3 };

function getCurrentPlan() {
  return localStorage.getItem("plan") || "basic"; // basic/premium/pro
}

function getDaysLeft() {
  const exp = localStorage.getItem("expires_at");
  if (!exp) return null;

  const end = new Date(exp);
  const now = new Date();
  const diffMs = end - now;

  // agar muddat o'tib ketgan bo'lsa
  if (diffMs <= 0) return 0;

  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

/* ================= (NEW) SYNC PLAN FROM SERVER ================= */
async function syncPlanFromServer() {
  const token = localStorage.getItem("token");
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;

    // ✅ DB plan: free/premium/pro -> frontend plan: basic/premium/pro
    if (data.plan) {
      localStorage.setItem("plan", data.plan === "free" ? "basic" : data.plan);
    }

    // role ham sync bo'lsin
    if (data.role) localStorage.setItem("role", data.role);

    // ✅ NEW: expires_at ham sync bo'lsin (qolgan kun ko'rsatish uchun)
    if (data.expires_at) localStorage.setItem("expires_at", data.expires_at);
    else localStorage.removeItem("expires_at");

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

/* ✅ FIX: showPage async bo'ldi, dashboard kirganda initDashboard await bo'ladi */
async function showPage(page, display = "flex") {
  if (!page) return;

  hideAllPages();
  page.style.display = display;

  // ✅ Background state (blur + image switch)
  document.body.classList.remove("is-auth", "is-main", "is-dashboard");

  if (
    page === pages.login ||
    page === pages.register ||
    page === pages.forgot ||
    page === pages.verify // ✅ NEW
  ) {
    document.body.classList.add("is-auth");
  }

  // ✅ UPDATED: Skeleton pages ham main fonni olsin
  if (
    page === pages.main ||
    page === pages.payment ||
    page === pages.listening ||
    page === pages.vocabulary ||
    page === pages.reading ||
    page === pages.writing ||
    page === pages.speaking ||
    page === pages.band9 ||
    page === pages.mock
  ) {
    document.body.classList.add("is-main");
  }

  if (page === pages.dashboard) {
    document.body.classList.add("is-dashboard");
  }

  page.classList.add("show", "active");

  if (page === pages.dashboard) {
    // ✅ async initDashboard endi to'liq ishlaydi
    await initDashboard();

    // ✅ Admin tugma faqat admin bo‘lsa ko‘rinsin
    const adminBtn = document.getElementById("adminToggleBtn");
    if (adminBtn) adminBtn.style.display = isAdminRole() ? "block" : "none";

    // ✅ Upgrade tugma faqat user uchun (endi top-barda)
    const upgradeTop = document.getElementById("upgradeBtnTop");
    if (upgradeTop) upgradeTop.style.display = isAdminRole() ? "none" : "inline-flex";

    // ✅ Dashboardga kirganda eski admin table qolib ketmasin
    cleanupAdminArtifacts();
  }

  if (page === pages.main) {
    // ✅ Adminlar pricing sahifaga kirmasin
    if (isAdminRole()) {
      await showPage(pages.dashboard);
      return;
    }
    initFeatureClick();
  }

  // ✅ Register page ochilganda Google verify holatini tozalaymiz va tugmani chizamiz
  if (page === pages.register) {
    resetGoogleVerify();
    initGoogleVerifyButton();
  }
}

/* ================= DROPDOWN (CLICK FIX) ================= */
function setupUserDropdown() {
  const avatarBtn = document.getElementById("avatarBtn");
  const dropdown = document.getElementById("userDropdown");

  if (!avatarBtn || !dropdown) return;

  // avatar bosilganda open/close
  avatarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown.classList.toggle("open");
  });

  // dropdown ichiga bosilganda yopilmasin
  dropdown.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  // tashqariga bosilganda yopilsin
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

    // ADMIN paneldan qaytsa
    if (goDash) {
      await showPage(pages.dashboard);
    } else {
      // ✅ ADMIN bo‘lsa darrov dashboard
      if (isAdminRole()) {
        await showPage(pages.dashboard);
      } else {
        // ✅ NEW: premium/pro bo'lsa mainPage emas, darrov dashboard
        const p = getCurrentPlan();
        if (p !== "basic") await showPage(pages.dashboard);
        else await showPage(pages.main);
      }
    }
  } else {
    await showPage(pages.login);
  }

  initFeatureClick();
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
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

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
  const code  = document.getElementById("verifyCode")?.value?.trim() || "";

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

    // ✅ agar server token qaytargan bo'lsa — avtomatik kiramiz
    if (data.token) {
      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", email);
      localStorage.setItem("role", data.role || "user");

      await syncPlanFromServer();
      cleanupAdminArtifacts();

      // login() dagi logika bilan bir xil yo'naltiramiz
      if ((data.role || getRole()) === "admin") {
        await showPage(pages.dashboard);
      } else {
        const p = getCurrentPlan();
        if (p !== "basic") await showPage(pages.dashboard);
        else await showPage(pages.main);
      }

      return;
    }

    // token bo'lmasa (masalan allaqachon verified) — oddiy login
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

/* ✅✅✅ FIX: onclick ko‘rishi uchun globalga chiqaramiz */
window.verifyEmailCode = verifyEmailCode;
window.resendVerifyCode = resendVerifyCode;

/* -------- LOGIN -------- */
async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

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

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Login xato");
      return;
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("role", data.role);

    await syncPlanFromServer();
    cleanupAdminArtifacts();

    if (data.role === "admin") {
      await showPage(pages.dashboard);
    } else {
      const p = getCurrentPlan();
      if (p !== "basic") await showPage(pages.dashboard);
      else await showPage(pages.main);
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

  const currentPlan = getCurrentPlan(); // basic/premium/pro
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
  const email = localStorage.getItem("userEmail") || "user@email.com";
  const emailEl = document.getElementById("userEmail");
  if (emailEl) emailEl.textContent = email;
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

  sidebarItems.forEach((el, index) => el.classList.toggle("locked", index >= limits.sidebarLimit));
  topItems.forEach((el, index) => el.classList.toggle("locked", index >= limits.topLimit));
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
    btn.onclick = null;

    btn.addEventListener("click", () => {
      if (!isAdminRole() && btn.classList.contains("locked")) {
        alert("🔒 This feature is locked. Upgrade your plan.");
        return;
      }

      const feature = btn.dataset.feature;

      if (feature === "listening") {
        showPage(pages.listening, "block");
        return;
      }

      const skeletonMap = {
        vocabulary: pages.vocabulary,
        reading: pages.reading,
        writing: pages.writing,
        speaking: pages.speaking,
        band9: pages.band9,
        mock: pages.mock
      };

      if (skeletonMap[feature]) {
        if (feature === "reading") {
          openReadingModule();
          return;
        }
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
function openForgot() { showPage(pages.forgot); }
function backToLogin() { showPage(pages.login); }

// 1) Emailga reset kodi yuborish
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

    // ✅ Step-2 (kod + yangi parol) formani ko‘rsatamiz
    const step2 = document.getElementById("resetStep2");
    if (step2) step2.style.display = "block";

    // ✅ Reset email input bo‘lsa to‘ldiramiz (bo‘lmasa ham mayli)
    const rEmail = document.getElementById("resetEmail");
    if (rEmail) rEmail.value = email;

    // ✅ Kod inputiga fokus (agar bo‘lsa)
    const codeEl = document.getElementById("resetCode");
    if (codeEl) codeEl.focus();

  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

// 2) Kod + yangi parol bilan parolni yangilash
async function resetPassword() {
  // ✅ Emailni resetEmail bo‘lmasa forgotEmail’dan olamiz
  const resetEmailEl = document.getElementById("resetEmail");
  const forgotEmailEl = document.getElementById("forgotEmail");

  const email = ((resetEmailEl?.value || forgotEmailEl?.value) || "").trim().toLowerCase();

  const codeEl = document.getElementById("resetCode");
  const pass1El = document.getElementById("resetNewPassword");
  const pass2El = document.getElementById("resetNewPassword2");

  const code  = (codeEl?.value || "").trim();
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

    // ✅ maydonlarni tozalab qo‘yamiz
    if (codeEl) codeEl.value = "";
    if (pass1El) pass1El.value = "";
    if (pass2El) pass2El.value = "";

    // ✅ step2 ni yashiramiz (xohlasang qoldirsa ham bo‘ladi)
    const step2 = document.getElementById("resetStep2");
    if (step2) step2.style.display = "none";

    await showPage(pages.login);

  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
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

/* ================= UPGRADE (UPDATED) ================= */
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

/* ================= PAYMENT (MANUAL) ================= */
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

/* ================= READING MODULE (DB ENGINE + 75% UNLOCK) ================= */
/* ✅ FIXED: token bo'lmasa header yubormaydi */
function getAuthHeaders() {
  const token = localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: "Bearer " + token };
}

async function openReadingModule() {
  await showPage(pages.reading, "block");
  await loadReadingList();
}

/* ✅ FIXED: it.is_unlocked bilan ishlaydi, token yo'q bo'lsa login deydi */
async function loadReadingList() {
  const listEl = document.getElementById("readingTestList");
  const titleEl = document.getElementById("readingTitle");
  const bodyEl = document.getElementById("readingBody");

  if (!listEl || !titleEl || !bodyEl) {
    console.warn("readingPage elementlari topilmadi (readingTestList/readingTitle/readingBody).");
    console.warn("index.html -> readingPage ichiga shu idlarni qo‘shish kerak bo‘ladi.");
    return;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    listEl.innerHTML = `<li>Avval login qiling 🔑</li>`;
    titleEl.textContent = "Login required";
    bodyEl.innerHTML = `<p>Reading testlarni ko‘rish uchun login qiling.</p>`;
    return;
  }

  listEl.innerHTML = `<li>Loading...</li>`;
  const hasOpenTest = !!document.getElementById("readingForm");
if (!hasOpenTest) {
  titleEl.textContent = "Select a test";
  bodyEl.innerHTML = `<p>Chapdan test tanlang.</p>`;
}

  try {
    // ✅ Backend endpoint:
    // GET /api/modules/reading/list
    const res = await fetch(`${API_BASE}/api/modules/reading/list`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      listEl.innerHTML = `<li>Error: ${data.message || "Failed"}</li>`;
      return;
    }

    const items = Array.isArray(data.items) ? data.items : [];
    if (!items.length) {
      listEl.innerHTML = `<li>No tests yet</li>`;
      return;
    }

    listEl.innerHTML = "";
    items.forEach((it) => {
      const li = document.createElement("li");
      li.textContent = `${it.order_no}. ${it.title}`;

      // ✅ backend field: is_unlocked
      const unlocked = Number(it.is_unlocked) === 1;

      if (!unlocked) {
        li.style.opacity = "0.55";
        li.style.pointerEvents = "none";
        li.textContent += " 🔒 (75% kerak)";
      } else {
        li.style.cursor = "pointer";
        li.addEventListener("click", () => openReadingTest(it.id));
      }

      listEl.appendChild(li);
    });
  } catch (e) {
    console.error(e);
    listEl.innerHTML = `<li>Server error</li>`;
  }
}

async function openReadingTest(materialId) {
  const titleEl = document.getElementById("readingTitle");
  const bodyEl = document.getElementById("readingBody");
  if (!titleEl || !bodyEl) return;

  titleEl.textContent = "Loading test...";
  bodyEl.innerHTML = `<p>Loading...</p>`;

  try {
    // ✅ server.js endpoint:
    // GET /api/materials/:id  -> { material, questions, progress }
    const res = await fetch(`${API_BASE}/api/materials/${materialId}`, {
      headers: getAuthHeaders()
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      bodyEl.innerHTML = `<p>${data.message || "Failed to load"}</p>`;
      return;
    }

    const material = data.material || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];

    titleEl.textContent = material.title || "Reading Test";

    // ✅ NEW: content JSON bo'lsa passage ni ajratib chiqaramiz
    let passageText = material.content || "Passage hali yo‘q";
    try {
      const obj = typeof passageText === "string" ? JSON.parse(passageText) : null;
      if (obj && obj.passage) passageText = obj.passage;
    } catch (_) {}

    let html = `
      <div style="background:#ffffff14;padding:14px;border-radius:12px;margin-bottom:12px;">
        <h4>Passage</h4>
        <p style="line-height:1.6;">${String(passageText).replace(/\n/g, "<br>")}</p>
      </div>
      <form id="readingForm">
    `;

    questions.forEach((q, idx) => {
      html += `
        <div style="background:#ffffff14;padding:14px;border-radius:12px;margin:10px 0;">
          <b>${idx + 1}) ${q.question_text || ""}</b>
          <div style="margin-top:10px;display:grid;gap:8px;">
            ${["A", "B", "C", "D"]
              .map((k) => {
                const opt = q["option_" + k.toLowerCase()];
                if (!opt) return "";
                return `
                  <label style="display:flex;gap:8px;align-items:center;">
                    <input type="radio" name="q_${q.id}" value="${k}" />
                    <span>${k}) ${opt}</span>
                  </label>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    });

    html += `
      <button type="submit" style="padding:12px 16px;border-radius:10px;border:none;background:blueviolet;color:#fff;">
        Submit
      </button>
      <div id="readingResult" style="margin-top:12px;"></div>
      </form>
    `;

    bodyEl.innerHTML = html;

    const form = document.getElementById("readingForm");
    if (!form) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const answers = [];
      questions.forEach((q) => {
        const v = form.querySelector(`input[name="q_${q.id}"]:checked`)?.value || "";
        answers.push({ question_id: q.id, answer: v });
      });

      await submitReading(materialId, answers);
    });
  } catch (e) {
    console.error(e);
    bodyEl.innerHTML = `<p>Server error</p>`;
  }
}

/* ✅ FIXED: submit endpoint to'g'ri: POST /api/attempts/submit */
async function submitReading(materialId, answers) {
  const resultEl = document.getElementById("readingResult");
  if (resultEl) resultEl.innerHTML = "Submitting...";

  try {
    // ✅ TO‘G‘RI endpoint: /api/attempts/submit
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

    // ro‘yxatni yangilab qo‘yamiz (lock/unlock ko‘rinishi uchun)
    await loadReadingList();

  } catch (e) {
    console.error(e);
    if (resultEl) resultEl.innerHTML = `<p style="color:crimson;">Server error</p>`;
  }
}

/* ================= ✅ GLOBAL EXPORTS (onclick FIX) ================= */
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
window.sendReset = sendReset;

window.loginWithGoogle = loginWithGoogle;
window.loginWithApple = loginWithApple;

window.toggleAdminPanel = toggleAdminPanel;
window.goUpgrade = goUpgrade;

window.submitPaymentRequest = submitPaymentRequest;
window.copyText = copyText;

window.openReadingModule = openReadingModule;
window.sendResetCode = sendResetCode;
window.resetPassword = resetPassword;
function sendReset() {
  return sendResetCode();
}
window.sendReset = sendReset;
// ✅ onclick ishlashi uchun (agar pastda allaqachon bo'lsa, takror qo‘shma)

window.openForgot = openForgot;
window.backToLogin = backToLogin;