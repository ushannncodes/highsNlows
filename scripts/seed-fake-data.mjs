// Populates the board with 40 fake respondents (80 entries) so you can see
// the display filled in without waiting for real submissions.
//
// Usage:
//   node scripts/seed-fake-data.mjs                              # targets http://localhost:3000
//   BASE_URL=https://highsnlows.onrender.com node scripts/seed-fake-data.mjs

const BASE = process.env.BASE_URL || 'http://localhost:3000';

const highlights = [
  'got promoted', 'new baby born', 'ran a marathon', 'started new job', 'got engaged',
  'bought first home', 'graduated finally', 'won a trophy', 'reunited with family', 'adopted a puppy',
  'learned to surf', 'hit the gym', 'launched my startup', 'passed driving test', 'went to Japan',
  'found new love', 'published my book', 'climbed a mountain', 'got my visa', 'started therapy',
  'paid off debt', 'built my portfolio', 'learned to swim', 'got a raise', 'moved to city',
  'made new friends', 'finished a marathon', 'opened my business', 'hosted first party', 'went back school',
  'quit smoking finally', 'ran first 10k', 'got dream job', 'renovated the kitchen', 'planted a garden',
  'sang on stage', 'won the lottery', 'met my idol', 'became a dad', 'starred wedding day',
];

const lowlights = [
  'lost my job', 'car broke down', 'lost my dad', 'failed the exam', 'flight got cancelled',
  'broke my leg', 'caught covid twice', 'pipes burst home', 'phone got stolen', 'missed my flight',
  'work burnout hit', 'lost my keys', 'went through breakup', 'house got robbed', 'lost my pet',
  'failed the interview', 'got food poisoning', 'lost my wallet', 'flooded the basement', 'missed the deadline',
  'argued with family', 'lost my savings', 'got into accident', 'denied the promotion', 'visa got rejected',
  'relationship ended badly', 'friend betrayed me', 'business nearly failed', 'lost my voice', 'surgery went wrong',
  'flight delayed hours', 'wisdom tooth pain', 'lost my luggage', 'internet down week', 'landlord raised rent',
  'car got towed', 'missed my grandma', 'project got cancelled', 'burned the kitchen', 'twisted my ankle',
];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  console.log(`Seeding ${BASE} ...`);
  const months = await fetch(`${BASE}/api/months`).then((r) => r.json());
  const hPool = shuffle(highlights);
  const lPool = shuffle(lowlights);

  const submissions = [];
  for (let i = 0; i < 40; i++) {
    const personId = `fake-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const hMonth = months[Math.floor(Math.random() * months.length)];
    const lMonth = months[Math.floor(Math.random() * months.length)];
    submissions.push({ type: 'highlight', month: hMonth.month, year: hMonth.year, text: hPool[i], personId });
    submissions.push({ type: 'lowlight', month: lMonth.month, year: lMonth.year, text: lPool[i], personId });
  }

  // shuffle overall order so highlights/lowlights arrive interleaved, like real attendees
  const ordered = shuffle(submissions);

  for (const payload of ordered) {
    const res = await fetch(`${BASE}/api/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('FAILED', payload, await res.text());
    }
    // tiny stagger so the live display animates them in like a real crowd, not one instant dump
    await new Promise((r) => setTimeout(r, 60));
  }

  console.log(`Seeded ${ordered.length} entries from 40 fake respondents.`);
}

main();
