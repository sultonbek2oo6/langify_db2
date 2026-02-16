/* ================= PAGE REFERENCES ================= */

const pages = {
  login: document.getElementById("loginPage"),
  register: document.getElementById("registerPage"),
  main: document.getElementById("mainPage"),
  dashboard: document.getElementById("dashboard"),
  forgot: document.getElementById("forgotPage"),
  listening: document.getElementById("listeningPage")
};

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
  }

  if (page === pages.main) {
    initFeatureClick();
  }
}

/* ================= INIT ================= */

window.addEventListener("DOMContentLoaded", () => {

  const savedUser = localStorage.getItem("userEmail");

  if (savedUser) {
    showPage(pages.main);
  } else {
    showPage(pages.login);
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
    const res = await fetch("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        email,
        password,
        full_name: username
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Xatolik yuz berdi");
      return;
    }

    alert("Register muvaffaqiyatli!");
    showPage(pages.login);

  } catch (err) {
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

    localStorage.setItem("userEmail", data.user.email);

    if (!localStorage.getItem("plan")) {
      localStorage.setItem("plan", "basic");
    }

    showPage(pages.main);

  } catch (err) {
    alert("Server bilan bog‘lanib bo‘lmadi");
  }
}

function logout() {
  localStorage.clear();
  showPage(pages.login);
}

/* ================= PLAN ================= */

function choosePlan(plan) {
  localStorage.setItem("plan", plan);
  showPage(pages.dashboard);
}

function goDashboard() {
  showPage(pages.dashboard);
}

/* ================= DASHBOARD ================= */

function initDashboard() {
  loadUser();
  applyFeatureLock();
}

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

/* ================= ACCESS LIMIT SYSTEM ================= */

const accessControl = {
  basic: { sidebarLimit: 3, topLimit: 3 },
  premium: { sidebarLimit: 4, topLimit: 5 },
  pro: { sidebarLimit: Infinity, topLimit: Infinity }
};

/* ================= FEATURE LOCK ================= */

function applyFeatureLock() {
  const plan = localStorage.getItem("plan") || "basic";
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
  vocabulary: {
    title: "Learn Vocabulary",
    body: "<p>📘 Practice new words with smart repetition.</p>"
  },
  reading: {
    title: "Reading Practice",
    body: "<p>📖 Read IELTS-style passages and answer questions.</p>"
  },
  writing: {
    title: "Writing Practice",
    body: `
      <textarea placeholder="Write your essay here..."></textarea>
      <button>Submit Essay</button>
    `
  },
  speaking: {
    title: "Speaking Practice",
    body: "<p>🎤 Practice speaking topics with guidance.</p>"
  },
  band9: {
    title: "Band 9.0 Samples",
    body: "<p>⭐ View high-scoring IELTS answers.</p>"
  },
  mock: {
    title: "Full Mock Test",
    body: "<p>📝 Take a complete IELTS mock exam.</p>"
  },
  leaderboard: {
    title: "Leaderboard",
    body: "<p>🏆 See top students and rankings.</p>"
  },
  translation: {
    title: "Translation Practice",
    body: "<p>🌍 Translate texts and improve accuracy.</p>"
  },
  lessons: {
    title: "Join My Lessons",
    body: "<p>📚 Join live lessons with teachers.</p>"
  },
  students: {
    title: "Student Results",
    body: "<p>📊 View student performance statistics.</p>"
  }
};

/* ================= FEATURE CLICK ================= */

function initFeatureClick() {
  const buttons = document.querySelectorAll("[data-feature]");

  buttons.forEach(btn => {

    btn.addEventListener("click", () => {

      if (btn.classList.contains("locked")) {
        alert("🔒 This feature is locked. Upgrade your plan.");
        return;
      }

      const feature = btn.dataset.feature;

      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      if (feature === "listening") {
        showPage(pages.listening, "block");
        return;
      }

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

function openForgot() {
  showPage(pages.forgot);
}

function backToLogin() {
  showPage(pages.login);
}

function sendReset() {
  alert("📧 Reset link sent!");
  backToLogin();
}

/* ================= SOCIAL LOGIN ================= */

function loginWithGoogle() {
  window.location.href = "http://localhost:3000/api/auth/google";
}

function loginWithApple() {
  window.location.href = "http://localhost:3000/api/auth/apple";
}
