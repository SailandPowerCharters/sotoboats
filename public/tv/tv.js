const scenes = [
  {
    image: "./media/bow-friends.jpg",
    eyebrow: "MORE THAN A TRIP",
    title: "YOUR DAY<br>AT SEA,<br><span>BEAUTIFULLY DONE.</span>",
    lead: "Charters, celebrations, brokerage and Mediterranean experiences from Estepona."
  },
  {
    image: "./media/hero-four-girls.jpg",
    eyebrow: "GOOD PEOPLE · BLUE WATER",
    title: "MAKE<br>MEMORIES<br><span>AT SEA.</span>",
    lead: "Friends, family, birthdays and celebrations — built around your perfect day."
  },
  {
    image: "./media/celebration.jpg",
    eyebrow: "CELEBRATE DIFFERENTLY",
    title: "THE BEST<br>PARTIES HAVE<br><span>A HORIZON.</span>",
    lead: "Hen trips, birthdays and special occasions with the Costa del Sol as your backdrop."
  },
  {
    image: "./media/food.jpg",
    eyebrow: "STAY A LITTLE LONGER",
    title: "GOOD FOOD.<br>GOOD COMPANY.<br><span>NO RUSH.</span>",
    lead: "Add food, drinks and the little extras that turn a charter into a day to remember."
  },
  {
    image: "./media/boat-sll.jpg",
    eyebrow: "OUR BOATS",
    title: "FIND THE BOAT<br>THAT FITS<br><span>YOUR DAY.</span>",
    lead: "From relaxed private charters to larger celebrations, ask us what's available today."
  }
];

const img = document.getElementById("sceneImage");
const eyebrow = document.getElementById("sceneEyebrow");
const title = document.getElementById("sceneTitle");
const lead = document.getElementById("sceneLead");

let current = 0;

function showScene(index) {
  const scene = scenes[index];
  img.classList.add("fade");
  setTimeout(() => {
    img.src = scene.image;
    eyebrow.textContent = scene.eyebrow;
    title.innerHTML = scene.title;
    lead.textContent = scene.lead;
    img.classList.remove("zoom");
    requestAnimationFrame(() => {
      img.classList.remove("fade");
      requestAnimationFrame(() => img.classList.add("zoom"));
    });
  }, 650);
}

setInterval(() => {
  current = (current + 1) % scenes.length;
  showScene(current);
}, 9000);

window.addEventListener("load", () => {
  setTimeout(() => img.classList.add("zoom"), 250);
});
