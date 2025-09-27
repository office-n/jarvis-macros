module.exports = function persistExec(req, res, next) {
  const isCommand = req.method === 'POST' && ((req.path || '') === '/command' || (req.originalUrl || '').startsWith('/command'));
  if (isCommand) {
    let execId = null, macrosUrl = null;
    try { const b = req.body || (JSON.parse(Buffer.from(req.rawBody||'').toString('utf8')||'{}')); execId = b && b.exec_id; macrosUrl = b && b.macros_url; } catch {}
    res.once('finish', async () => {
      if (res.statusCode === 202 && execId) {
        try {
          const { Firestore } = require('@google-cloud/firestore');
          const db = new Firestore({ projectId: 'projectab-db' });
          const now = new Date();
          await db.collection('exec').doc(execId).set({ exec_id: execId, state:'QUEUED', phase:'load_macros→plan', progress:20, updated_at: now, next_wakeup_at: null, macros_url: macrosUrl || null }, { merge: true });
        } catch (e) { console.error('persistExec failed:', e); }
      }
    });
  }
  return next();
};
