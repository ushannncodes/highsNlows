const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const form = document.getElementById('form');
const errEl = document.getElementById('err');
const submitBtn = document.getElementById('submit-btn');
const highlightMonth = document.getElementById('highlight-month');
const lowlightMonth = document.getElementById('lowlight-month');
const highlightText = document.getElementById('highlight-text');
const lowlightText = document.getElementById('lowlight-text');

function limitToThreeWords(input) {
  input.addEventListener('input', () => {
    const words = input.value.split(/\s+/).filter(Boolean).slice(0, 3);
    const trailingSpace = /\s$/.test(input.value) && words.length < 3;
    input.value = words.join(' ') + (trailingSpace ? ' ' : '');
  });
}

limitToThreeWords(highlightText);
limitToThreeWords(lowlightText);

function generatePersonId() {
  // crypto.randomUUID() only exists in secure contexts (HTTPS or localhost) —
  // plain http://<lan-ip> during testing doesn't qualify, so fall back to a
  // simple random token. It's just a correlation ID, not a security value.
  if (window.crypto && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function loadMonths() {
  const res = await fetch('/api/months');
  const months = await res.json();
  const options = months
    .slice()
    .reverse()
    .map(({ month, year }) => {
      const label = `${MONTH_NAMES[month]} ${year}`;
      return `<option value="${month}-${year}">${label}</option>`;
    })
    .join('');
  highlightMonth.innerHTML = options;
  lowlightMonth.innerHTML = options;
}

loadMonths();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';

  const [hMonth, hYear] = highlightMonth.value.split('-').map(Number);
  const [lMonth, lYear] = lowlightMonth.value.split('-').map(Number);

  const highlightWords = highlightText.value.trim().split(/\s+/).filter(Boolean);
  const lowlightWords = lowlightText.value.trim().split(/\s+/).filter(Boolean);

  if (highlightWords.length === 0 || lowlightWords.length === 0) {
    errEl.textContent = 'Fill in both a highlight and a lowlight.';
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting…';

  try {
    const personId = generatePersonId();
    const payloads = [
      { type: 'highlight', month: hMonth, year: hYear, text: highlightWords.join(' '), personId },
      { type: 'lowlight', month: lMonth, year: lYear, text: lowlightWords.join(' '), personId },
    ];

    for (const payload of payloads) {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Something went wrong');
      }
    }

    form.hidden = true;
    document.getElementById('done').hidden = false;
  } catch (err) {
    errEl.textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
  }
});
