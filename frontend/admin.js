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


  }

  catch (err) {
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
      loadUsers(parseInt(btn.dataset.p));
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
    
    const tr = document.createElement("tr");
   
    tr.innerHTML = `

<td>${u.id}</td>
<td>${escapeHtml(u.username)}</td>
<td>${escapeHtml(u.email)}</td>

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
  <button class="admin-btn admin-mini delete" data-id="${u.id}">Delete</button>
</div>
</td>
`;

    tbody.appendChild(tr);
  });
  tbody.querySelectorAll(".save").forEach(btn => {
    btn.onclick = () => saveUser(btn.dataset.id);
  });
  tbody.querySelectorAll(".delete").forEach(btn => {
    btn.onclick = () => openConfirm(btn.dataset.id);
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

// ====================== DELETE ======================
function openConfirm(id) {
  PENDING_DELETE_ID = id;
  $("confirmModal").style.display = "block";
}

function closeConfirm() {
  $("confirmModal").style.display = "none";
}

async function confirmOk() {

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
  }
  catch {
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
  return new Date(d).toLocaleString();
}