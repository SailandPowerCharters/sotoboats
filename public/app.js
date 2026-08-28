const helmData = {
  charter: {
    rotation: 0,
    kicker: "CHARTER",
    title: "Make the Mediterranean yours.",
    text: "Browse featured boats or tell us what you need and we will find the right charter for you.",
    cta: "Explore charters →",
    href: "#charter",
    heroCta: "Explore charters",
    intro: "Charter, buy, sell and enjoy the Mediterranean with one trusted local team.",
    image: "radial-gradient(circle at 72% 40%, rgba(48, 103, 148, 0.26) 0%, rgba(12, 31, 49, 0) 42%), linear-gradient(120deg, rgba(6, 23, 37, 0.05), rgba(7, 25, 40, 0.04)), url(\"https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=1800\") center center / cover no-repeat"
  },
  sale: {
    rotation: -90,
    kicker: "BOATS FOR SALE",
    title: "Your next boat could be closer than you think.",
    text: "Explore selected vessels offered through Sotoboats and trusted owners across the western Costa del Sol.",
    cta: "View boats for sale →",
    href: "#sale",
    heroCta: "View boats for sale",
    intro: "Discover boats for sale with local guidance, clear communication and a personal brokerage service.",
    image: "radial-gradient(circle at 72% 40%, rgba(48, 103, 148, 0.26) 0%, rgba(12, 31, 49, 0) 42%), linear-gradient(120deg, rgba(6, 23, 37, 0.05), rgba(7, 25, 40, 0.04)), url(\"https://images.pexels.com/photos/1295036/pexels-photo-1295036.jpeg?auto=compress&cs=tinysrgb&w=1800\") center center / cover no-repeat"
  },
  services: {
    rotation: -180,
    kicker: "MARINE SERVICES",
    title: "One local team. One point of contact.",
    text: "From maintenance and preparation to owner support and logistics, Sotoboats helps keep everything moving.",
    cta: "Explore marine services →",
    href: "#services",
    heroCta: "Marine services",
    intro: "Practical marine support and trusted local coordination for owners on the Costa del Sol.",
    image: "radial-gradient(circle at 72% 40%, rgba(48, 103, 148, 0.26) 0%, rgba(12, 31, 49, 0) 42%), linear-gradient(120deg, rgba(6, 23, 37, 0.05), rgba(7, 25, 40, 0.04)), url(\"https://images.pexels.com/photos/163236/luxury-yacht-boat-speed-water-163236.jpeg?auto=compress&cs=tinysrgb&w=1800\") center center / cover no-repeat"
  },
  sell: {
    rotation: -270,
    kicker: "SELL YOUR BOAT",
    title: "Sell with local expertise behind you.",
    text: "Professional presentation, qualified enquiries and straightforward brokerage from valuation to handover.",
    cta: "Request a valuation →",
    href: "#sell",
    heroCta: "Request a valuation",
    intro: "Present your boat properly, reach serious buyers and let Sotoboats manage the process from start to finish.",
    image: "radial-gradient(circle at 72% 40%, rgba(48, 103, 148, 0.26) 0%, rgba(12, 31, 49, 0) 42%), linear-gradient(120deg, rgba(6, 23, 37, 0.05), rgba(7, 25, 40, 0.04)), url(\"https://images.pexels.com/photos/860868/pexels-photo-860868.jpeg?auto=compress&cs=tinysrgb&w=1800\") center center / cover no-repeat"
  }
};

const wheel = document.getElementById("helmWheel");
const preview = document.getElementById("helmPreview");
const heroBackdrop = document.getElementById("heroBackdrop");
const previewKicker = document.getElementById("previewKicker");
const previewTitle = document.getElementById("previewTitle");
const previewText = document.getElementById("previewText");
const previewLink = document.getElementById("previewLink");
const primaryHeroCta = document.getElementById("primaryHeroCta");
const heroIntro = document.getElementById("heroIntro");
const options = [...document.querySelectorAll(".helm-option")];
const menuToggle = document.querySelector(".menu-toggle");
const mainNav = document.querySelector(".main-nav");

function setHeroBackground(value) {
  heroBackdrop.style.background = value;
}

function activateHelm(key) {
  const data = helmData[key];
  if (!data) return;

  options.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.key === key);
  });

  preview.classList.add("is-changing");
  wheel.style.transform = `rotate(${data.rotation}deg)`;
  heroBackdrop.style.transform = "scale(1.05)";

  setTimeout(() => {
    previewKicker.textContent = data.kicker;
    previewTitle.textContent = data.title;
    previewText.textContent = data.text;
    previewLink.textContent = data.cta;
    previewLink.href = data.href;
    primaryHeroCta.textContent = data.heroCta;
    primaryHeroCta.href = data.href;
    heroIntro.textContent = data.intro;
    setHeroBackground(data.image);
    preview.classList.remove("is-changing");
  }, 200);

  setTimeout(() => {
    heroBackdrop.style.transform = "scale(1.02)";
  }, 760);
}

options.forEach((button) => {
  button.addEventListener("click", () => activateHelm(button.dataset.key));
});

menuToggle.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

document.getElementById("year").textContent = new Date().getFullYear();

window.addEventListener("load", () => {
  setTimeout(() => {
    wheel.animate(
      [
        { transform: "rotate(-6deg)" },
        { transform: "rotate(10deg)" },
        { transform: "rotate(0deg)" }
      ],
      {
        duration: 1200,
        easing: "cubic-bezier(.2,.8,.2,1)"
      }
    );
  }, 650);
});
