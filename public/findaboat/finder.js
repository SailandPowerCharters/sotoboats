const boats = [
  {
    id: "jaz",
    name: "Jaz II",
    type: "Jeanneau Sun Odyssey 45 DS",
    image: "https://static.wixstatic.com/media/24ac4e_42b5209b6ac84a2896f864776a94a8d2~mv2.jpeg",
    occasions: ["private","family","sunset","sailing","waterfun"],
    prices: {2:412,4:690,6:920,8:1102},
    included: "Skipper, hostess, snacks, drinks, music, snorkelling and paddleboards.",
    note: "A strong choice when the sailing itself is part of the experience."
  },
  {
    id: "master",
    name: "Master V",
    type: "Lagoon 380 Catamaran",
    image: "/media/family-paddleboard.jpg",
    occasions: ["private","celebration","henstag","family","sunset","waterfun"],
    prices: {2:484,4:914,6:1271,8:1610},
    included: "Skipper, hostess, snacks, drinks, music, snorkelling and paddleboards.",
    note: "Lots of sociable deck space for groups, families and celebrations."
  },
  {
    id: "sll",
    name: "Sarah's Lucky Lady",
    type: "Sunseeker Camargue 50",
    image: "/media/sll.jpg",
    occasions: ["private","celebration","henstag","family","sunset","waterfun"],
    prices: {2:850,4:1550,6:2300,8:2650},
    included: "Fuel, skipper, hostess, snacks, drinks, music, snorkelling and paddleboards.",
    note: "A premium motor-yacht option for celebrations and a faster day on the coast."
  }
];

const form = document.getElementById("boatFinderForm");
const resultsSection = document.getElementById("resultsSection");
const results = document.getElementById("boatResults");
const resultsTitle = document.getElementById("resultsTitle");
const startAgain = document.getElementById("startAgain");
const sendWhatsApp = document.getElementById("sendWhatsApp");

let currentMatches = [];
let selectedBoatIds = new Set();
let lastAnswers = null;

const money = n => new Intl.NumberFormat("en-IE",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n);

function matchScore(boat, occasion){
  let score = boat.occasions.includes(occasion) ? 10 : 0;
  if(occasion === "sailing" && boat.id === "jaz") score += 10;
  if((occasion === "celebration" || occasion === "henstag") && boat.id === "master") score += 4;
  if(occasion === "private" && boat.id === "sll") score += 3;
  return score;
}

function renderBoat(boat, duration){
  const price = boat.prices[duration];
  const tag = boat.id === "jaz" ? "BEST FOR SAILING" :
              boat.id === "master" ? "GREAT FOR GROUPS" :
              "MOTOR YACHT OPTION";
  return `
    <article class="boat-result">
      <img src="${boat.image}" alt="${boat.name}">
      <div class="boat-result-body">
        <span class="match-tag">${tag}</span>
        <span class="boat-type">${boat.type}</span>
        <h3>${boat.name}</h3>
        <p>${boat.note}</p>
        <p><strong>Included:</strong> ${boat.included}</p>
        <div class="boat-price">
          <div>
            <small>INDICATIVE ${duration}-HOUR PRICE</small>
            <strong>${money(price)}</strong>
          </div>
          <small>Subject to availability<br>and confirmation</small>
        </div>
        <button class="select-boat" type="button" data-boat="${boat.id}">Add to my shortlist</button>
      </div>
    </article>
  `;
}

form.addEventListener("submit", e => {
  e.preventDefault();

  const data = new FormData(form);
  const guests = Number(data.get("guests"));
  const duration = Number(data.get("duration"));
  const budget = Number(data.get("budget") || 99999);
  const occasion = data.get("occasion");
  const extras = data.getAll("extras");

  lastAnswers = {
    date: data.get("date"),
    guests,
    duration,
    budget,
    occasion,
    extras
  };

  selectedBoatIds.clear();

  if(guests > 12){
    currentMatches = [];
    results.innerHTML = `
      <article class="network-card">
        <p class="finder-eyebrow">LARGER GROUP</p>
        <h3>We’ll search the wider Sotoboats network.</h3>
        <p>Your group is larger than the three example boats shown in this first version. Send us the enquiry and we’ll look for suitable larger boats and catamarans.</p>
      </article>
    `;
    resultsTitle.textContent = "Let us source something larger.";
  } else {
    currentMatches = boats
      .filter(b => b.prices[duration])
      .map(b => ({...b, score:matchScore(b,occasion)}))
      .filter(b => b.score > 0)
      .sort((a,b) => b.score-a.score || a.prices[duration]-b.prices[duration]);

    const withinBudget = currentMatches.filter(b => b.prices[duration] <= budget);
    const toShow = withinBudget.length ? withinBudget : currentMatches;

    if(!toShow.length){
      results.innerHTML = `
        <article class="network-card">
          <p class="finder-eyebrow">WE'LL SOURCE IT</p>
          <h3>Nothing in the example fleet quite fits.</h3>
          <p>That is exactly what the Sotoboats network is for. Send us your details and we’ll look for the right match.</p>
        </article>`;
      resultsTitle.textContent = "Let us find a better fit.";
    } else {
      results.innerHTML = toShow.map(b => renderBoat(b,duration)).join("");
      resultsTitle.textContent =
        withinBudget.length ? "These fit your plan." : "Closest matches to your plan.";
    }
  }

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({behavior:"smooth",block:"start"});
});

results.addEventListener("click", e => {
  const btn = e.target.closest(".select-boat");
  if(!btn) return;
  const id = btn.dataset.boat;
  if(selectedBoatIds.has(id)){
    selectedBoatIds.delete(id);
    btn.classList.remove("selected");
    btn.textContent = "Add to my shortlist";
  } else {
    selectedBoatIds.add(id);
    btn.classList.add("selected");
    btn.textContent = "✓ Added to shortlist";
  }
});

startAgain.addEventListener("click", () => {
  form.scrollIntoView({behavior:"smooth",block:"start"});
});

sendWhatsApp.addEventListener("click", () => {
  if(!lastAnswers){
    alert("Please complete the boat finder first.");
    return;
  }

  const name = document.getElementById("customerName").value.trim();
  const phone = document.getElementById("customerPhone").value.trim();
  const email = document.getElementById("customerEmail").value.trim();

  const selected = [...selectedBoatIds]
    .map(id => boats.find(b => b.id === id)?.name)
    .filter(Boolean);

  const message = [
    "Hi Sotoboats, I'd like help finding a charter.",
    "",
    `Date: ${lastAnswers.date || "Flexible"}`,
    `Group: ${lastAnswers.guests > 12 ? "More than 12" : `Up to ${lastAnswers.guests}`}`,
    `Duration: ${lastAnswers.duration} hours`,
    `Type: ${lastAnswers.occasion}`,
    `Budget: ${lastAnswers.budget >= 99999 ? "Open" : `Up to €${lastAnswers.budget}`}`,
    `Extras: ${lastAnswers.extras.length ? lastAnswers.extras.join(", ") : "None selected"}`,
    `Shortlist: ${selected.length ? selected.join(", ") : "Please recommend"}`,
    "",
    `Name: ${name || "Not supplied"}`,
    `Phone: ${phone || "Not supplied"}`,
    `Email: ${email || "Not supplied"}`
  ].join("\n");

  window.open(`https://wa.me/34644053656?text=${encodeURIComponent(message)}`,"_blank","noopener");
});

// Prevent past dates.
const tripDate = document.getElementById("tripDate");
if(tripDate){
  tripDate.min = new Date().toISOString().split("T")[0];
}
