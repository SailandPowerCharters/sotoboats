const loginScreen = document.getElementById("loginScreen");
const portalScreen = document.getElementById("portalScreen");
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutBtn = document.getElementById("logoutBtn");
const bidDialog = document.getElementById("bidDialog");
const bidForm = document.getElementById("bidForm");
let dashboardData = null;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || data.message || "Something went wrong");
  return data;
}

function money(v) {
  if (v === null || v === undefined || v === "") return "—";
  return new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(v));
}

function dateText(v) {
  if (!v) return "Date TBA";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(v));
}

function switchView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  document.getElementById(`view-${name}`)?.classList.add("active");
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
document.querySelectorAll("[data-go]").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.go)));

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "";
  const data = Object.fromEntries(new FormData(loginForm).entries());
  try {
    const result = await api("/api/login", { method: "POST", body: JSON.stringify(data) });
    if (result.user.role !== "owner") throw new Error("This login is not an owner account");
    await loadDashboard();
  } catch (err) {
    loginMessage.textContent = err.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  portalScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
});

async function boot() {
  try {
    const me = await api("/api/me");
    if (me.user?.role === "owner") return loadDashboard();
  } catch {}
  loginScreen.classList.remove("hidden");
}

async function loadDashboard() {
  dashboardData = await api("/api/owner/dashboard");
  loginScreen.classList.add("hidden");
  portalScreen.classList.remove("hidden");

  const user = dashboardData.user;
  document.getElementById("welcomeTitle").textContent = `Welcome back, ${user.fullName}.`;
  document.getElementById("welcomeSub").textContent = dashboardData.opportunities.length
    ? `You have ${dashboardData.opportunities.length} charter opportunities waiting.`
    : "You're all caught up.";
  document.getElementById("userName").textContent = user.fullName;
  document.getElementById("userInitial").textContent = (user.fullName || "S").charAt(0).toUpperCase();
  document.getElementById("opportunityCount").textContent = dashboardData.opportunities.length;

  renderDashboard();
  renderBoats();
  renderAvailability();
  renderOpportunities();
  renderBids();
  populateBidBoats();
}

function renderDashboard() {
  const latest = dashboardData.opportunities[0];
  const latestEl = document.getElementById("latestOpportunity");
  if (!latest) {
    latestEl.className = "empty-state";
    latestEl.textContent = "No opportunities yet.";
  } else {
    latestEl.className = "";
    latestEl.innerHTML = `
      <div class="op-mini">
        <img src="${dashboardData.boats[0]?.image_url || 'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=800'}" alt="">
        <div>
          <h4>${latest.title}</h4>
          <div class="meta-row">
            <span>${dateText(latest.charter_date)}</span>
            <span>${latest.guests || "—"} guests</span>
            <span>${latest.departure_area || "Area TBA"}</span>
            <span>${money(latest.budget_min)}–${money(latest.budget_max)}</span>
          </div>
          <button class="bid-now" onclick="openBid(${latest.id}, ${JSON.stringify(latest.title)})">Bid now →</button>
        </div>
      </div>`;
  }

  const boat = dashboardData.boats[0];
  document.getElementById("boatSummary").innerHTML = boat
    ? `<div class="boat-mini"><img src="${boat.image_url || 'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=500'}"><div><strong>${boat.name}</strong><small>${boat.marina || ""} · ${boat.capacity || "—"} guests</small></div></div>`
    : `<div class="empty-state">No boats added yet.</div>`;

  document.getElementById("availabilitySummary").innerHTML = buildAvailabilityRows(dashboardData.availability.slice(0, 4));
  document.getElementById("bidSummary").innerHTML = dashboardData.bids.length
    ? dashboardData.bids.slice(0, 4).map(b => `<div class="status-row"><div><strong>${b.title}</strong><br><small>${b.boat_name || ""}</small></div><span class="badge ${b.status === "won" ? "green" : b.status === "submitted" ? "blue" : "orange"}">${b.status}</span></div>`).join("")
    : `<div class="empty-state">No bids submitted yet.</div>`;
}

function buildAvailabilityRows(rows) {
  if (!rows.length) return `<div class="empty-state">No availability saved yet.</div>`;
  return rows.map(a => `<div class="status-row"><div><strong>${a.boat_name}</strong><br><small>${dateText(a.week_start)}</small></div><span class="badge ${a.status === "confirmed" ? "green" : a.status === "unavailable" ? "orange" : "blue"}">${a.status.replaceAll("_"," ")}</span></div>`).join("");
}

function renderBoats() {
  document.getElementById("boatsGrid").innerHTML = dashboardData.boats.length
    ? dashboardData.boats.map(b => `
      <article class="boat-card">
        <img src="${b.image_url || 'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=800'}">
        <div class="body">
          <span class="badge green">Ready to sail</span>
          <h3>${b.name}</h3>
          <p>${b.boat_type || "Boat"} · ${b.marina || "Marina TBA"} · ${b.capacity || "—"} guests</p>
          <p>Half day ${money(b.half_day_price)} · Full day ${money(b.full_day_price)}</p>
        </div>
      </article>`).join("")
    : `<div class="empty-state">Add your first boat using the form.</div>`;
}

document.getElementById("boatForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.currentTarget).entries());
  try {
    await api("/api/owner/boats", { method: "POST", body: JSON.stringify(data) });
    e.currentTarget.reset();
    await loadDashboard();
    switchView("boats");
  } catch (err) {
    alert(err.message);
  }
});

function mondayOfWeek(offset = 0) {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1 + offset * 7);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0,10);
}

function renderAvailability() {
  const holder = document.getElementById("availabilityManager");
  if (!dashboardData.boats.length) {
    holder.innerHTML = `<div class="card">Add a boat first.</div>`;
    return;
  }

  holder.innerHTML = dashboardData.boats.map(boat => {
    const weeks = [0,1,2,3].map(i => {
      const date = mondayOfWeek(i);
      const current = dashboardData.availability.find(a => Number(a.boat_id) === Number(boat.id) && String(a.week_start).slice(0,10) === date);
      return `<div class="week-box">
        <strong>${i === 0 ? "This week" : `Week ${i+1}`}</strong>
        <small>${dateText(date)}</small>
        <select data-boat="${boat.id}" data-week="${date}">
          <option value="confirmed" ${current?.status === "confirmed" ? "selected" : ""}>Confirmed</option>
          <option value="to_be_advised" ${!current || current?.status === "to_be_advised" ? "selected" : ""}>To be advised</option>
          <option value="unavailable" ${current?.status === "unavailable" ? "selected" : ""}>Unavailable</option>
        </select>
      </div>`;
    }).join("");

    return `<section class="availability-boat"><h3>${boat.name}</h3><div class="availability-weeks">${weeks}</div></section>`;
  }).join("");

  holder.querySelectorAll("select").forEach(sel => sel.addEventListener("change", async () => {
    try {
      await api("/api/owner/availability", {
        method: "POST",
        body: JSON.stringify({ boatId: sel.dataset.boat, weekStart: sel.dataset.week, status: sel.value })
      });
    } catch (err) {
      alert(err.message);
    }
  }));
}

function renderOpportunities() {
  document.getElementById("opportunitiesList").innerHTML = dashboardData.opportunities.length
    ? dashboardData.opportunities.map(o => `
      <article class="opportunity-card">
        <div class="body">
          <span class="tag gold">FRESH CHARTER REQUEST</span>
          <h3>${o.title}</h3>
          <p>${o.notes || "No additional notes."}</p>
          <div class="meta-row">
            <span>${dateText(o.charter_date)}</span>
            <span>${o.guests || "—"} guests</span>
            <span>${o.departure_area || "Area TBA"}</span>
            <span>${money(o.budget_min)}–${money(o.budget_max)}</span>
          </div>
          <button class="bid-now" onclick="openBid(${o.id}, ${JSON.stringify(o.title)})">Bid now →</button>
        </div>
      </article>`).join("")
    : `<div class="card">No current opportunities.</div>`;
}

function renderBids() {
  const holder = document.getElementById("bidsTable");
  if (!dashboardData.bids.length) {
    holder.innerHTML = `<div class="empty-state">No bids submitted yet.</div>`;
    return;
  }
  holder.innerHTML = `<table class="bids-table"><thead><tr><th>Opportunity</th><th>Boat</th><th>Bid</th><th>Status</th><th>Date</th></tr></thead><tbody>${dashboardData.bids.map(b => `<tr><td>${b.title}</td><td>${b.boat_name || "—"}</td><td>${money(b.bid_price)}</td><td><span class="badge ${b.status === "won" ? "green" : "blue"}">${b.status}</span></td><td>${dateText(b.created_at)}</td></tr>`).join("")}</tbody></table>`;
}

function populateBidBoats() {
  document.getElementById("bidBoatSelect").innerHTML = `<option value="">Choose boat</option>` + dashboardData.boats.map(b => `<option value="${b.id}">${b.name} · ${b.marina || ""}</option>`).join("");
}

window.openBid = function(id, title) {
  bidForm.reset();
  bidForm.elements.opportunityId.value = id;
  document.getElementById("bidDialogTitle").textContent = title;
  document.getElementById("bidMessage").textContent = "";
  bidDialog.showModal();
};

bidForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(bidForm);
  const payload = Object.fromEntries(fd.entries());
  payload.availabilityConfirmed = fd.get("availabilityConfirmed") === "on";
  try {
    await api("/api/owner/bids", { method: "POST", body: JSON.stringify(payload) });
    document.getElementById("bidMessage").style.color = "green";
    document.getElementById("bidMessage").textContent = "Bid submitted.";
    setTimeout(async () => {
      bidDialog.close();
      await loadDashboard();
      switchView("bids");
    }, 700);
  } catch (err) {
    document.getElementById("bidMessage").textContent = err.message;
  }
});

boot();
