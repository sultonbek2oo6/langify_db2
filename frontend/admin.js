// ====================== HELPERS ======================
const API = "http://localhost:3000";
const $ = (id) => document.getElementById(id);

let ALL_USERS = [];
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

  // Dashboard (✅ file:// muammo bo‘lmasin)
  $("backBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
         
    localStorage.setItem("goDashboard", "1");

    window.location.href = "./index.html";
  });

  // Refresh
  $("refreshBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    loadUsers();
  });

  // Live search
  $("searchInput")?.addEventListener("input", applyFilters);

  // Enter bosilganda ham qidirish
  $("searchInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyFilters();
    }
  });

  // Pusk button
  $("searchBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    applyFilters();
  });

  // Filters
  $("filterPlan")?.addEventListener("change", applyFilters);
  $("filterRole")?.addEventListener("change", applyFilters);

  // Modal buttons
  $("confirmCancel")?.addEventListener("click", closeConfirm);
  $("confirmOk")?.addEventListener("click", confirmOk);

  loadUsers();
});

// ====================== DATA LOAD ======================
async function loadUsers() {
  const token = localStorage.getItem("token");
  const tbody = $("usersTable");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7">Loading...</td></tr>`;

  try {
    const res = await fetch(`${API}/admin/users`, {
      headers: { Authorization: "Bearer " + token },
    });

    if (res.status === 401 || res.status === 403) {
      toast("Ruxsat yo‘q (Admin only) ❌");
      localStorage.clear();
      window.location.href = "index.html";
      return;
    }

    if (!res.ok) {
      const e = await safeJson(res);
      toast(e?.message || `Server error (${res.status}) ❌`);
      tbody.innerHTML = `<tr><td colspan="7">Load error</td></tr>`;
      return;
    }

    const users = await safeJson(res);
    ALL_USERS = Array.isArray(users) ? users : [];

    // render + filter
    applyFilters(); // ichida renderUsers + updateKpis bor
  } catch (err) {
    console.error(err);
    toast("Internet/Serverga ulanishda xatolik ❌");
    tbody.innerHTML = `<tr><td colspan="7">Connection error</td></tr>`;
  }
}

// ====================== FILTERS ======================
function applyFilters() {
  const q = (($("searchInput")?.value || "").toLowerCase().trim());
  const plan = $("filterPlan")?.value || "all";
  const role = $("filterRole")?.value || "all";

  const filtered = ALL_USERS.filter((u) => {
    const planVal = (u.plan || "free"); // server plan qaytarmasa ham free bo‘lib turadi
    const roleVal = (u.role || "user");

    const idStr = String(u.id ?? "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const username = (u.username || "").toLowerCase();

    const matchQ = !q || idStr.includes(q) || email.includes(q) || username.includes(q);
    const matchPlan = plan === "all" ? true : planVal === plan;
    const matchRole = role === "all" ? true : roleVal === role;

    return matchQ && matchPlan && matchRole;
  });

  updateKpis(filtered);
  renderUsers(filtered);
}

// ====================== RENDER ======================
function renderUsers(users) {
  const tbody = $("usersTable");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="7">No users found</td></tr>`;
    return;
  }

  users.forEach((u) => {
    const planVal = u.plan || "free";

    const roleChipClass = u.role === "admin" ? "chip-admin" : "chip-user";
    const planChipClass =
      planVal === "premium" ? "chip-premium" :
      planVal === "pro" ? "chip-pro" : "chip-free";

    const created = formatDate(u.created_at);

    const tr = document.createElement("tr");
    tr.className = "admin-row";
    tr.innerHTML = `
      <td>${u.id}</td>
      <td>${escapeHtml(u.username || "")}</td>
      <td>${escapeHtml(u.email || "")}</td>

      <td>
        <span class="admin-chip ${roleChipClass}">${escapeHtml(u.role || "user")}</span>
        <select class="admin-select" id="role-${u.id}">
          <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
        </select>
      </td>

      <td>
        <span class="admin-chip ${planChipClass}">${escapeHtml(planVal)}</span>
        <select class="admin-select" id="plan-${u.id}">
          <option value="free" ${planVal === "free" ? "selected" : ""}>free</option>
          <option value="premium" ${planVal === "premium" ? "selected" : ""}>premium</option>
          <option value="pro" ${planVal === "pro" ? "selected" : ""}>pro</option>
        </select>
      </td>

      <td>${created}</td>

      <td>
        <div class="admin-actions">
          <button class="admin-btn admin-mini save" data-id="${u.id}">Save</button>
          <button class="admin-btn admin-mini delete" data-id="${u.id}">Delete</button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // bind save/delete
  tbody.querySelectorAll(".admin-mini.save").forEach((btn) => {
    btn.addEventListener("click", () => saveUser(btn.dataset.id, btn));
  });

  tbody.querySelectorAll(".admin-mini.delete").forEach((btn) => {
    btn.addEventListener("click", () => openConfirm(btn.dataset.id));
  });
}

// ====================== SAVE ======================
async function saveUser(id, btn) {
  const token = localStorage.getItem("token");

  const roleSel = document.getElementById(`role-${id}`);
  const planSel = document.getElementById(`plan-${id}`);

  const newRole = roleSel ? roleSel.value : "user";
  const newPlanRaw = planSel ? planSel.value : "free";
  const newPlan = newPlanRaw === "free" ? null : newPlanRaw;

  // UX
  const oldText = btn?.textContent || "Save";
  if (btn) {
    btn.textContent = "Saving...";
    btn.disabled = true;
    btn.style.opacity = "0.85";
  }

  try {
    // role update
    const r1 = await fetch(`${API}/admin/users/${id}/role`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ role: newRole }),
    });

    if (!r1.ok) {
      const e = await safeJson(r1);
      toast(e?.message || "Role update error ❌");
      return;
    }

    // plan update
    const r2 = await fetch(`${API}/admin/users/${id}/plan`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ plan: newPlan }),
    });

    if (!r2.ok) {
      const e = await safeJson(r2);
      toast(e?.message || "Plan update error ❌");
      return;
    }

    toast("Saved ✅");
    await loadUsers();
  } catch (err) {
    console.error(err);
    toast("Saqlashda xatolik ❌");
  } finally {
    if (btn) {
      btn.textContent = oldText;
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  }
}

// ====================== DELETE + MODAL ======================
function openConfirm(id) {
  PENDING_DELETE_ID = id;

  const textEl = $("confirmText");
  const modalEl = $("confirmModal");

  if (textEl) textEl.textContent = `User ID ${id} ni o‘chirmoqchimisiz?`;
  if (modalEl) modalEl.style.display = "block";
}

function closeConfirm() {
  PENDING_DELETE_ID = null;
  const modalEl = $("confirmModal");
  if (modalEl) modalEl.style.display = "none";
}

async function confirmOk() {
  if (!PENDING_DELETE_ID) return;
  await deleteUser(PENDING_DELETE_ID);
  closeConfirm();
}

async function deleteUser(id) {
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`${API}/admin/users/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token },
    });

    if (!res.ok) {
      const e = await safeJson(res);
      toast(e?.message || "Delete error ❌");
      return;
    }

    toast("Deleted ✅");
    await loadUsers();
  } catch (err) {
    console.error(err);
    toast("O‘chirishda xatolik ❌");
  }
}

// ====================== KPI ======================
function updateKpis(users) {
  const total = users.length;
  const premium = users.filter((u) => (u.plan || "free") === "premium").length;
  const pro = users.filter((u) => (u.plan || "free") === "pro").length;

  if ($("kpiTotal")) $("kpiTotal").textContent = String(total);
  if ($("kpiPremium")) $("kpiPremium").textContent = String(premium);
  if ($("kpiPro")) $("kpiPro").textContent = String(pro);
}

// ====================== UI UTIL ======================
function toast(msg) {
  const el = $("toast");
  if (!el) return;

  el.textContent = msg;
  el.style.display = "block";

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    el.style.display = "none";
  }, 2200);
}

async function safeJson(res) {
  try { return await res.json(); }
  catch { return null; }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}