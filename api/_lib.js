const crypto = require('crypto');
const R = process.env;

async function redis(...cmd) {
  const r = await fetch(R.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + R.UPSTASH_REDIS_REST_TOKEN },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

const sha = (s) => crypto.createHash('sha256').update((R.SECRET || '') + s).digest('hex');
const rand = (n) => crypto.randomBytes(n).toString('hex');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ส่งหลายฉบับในคำขอเดียว (Resend batch, สูงสุด 100 ฉบับ)
async function sendBatch(list) {
  const r = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + R.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(list.map((m) => ({ from: R.FROM_EMAIL, ...m }))),
  });
  if (!r.ok) console.error('resend error', r.status, await r.text());
  return r.ok;
}

const layout = (inner) =>
  `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #f3e3e6;border-radius:16px">
   <div style="font-size:40px">🎁</div>${inner}</div>`;

module.exports = { redis, sha, rand, esc, emailRe, sendBatch, layout, crypto };
