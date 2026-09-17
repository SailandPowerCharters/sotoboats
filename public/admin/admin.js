
const login = document.getElementById("adminLogin");
const app = document.getElementById("adminApp");
const form = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("adminLoginMessage");
let data = null;
let currentLang = localStorage.getItem("sotoboatsAdminLang") || "en";

const translations = {
  en: {
    controlCentre:"Control Centre", dashboard:"Dashboard", charterRequests:"Charter Requests", owners:"Owners", bids:"Bids",
    logout:"Log out", adminIntro:"Manage owners, charter opportunities and incoming bids.", email:"Email", password:"Password",
    enterAdmin:"Enter Admin", charterControlCentre:"Charter Control Centre", liveNetwork:"● Live network",
    ownersCaps:"OWNERS", boatsCaps:"BOATS", openRequestsCaps:"OPEN REQUESTS", bidsCaps:"BIDS",
    createOpportunity:"Create Charter Opportunity", title:"Title", date:"Date", startTime:"Start time", endTime:"End time",
    guests:"Guests", departureArea:"Departure area", preferredBoatType:"Preferred boat type", extras:"Extras",
    budgetMin:"Budget min (€)", budgetMax:"Budget max (€)", notes:"Notes", bidDeadline:"Bid deadline",
    createOpportunityButton:"Create opportunity", latestRequests:"Latest Requests", viewAll:"View all",
    charterRequestsCaps:"CHARTER REQUESTS", broadcastOpportunities:"Broadcast opportunities",
    broadcastHelp:"Create a request, then send it to all active registered owners.",
    ownerNetworkCaps:"OWNER NETWORK", registeredOwners:"Registered Owners", bidBoardCaps:"BID BOARD",
    compareBids:"Compare incoming bids", titlePlaceholder:"Family day charter", boatTypePlaceholder:"Motor yacht",
    extrasPlaceholder:"Skipper + drinks", noOpportunities:"No opportunities yet.", noOwners:"No registered owners.",
    noBids:"No bids yet.", broadcastButton:"Broadcast to owners", broadcastConfirm:"Send this charter opportunity to all active registered owners?",
    broadcastSent:"Broadcast sent to {count} owner(s).", opportunityCreated:"Opportunity created.",
    ownerTable:"OWNER", companyTable:"COMPANY", emailTable:"EMAIL", phoneTable:"PHONE", statusTable:"STATUS",
    requestTable:"REQUEST", boatTable:"BOAT", bidTable:"BID"
  },
  es: {
    controlCentre:"Centro de Control", dashboard:"Panel", charterRequests:"Solicitudes de Charter", owners:"Propietarios", bids:"Ofertas",
    logout:"Cerrar sesión", adminIntro:"Gestiona propietarios, oportunidades de charter y ofertas recibidas.", email:"Correo electrónico", password:"Contraseña",
    enterAdmin:"Entrar al Admin", charterControlCentre:"Centro de Control de Charters", liveNetwork:"● Red activa",
    ownersCaps:"PROPIETARIOS", boatsCaps:"EMBARCACIONES", openRequestsCaps:"SOLICITUDES ABIERTAS", bidsCaps:"OFERTAS",
    createOpportunity:"Crear oportunidad de charter", title:"Título", date:"Fecha", startTime:"Hora de inicio", endTime:"Hora de fin",
    guests:"Pasajeros", departureArea:"Zona de salida", preferredBoatType:"Tipo de embarcación", extras:"Extras",
    budgetMin:"Presupuesto mín. (€)", budgetMax:"Presupuesto máx. (€)", notes:"Notas", bidDeadline:"Fecha límite de oferta",
    createOpportunityButton:"Crear oportunidad", latestRequests:"Últimas solicitudes", viewAll:"Ver todas",
    charterRequestsCaps:"SOLICITUDES DE CHARTER", broadcastOpportunities:"Enviar oportunidades",
    broadcastHelp:"Crea una solicitud y envíala a todos los propietarios activos registrados.",
    ownerNetworkCaps:"RED DE PROPIETARIOS", registeredOwners:"Propietarios registrados", bidBoardCaps:"TABLÓN DE OFERTAS",
    compareBids:"Comparar ofertas recibidas", titlePlaceholder:"Charter familiar de día", boatTypePlaceholder:"Yate a motor",
    extrasPlaceholder:"Patrón + bebidas", noOpportunities:"Todavía no hay oportunidades.", noOwners:"No hay propietarios registrados.",
    noBids:"Todavía no hay ofertas.", broadcastButton:"Enviar a propietarios", broadcastConfirm:"¿Enviar esta oportunidad a todos los propietarios activos registrados?",
    broadcastSent:"Enviado a {count} propietario(s).", opportunityCreated:"Oportunidad creada.",
    ownerTable:"PROPIETARIO", companyTable:"EMPRESA", emailTable:"EMAIL", phoneTable:"TELÉFONO", statusTable:"ESTADO",
    requestTable:"SOLICITUD", boatTable:"EMBARCACIÓN", bidTable:"OFERTA"
  }
};

function t(key){ return translations[currentLang][key] || translations.en[key] || key; }

function applyLanguage(lang){
  currentLang = lang;
  localStorage.setItem("sotoboatsAdminLang", lang);
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if(translations[lang][key]) el.textContent = translations[lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if(translations[lang][key]) el.placeholder = translations[lang][key];
  });
  document.querySelectorAll(".lang-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.lang === lang));
  if(data) render();
}

document.querySelectorAll(".lang-btn").forEach(btn => {
  btn.addEventListener("click", e => {
    e.preventDefault();
    applyLanguage(btn.dataset.lang);
  });
});

async function api(url, options = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Something went wrong");
  return body;
}
function money(v){if(v===null||v===undefined||v==="")return"—";return new Intl.NumberFormat(currentLang==="es"?"es-ES":"en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(Number(v))}
function dateText(v){if(!v)return"—";return new Intl.DateTimeFormat(currentLang==="es"?"es-ES":"en-GB",{day:"numeric",month:"short",year:"numeric"}).format(new Date(v))}

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
  applyLanguage(currentLang);
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
    ? data.opportunities.slice(0,5).map(o=>`<div class="request-card"><div><h3>${o.title}</h3><p>${o.departure_area||"—"} · ${dateText(o.charter_date)}</p></div><span class="badge">${o.status}</span></div>`).join("")
    : `<div class="empty">${t("noOpportunities")}</div>`;

  document.getElementById("opportunitiesAdmin").innerHTML=data.opportunities.length
    ? data.opportunities.map(o=>`<article class="request-card"><div><h3>${o.title}</h3><p>${o.notes||"—"}</p><div class="meta"><span>${dateText(o.charter_date)}</span><span>${o.guests||"—"} ${t("guests").toLowerCase()}</span><span>${o.departure_area||"—"}</span><span>${money(o.budget_min)}–${money(o.budget_max)}</span></div></div><button class="broadcast-btn" onclick="broadcast(${o.id})">${t("broadcastButton")}</button></article>`).join("")
    : `<div class="card">${t("noOpportunities")}</div>`;

  document.getElementById("ownersAdmin").innerHTML=data.owners.length
    ? `<table class="table"><thead><tr><th>${t("ownerTable")}</th><th>${t("companyTable")}</th><th>${t("emailTable")}</th><th>${t("phoneTable")}</th><th>${t("statusTable")}</th></tr></thead><tbody>${data.owners.map(o=>`<tr><td>${o.full_name}</td><td>${o.company_name||"—"}</td><td>${o.email}</td><td>${o.phone||"—"}</td><td><span class="badge green">${o.status}</span></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">${t("noOwners")}</div>`;

  document.getElementById("bidsAdmin").innerHTML=data.bids.length
    ? `<table class="table"><thead><tr><th>${t("requestTable")}</th><th>${t("ownerTable")}</th><th>${t("boatTable")}</th><th>${t("bidTable")}</th><th>${t("statusTable")}</th></tr></thead><tbody>${data.bids.map(b=>`<tr><td>${b.public_ref}<br>${b.title}</td><td>${b.owner_name}</td><td>${b.boat_name||"—"}</td><td>${money(b.bid_price)}</td><td><span class="badge">${b.status}</span></td></tr>`).join("")}</tbody></table>`
    : `<div class="empty">${t("noBids")}</div>`;
}

document.getElementById("opportunityForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const formEl=e.currentTarget;
  const msg=document.getElementById("opportunityMessage");
  msg.textContent="";
  const payload=Object.fromEntries(new FormData(formEl).entries());
  try{
    await api("/api/admin/opportunities",{method:"POST",body:JSON.stringify(payload)});
    formEl.reset();
    msg.style.color="green";
    msg.textContent=t("opportunityCreated");
    await load();
  }catch(err){
    msg.style.color="#b45151";
    msg.textContent=err.message;
  }
});

window.broadcast=async function(id){
  if(!confirm(t("broadcastConfirm")))return;
  try{
    const result=await api(`/api/admin/opportunities/${id}/broadcast`,{method:"POST",body:JSON.stringify({ownerIds:[]})});
    alert(t("broadcastSent").replace("{count}",result.sentTo));
  }catch(err){alert(err.message)}
};

boot();
