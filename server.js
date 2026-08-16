const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'hol-admin';

// In-memory store — single-event, ephemeral by design.
let entries = [];
let nextId = 1;

function last12Months() {
  const months = [];
  const now = new Date();
  now.setDate(1);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: d.getMonth() + 1, year: d.getFullYear() });
  }
  return months;
}

function isValidMonthYear(month, year) {
  return last12Months().some((m) => m.month === month && m.year === year);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/months', (req, res) => {
  res.json(last12Months());
});

app.get('/api/entries', (req, res) => {
  res.json(entries);
});

app.post('/api/submit', (req, res) => {
  const { type, month, year, text, personId } = req.body || {};

  if (type !== 'highlight' && type !== 'lowlight') {
    return res.status(400).json({ error: 'Invalid type' });
  }
  const m = Number(month);
  const y = Number(year);
  if (!isValidMonthYear(m, y)) {
    return res.status(400).json({ error: 'Month/year out of range' });
  }
  const cleanText = String(text || '').trim().replace(/\s+/g, ' ');
  const words = cleanText.split(' ').filter(Boolean);
  if (words.length === 0 || words.length > 3) {
    return res.status(400).json({ error: 'Must be 1-3 words' });
  }
  if (cleanText.length > 40) {
    return res.status(400).json({ error: 'Too long' });
  }

  // personId links a person's highlight and lowlight so the display can pair them —
  // it's just a random client-generated token, not a real identity.
  const cleanPersonId = typeof personId === 'string' ? personId.slice(0, 64) : null;

  const entry = {
    id: nextId++,
    type,
    month: m,
    year: y,
    text: cleanText,
    personId: cleanPersonId,
    ts: Date.now(),
  };
  entries.push(entry);
  io.emit('submission', entry);
  res.status(201).json(entry);
});

// Organizer-only: wipe test submissions before the real event starts.
app.post('/api/reset', (req, res) => {
  if (req.query.key !== ADMIN_KEY) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  entries = [];
  nextId = 1;
  io.emit('reset');
  res.json({ ok: true });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'submit.html'));
});

app.get('/display', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'display.html'));
});

io.on('connection', () => {});

server.listen(PORT, () => {
  console.log(`HOL Year Wheel listening on port ${PORT}`);
});
