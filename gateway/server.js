const express = require("express");
const crypto  = require("crypto");
const fs      = require("fs");
const path    = require("path");
const fetch   = globalThis.fetch;

const app = express();
app.disable("x-powered-by");
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf.toString("utf8"); } }));

const ACCEPTED_PHRASES = ["GO start", "GO finalize-autonomy"];
const GO_SHARED_SECRET = process.env.GO_SHARED_SECRET || "CHANGEME_LOCAL_ONLY";

function resolveSchemaPath() {
  const candidates = [
    path.resolve(__dirname, "../schema/macros.schema.json"), // ルート直下 schema/
    path.resolve(__dirname, "schema/macros.schema.json"),    // gateway/schema/
    process.env.SCHEMA_PATH
  ].filter(Boolean);
  for (const p of candidates) {
    try { fs.accessSync(p); return p; } catch { /* next */ }
  }
  throw new Error("macros.schema.json not found in expected paths");
}
const SCHEMA_PATH = resolveSchemaPath();

// ✅ AJV 2020
const Ajv = require("ajv/dist/2020");
const addFormats = require("ajv-formats");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const validateMacros = ajv.compile(schema);

// 署名検証
function verifyHmac(req) {
  const sig = req.header("X-GO-Signature");
  if (!sig) return false;
  const calc = crypto.createHmac("sha256", GO_SHARED_SECRET).update(req.rawBody || "", "utf8").digest("hex");
  return sig === calc;
}

// ヘルス
app.get("/", (_req, res) => res.status(200).send("ok"));
app.get("/healthz", (_req, res) => res.status(200).json({ ok: true }));

// URL 安全性チェック
function isSafeHttpUrl(u) {
  try { const url = new URL(u); return ["http:", "https:"].includes(url.protocol); } catch { return false; }
}

// 外部JSON取得（サイズ・時間制限）
async function fetchJsonWithLimits(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(url, { redirect: "error", signal: controller.signal });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const max = 1 * 1024 * 1024;
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > max) throw new Error("payload too large");
    return JSON.parse(buf.toString("utf8"));
  } finally { clearTimeout(timeout); }
}

// /command（Phase 6）
app.post("/command", async (req, res) => {
  try {
    if (!verifyHmac(req)) return res.status(401).json({ code: "ERR_SIGNATURE", message: "invalid X-GO-Signature" });
    const { phrase, exec_id, macros_url } = req.body || {};
    if (!ACCEPTED_PHRASES.includes(phrase)) return res.status(400).json({ code: "ERR_PHRASE", message: "unsupported phrase" });
    if (!macros_url) return res.status(400).json({ code: "ERR_MACROS_URL_MISSING", message: "macros_url required" });
    if (!isSafeHttpUrl(macros_url)) return res.status(400).json({ code: "ERR_MACROS_URL_SCHEME", message: "macros_url must be http(s)" });

    let macros;
    try { macros = await fetchJsonWithLimits(macros_url); }
    catch (e) { return res.status(400).json({ code: "ERR_MACROS_FETCH", message: String(e.message || e) }); }

    const ok = validateMacros(macros);
    if (!ok) {
      return res.status(400).json({
        code: "ERR_MACROS_INVALID_SCHEMA",
        message: ajv.errorsText(validateMacros.errors, { dataVar: "macros" })
      });
    }
    if (!macros.steps || macros.steps.length === 0) {
      return res.status(400).json({ code: "ERR_EMPTY_STEPS", message: "steps must be non-empty" });
    }
    return res.status(202).json({ accepted: true, exec_id: exec_id || null, version: macros.version || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ code: "ERR_INTERNAL", message: "unexpected error" });
  }
});

// ✅ HITL ルート登録（Phase 7 スケルトン）
const { registerHitlRoutes } = require("./hitl");
registerHitlRoutes(app, verifyHmac);

// 起動
const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Gateway listening on http://localhost:${port}`));
