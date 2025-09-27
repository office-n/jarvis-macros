const express = require('express');
const crypto = require('crypto');
let _db = null; function db(){ if(_db) return _db; const { Firestore, FieldValue } = require('@google-cloud/firestore'); _db = { fs: new Firestore(), FV: FieldValue }; return _db; }
module.exports = function createHitlRouter(){
  const router = express.Router();
  function verify(req){
    const secret = process.env.GO_SHARED_SECRET;
    if(!secret) return { ok:false, code:'E900', message:'shared secret missing' };
    const sent = String(req.get('X-GO-Signature')||'').trim().toLowerCase();
    const calc = crypto.createHmac('sha256', secret).update(req.rawBody||Buffer.alloc(0)).digest('hex').toLowerCase();
    return sent === calc ? { ok:true } : { ok:false, code:'UNAUTHORIZED', message:'invalid signature' };
  }
  async function handle(action, req, res){
    const v = verify(req);
    if(!v.ok) return res.status(v.code==='UNAUTHORIZED'?401:500).json(v);
    const exec_id = String((req.body&&req.body.exec_id)||'').trim();
    const reason  = req.body && req.body.payload && req.body.payload.reason || null;
    if(!exec_id) return res.status(400).json({ code:'E200', message:'exec_id required' });
    await db().fs.collection('events').add({ exec_id, ts: db().FV.serverTimestamp(), type: action.toUpperCase(), payload:{ reason } });
    return res.status(200).json({ exec_id, status: action.toUpperCase() });
  }
  router.post('/approve',(req,res)=>handle('approve',req,res));
  router.post('/reject', (req,res)=>handle('reject',req,res));
  return router;
};
