const AjvModule = require('ajv/dist/2020');              // 正規エントリポイント（深い import なし）
const Ajv = AjvModule.default || AjvModule;
const addFormats = require('ajv-formats');
const schemaOriginal = require('./schema/macros.schema.json');

// $schema が 2020-12 を指していても、メタは手動ロードせず「参照自体を無効化」して内部デフォルトに委ねる
const schema = JSON.parse(JSON.stringify(schemaOriginal));
if (typeof schema.$schema === 'string' && /2020-12/.test(schema.$schema)) {
  delete schema.$schema;
}

let _fetch = null;
try { if (typeof fetch === 'function') _fetch = fetch; } catch {}
if (!_fetch) {
  try { _fetch = require('undici').fetch; }
  catch { _fetch = async () => { throw new Error('no fetch available'); }; }
}

function bad(res, http, body){
  res.type('application/json; charset=utf-8');
  return res.status(http).json(body);
}

module.exports = async function validateMacrosMW(req, res, next){
  const path = (req.path || req.url || '');
  if (!(req.method === 'POST' && (path === '/command' || (req.originalUrl || '').startsWith('/command')))) return next();

  try {
    let b = req.body || {};
    if (!b || (typeof b === 'object' && Object.keys(b).length === 0)) {
      try { b = JSON.parse(Buffer.from(req.rawBody||'').toString('utf8')||'{}'); } catch {}
    }

    const exec_id = b.exec_id;
    const url = b.macros_url;
    if (typeof url !== 'string' || !/^https:\/\//i.test(url)) {
      return bad(res, 400, { exec_id, status:'REJECTED', code:'E001', message:'macros_url required (https only)' });
    }

    // 取得
    let text;
    try {
      const ac = new AbortController();
      const id = setTimeout(()=>ac.abort(), 5000);
      const r = await _fetch(url, { signal: ac.signal, headers: { accept: 'application/json' } });
      clearTimeout(id);
      if (!r.ok) {
        return bad(res, 424, { exec_id, status:'REJECTED', code:'E002', message:`fetch failed: ${r.status} ${r.statusText}`, details:{ macros_url:url } });
      }
      text = await r.text();
    } catch (e) {
      return bad(res, 424, { exec_id, status:'REJECTED', code:'E002', message:'fetch error', details:{ error:String(e), macros_url:url } });
    }

    // 解析
    let macros;
    try { macros = JSON.parse(text); }
    catch { return bad(res, 400, { exec_id, status:'REJECTED', code:'E003', message:'macros.json parse error', details:{ macros_url:url } }); }

    // 検証（Ajv 2020・メタ自動、formats追加）
    const ajv = new Ajv({ strict:true, allErrors:true, allowUnionTypes:false, unevaluated:true, removeAdditional:false });
    addFormats(ajv);

    const validate = ajv.compile(schema);
    if (!validate(macros)) {
      return bad(res, 422, { exec_id, status:'REJECTED', code:'E004', message:'macros.json does not conform to schema', details:{ ajvErrors: validate.errors, macros_url:url } });
    }

    // 後段引き渡し + デバッグヘッダ
    req.macros_json = macros;
    res.locals.macros_json = macros;
    res.setHeader('X-Validated-Macros','1');
    return next();

  } catch (e) {
    return bad(res, 500, { status:'ERROR', code:'E010', message:'validator internal error', details:String(e) });
  }
};
