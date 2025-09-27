'use strict';
const express = require('express');
const crypto = require('crypto');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ verify: (req,res,buf)=>{ req.rawBody = buf; } }));

// health
app.get('/', (_,res)=> res.status(200).type('text/plain').send('ok'));
app.get('/healthz', (_,res)=> res.status(200).json({ ok:true }));

// 前段 MW（順序固定）
const validateMacrosMW = require('./validate-macros'); // AJV 2020-12 + undici
app.use(validateMacrosMW);

const persistExec = require('./persist-exec');        // 202 後 finish で Firestore 永続化
app.use(persistExec);

// HMAC 検証
function verifyHmac(req,res,next){
  try{
    const secret = process.env.GO_SHARED_SECRET;
    if(!secret) return res.status(500).json({ code:'E900', message:'shared secret missing' });
    const sent = String(req.get('X-GO-Signature')||'').trim().toLowerCase();
    const calc = crypto.createHmac('sha256', secret).update(req.rawBody||Buffer.alloc(0)).digest('hex').toLowerCase();
    if(sent !== calc) return res.status(401).json({ code:'UNAUTHORIZED', message:'invalid signature' });
    return next();
  }catch(e){ return res.status(500).json({ code:'E910', message:'hmac verify error', details:String(e) }); }
}

// /command（前段MWの検証結果だけを使用。再fetchしない）
app.post('/command', verifyHmac, (req,res)=>{
  try{
    const b = req.body || {};
    const exec_id = String(b.exec_id||'').trim();
    if(!exec_id) return res.status(400).json({ code:'E001', message:'exec_id required' });
    const macros = res.locals.macros_json || req.macros_json;
    if(!macros)  return res.status(500).json({ code:'E010', message:'validated macros missing' });
    return res.status(202).json({ exec_id, status:'ACCEPTED' });
  }catch(e){ return res.status(500).json({ code:'E010', message:'command handler error', details:String(e) }); }
});

// ルーター
app.use(require('./routes/status'));
app.use(require('./routes/events'));

// HITL（存在時のみ）
try { const createHitlRouter = require('./routes/hitl'); if (typeof createHitlRouter==='function') app.use(createHitlRouter()); } catch {}

app.use((req,res)=>{
  res.type('application/json; charset=utf-8');
  res.status(404).json({ code:'NOT_FOUND', path:req.path, method:req.method });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, ()=> console.log(`Gateway listening on http://localhost:${PORT}`));
