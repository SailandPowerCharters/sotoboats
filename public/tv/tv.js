const scenes = [
  {
    image: "./media/hero-four-girls.jpg",
    eyebrow: "ESTEPONA · COSTA DEL SOL",
    title: "YOUR DAY AT SEA<br><span>STARTS HERE.</span>",
    lead: "Charter, celebrate, explore and make the Mediterranean yours."
  },
  {
    image: "./media/morocco-tv-hero.png",
    eyebrow: "SAIL TO MOROCCO",
    title: "A DIFFERENT KIND OF<br><span>SAILING ADVENTURE.</span>",
    lead: "Two days at sea, one night in Marina Smir aboard Jaz II — €250 per person per night."
  },
  {
    image: "./media/celebration.jpg",
    eyebrow: "CELEBRATE DIFFERENTLY",
    title: "THE BEST PARTIES<br><span>HAVE A HORIZON.</span>",
    lead: "Hen trips, birthdays and special occasions with the Costa del Sol as your backdrop."
  },
  {
    image: "./media/food-hero.jpg",
    eyebrow: "FOOD & DRINKS",
    title: "GOOD COMPANY.<br><span>GREAT MOMENTS.</span>",
    lead: "Champagne, snacks and the little extras that make a day at sea feel special."
  },
  {
    image: "./media/boat-sll.jpg",
    eyebrow: "OUR BOATS",
    title: "FIND THE BOAT<br><span>THAT FITS YOUR DAY.</span>",
    lead: "From relaxed private charters to larger group experiences, ask what's available today."
  },
  {
    image: "./media/paddleboard.jpg",
    eyebrow: "MORE THAN A CHARTER",
    title: "ADD A LITTLE MORE<br><span>ADVENTURE.</span>",
    lead: "Paddleboards, jet skis and on-the-water experiences for unforgettable days."
  }
];

const img = document.getElementById("sceneImage");
const eyebrow = document.getElementById("sceneEyebrow");
const title = document.getElementById("sceneTitle");
const lead = document.getElementById("sceneLead");

let current = 0;

function applySceneCrop(imagePath) {
  if (imagePath.includes("morocco-tv-hero.png")) {
    img.style.objectPosition = "center center";
  } else if (imagePath.includes("celebration.jpg")) {
    img.style.objectPosition = "center 12%";
  } else if (imagePath.includes("food-hero.jpg")) {
    img.style.objectPosition = "center 58%";
  } else if (imagePath.includes("paddleboard.jpg")) {
    img.style.objectPosition = "center 55%";
  } else {
    img.style.objectPosition = "center center";
  }
}

function showScene(index) {
  const scene = scenes[index];
  img.classList.add("fade");

  setTimeout(() => {
    img.src = scene.image;
    applySceneCrop(scene.image);

    eyebrow.textContent = scene.eyebrow;
    title.innerHTML = scene.title;
    lead.textContent = scene.lead;

    img.classList.remove("zoom");

    requestAnimationFrame(() => {
      img.classList.remove("fade");
      requestAnimationFrame(() => img.classList.add("zoom"));
    });
  }, 600);
}

window.addEventListener("load", () => {
  applySceneCrop(scenes[0].image);
  setTimeout(() => img.classList.add("zoom"), 250);
});

setInterval(() => {
  current = (current + 1) % scenes.length;
  showScene(current);
}, 9000);
