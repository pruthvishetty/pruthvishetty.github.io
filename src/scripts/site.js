/* Site-wide behaviour: theme, reveals, clock, toasts, and a few secrets. */

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}
window.toast = toast;

/* ---------- chai wisdom (the cup in the nav) ---------- */
const CHAI_LINES = [
  'Chai break. You’ve earned it. ☕',
  '“It’s a magical world, Hobbes ol’ buddy… let’s go exploring!”',
  'One cardamom pod changes everything.',
  'Adrak (ginger) in winter. Non-negotiable.',
  'The kettle sings in Raag Malhar, if you listen right.',
  '“There’s treasure everywhere.” — Calvin',
  'Filter coffee is also acceptable. Barely.',
  'Brewed in Udupi, steeped in San Francisco.',
  'Rule of chai: the smaller the cup, the better the conversation.',
  '“We’re so busy watching out for what’s just ahead of us that we don’t take time to enjoy where we are.”',
];
let chaiIdx = Math.floor(Math.random() * CHAI_LINES.length);

function initChaiCup() {
  const cup = document.getElementById('chai-cup');
  if (!cup || cup.dataset.wired) return;
  cup.dataset.wired = '1';
  cup.addEventListener('click', () => {
    cup.classList.remove('brewing');
    void cup.offsetWidth; // restart animation
    cup.classList.add('brewing');
    toast(CHAI_LINES[chaiIdx % CHAI_LINES.length], 3200);
    chaiIdx++;
  });
}

/* ---------- theme ---------- */
function initTheme() {
  const btn = document.getElementById('theme-toggle');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    const dark = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    toast(dark ? 'Evening chai, by lamplight. 🪔' : 'Morning chai, sunlit. ☀️', 1800);
  });
}

/* ---------- scroll reveals ---------- */
let observer;
function initReveals() {
  observer?.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          observer.unobserve(e.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
  );
  document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => {
    // Above-the-fold content shows immediately — never wait on observer timing.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.96 && r.bottom > 0) el.classList.add('is-visible');
    else observer.observe(el);
  });
}

/* ---------- footer clock + year progress ---------- */
const ZONES = [
  { code: 'SF', tz: 'America/Los_Angeles' },
  { code: 'BLR', tz: 'Asia/Kolkata' },
  { code: 'NYC', tz: 'America/New_York' },
  { code: 'LDN', tz: 'Europe/London' },
];
let zoneIdx = parseInt(sessionStorage.getItem('zoneIdx') || '0', 10) % ZONES.length;
let clockTimer;

function renderClock() {
  const time = document.getElementById('clock-time');
  const date = document.getElementById('clock-date');
  const zone = document.getElementById('clock-zone');
  if (!time) return;
  const { code, tz } = ZONES[zoneIdx];
  const now = new Date();
  time.textContent = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: tz,
  });
  if (date) date.textContent = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: tz,
  });
  if (zone) zone.textContent = code;
}

function initClock() {
  const btn = document.getElementById('clock-cycle');
  if (btn && !btn.dataset.wired) {
    btn.dataset.wired = '1';
    btn.addEventListener('click', () => {
      zoneIdx = (zoneIdx + 1) % ZONES.length;
      sessionStorage.setItem('zoneIdx', String(zoneIdx));
      renderClock();
    });
  }
  clearInterval(clockTimer);
  if (document.getElementById('clock-time')) {
    renderClock();
    clockTimer = setInterval(renderClock, 1000);
  }
}

function initYearProgress() {
  const bar = document.getElementById('year-bar');
  const label = document.getElementById('year-label');
  if (!bar) return;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const pct = ((now - start) / (end - start)) * 100;
  bar.style.width = pct.toFixed(2) + '%';
  if (label) label.textContent = `${now.getFullYear()} is ${pct.toFixed(1)}% brewed`;
}

/* ---------- name pronunciation ---------- */
function initPronounce() {
  const btn = document.getElementById('pronounce');
  if (!btn || btn.dataset.wired) return;
  btn.dataset.wired = '1';
  btn.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance('Pruthvi');
      u.rate = 0.85;
      speechSynthesis.speak(u);
    }
    toast('PRUTH-vee · ಪೃಥ್ವಿ · “the Earth” in Sanskrit', 3200);
  });
}

/* ---------- secrets ---------- */
/* Typing c-h-a-i anywhere warms the page; konami rolls the wagon. */
const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
let typed = '';
let kIdx = 0;

function onKeydown(e) {
  if (/input|textarea|select/i.test(e.target.tagName) || e.target.isContentEditable) return;

  // "chai"
  typed = (typed + e.key).slice(-4).toLowerCase();
  if (typed === 'chai') {
    document.documentElement.classList.add('chai-warmth');
    toast('Ahh. That hits the spot. ☕', 2600);
    setTimeout(() => document.documentElement.classList.remove('chai-warmth'), 4000);
  }

  // konami → the wagon ride
  kIdx = e.key === KONAMI[kIdx] ? kIdx + 1 : (e.key === KONAMI[0] ? 1 : 0);
  if (kIdx === KONAMI.length) {
    kIdx = 0;
    rollWagon();
  }
}

function rollWagon() {
  if (document.getElementById('wagon-ride')) return;
  const wagon = document.createElement('div');
  wagon.id = 'wagon-ride';
  wagon.setAttribute('aria-hidden', 'true');
  wagon.innerHTML = `<svg width="84" height="52" viewBox="0 0 84 52" fill="none">
    <path d="M6 30h60l8-6" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="4" y="22" width="58" height="12" rx="3" fill="#c23b22"/>
    <circle cx="18" cy="40" r="7" fill="var(--ink)"/><circle cx="18" cy="40" r="2.6" fill="var(--paper)"/>
    <circle cx="50" cy="40" r="7" fill="var(--ink)"/><circle cx="50" cy="40" r="2.6" fill="var(--paper)"/>
  </svg>`;
  Object.assign(wagon.style, {
    position: 'fixed', bottom: '0', left: '-120px', zIndex: 3500,
    pointerEvents: 'none', animation: 'wagon-roll 3.2s linear forwards',
  });
  document.body.appendChild(wagon);
  toast('“Let’s go exploring!” 🛷', 3000);
  setTimeout(() => wagon.remove(), 3400);
}

/* ---------- console greeting ---------- */
function greetConsole() {
  if (window.__greeted) return;
  window.__greeted = true;
  console.log(
    '%c☕ Namaskara, fellow source-viewer. ' +
    '%c\nHand-built with Astro, Fraunces & too much chai.' +
    '\nThe tools here run 100% in your browser — check the Network tab, I’ll wait.' +
    '\nTry typing "chai" on any page. Or the Konami code, if you’re old school.',
    'font-size:14px; font-weight:bold; color:#a8521d;',
    'font-size:12px; color:#888;'
  );
}

/* ---------- boot ---------- */
function init() {
  initTheme();
  initChaiCup();
  initReveals();
  initClock();
  initYearProgress();
  initPronounce();
  greetConsole();
}

document.addEventListener('astro:page-load', init);
document.addEventListener('keydown', onKeydown);

/* keyframes for the wagon + chai warmth, injected once */
const style = document.createElement('style');
style.textContent = `
@keyframes wagon-roll {
  from { transform: translateX(0) }
  to { transform: translateX(calc(100vw + 240px)) }
}
html.chai-warmth body { transition: filter 1.2s ease; filter: sepia(0.22) saturate(1.12); }
`;
document.head.appendChild(style);
