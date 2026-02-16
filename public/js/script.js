const menuBtn = document.querySelector('.burger');
const navBar = document.querySelector('.navbar');
const menuItem = document.querySelectorAll('.menu-item');

function toggleMenu() {
  if (!menuBtn || !navBar) {
    return;
  }
  navBar.classList.toggle('is-active');
  menuBtn.classList.toggle("fa-bars");
  menuBtn.classList.toggle("fa-xmark");
}

if (menuBtn && navBar) {
  menuBtn.addEventListener('click', function () {
    toggleMenu();
  });

  menuItem.forEach(function(menuItem) {
    menuItem.addEventListener('click', function() {
      toggleMenu();
    });
  });
}


//scroll to page
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
      e.preventDefault();

      const target = document.querySelector(this.getAttribute('href'));

      if (target) {
          const offset = 100; // Adjust the offset/margin as needed
          const targetPosition = target.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({
              top: targetPosition - offset,
              behavior: 'smooth'
          });
      }
  });
});

document.addEventListener("DOMContentLoaded", function() {
  const heroVideo = document.querySelector("#heading-container .hero-video");
  if (heroVideo) {
    heroVideo.addEventListener("loadedmetadata", function() {
      heroVideo.currentTime = 5.5;
    }, { once: true });
  }

  const heroIntroTargets = document.querySelectorAll([
    "#heading-container .container-left img",
    "#heading-container .container-left p",
    "#heading-container #event-container"
  ].join(", "));

  heroIntroTargets.forEach(function(el) {
    el.classList.add("hero-intro-fade");
  });

  if (heroIntroTargets.length) {
    window.requestAnimationFrame(function() {
      window.setTimeout(function() {
        heroIntroTargets.forEach(function(el, index) {
          window.setTimeout(function() {
            el.classList.add("hero-intro-visible");
          }, index * 160);
        });
      }, 500);
    });
  }

  let lastScrollY = window.scrollY;
  let scrollDirection = "down";
  let ticking = false;
  const isEventsListPage = !!document.querySelector("#events-page");

  const revealSelectors = [
    "#heading-container .container-left",
    "#heading-container .container-right",
    "#about-container .container-left",
    "#about-container .container-right",
    "#blog-container .container-left",
    "#blog-container .container-right",
    "#nieuwsbrief-container .section",
    "#contact-container .contact-intro",
    "#contact-container .contact-links",
    "#steunons-container .support-overview",
    "#steunons-container .support-payment-placeholder",
    "#single-page .article-info",
    "#single-page article"
  ];

  if (!isEventsListPage) {
    revealSelectors.push(".listpage-items li");
  }

  const revealTargets = document.querySelectorAll(revealSelectors.join(", "));

  if (!revealTargets.length) {
    return;
  }

  revealTargets.forEach(function(el, index) {
    el.classList.add("reveal-up");
    el.style.transitionDelay = `${(index % 6) * 60}ms`;
  });

  function applyRevealState(direction) {
    const revealLineDown = window.innerHeight * 0.82;
    const hideLineUp = window.innerHeight * 0.72;
    revealTargets.forEach(function(el) {
      const top = el.getBoundingClientRect().top;
      if (direction === "down") {
        if (top <= revealLineDown) {
          el.classList.add("is-visible");
        }
      } else {
        if (top > hideLineUp) {
          el.classList.remove("is-visible");
        } else {
          el.classList.add("is-visible");
        }
      }
    });
  }

  function queueRevealPass() {
    if (ticking) {
      return;
    }
    ticking = true;
    window.requestAnimationFrame(function() {
      applyRevealState(scrollDirection);
      ticking = false;
    });
  }

  window.addEventListener("scroll", function() {
    const currentScrollY = window.scrollY;
    scrollDirection = currentScrollY > lastScrollY ? "down" : "up";
    lastScrollY = currentScrollY;
    queueRevealPass();
  }, { passive: true });

  window.addEventListener("resize", function() {
    applyRevealState("down");
  }, { passive: true });

  if (!("requestAnimationFrame" in window)) {
    revealTargets.forEach(function(el) {
      el.classList.add("is-visible");
    });
    return;
  }

  applyRevealState("down");
});


//month
document.addEventListener("DOMContentLoaded", function() {
  const englishMonthNames = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
  ];
  
  const dutchMonthNames = [
      "Januari", "Februari", "Maart", "April", "Mei", "Juni", 
      "Juli", "Augustus", "September", "Oktober", "November", "December"
  ];
  
  const monthDisplay = document.getElementById('currentMonth');
  const prevButton = document.getElementById('prevMonth');
  const nextButton = document.getElementById('nextMonth');
  const noEventsMessage = document.getElementById('noEventsMessage');
  const eventsList = document.querySelectorAll('.events-list a');

  if (!monthDisplay || !prevButton || !nextButton || !noEventsMessage || !eventsList.length) {
    return;
  }
  
  let currentDate = new Date();
  let currentMonthIndex = currentDate.getMonth(); // Get current month index
  let currentYear = currentDate.getFullYear(); // Get current year
  
  function updateMonthDisplay() {
      monthDisplay.textContent = `${dutchMonthNames[currentMonthIndex]} ${currentYear}`;
      filterEvents();
  }
  
  function filterEvents() {
    const currentMonth = `${englishMonthNames[currentMonthIndex]}-${currentYear}`;
    let eventsFound = false;
    eventsList.forEach(event => {
        if (event.getAttribute('date-month') === currentMonth) {
            event.style.display = 'block';
            eventsFound = true;
        } else {
            event.style.display = 'none';
        }
    });

    if (!eventsFound) {
        noEventsMessage.style.display = "block";
    } else {
        noEventsMessage.style.display = "none";
    }
}
  
  prevButton.addEventListener('click', function() {
      if (currentMonthIndex === 0) {
          currentMonthIndex = 11;
          currentYear -= 1;
      } else {
          currentMonthIndex -= 1;
      }
      updateMonthDisplay();
  });
  
  nextButton.addEventListener('click', function() {
      if (currentMonthIndex === 11) {
          currentMonthIndex = 0;
          currentYear += 1;
      } else {
          currentMonthIndex += 1;
      }
      updateMonthDisplay();
  });
  
  updateMonthDisplay();  // Initial call to set the correct events
});
