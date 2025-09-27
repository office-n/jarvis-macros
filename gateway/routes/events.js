const express = require('express');
const router = express.Router();
let _db = null; function db(){ if(_db) return _db; const { Firestore } = require('@google-cloud/firestore'); _db = new Firestore(); return _db; }
function ts(v){ try{ if(!v) return null; if(typeof v.toDate==='function') return v.toDate().toISOString();
  if(typeof v._seconds==='number') return new Date(v._seconds*1000 + Math.round((v._nanoseconds||0)/1e6)).toISOString(); return v; } catch { return v; } }
router.get('/events', async (req,res)=>{
  const exec_id = String(req.query.exec_id||'').trim();
  const degraded = String(req.query.degraded_sort||'false') === 'true';
  if(!exec_id) return res.status(400).json({ code:'E200', message:'exec_id required' });
  try{
    let q = db().collection('events').where('exec_id','==',exec_id);
    if (!degraded) q = q.orderBy('exec_id','asc').orderBy('ts','desc');
    const snap = await q.limit(200).get();
    const items = snap.docs.map(d => { const x=d.data(); return { exec_id:x.exec_id, ts:ts(x.ts), type:x.type, payload:x.payload??null };});
    return res.status(200).json({ exec_id, degraded_sort: degraded, items });
  }catch(e){
    const msg = String(e||'');
    if (msg.includes('FAILED_PRECONDITION') && msg.includes('The query requires an index')) {
      const snap = await db().collection('events').where('exec_id','==',exec_id).limit(200).get();
      const items = snap.docs.map(d=>d.data()).sort((a,b)=>(b.ts?.seconds||0)-(a.ts?.seconds||0))
        .map(x=>({ exec_id:x.exec_id, ts:ts(x.ts), type:x.type, payload:x.payload??null }));
      return res.status(200).json({ exec_id, degraded_sort:true, items });
    }
    return res.status(500).json({ code:'E299', message:'events lookup failed', details:msg });
  }
});
module.exports = router;
