const login = document.getElementById("adminLogin");
const app = document.getElementById("adminApp");
const form = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("adminLoginMessage");
let data = null;

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong");
  return body;
}
function money(v){if(v===null||v===undefined||v==="")return"—";return new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(v))}
function dateText(v){if(!v)return"—";return new Intl.DateTimeFormat("en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v))}

function switchView(name){
  document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
  document.querySelectorAll(".nav").forEach(b=>b.classList.toggle("active",b.dataset.view===name));
  document.getElementById(`view-${name}`)?.classList.add("active");
}
document.querySelectorAll(".nav").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b=>b.addEventListener("click",()=>switchView(b.dataset.go)));

form.addEventListener("submit",async e=>{
  e.preventDefault(); loginMessage.textContent="";
  try{
    const result=await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(form).entries()))});
    if(result.user.role!=="admin")throw new Error("This login is not an admin account");
    await load();
  }catch(err){loginMessage.textContent=err.message}
});

document.getElementById("adminLogout").addEventListener("click",async()=>{
  await api("/api/logout",{method:"POST"}); app.classList.add("hidden"); login.classList.remove("hidden");
});

async function boot(){
  try{
    const me=await api("/api/me");
    if(me.user?.role==="admin")return load();
  }catch{}
}
async function load(){
  data=await api("/api/admin/dashboard");
  login.classList.add("hidden"); app.classList.remove("hidden");
  render();
}

function render(){
  document.getElementById("statOwners").textContent=data.owners.length;
  document.getElementById("statBoats").textContent=data.boats.length;
  document.getElementById("statOpps").textContent=data.opportunities.filter(o=>o.status==="open").length;
  document.getElementById("statBids").textContent=data.bids.length;

  document.getElementById("latestOpps").innerHTML=data.opportunities.length
    ? data.opportunities.slice(0,5).map(o=>`<div class="request-card"><div><h3>${o.title}</h3><p>${o.departure_area||"Area TBA"} · ${dateText(o.charter_date)}</p></div><span class="badge">${o.status}</span></div>`).join("")
    : `<div class="empty">No opportunities yet.</div>`;

  document.getElementById("opportunitiesAdmin").innerHTML=data.opportunities.length
    ? data.opportunities.map(o=>`<article class="request-card"><div><h3>${o.title}</h3><p>${o.notes||"No notes"}</p><div class="meta"><span>${dateText(o.charter_date)}</span><span>${o.guests||"—"} guests</span><span>${o.departure_area||"—"}</span><span>${money(o.budget_min)}–${money(o.budget_max)}</span></div></div><button class="broadcast-btn" onclick="broadcast(${o.id})">Broadcast to owners</button></article>`).join("")
    : `<div class="card">No opportunities yet.</div>`;

  document.getElementById("ownersAdmin").innerHTML=data.owners.length
    ? `<table class="table"><thead><tr><th>OWNER</th><th>COMPANY</th><th>EMAIL</th><th>PHONE</th><th>STATUS</th></tr></thead><tbody>${data.owners.map(o=>`<tr><td>${o.full_name}</td><td>${o.company_name||"—"}</td><td>${o.email}</td><td>${o.phone||"—"}</td><td><span class="badge green">${o.status}</span></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">No registered owners.</div>`;

  document.getElementById("bidsAdmin").innerHTML=data.bids.length
    ? `<table class="table"><thead><tr><th>REQUEST</th><th>OWNER</th><th>BOAT</th><th>BID</th><th>STATUS</th></tr></thead><tbody>${data.bids.map(b=>`<tr><td>${b.public_ref}<br>${b.title}</td><td>${b.owner_name}</td><td>${b.boat_name||"—"}</td><td>${money(b.bid_price)}</td><td><span class="badge">${b.status}</span></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">No bids yet.</div>`;
}

document.getElementById("opportunityForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const msg=document.getElementById("opportunityMessage"); msg.textContent="";
  try{
    await api("/api/admin/opportunities",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget).entries()))});
    e.currentTarget.reset(); msg.style.color="green"; msg.textContent="Opportunity created.";
    await load();
  }catch(err){msg.style.color="#b45151";msg.textContent=err.message}
});

window.broadcast=async function(id){
  if(!confirm("Send this charter opportunity to all active registered owners?"))return;
  try{
    const result=await api(`/api/admin/opportunities/${id}/broadcast`,{method:"POST",body:JSON.stringify({ownerIds:[]})});
    alert(`Broadcast sent to ${result.sentTo} owner(s).`);
  }catch(err){alert(err.message)}
};

boot();
