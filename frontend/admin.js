// ====================== HELPERS ======================
const API = "http://localhost:3000";
const $ = (id) => document.getElementById(id);

// Pagination state
let STATE = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
};

let ALL_USERS = []; // current page users
let PENDING_DELETE_ID = null;

// ====================== INIT ======================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Siz admin emassiz!");
    window.location.href = "index.html";
    return;
  }

  // Logout
  $("logoutBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.clear();
    window.location.href = "index.html";
  });

  // Dashboard
  $("backBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    localStorage.setItem("goDashboard", "1");
    window.location.href = "./index.html";
  });

  // Refresh
  $("refreshBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    loadUsers(STATE.page);
  });

  // Live search
  $("searchInput")?.addEventListener("input", () => applyFilters());

  // Enter search
  $("searchInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });

  // Pusk
  $("searchBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    applyFilters();
  });

  // Filters
  $("filterPlan")?.addEventListener("change", () => applyFilters());
  $("filterRole")?.addEventListener("change", () => applyFilters());

  // Modal
  $("confirmCancel")?.addEventListener("click", closeConfirm);
  $("confirmOk")?.addEventListener("click", confirmOk);

  loadUsers(1);
});

// ====================== DATA LOAD (PAGINATION) ======================
async function loadUsers(page = 1) {
  const token = localStorage.getItem("token");
  const tbody = $("usersTable");
  if (!tbody) return;

  STATE.page = page;

  const q = (($("searchInput")?.value || "").trim());
  const roleVal = $("filterRole")?.value || "all";

  const qs = new URLSearchParams({
    page: STATE.page,
    limit: STATE.limit
  });

  if (q) qs.set("search", q);
  if (roleVal !== "all") qs.set("role", roleVal);
  const planVal = $("filterPlan")?.value || "all";
  if (planVal !== "all") qs.set("plan", planVal);

  tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/users?${qs.toString()}`, {
      headers: {
        Authorization: "Bearer " + token
      }
    });

    if (res.status === 401 || res.status === 403) {
      toast("Ruxsat yo‘q ❌");
      localStorage.clear();
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) {
      toast("Server error ❌");
      return;
    }

    const data = await safeJson(res);

    ALL_USERS = data.users || [];
    STATE.total = data.total;
    STATE.totalPages = data.totalPages;

    renderUsers(ALL_USERS);
    updateKpis(ALL_USERS);
    renderPagination();

  } catch (err) {
    console.error(err);
    toast("Connection error ❌");
  }
}

// ====================== FILTERS ======================
function applyFilters() {
  loadUsers(1);
}

// ====================== PAGINATION RENDER ======================
function renderPagination() {
  const el = $("pagination");
  if (!el) return;

  if (STATE.totalPages <= 1) {
    el.innerHTML = "";
    return;
  }

  let html = "";

  html += `<button ${STATE.page === 1 ? "disabled" : ""} data-p="${STATE.page - 1}">Prev</button>`;

  for (let i = 1; i <= STATE.totalPages; i++) {
    html += `<button class="${i === STATE.page ? "active" : ""}" data-p="${i}">${i}</button>`;
  }

  html += `<button ${STATE.page === STATE.totalPages ? "disabled" : ""} data-p="${STATE.page + 1}">Next</button>`;

  el.innerHTML = html;

  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      loadUsers(parseInt(btn.dataset.p, 10));
    });
  });
}

// ====================== RENDER USERS ======================
function renderUsers(users) {
  const tbody = $("usersTable");
  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7">No users</td></tr>`;
    return;
  }

  users.forEach(u => {
    const planVal = u.plan || "free";
    const isBlocked = (u.is_active === 0);

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${escapeHtml(u.username || "")}</td>
      <td>${escapeHtml(u.email || "")}</td>

      <td>
        <select id="role-${u.id}">
          <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>

      <td>
        <select id="plan-${u.id}">
          <option value="free" ${planVal === "free" ? "selected" : ""}>free</option>
          <option value="premium" ${planVal === "premium" ? "selected" : ""}>premium</option>
          <option value="pro" ${planVal === "pro" ? "selected" : ""}>pro</option>
        </select>
      </td>

      <td>${formatDate(u.created_at)}</td>

      <td>
        <div class="admin-actions">
          <button class="admin-btn admin-mini save" data-id="${u.id}">Save</button>

          <button class="admin-btn admin-mini ${isBlocked ? "unblock" : "block"}"
                  data-id="${u.id}"
                  data-active="${u.is_active}">
            ${isBlocked ? "Unblock" : "Block"}
          </button>

          <button class="admin-btn admin-mini delete" data-id="${u.id}">Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Save
  tbody.querySelectorAll(".save").forEach(btn => {
    btn.onclick = () => saveUser(btn.dataset.id);
  });

  // Delete
  tbody.querySelectorAll(".delete").forEach(btn => {
    btn.onclick = () => openConfirm(btn.dataset.id);
  });

  // Block / Unblock
  tbody.querySelectorAll(".block, .unblock").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const current = parseInt(btn.dataset.active, 10); // 1 yoki 0
      const nextState = current === 1 ? 0 : 1;
      toggleBlock(id, nextState);
    });
  });
}

// ====================== SAVE ======================
async function saveUser(id) {
  const token = localStorage.getItem("token");

  const role = $(`role-${id}`).value;
  const plan = $(`plan-${id}`).value;

  await fetch(`${API}/admin/users/${id}/role`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ role })
  });

  await fetch(`${API}/admin/users/${id}/plan`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ plan })
  });

  toast("Saved ✅");
  loadUsers(STATE.page);
}

// ====================== BLOCK / UNBLOCK ======================
async function toggleBlock(id, is_active) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/users/${id}/block`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ is_active })
    });

    if (!res.ok) {
      const e = await safeJson(res);
      toast(e?.message || "Block error ❌");
      return;
    }

    toast(is_active ? "Unblocked ✅" : "Blocked ⛔");
    loadUsers(STATE.page);

  } catch (err) {
    console.error(err);
    toast("Block/Unblock xatolik ❌");
  }
}

// ====================== DELETE ======================
function openConfirm(id) {
  PENDING_DELETE_ID = id;
  $("confirmText") && ($("confirmText").textContent = `User ID ${id} ni o‘chirmoqchimisiz?`);
  $("confirmModal").style.display = "block";
}

function closeConfirm() {
  $("confirmModal").style.display = "none";
  PENDING_DELETE_ID = null;
}

async function confirmOk() {
  if (!PENDING_DELETE_ID) return;

  const token = localStorage.getItem("token");
  await fetch(`${API}/admin/users/${PENDING_DELETE_ID}`, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  toast("Deleted");
  closeConfirm();
  loadUsers(STATE.page);
}

// ====================== KPI ======================
function updateKpis(users) {
  $("kpiTotal").textContent = STATE.total;
  // Premium/Pro count hozircha plan yo‘q bo‘lsa ham 0 bo‘ladi.
  const premium = users.filter(u => (u.plan || "free") === "premium").length;
  const pro = users.filter(u => (u.plan || "free") === "pro").length;

  $("kpiPremium") && ($("kpiPremium").textContent = String(premium));
  $("kpiPro") && ($("kpiPro").textContent = String(pro));
}

// ====================== UTIL ======================
function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.style.display = "block";
  setTimeout(() => el.style.display = "none", 2000);
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDate(d) {
  if (!d) return "-";
  return new Date(d).toLocaleString();
}