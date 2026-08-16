const MONTH_ABBR = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ticksEl = document.getElementById('ticks');
const dotsEl = document.getElementById('dots');
const countHighlightEl = document.getElementById('count-highlight');
const countLowlightEl = document.getElementById('count-lowlight');
const timelineEl = document.getElementById('timeline');

// Custom cursor image data URIs are unreliable across browsers, so instead we
// rasterize the emoji ourselves via canvas — using whichever emoji font is
// actually installed on this machine — and hand the browser a plain PNG.
// We render at 2x pixel density (image-set) so it stays crisp on retina
// displays, with a 1x PNG as a fallback for browsers that don't support it.
(function setupCursor() {
  try {
    const size = 48; // logical (CSS px) cursor size
    const hotspot = Math.round(size * 0.3);

    function renderAt(scale) {
      const canvas = document.createElement('canvas');
      canvas.width = size * scale;
      canvas.height = size * scale;
      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.font = `${Math.round(size * 0.8)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🔎', size / 2, size / 2 + 2);
      return canvas.toDataURL('image/png');
    }

    const url1x = renderAt(1);
    const url2x = renderAt(2);
    timelineEl.style.cursor =
      `image-set(url("${url2x}") 2x, url("${url1x}") 1x) ${hotspot} ${hotspot}, ` +
      `url("${url1x}") ${hotspot} ${hotspot}, zoom-in`;
  } catch (e) {
    // canvas cursor generation failed for some reason — the CSS `zoom-in` fallback still applies
  }
})();

const BASE_OFFSET = 50; // px from axis to first slot — clears the month tick labels (and the dots' dashed rings)
const SLOT_GAP = 26; // px between stacked entries (dots only, once labels fade)
const JITTER = 6; // px horizontal jitter so stacks don't look too rigid
const LABEL_LIFETIME = 4500; // ms a new entry's text stays visible before fading to a plain dot
const ARRIVAL_INTERVAL = 150; // ms between dots appearing — protects against a submission burst
const DWELL_MS = 500; // ms of continuous hover before focus mode (dim + pair reveal) kicks in

let months = [];
const stacks = new Map(); // key -> count
const byPerson = new Map(); // personId -> { highlight: el, lowlight: el }
let counts = { highlight: 0, lowlight: 0 };

function monthKey(month, year) {
  return `${month}-${year}`;
}

function renderTicks() {
  ticksEl.innerHTML = months
    .map(({ month, year }, i) => {
      const x = ((i + 0.5) / months.length) * 100;
      const label = `${MONTH_ABBR[month]} '${String(year).slice(2)}`;
      return `<div class="tick" style="left:${x}%">
        <div class="tick-label">${label}</div>
      </div>`;
    })
    .join('');
}

function jitterFor(id) {
  // deterministic pseudo-random jitter based on entry id
  const r = Math.sin(id * 999.37) * 10000;
  const frac = r - Math.floor(r);
  return (frac - 0.5) * 2 * JITTER;
}

function addEntry(entry, animate) {
  const idx = months.findIndex((m) => m.month === entry.month && m.year === entry.year);
  if (idx === -1) return;

  const xPct = ((idx + 0.5) / months.length) * 100;
  const key = `${entry.type}-${monthKey(entry.month, entry.year)}`;
  const stackIndex = stacks.get(key) || 0;
  stacks.set(key, stackIndex + 1);

  const yOffset = BASE_OFFSET + stackIndex * SLOT_GAP;
  const sign = entry.type === 'highlight' ? -1 : 1;
  const jitterX = jitterFor(entry.id);

  const el = document.createElement('div');
  el.className = `entry entry--${entry.type}`;
  el.title = entry.text;
  el.style.left = `calc(${xPct}% + ${jitterX}px)`;
  el.style.top = `calc(50% + ${sign * yOffset}px)`;
  el.innerHTML = `<span class="dot dot--${entry.type === 'highlight' ? 'gold' : 'violet'}"></span><span class="label">${escapeHtml(entry.text)}</span>`;
  dotsEl.appendChild(el);

  if (entry.personId) {
    el.dataset.person = entry.personId;
    const rec = byPerson.get(entry.personId) || {};
    rec[entry.type] = el;
    byPerson.set(entry.personId, rec);
  }

  if (animate) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => el.classList.add('in'));
    });
    setTimeout(() => el.classList.add('settled'), LABEL_LIFETIME);
  } else {
    // Entries already on the board when this display connected — no spotlight, just present.
    el.classList.add('in', 'settled');
  }

  counts[entry.type] += 1;
  countHighlightEl.textContent = counts.highlight;
  countLowlightEl.textContent = counts.lowlight;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// New submissions land in a queue and are revealed one at a time, so a burst of
// simultaneous submissions (everyone hitting submit at once) still animates in
// gradually instead of all popping at once.
const arrivalQueue = [];
let arrivalTimer = null;

function enqueueEntry(entry) {
  arrivalQueue.push(entry);
  if (arrivalTimer) return;
  arrivalTimer = setInterval(() => {
    const next = arrivalQueue.shift();
    if (next) addEntry(next, true);
    if (arrivalQueue.length === 0) {
      clearInterval(arrivalTimer);
      arrivalTimer = null;
    }
  }, ARRIVAL_INTERVAL);
}

function clearAll() {
  arrivalQueue.length = 0;
  if (arrivalTimer) {
    clearInterval(arrivalTimer);
    arrivalTimer = null;
  }
  clearDwell();
  dotsEl.innerHTML = '';
  stacks.clear();
  byPerson.clear();
  counts = { highlight: 0, lowlight: 0 };
  countHighlightEl.textContent = '0';
  countLowlightEl.textContent = '0';
}

// Hovering one dot for more than DWELL_MS dims the rest of the board and pulls
// that person's other entry (their highlight if this is their lowlight, or vice
// versa) out of hiding, so you can see both halves of one person's year at once.
let dwellTimer = null;
let focusedEl = null;

function clearDwell() {
  if (dwellTimer) {
    clearTimeout(dwellTimer);
    dwellTimer = null;
  }
}

function activateFocus(entryEl) {
  focusedEl = entryEl;
  entryEl.classList.add('is-focused');
  const personId = entryEl.dataset.person;
  const rec = personId ? byPerson.get(personId) : null;
  const twin = rec ? (entryEl === rec.highlight ? rec.lowlight : rec.highlight) : null;
  if (twin && twin !== entryEl) {
    twin.classList.add('is-twin');
  }
  dotsEl.classList.add('focus-active');
}

function deactivateFocus() {
  if (focusedEl) focusedEl.classList.remove('is-focused');
  dotsEl.querySelectorAll('.is-twin').forEach((el) => el.classList.remove('is-twin'));
  dotsEl.classList.remove('focus-active');
  focusedEl = null;
}

dotsEl.addEventListener('mouseover', (e) => {
  const entryEl = e.target.closest('.entry');
  if (!entryEl || entryEl === focusedEl) return;
  clearDwell();
  dwellTimer = setTimeout(() => activateFocus(entryEl), DWELL_MS);
});

dotsEl.addEventListener('mouseout', (e) => {
  const entryEl = e.target.closest('.entry');
  if (!entryEl || entryEl.contains(e.relatedTarget)) return;
  clearDwell();
  if (focusedEl === entryEl) deactivateFocus();
});

async function init() {
  const [monthsRes, entriesRes] = await Promise.all([
    fetch('/api/months').then((r) => r.json()),
    fetch('/api/entries').then((r) => r.json()),
  ]);
  months = monthsRes;
  renderTicks();
  entriesRes.forEach((entry) => addEntry(entry, false));

  const socket = io();
  socket.on('submission', (entry) => enqueueEntry(entry));
  socket.on('reset', () => clearAll());
}

init();
