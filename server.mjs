import express from "express";
const app = express();

function nowJSTString() {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).format(new Date()).replace(/\//g, "-").replace(",", "");
}

app.get("/now", (_req, res) => {
  res.json({ now_jst: nowJSTString(), tz: "Asia/Tokyo" });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`listening on http://localhost:${port}/now`));
