/* ================= PAGE REFERENCES ================= */
const pages = {
  login: document.getElementById("loginPage"),
  register: document.getElementById("registerPage"),
  main: document.getElementById("mainPage"),
  payment: document.getElementById("paymentPage"), // ✅ NEW: payment page
  dashboard: document.getElementById("dashboard"),
  forgot: document.getElementById("forgotPage"),
  listening: document.getElementById("listeningPage")
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
  page.classList.add("show", "active");

  if (page === pages.dashboard) {
    // ✅ async initDashboard endi to'liq ishlaydi
    await initDashboard();

    // ✅ Admin tugma faqat admin bo‘lsa ko‘rinsin
    const adminBtn = document.getElementById("adminToggleBtn");
    if (adminBtn) adminBtn.style.display = isAdminRole() ? "block" : "none";

    // ✅ Upgrade tugma faqat user uchun
    const upgradeBtn = document.getElementById("upgradeBtn");
    if (upgradeBtn) upgradeBtn.style.display = isAdminRole() ? "none" : "block";

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

  if (page === pages.payment) {
    // payment page ochilganda hech nima majburiy emas
    // preparePayment() plan tanlanganda yoki goUpgrade() da chaqiladi
  }

  // ✅ Register page ochilganda Google verify holatini tozalaymiz va tugmani chizamiz
  if (page === pages.register) {
    resetGoogleVerify();
    initGoogleVerifyButton();
  }
}

/* ================= INIT ================= */
window.addEventListener("DOMContentLoaded", async () => {
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

  // ✅ Google verify majburiy
  if (!GOOGLE_VERIFY.idToken) {
    alert("Avval Google orqali emailni tasdiqlang (Verify with Google).");
    return;
  }

  try {
    // 1) backendda token verify qilamiz
    const verifyRes = await fetch(`${API_BASE}/api/auth/google-verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: GOOGLE_VERIFY.idToken })
    });

    const v = await verifyRes.json();

    if (!verifyRes.ok) {
      alert(v?.message || "Google verify failed");
      return;
    }

    if (!v.email_verified) {
      alert("Bu email Google tomonidan tasdiqlanmagan (email_verified=false).");
      return;
    }

    const googleEmail = String(v.email || "").toLowerCase();
    const formEmail = String(email || "").toLowerCase();

    if (!googleEmail || googleEmail !== formEmail) {
      alert(`Email mos emas!\nGoogle: ${googleEmail}\nSiz kiritgan: ${formEmail}`);
      return;
    }

    // 2) Endi register qilamiz
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password, full_name: username })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Xatolik yuz berdi");
      return;
    }

    alert("Register muvaffaqiyatli! Endi login qiling.");

    resetGoogleVerify();
    await showPage(pages.login);
  } catch (e) {
    console.error(e);
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

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

    // ✅ Saqlash
    localStorage.setItem("token", data.token);
    localStorage.setItem("userEmail", email);
    localStorage.setItem("role", data.role);

    // ✅ plan'ni basic qilib qo'ymaymiz, DB'dan olib kelamiz
    await syncPlanFromServer();

    cleanupAdminArtifacts();

    if (data.role === "admin") {
      await showPage(pages.dashboard);
    } else {
      // ✅ NEW: premium/pro bo'lsa mainPage emas, dashboard
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
  // ✅ Admin plan tanlamaydi
  if (isAdminRole()) {
    showPage(pages.dashboard);
    return;
  }

  const currentPlan = getCurrentPlan(); // basic/premium/pro
  const curRank = PLAN_RANK[currentPlan] || 1;
  const wantRank = PLAN_RANK[plan] || 1;

  // Basic - darrov dashboard
  if (plan === "basic") {
    localStorage.setItem("plan", "basic");
    showPage(pages.dashboard);
    return;
  }

  // ✅ NEW: allaqachon shu plan yoki undan yuqori bo'lsa -> payment emas, info
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

  // Premium/Pro - payment page
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

/* ================= DROPDOWN ================= */
function toggleDropdown() {
  const dropdown = document.getElementById("userDropdown");
  if (!dropdown) return;
  dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
}

/* ================= ACCESS CONTROL ================= */
const accessControl = {
  basic: { sidebarLimit: 3, topLimit: 3 },
  premium: { sidebarLimit: 4, topLimit: 5 },
  pro: { sidebarLimit: Infinity, topLimit: Infinity }
};

/* ================= FEATURE LOCK ================= */
function applyFeatureLock() {
  // ✅ Admin uchun hammasi ochiq
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

/* ================= PASSWORD RESET ================= */
function openForgot() { showPage(pages.forgot); }
function backToLogin() { showPage(pages.login); }
function sendReset() { alert("📧 Reset link sent!"); backToLogin(); }

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

  const currentPlan = getCurrentPlan(); // basic/premium/pro
  const daysLeft = getDaysLeft();

  // pro bo'lsa -> info
  if (currentPlan === "pro") {
    const msg = daysLeft !== null
      ? `✅ Siz allaqachon PRO planidasiz.\n⏳ Qolgan muddat: ${daysLeft} kun.`
      : `✅ Siz allaqachon PRO planidasiz.`;
    alert(msg);
    showPage(pages.dashboard);
    return;
  }

  // basic bo'lsa premiumga, premium bo'lsa proga
  const nextPlan = currentPlan === "premium" ? "pro" : "premium";
  preparePayment(nextPlan);
  showPage(pages.payment, "flex");
}

/* ================= CLEANUP HELPERS ================= */
function cleanupAdminArtifacts() {
  const oldTable = document.getElementById("adminUsersTable");
  if (oldTable) oldTable.remove();

  const dropdown = document.getElementById("userDropdown");
  if (dropdown) dropdown.style.display = "none";
}

/* ================= (OLD ADMIN API FUNCTIONS) ================= */
/* Pastdagi funksiyalarni o‘chirmadim — hech narsa tushib qolmasin deding.
   Lekin endi toggleAdminPanel ularni chaqirmaydi.
   Agar xohlasang keyin bularni admin.js ga ko‘chirib, index.js dan olib tashlaymiz. */

async function loadAdminUsers() {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      headers: { Authorization: "Bearer " + token }
    });

    if (res.status === 403) {
      alert("Only admin allowed");
      return;
    }

    if (!res.ok) return;

    const users = await res.json();
    const dashboardMain = document.querySelector(".main");
    if (!dashboardMain) return;

    let oldTable = document.getElementById("adminUsersTable");
    if (oldTable) oldTable.remove();

    const table = document.createElement("table");
    table.id = "adminUsersTable";
    table.style.width = "100%";
    table.style.marginTop = "30px";

    table.innerHTML = `
      <tr>
        <th>ID</th>
        <th>Username</th>
        <th>Email</th>
        <th>Role</th>
        <th>Created</th>
        <th>Actions</th>
      </tr>
    `;

    users.forEach((user) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.created_at).toLocaleString()}</td>
        <td>
          <button onclick="deleteUser(${user.id})">Delete</button>
          <button onclick="changeRole(${user.id}, '${user.role === "admin" ? "user" : "admin"}')">
            ${user.role === "admin" ? "Make User" : "Make Admin"}
          </button>
        </td>
      `;

      table.appendChild(tr);
    });

    dashboardMain.appendChild(table);
  } catch (err) {
    console.error(err);
  }
}

async function deleteUser(userId) {
  if (localStorage.getItem("role") !== "admin") return;

  if (!confirm("Are you sure to delete this user?")) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + localStorage.getItem("token") }
    });

    if (res.ok) loadAdminUsers();
  } catch (err) {
    console.error(err);
  }
}

async function changeRole(userId, newRole) {
  if (localStorage.getItem("role") !== "admin") return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ role: newRole })
    });

    if (res.ok) loadAdminUsers();
  } catch (err) {
    console.error(err);
  }
}

/* ================= PAYMENT (MANUAL) ================= */
const PLAN_PRICES = {
  premium: "99 000 so‘m",
  pro: "149 000 so‘m"
};

/* ✅ NEW: amount DBga son bo‘lib borishi uchun */
const PLAN_AMOUNTS = {
  premium: 99000,
  pro: 149000
};

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

/* ✅ UPDATED: endi demo emas, real backendga yuboradi */
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
      headers: {
        Authorization: "Bearer " + token
      },
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