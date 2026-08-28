const helmData = {
  charter:{rotation:0,kicker:"CHARTER",title:"Make the Mediterranean yours.",text:"Browse featured boats or tell us what you need and we will find the right charter for you.",cta:"Explore charters →",href:"#charter",heroCta:"Explore charters",intro:"Charter, buy, sell and enjoy the Mediterranean with one trusted local team.",image:"https://images.unsplash.com/photo-1566847438217-76e82d383f84?auto=format&fit=crop&w=2200&q=90"},
  sale:{rotation:-90,kicker:"BOATS FOR SALE",title:"Your next boat could be closer than you think.",text:"Explore selected vessels offered through Sotoboats and trusted owners across the western Costa del Sol.",cta:"View boats for sale →",href:"#sale",heroCta:"View boats for sale",intro:"Discover boats for sale with local guidance, clear communication and a personal brokerage service.",image:"https://images.unsplash.com/photo-1540946485063-a40da27545f8?auto=format&fit=crop&w=2200&q=90"},
  services:{rotation:-180,kicker:"MARINE SERVICES",title:"One local team. One point of contact.",text:"From maintenance and preparation to owner support and logistics, Sotoboats helps keep everything moving.",cta:"Explore marine services →",href:"#services",heroCta:"Marine services",intro:"Practical marine support and trusted local coordination for owners on the Costa del Sol.",image:"https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=2200&q=90"},
  sell:{rotation:-270,kicker:"SELL YOUR BOAT",title:"Sell with local expertise behind you.",text:"Professional presentation, qualified enquiries and straightforward brokerage from valuation to handover.",cta:"Request a valuation →",href:"#sell",heroCta:"Request a valuation",intro:"Present your boat properly, reach serious buyers and let Sotoboats manage the process from start to finish.",image:"https://images.unsplash.com/photo-1562281302-809108fd533c?auto=format&fit=crop&w=2200&q=90"}
};

const wheel=document.getElementById("helmWheel"),preview=document.getElementById("helmPreview"),heroBackdrop=document.getElementById("heroBackdrop");
const previewKicker=document.getElementById("previewKicker"),previewTitle=document.getElementById("previewTitle"),previewText=document.getElementById("previewText"),previewLink=document.getElementById("previewLink"),primaryHeroCta=document.getElementById("primaryHeroCta"),heroIntro=document.getElementById("heroIntro");
const options=[...document.querySelectorAll(".helm-option")];

function activateHelm(key){
  const d=helmData[key]; if(!d)return;
  options.forEach(b=>b.classList.toggle("active",b.dataset.key===key));
  preview.classList.add("is-changing");
  wheel.style.transform=`rotate(${d.rotation}deg)`;
  heroBackdrop.style.transform="scale(1.045)";
  setTimeout(()=>{
    previewKicker.textContent=d.kicker; previewTitle.textContent=d.title; previewText.textContent=d.text;
    previewLink.textContent=d.cta; previewLink.href=d.href; primaryHeroCta.textContent=d.heroCta; primaryHeroCta.href=d.href;
    heroIntro.textContent=d.intro; heroBackdrop.style.backgroundImage=`url("${d.image}")`;
    preview.classList.remove("is-changing");
  },210);
  setTimeout(()=>heroBackdrop.style.transform="scale(1.02)",700);
}
options.forEach(b=>b.addEventListener("click",()=>activateHelm(b.dataset.key)));

const toggle=document.querySelector(".menu-toggle"),nav=document.querySelector(".main-nav");
toggle.addEventListener("click",()=>{const open=nav.classList.toggle("open");toggle.setAttribute("aria-expanded",String(open));});
document.querySelectorAll(".main-nav a").forEach(a=>a.addEventListener("click",()=>nav.classList.remove("open")));
document.getElementById("year").textContent=new Date().getFullYear();

window.addEventListener("load",()=>setTimeout(()=>{
  wheel.animate([{transform:"rotate(-6deg)"},{transform:"rotate(7deg)"},{transform:"rotate(0deg)"}],{duration:1000,easing:"cubic-bezier(.2,.8,.2,1)"});
},650));
