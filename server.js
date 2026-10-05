const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname); }
  catch { res.writeHead(400).end("Bad request"); return; }
  const relative = pathname.replace(/^\/+/, "");
  let file = path.resolve(root, relative || "index.html");
  if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end("Forbidden"); return; }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, "index.html");
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream", "X-Content-Type-Options": "nosniff" });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Samson Cafe is available at http://localhost:${port}`));
