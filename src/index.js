const http = require("http");
const fs = require("fs");
const path = require("path");
const { listEnvFiles, getPrimaryEnv, ensureDemoEnv } = require("./envStore");
const {
  listProcesses,
  startDemoWorker,
  killProcess,
  acknowledgeEnv,
  getAckState,
  seedIfEmpty,
} = require("./processManager");

const port = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, "..", "public");

ensureDemoEnv();
seedIfEmpty();

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

function serveStatic(res, urlPath) {
  const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC, safe === "/" || safe === "" ? "index.html" : safe);
  if (!filePath.startsWith(PUBLIC) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }
  res.writeHead(200, { "Content-Type": contentType(filePath) });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const { pathname } = url;

  try {
    if (pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (pathname === "/api/env" && req.method === "GET") {
      const files = listEnvFiles();
      const primary = getPrimaryEnv();
      return sendJson(res, 200, {
        primary: primary
          ? {
              name: primary.name,
              path: primary.path,
              size: primary.size,
              mtime: primary.mtime,
              entries: primary.entries,
              content: primary.content,
            }
          : null,
        files: files.map((f) => ({
          name: f.name,
          path: f.path,
          size: f.size,
          mtime: f.mtime,
          entryCount: f.entries.length,
        })),
        ack: getAckState(),
      });
    }

    if (pathname.startsWith("/api/env/") && req.method === "GET") {
      const name = decodeURIComponent(pathname.slice("/api/env/".length));
      const file = listEnvFiles().find((f) => f.name === name);
      if (!file) return sendJson(res, 404, { error: "Env file not found" });
      return sendJson(res, 200, {
        name: file.name,
        path: file.path,
        size: file.size,
        mtime: file.mtime,
        entries: file.entries,
        content: file.content,
      });
    }

    if (pathname === "/api/ack" && req.method === "POST") {
      const body = await readBody(req);
      return sendJson(res, 200, acknowledgeEnv(body.note));
    }

    if (pathname === "/api/ack" && req.method === "GET") {
      return sendJson(res, 200, getAckState());
    }

    if (pathname === "/api/processes" && req.method === "GET") {
      return sendJson(res, 200, {
        processes: listProcesses(),
        ack: getAckState(),
      });
    }

    if (pathname === "/api/processes" && req.method === "POST") {
      const body = await readBody(req);
      const started = startDemoWorker(body.name || "demo-worker");
      return sendJson(res, 201, { process: started });
    }

    if (pathname.startsWith("/api/processes/") && pathname.endsWith("/kill") && req.method === "POST") {
      const id = pathname.slice("/api/processes/".length, -"/kill".length);
      const body = await readBody(req);
      const result = killProcess(id, body.token);
      return sendJson(res, result.ok ? 200 : 403, result);
    }

    if (req.method === "GET" && serveStatic(res, pathname === "/" ? "/" : pathname)) {
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (err) {
    sendJson(res, 500, { error: err.message || "Server error" });
  }
});

server.listen(port, "0.0.0.0", () => {
  const primary = getPrimaryEnv();
  console.log("listening on :" + port);
  if (primary) {
    console.log("env file location:", primary.path);
    console.log("env file content:\n" + primary.content);
  }
});
