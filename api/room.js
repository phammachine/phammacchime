const { redis, sha, rand } = require('./_lib');
const TTL = 60 * 60 * 24 * 30;

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const id = rand(3);
      const adminToken = rand(16);
      await redis('SET', 'room:' + id, JSON.stringify({ admin: sha(adminToken), drawn: false }), 'EX', TTL);
      return res.json({ id, adminToken });
    }
    const id = String(req.query.id || '');
    const rm = JSON.parse((await redis('GET', 'room:' + id)) || 'null');
    if (!rm) return res.status(404).json({ error: 'ไม่พบห้องนี้' });
    const names = (await redis('HVALS', 'p:' + id)) || [];
    res.json({ drawn: rm.drawn, names });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' });
  }
};
