const { redis, sha } = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { room, email, code } = req.body || {};
    const e = String(email || '').trim().toLowerCase();
    const key = 'otp:' + room + ':' + e;
    const rec = JSON.parse((await redis('GET', key)) || 'null');
    if (!rec) return res.status(400).json({ error: 'รหัสหมดอายุ กรุณาขอรหัสใหม่' });
    if (rec.tries >= 5) { await redis('DEL', key); return res.status(429).json({ error: 'กรอกผิดเกินกำหนด กรุณาขอรหัสใหม่' }); }
    if (sha(String(code || '').trim() + e) !== rec.h) {
      rec.tries++;
      await redis('SET', key, JSON.stringify(rec), 'EX', 600);
      return res.status(400).json({ error: 'รหัสไม่ถูกต้อง' });
    }
    const rm = JSON.parse((await redis('GET', 'room:' + room)) || 'null');
    if (!rm || rm.drawn) return res.status(409).json({ error: 'ห้องนี้จับสลากไปแล้ว' });
    await redis('HSET', 'p:' + room, e, rec.name);
    await redis('DEL', key);
    res.json({ ok: true, name: rec.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
};
