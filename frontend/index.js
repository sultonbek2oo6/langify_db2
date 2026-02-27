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

const GOOGLE_CLIENT_ID = "1081668585971-ee2gmg3f7rvjsf0g2nnfcqgvkpvdnsg3.apps.googleusercontent.com";

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
    setGoogleVerifyStatus("Google script yuklanmadi. (gsi/client) qo‘shilganini tekshiring.");
    return;
  }

  // Client ID qo‘yilmagan bo‘lsa
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.includes("PASTE_YOUR")) {
    setGoogleVerifyStatus("GOOGLE_CLIENT_ID qo‘yilmagan. index.js dagi GOOGLE_CLIENT_ID ni to‘ldiring.");
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

/* ================= PAGE CONTROLLER ================= */
function hideAllPages() {
  Object.values(pages).forEach(page => {
    if (!page) return;
    page.style.display = "none";
    page.classList.remove("show", "active");
  });
}

function showPage(page, display = "flex") {
  if (!page) return;

  hideAllPages();
  page.style.display = display;
  page.classList.add("show", "active");

  if (page === pages.dashboard) {
    initDashboard();

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
    // ✅ Adminlar pricing sahifaga kirmasin (xohlasang)
    if (isAdminRole()) {
      showPage(pages.dashboard);
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
window.addEventListener("DOMContentLoaded", () => {
  const savedUser = localStorage.getItem("userEmail");
  const token = localStorage.getItem("token");
  const goDash = localStorage.getItem("goDashboard") === "1";

  // flagni o‘chiramiz
  if (goDash) localStorage.removeItem("goDashboard");

  if (savedUser && token) {

    // ADMIN paneldan qaytsa
    if (goDash) {
      showPage(pages.dashboard);
    }

    // oddiy holat
    else {
      // ✅ ADMIN bo‘lsa darrov dashboard
      if (isAdminRole()) showPage(pages.dashboard);
      else showPage(pages.main);
    }

  } else {
    showPage(pages.login);
  }

  initFeatureClick();
});

/* ================= AUTH ================= */
function goRegister() { showPage(pages.register); }
function goLogin() { showPage(pages.login); }

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
    const verifyRes = await fetch("http://localhost:3000/api/auth/google-verify", {
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
    const res = await fetch("http://localhost:3000/api/auth/register", {
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
    showPage(pages.login);
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
    const res = await fetch("http://localhost:3000/api/auth/login", {
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

    // ✅ User bo‘lsa: plan bo‘lmasa basic
    if (!localStorage.getItem("plan")) {
      localStorage.setItem("plan", "basic");
    }

    cleanupAdminArtifacts();

    // ✅ ADMIN bo‘lsa darrov dashboard, user bo‘lsa pricing
    if (data.role === "admin") {
      showPage(pages.dashboard);
    } else {
      showPage(pages.main);
    }

  } catch {
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

  // Basic - darrov dashboard
  if (plan === "basic") {
    localStorage.setItem("plan", "basic");
    showPage(pages.dashboard);
    return;
  }

  // Premium/Pro - payment page
  preparePayment(plan);
  showPage(pages.payment, "flex");
}

function goDashboard() { showPage(pages.dashboard); }

/* ================= DASHBOARD ================= */
function initDashboard() {
  loadUser();
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
  dropdown.style.display =
    dropdown.style.display === "block" ? "none" : "block";
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
    document.querySelectorAll(".locked").forEach(el => el.classList.remove("locked"));
    return;
  }

  const plan = localStorage.getItem("plan") || "basic";
  const limits = accessControl[plan] || accessControl.basic;

  const sidebarItems = document.querySelectorAll(".sidebar [data-feature]");
  const topItems = document.querySelectorAll(".feature-buttons [data-feature]");

  sidebarItems.forEach((el, index) =>
    el.classList.toggle("locked", index >= limits.sidebarLimit)
  );

  topItems.forEach((el, index) =>
    el.classList.toggle("locked", index >= limits.topLimit)
  );
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

  buttons.forEach(btn => {
    // old listenerlar ko‘payib ketmasin
    btn.onclick = null;

    btn.addEventListener("click", () => {
      // ✅ Admin bo‘lsa locked tekshiruvi yo‘q
      if (!isAdminRole() && btn.classList.contains("locked")) {
        alert("🔒 This feature is locked. Upgrade your plan.");
        return;
      }

      const feature = btn.dataset.feature;

      if (feature === "listening") {
        showPage(pages.listening, "block");
        return;
      }

      buttons.forEach(b => b.classList.remove("active"));
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
  window.location.href = "http://localhost:3000/api/auth/google";
}
function loginWithApple() {
  window.location.href = "http://localhost:3000/api/auth/apple";
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
  // ✅ Faqat user uchun
  if (isAdminRole()) {
    alert("Admin uchun Upgrade kerak emas.");
    return;
  }
  // default: premium
  preparePayment("premium");
  showPage(pages.payment, "flex");
}

/* ================= CLEANUP HELPERS ================= */
function cleanupAdminArtifacts() {
  // Admin jadval qolib ketmasin
  const oldTable = document.getElementById("adminUsersTable");
  if (oldTable) oldTable.remove();

  // Dropdown yopilsin
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
    const res = await fetch("http://localhost:3000/admin/users", {
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

    users.forEach(user => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.username}</td>
        <td>${user.email}</td>
        <td>${user.role}</td>
        <td>${new Date(user.created_at).toLocaleString()}</td>
        <td>
          <button onclick="deleteUser(${user.id})">Delete</button>
          <button onclick="changeRole(${user.id}, '${user.role === 'admin' ? 'user' : 'admin'}')">
            ${user.role === 'admin' ? 'Make User' : 'Make Admin'}
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
    const res = await fetch(`http://localhost:3000/admin/users/${userId}`, {
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
    const res = await fetch(`http://localhost:3000/admin/users/${userId}/role`, {
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

// kartalaringni shu yerda yozib qo‘yasiz
const CARD_INFO = {
  number: "8600 1234 5678 9012",
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

  // eski file/tx ni tozalash
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
  const file = document.getElementById("receiptFile")?.files?.[0];
  const txId = document.getElementById("txId")?.value?.trim() || "";
  const plan = localStorage.getItem("pending_plan") || "premium";

  if (!file) {
    alert("Chek rasmini yuklang!");
    return;
  }

  // Hozircha demo:
  alert(`✅ Chek yuborishga tayyor!\nPlan: ${plan}\nTX: ${txId || "-" }\n\nKeyingi bosqich: server.js ga upload endpoint qo‘shamiz.`);
}