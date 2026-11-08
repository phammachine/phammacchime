const { redis, sha, esc, sendBatch, layout, crypto } = require('./_lib');
const TTL = 60 * 60 * 24 * 30;

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { room, adminToken } = req.body || {};
    const rm = JSON.parse((await redis('GET', 'room:' + room)) || 'null');
    if (!rm) return res.status(404).json({ error: 'ไม่พบห้องนี้' });
    if (sha(String(adminToken || '')) !== rm.admin) return res.status(403).json({ error: 'เฉพาะผู้จัดเท่านั้นที่จับสลากได้' });

    let d = JSON.parse((await redis('GET', 'd:' + room)) || 'null');
    if (!d) {
      const flat = (await redis('HGETALL', 'p:' + room)) || [];
      const a = [];
      for (let i = 0; i < flat.length; i += 2) a.push({ email: flat[i], name: flat[i + 1] });
      if (a.length < 3) return res.status(400).json({ error: 'ต้องมีคนยืนยันอีเมลแล้วอย่างน้อย 3 คน' });
      for (let i = a.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
      d = a.map((g, i) => ({ email: g.email, name: g.name, gets: a[(i + 1) % a.length].name, sent: false }));
      await redis('SET', 'd:' + room, JSON.stringify(d), 'EX', TTL);
      rm.drawn = true;
      await redis('SET', 'room:' + room, JSON.stringify(rm), 'EX', TTL);
    }

    const todo = d.filter((x) => !x.sent);
    if (todo.length) {
      const ok = await sendBatch(todo.map((x) => ({
        to: [x.email],
        subject: '🎁 ผลจับสลากบัดดี้ลับของคุณ',
        html: layout(`<p>สวัสดี ${esc(x.name)}</p><p>คุณจับได้ให้ของขวัญกับ</p>
          <p style="font-size:28px;font-weight:700;color:#d9480f">${esc(x.gets)}</p>
          <p style="color:#888">อย่าบอกใครนะ เป็นความลับ 🤫</p>`),
      })));
      if (ok) todo.forEach((x) => (x.sent = true));
      await redis('SET', 'd:' + room, JSON.stringify(d), 'EX', TTL);
    }
    const pending = d.filter((x) => !x.sent).length;
    res.json({ ok: pending === 0, total: d.length, pending });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
};
