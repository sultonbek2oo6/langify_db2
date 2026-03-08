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

let ALL_USERS = [];
let PENDING_DELETE_ID = null;

// ====================== NAV (NEW) ======================
function showAdminSection(name) {
  const usersSection = $("usersSection");
  const paymentsSection = $("paymentsSection");
  const materialsSection = $("materialsSection");

  const navUsers = $("navUsers");
  const navPayments = $("navPayments");
  const navMaterials = $("navMaterials");

  if (usersSection) usersSection.style.display = name === "users" ? "block" : "none";
  if (paymentsSection) paymentsSection.style.display = name === "payments" ? "block" : "none";
  if (materialsSection) materialsSection.style.display = name === "materials" ? "block" : "none";

  if (navUsers) navUsers.classList.toggle("active", name === "users");
  if (navPayments) navPayments.classList.toggle("active", name === "payments");
  if (navMaterials) navMaterials.classList.toggle("active", name === "materials");

  if (name === "users") loadUsers(STATE.page);
  if (name === "payments") loadPaymentRequests();
  if (name === "materials") loadMaterials();
}

// ====================== INIT ======================
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token || role !== "admin") {
    alert("Siz admin emassiz!");
    window.location.href = "index.html";
    return;
  }

  // NAV
  $("navUsers")?.addEventListener("click", () => showAdminSection("users"));
  $("navPayments")?.addEventListener("click", () => showAdminSection("payments"));
  $("navMaterials")?.addEventListener("click", () => showAdminSection("materials"));
  $("matRefreshBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  loadMaterials();
  });
  $("matStatus")?.addEventListener("change", () => loadMaterials());
  $("matModule")?.addEventListener("change", () => loadMaterials());

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

  // Refresh users
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

  // Payments refresh
  $("payRefreshBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    loadPaymentRequests();
  });
  $("payStatus")?.addEventListener("change", () => loadPaymentRequests());

  // Default: Users
  showAdminSection("users");
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
      const current = parseInt(btn.dataset.active, 10);
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
  const premium = users.filter(u => (u.plan || "free") === "premium").length;
  const pro = users.filter(u => (u.plan || "free") === "pro").length;

  $("kpiPremium") && ($("kpiPremium").textContent = String(premium));
  $("kpiPro") && ($("kpiPro").textContent = String(pro));
}

// ====================== PAYMENTS (NEW) ======================

async function loadPaymentRequests() {
  const token = localStorage.getItem("token");
  const tbody = $("paymentReqTable");
  if (!tbody) return;

  const status = $("payStatus")?.value || "pending";

  tbody.innerHTML = `<tr><td colspan="9">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/payment-requests?status=${encodeURIComponent(status)}`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);

    if (!res.ok) {
      toast(data?.message || "Payments load error ❌");
      tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(data?.message || "Error")}</td></tr>`;
      return;
    }

    renderPaymentRequests(Array.isArray(data) ? data : []);
  } catch (e) {
    console.error(e);
    toast("Connection error ❌");
    tbody.innerHTML = `<tr><td colspan="9">Connection error</td></tr>`;
  }
}

function renderPaymentRequests(items) {
  const tbody = $("paymentReqTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9">No requests</td></tr>`;
    return;
  }

  items.forEach(pr => {
    const receiptLink = pr.receipt_url
      ? `<a href="${API}${pr.receipt_url}" target="_blank">Open receipt</a>`
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${pr.id}</td>
      <td>${escapeHtml(pr.username || "")}</td>
      <td>${escapeHtml(pr.email || "")}</td>
      <td>${escapeHtml(pr.plan_requested || "")}</td>
      <td>${pr.duration_days || 90}</td>
      <td>${pr.amount || 0} ${escapeHtml(pr.currency || "UZS")}</td>
      <td>${receiptLink}</td>
      <td>${escapeHtml(pr.status || "")}</td>
      <td>
        <div class="admin-actions">
          <button class="admin-btn admin-mini save" ${pr.status !== "pending" ? "disabled" : ""} data-id="${pr.id}">Approve</button>
          <button class="admin-btn admin-mini delete" ${pr.status !== "pending" ? "disabled" : ""} data-id="${pr.id}">Reject</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".save").forEach(btn => {
    btn.onclick = () => approveRequest(btn.dataset.id);
  });

  tbody.querySelectorAll(".delete").forEach(btn => {
    btn.onclick = () => rejectRequest(btn.dataset.id);
  });
}

async function approveRequest(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/payment-requests/${id}/approve`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);
    if (!res.ok) {
      toast(data?.message || "Approve error ❌");
      return;
    }

    toast("Approved ✅");
    loadPaymentRequests();
  } catch (e) {
    console.error(e);
    toast("Approve error ❌");
  }
}

async function rejectRequest(id) {
  const token = localStorage.getItem("token");
  const note = prompt("Reject sababi (ixtiyoriy):") || "";

  try {
    const res = await fetch(`${API}/admin/payment-requests/${id}/reject`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ admin_note: note })
    });

    const data = await safeJson(res);
    if (!res.ok) {
      toast(data?.message || "Reject error ❌");
      return;
    }

    toast("Rejected ✅");
    loadPaymentRequests();
  } catch (e) {
    console.error(e);
    toast("Reject error ❌");
  }
}

// ====================== MATERIALS ======================

async function loadMaterials() {
  const token = localStorage.getItem("token");
  const tbody = $("materialsTable");
  const preview = $("materialPreview");
  if (!tbody) return;

  const status = $("matStatus")?.value || "pending";
  const module = $("matModule")?.value || "";

  const qs = new URLSearchParams({ status });
  if (module) qs.set("module", module);

  tbody.innerHTML = `<tr><td colspan="9">Loading...</td></tr>`;
  if (preview) preview.innerHTML = `<p>Loading preview...</p>`;

  try {
    const res = await fetch(`${API}/admin/materials?${qs.toString()}`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);

    if (!res.ok) {
      toast(data?.message || "Materials load error ❌");
      tbody.innerHTML = `<tr><td colspan="9">${escapeHtml(data?.message || "Error")}</td></tr>`;
      if (preview) preview.innerHTML = `<p>Error loading preview.</p>`;
      return;
    }

    renderMaterials(Array.isArray(data.items) ? data.items : []);
  } catch (e) {
    console.error(e);
    toast("Connection error ❌");
    tbody.innerHTML = `<tr><td colspan="9">Connection error</td></tr>`;
    if (preview) preview.innerHTML = `<p>Connection error</p>`;
  }
}

function renderMaterials(items) {
  const tbody = $("materialsTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9">No materials</td></tr>`;
    return;
  }

  items.forEach((m) => {
    const tr = document.createElement("tr");

    let actionHtml = `
      <div class="admin-actions">
        <button class="admin-btn admin-mini save" data-id="${m.id}" data-action="preview">Preview</button>
    `;

    if (m.review_status === "pending") {
      actionHtml += `
        <button class="admin-btn admin-mini save" data-id="${m.id}" data-action="approve">Approve</button>
        <button class="admin-btn admin-mini delete" data-id="${m.id}" data-action="reject">Reject</button>
      `;
    } else if (m.review_status === "approved") {
      actionHtml += `
        <button class="admin-btn admin-mini block" data-id="${m.id}" data-action="unpublish">Unpublish</button>
      `;
    }

    actionHtml += `</div>`;

    tr.innerHTML = `
      <td>${m.id}</td>
      <td>${escapeHtml(m.module || "-")}</td>
      <td>${escapeHtml(m.title || "-")}</td>
      <td>${m.order_no ?? "-"}</td>
      <td>${escapeHtml(m.level || "-")}</td>
      <td>${m.questions_count ?? 0}</td>
      <td>${escapeHtml(m.review_status || "-")}</td>
      <td>${formatDate(m.created_at)}</td>
      <td>${actionHtml}</td>
    `;

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button[data-action='preview']").forEach((btn) => {
    btn.onclick = () => previewMaterial(btn.dataset.id);
  });

  tbody.querySelectorAll("button[data-action='approve']").forEach((btn) => {
    btn.onclick = () => approveMaterial(btn.dataset.id);
  });

  tbody.querySelectorAll("button[data-action='reject']").forEach((btn) => {
    btn.onclick = () => rejectMaterial(btn.dataset.id);
  });

  tbody.querySelectorAll("button[data-action='unpublish']").forEach((btn) => {
    btn.onclick = () => unpublishMaterial(btn.dataset.id);
  });
}

async function previewMaterial(id) {
  const token = localStorage.getItem("token");
  const preview = $("materialPreview");
  if (!preview) return;

  preview.innerHTML = `<p>Loading...</p>`;

  try {
    const res = await fetch(`${API}/admin/materials/${id}`, {
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);

    if (!res.ok) {
      preview.innerHTML = `<p>${escapeHtml(data?.message || "Error")}</p>`;
      return;
    }

    const material = data.material || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];

    let contentHtml = "";
    try {
      const parsed = typeof material.content === "string" ? JSON.parse(material.content) : null;
      if (parsed?.passage) {
        contentHtml = `<div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(parsed.passage)}</div>`;
      } else if (parsed?.audio) {
        contentHtml = `<p><b>Audio:</b> ${escapeHtml(parsed.audio)}</p>`;
      } else if (parsed?.words) {
        contentHtml = `<pre style="white-space:pre-wrap;">${escapeHtml(JSON.stringify(parsed.words, null, 2))}</pre>`;
      } else {
        contentHtml = `<div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(material.content || "")}</div>`;
      }
    } catch {
      contentHtml = `<div style="white-space:pre-wrap;line-height:1.6;">${escapeHtml(material.content || "")}</div>`;
    }

    let questionsHtml = "<p>No questions</p>";
    if (questions.length) {
      questionsHtml = `
        <div style="display:grid;gap:10px;">
          ${questions.map((q, i) => `
            <div style="padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
              <b>${i + 1}) ${escapeHtml(q.question_text || "")}</b>
              <div style="margin-top:8px;display:grid;gap:4px;">
                <div>A) ${escapeHtml(q.option_a || "")}</div>
                <div>B) ${escapeHtml(q.option_b || "")}</div>
                <div>C) ${escapeHtml(q.option_c || "")}</div>
                <div>D) ${escapeHtml(q.option_d || "")}</div>
                <div style="margin-top:6px;color:#059669;"><b>Correct:</b> ${escapeHtml(q.correct_option || "-")}</div>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    preview.innerHTML = `
      <div style="display:grid;gap:14px;">
        <div>
          <h4 style="margin-bottom:8px;">${escapeHtml(material.title || "-")}</h4>
          <p><b>Module:</b> ${escapeHtml(material.module || "-")}</p>
          <p><b>Type:</b> ${escapeHtml(material.type || "-")}</p>
          <p><b>Level:</b> ${escapeHtml(material.level || "-")}</p>
          <p><b>Status:</b> ${escapeHtml(material.review_status || "-")}</p>
        </div>

        <div>
          <h4 style="margin-bottom:8px;">Content</h4>
          ${contentHtml}
        </div>

        <div>
          <h4 style="margin-bottom:8px;">Questions</h4>
          ${questionsHtml}
        </div>
      </div>
    `;
  } catch (e) {
    console.error(e);
    preview.innerHTML = `<p>Connection error</p>`;
  }
}

async function approveMaterial(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/materials/${id}/approve`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);
    if (!res.ok) {
      toast(data?.message || "Approve error ❌");
      return;
    }

    toast("Material approved ✅");
    loadMaterials();
  } catch (e) {
    console.error(e);
    toast("Approve error ❌");
  }
}

async function rejectMaterial(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/materials/${id}/reject`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);
    if (!res.ok) {
      toast(data?.message || "Reject error ❌");
      return;
    }

    toast("Material rejected ✅");
    loadMaterials();
  } catch (e) {
    console.error(e);
    toast("Reject error ❌");
  }
}

async function unpublishMaterial(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/materials/${id}/unpublish`, {
      method: "POST",
      headers: { Authorization: "Bearer " + token }
    });

    const data = await safeJson(res);
    if (!res.ok) {
      toast(data?.message || "Unpublish error ❌");
      return;
    }

    toast("Material unpublished ✅");
    loadMaterials();
  } catch (e) {
    console.error(e);
    toast("Unpublish error ❌");
  }
}
// ====================== UTIL ======================
function toast(msg) {
  const el = $("toast");
  if (!el) return;
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