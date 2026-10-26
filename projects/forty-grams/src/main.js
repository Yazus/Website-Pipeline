// Forty Grams: the live mill counter and the section entrances.
// The page reads completely without this file; it only adds to it.

const MILL = { start: 6.5, stop: 16.5, gramsPerHour: 40, gramsPerBowl: 2, restDay: 1 }; // restDay: Monday

function edinburghNow() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type) => parts.find((p) => p.type === type).value;
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hours = Number(get('hour')) + Number(get('minute')) / 60 + Number(get('second')) / 3600;
  return { day, hours };
}

export function millText({ day, hours }) {
  const full = (MILL.stop - MILL.start) * MILL.gramsPerHour;
  if (day === MILL.restDay) {
    return 'The mill rests on Mondays while its stones are dressed. It turns again on Tuesday at 6:30.';
  }
  if (hours < MILL.start) {
    return 'The mill starts at 6:30 this morning. By closing it will have ground 400 g.';
  }
  if (hours >= MILL.stop) {
    return `The mill stopped at 16:30 after ${full} g today, about ${full / MILL.gramsPerBowl} bowls.`;
  }
  const grams = Math.floor((hours - MILL.start) * MILL.gramsPerHour);
  const bowls = Math.floor(grams / MILL.gramsPerBowl);
  return `Since 6:30 the mill has ground <strong>${grams} g</strong> today, enough for ${bowls} ${bowls === 1 ? 'bowl' : 'bowls'}.`;
}

function startMill() {
  const el = document.querySelector('[data-mill]');
  if (!el) return;
  const tick = () => {
    el.innerHTML = millText(edinburghNow());
  };
  tick();
  // One gram takes ninety seconds; checking every fifteen keeps the count honest without churn.
  setInterval(tick, 15000);
}

function startReveals() {
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll('section').forEach((section) => {
    section.querySelectorAll('[data-reveal]').forEach((el, i) => el.style.setProperty('--i', i));
  });

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px' },
  );

  // Only things below the first screen wait for their entrance; nothing already in view is hidden.
  const fold = window.innerHeight;
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (el.getBoundingClientRect().top < fold) el.classList.add('is-in');
    io.observe(el);
  });
  document.documentElement.classList.add('reveal-ready');
}

startMill();
startReveals();
