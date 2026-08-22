const menuBtn = document.querySelector('.mobile-menu-toggle');
const navBar = document.querySelector('.site-header-nav');
const menuItem = document.querySelectorAll('.site-nav-item');

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
  const heroVideo = document.querySelector("#home-hero .hero-video");
  if (heroVideo) {
    heroVideo.addEventListener("loadedmetadata", function() {
      if (Number.isFinite(heroVideo.duration) && heroVideo.duration > 0) {
        heroVideo.currentTime = heroVideo.duration / 2;
      }
    }, { once: true });
  }

  const heroIntroTargets = document.querySelectorAll([
    "#home-hero .content-column-left img",
    "#home-hero .content-column-left p",
    "#home-hero #event-calendar"
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
  const isBlogsListPage = !!document.querySelector("#blogs-page");

  if (isBlogsListPage) {
    document.querySelectorAll(".reveal-up").forEach(function(el) {
      el.classList.remove("reveal-up");
      el.classList.remove("is-visible");
      el.style.transitionDelay = "";
    });
    return;
  }

  const revealSelectors = [
    "#home-hero .content-column-left",
    "#home-hero .content-column-right",
    "#about-section .content-column-left",
    "#about-section .content-column-right",
    "#blog-section .content-column-left",
    "#blog-section .content-column-right",
    "#newsletter-section .section",
    "#contact-section .contact-intro",
    "#contact-section .contact-links",
    "#support-section .support-overview",
    "#support-section .support-payment-placeholder",
    "#article-page .article-info",
    "#article-page article"
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


// Events are classified in the browser so a deployed page stays current
// between Hugo builds. The date is an ISO value rendered from the existing
// front matter `date` field; Date.parse preserves its explicit timezone.
document.addEventListener("DOMContentLoaded", function() {
  const eventsPage = document.getElementById("events-page");
  if (!eventsPage) return;

  const upcomingList = document.getElementById("upcoming-events");
  const pastList = document.getElementById("past-events");
  const overview = eventsPage.querySelector("[data-events-overview]");
  const groups = eventsPage.querySelectorAll(".events-group");
  const upcomingCount = groups[0]?.querySelector("[data-events-count]");
  const pastCount = groups[1]?.querySelector("[data-events-count]");
  const upcomingEmpty = groups[0]?.querySelector("[data-events-empty]");
  const pastEmpty = groups[1]?.querySelector("[data-events-empty]");
  const eventItems = [...upcomingList.querySelectorAll("[data-event-date]")];
  const now = Date.now();
  const upcoming = [];
  const past = [];

  eventItems.forEach((item) => {
    const timestamp = Date.parse(item.dataset.eventDate);
    if (Number.isNaN(timestamp) || timestamp >= now) upcoming.push({ item, timestamp });
    else past.push({ item, timestamp });
  });

  upcoming.sort((a, b) => a.timestamp - b.timestamp);
  past.sort((a, b) => b.timestamp - a.timestamp);
  upcoming.forEach(({ item }) => upcomingList.append(item));
  past.forEach(({ item }) => pastList.append(item));

  upcomingList.classList.toggle("events-grid-single", upcoming.length === 1);
  pastList.classList.toggle("events-grid-single", past.length === 1);
  upcomingCount.textContent = upcoming.length;
  pastCount.textContent = past.length;
  upcomingEmpty.style.display = upcoming.length ? "none" : "block";
  pastEmpty.style.display = past.length ? "none" : "block";
  overview.textContent = `${upcoming.length} aankomend · ${past.length} voorbij`;
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
  
  const monthDisplay = document.getElementById('event-calendar-month');
  const prevButton = document.getElementById('event-calendar-previous');
  const nextButton = document.getElementById('event-calendar-next');
  const eventCalendarEmpty = document.getElementById('event-calendar-empty');
  const eventsList = document.querySelectorAll('.event-calendar-items a');

  if (!monthDisplay || !prevButton || !nextButton || !eventCalendarEmpty) {
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
        eventCalendarEmpty.style.display = "block";
    } else {
        eventCalendarEmpty.style.display = "none";
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
