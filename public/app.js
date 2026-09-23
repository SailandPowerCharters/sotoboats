const helmData = {
  private: {
    rotation: 0,
    kicker: "PRIVATE CHARTER",
    title: "Make the Mediterranean yours.",
    text: "Tell us what kind of day you have in mind and we’ll help you find the right boat, experience and crew.",
    cta: "View charter calendar & book online →",
    href: "https://sp-charter-dashboard.onrender.com/book",
    heroCta: "View our Charter calendar and book online",
    intro: "Private charters, celebrations and unforgettable days on the Mediterranean — all from one trusted local team in Estepona."
  },
  celebrations: {
    rotation: -90,
    kicker: "CELEBRATIONS",
    title: "The best parties have a horizon.",
    text: "Birthdays, hens, anniversaries and group days made better on the Mediterranean.",
    cta: "Plan a celebration →",
    href: "#experiences",
    heroCta: "Plan a celebration",
    intro: "Bring your favourite people. We’ll help you turn a boat charter into a day worth remembering."
  },
  morocco: {
    rotation: -180,
    kicker: "SAIL TO MOROCCO",
    title: "Two sailing days. Two nights in Smir.",
    text: "Cross the Strait aboard Jaz II, our Jeanneau Sun Odyssey 45 DS. Created for sailors with some previous experience.",
    cta: "Discover the Morocco trip →",
    href: "/morocco/",
    heroCta: "Explore the Morocco sailing trip",
    intro: "A proper sailing adventure from Estepona to Marina Smir for guests who want to go further."
  },
  water: {
    rotation: -270,
    kicker: "WATER EXPERIENCES",
    title: "Drop anchor. Add some adventure.",
    text: "Paddleboards, jet skis, swimming and the extras that turn a charter into your kind of day.",
    cta: "Explore experiences →",
    href: "#experiences",
    heroCta: "Explore charter experiences",
    intro: "Build your day around the people you’re with — relaxed, energetic, celebratory or a bit of everything."
  }
};

const wheel = document.getElementById("helmWheel");
const preview = document.getElementById("helmPreview");
const previewKicker = document.getElementById("previewKicker");
const previewTitle = document.getElementById("previewTitle");
const previewText = document.getElementById("previewText");
const previewLink = document.getElementById("previewLink");
const primaryHeroCta = document.getElementById("primaryHeroCta");
const heroIntro = document.getElementById("heroIntro");
const options = [...document.querySelectorAll(".helm-option")];
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

let currentHelmRotation = 0;

function spinHelmTo(targetRotation) {
  if (!wheel) return;
  const start = currentHelmRotation;
  let target = targetRotation;

  while (target - start > 180) target -= 360;
  while (target - start < -180) target += 360;

  wheel.getAnimations().forEach((animation) => animation.cancel());

  const animation = wheel.animate(
    [
      { transform: `rotate(${start}deg)` },
      { transform: `rotate(${target}deg)` }
    ],
    {
      duration: 900,
      easing: "cubic-bezier(.2,.8,.15,1)",
      fill: "forwards"
    }
  );

  animation.onfinish = () => {
    currentHelmRotation = target;
    wheel.style.transform = `rotate(${target}deg)`;
    animation.cancel();
  };
}

function activateHelm(key) {
  const data = helmData[key];
  if (!data) return;

  options.forEach((btn) => btn.classList.toggle("active", btn.dataset.key === key));

  preview.classList.add("is-changing");
  spinHelmTo(data.rotation);

  setTimeout(() => {
    previewKicker.textContent = data.kicker;
    previewTitle.textContent = data.title;
    previewText.textContent = data.text;
    previewLink.textContent = data.cta;
    previewLink.href = data.href;

    const isExternal = data.href.startsWith("http");
    previewLink.target = isExternal ? "_blank" : "_self";
    if (isExternal) previewLink.rel = "noopener"; else previewLink.removeAttribute("rel");

    primaryHeroCta.textContent = data.heroCta;
    primaryHeroCta.href = data.href;
    primaryHeroCta.target = isExternal ? "_blank" : "_self";
    if (isExternal) primaryHeroCta.rel = "noopener"; else primaryHeroCta.removeAttribute("rel");

    heroIntro.textContent = data.intro;
    preview.classList.remove("is-changing");
  }, 200);
}

options.forEach((button) => {
  button.addEventListener("click", () => activateHelm(button.dataset.key));
});

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    if (mainNav) mainNav.classList.remove("open");
    if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
  });
});

const yearEl = document.getElementById("year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

window.addEventListener("load", () => {
  if (wheel) {
    currentHelmRotation = 0;
    wheel.style.transform = "rotate(0deg)";
    setTimeout(() => {
      const intro = wheel.animate(
        [
          { transform: "rotate(-5deg)" },
          { transform: "rotate(8deg)" },
          { transform: "rotate(0deg)" }
        ],
        { duration: 1000, easing: "cubic-bezier(.2,.8,.2,1)" }
      );
      intro.onfinish = () => { wheel.style.transform = "rotate(0deg)"; };
    }, 500);
  }
});
