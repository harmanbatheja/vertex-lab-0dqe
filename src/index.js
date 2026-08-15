const http = require("http");

const port = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>vertex-lab-0dqe</title>
  <style>
    :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f4f6f8; color: #111; }
    main { width: min(28rem, 92vw); }
    h1 { font-size: 1.35rem; margin: 0 0 0.5rem; }
    p { margin: 0; color: #444; line-height: 1.45; }
  </style>
</head>
<body>
  <main>
    <h1>vertex-lab-0dqe</h1>
    <p>Scaffold is running. Implement the full app (UI + API), then keep <code>GET /</code> user-facing.</p>
  </main>
</body>
</html>`);
});

server.listen(port, "0.0.0.0", () => {
  console.log("listening on :" + port);
});
