const { redis, sha, esc, emailRe, sendBatch, layout, crypto } = require('./_lib');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end();
    const { room, name, email } = req.body || {};
    const n = String(name || '').trim().slice(0, 40);
    const e = String(email || '').trim().toLowerCase();
    if (!n) return res.status(400).json({ error: 'กรุณาใส่ชื่อ' });
    if (!emailRe.test(e)) return res.status(400).json({ error: 'รูปแบบอีเมลไม่ถูกต้อง' });

    const rm = JSON.parse((await redis('GET', 'room:' + room)) || 'null');
    if (!rm) return res.status(404).json({ error: 'ไม่พบห้องนี้' });
    if (rm.drawn) return res.status(409).json({ error: 'จับสลากไปแล้ว เข้าร่วมเพิ่มไม่ได้' });
    if ((await redis('HLEN', 'p:' + room)) >= 100) return res.status(409).json({ error: 'ห้องเต็มแล้ว (100 คน)' });
    if (await redis('HGET', 'p:' + room, e)) return res.status(409).json({ error: 'อีเมลนี้ยืนยันแล้ว' });
    const names = (await redis('HVALS', 'p:' + room)) || [];
    if (names.includes(n)) return res.status(409).json({ error: 'ชื่อนี้ซ้ำ ลองเพิ่มนามสกุลหรือชื่อเล่น' });

    const ok = await redis('SET', 'rl:' + room + ':' + e, '1', 'NX', 'EX', 60);
    if (!ok) return res.status(429).json({ error: 'ขอรหัสได้ทุก 60 วินาที รอสักครู่' });

    const code = String(crypto.randomInt(100000, 1000000));
    await redis('SET', 'otp:' + room + ':' + e, JSON.stringify({ h: sha(code + e), name: n, tries: 0 }), 'EX', 600);
    const sent = await sendBatch([{
      to: [e],
      subject: 'รหัสยืนยัน ' + code + ' - จับสลากบัดดี้ลับ',
      html: layout(`<p>สวัสดี ${esc(n)}</p><p>รหัสยืนยันอีเมลของคุณคือ</p>
        <p style="font-size:34px;font-weight:700;letter-spacing:6px">${code}</p>
        <p style="color:#888">รหัสหมดอายุใน 10 นาที</p>`),
    }]);
    if (!sent) return res.status(502).json({ error: 'ส่งอีเมลไม่สำเร็จ ตรวจสอบการตั้งค่า Resend' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
};
