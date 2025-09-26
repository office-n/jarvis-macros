const { randomUUID } = require("crypto");

// 最小のインメモリイベントログ（デモ用）。本番では Firestore 永続化に置換。
const HITL_EVENTS = [];

function addEvent(exec_id, type, payload) {
  const ev = { id: randomUUID(), ts: new Date().toISOString(), exec_id, type, payload };
  HITL_EVENTS.push(ev);
  if (HITL_EVENTS.length > 1000) HITL_EVENTS.shift(); // メモリ制限
  return ev;
}

function registerHitlRoutes(app, verifyHmac) {
  app.post("/approve", (req, res) => {
    if (!verifyHmac(req)) return res.status(401).json({ code: "ERR_SIGNATURE", message: "invalid X-GO-Signature" });
    const exec_id = req.body?.exec_id || req.query.exec_id;
    const reason  = req.body?.reason  || req.query.reason || null;
    if (!exec_id) return res.status(400).json({ code: "ERR_EXEC_ID_REQUIRED", message: "exec_id required" });
    const ev = addEvent(exec_id, "APPROVE", { reason });
    return res.status(200).json({ approved: true, exec_id, event: ev });
  });

  app.post("/reject", (req, res) => {
    if (!verifyHmac(req)) return res.status(401).json({ code: "ERR_SIGNATURE", message: "invalid X-GO-Signature" });
    const exec_id = req.body?.exec_id || req.query.exec_id;
    const reason  = req.body?.reason  || req.query.reason || null;
    if (!exec_id) return res.status(400).json({ code: "ERR_EXEC_ID_REQUIRED", message: "exec_id required" });
    const ev = addEvent(exec_id, "REJECT", { reason });
    return res.status(200).json({ approved: false, exec_id, event: ev });
  });

  // タイムライン確認（直近100件, exec_id で絞り込み可）
  app.get("/events", (req, res) => {
    const exec_id = req.query.exec_id;
    const out = exec_id ? HITL_EVENTS.filter(e => e.exec_id === exec_id) : HITL_EVENTS.slice(-100);
    res.json({ events: out });
  });
}

module.exports = { registerHitlRoutes };
