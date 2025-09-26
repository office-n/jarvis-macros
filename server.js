const express = require('express');
const app = express();
app.disable('x-powered-by');

const fmt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false
});
function nowJSTString() {
  return fmt.format(new Date()).replace(/\//g, "-").replace(",", "");
}

app.get("/now", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ now_jst: nowJSTString() + " JST", tz: "Asia/Tokyo" });
});
app.get("/", (_req, res) => res.status(200).send("ok")); // 軽量ヘルス

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on http://localhost:${port}`));
