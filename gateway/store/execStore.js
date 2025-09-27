let _db = null;
function db(){ if(_db) return _db; const { Firestore } = require('@google-cloud/firestore'); _db = new Firestore(); return _db; }
const COL = 'exec';
async function getExecById(exec_id){
  const docRef = db().collection(COL).doc(exec_id);
  const snap = await docRef.get();
  if (snap.exists) return snap.data();
  const q = await db().collection(COL).where('exec_id','==',exec_id).limit(1).get();
  if (!q.empty) return q.docs[0].data();
  return null;
}
module.exports = { getExecById };
