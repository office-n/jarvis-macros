const fmtJST = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false
});
function nowJstString() {
  return fmtJST.format(new Date()).replace(/\//g, "-").replace(",", "") + " JST";
}
export function phaseTimestampCell(status, completedAtJst) {
  if (status === "DONE") return completedAtJst || "";
  if (status === "IN_PROGRESS") return nowJstString();
  return "";
}
