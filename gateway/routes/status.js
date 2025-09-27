const express = require('express');
const { getExecById } = require('../store/execStore');
const router = express.Router();
function ts(v){ try{ if(!v) return null; if(typeof v.toDate==='function') return v.toDate().toISOString();
  if(typeof v._seconds==='number') return new Date(v._seconds*1000 + Math.round((v._nanoseconds||0)/1e6)).toISOString(); return v; } catch { return v; } }
router.get('/status', async (req,res)=>{
  const exec_id = String(req.query.exec_id||'').trim();
  if(!exec_id) return res.status(400).json({ code:'E100', message:'exec_id required' });
  try{
    const exec = await getExecById(exec_id);
    if(!exec) return res.status(404).json({ code:'E101', message:'exec not found', exec_id });
    return res.status(200).json({ exec_id: exec.exec_id, state: exec.state, phase: exec.phase ?? null, progress: exec.progress ?? null, updated_at: ts(exec.updated_at), next_wakeup_at: ts(exec.next_wakeup_at), version:'1.0' });
  }catch(e){ return res.status(500).json({ code:'E199', message:'status lookup failed', details:String(e) }); }
});
module.exports = router;
