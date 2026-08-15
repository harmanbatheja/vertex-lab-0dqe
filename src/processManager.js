const { spawn } = require("child_process");
const path = require("path");
const { ROOT } = require("./envStore");

/** @type {Map<string, { id: string, name: string, command: string, pid: number|null, status: string, startedAt: string, exitCode: number|null, logs: string[] }>} */
const processes = new Map();

let ackToken = null;
let ackAt = null;

function createId() {
  return "proc_" + Math.random().toString(36).slice(2, 10);
}

function listProcesses() {
  return Array.from(processes.values()).map((p) => ({
    id: p.id,
    name: p.name,
    command: p.command,
    pid: p.pid,
    status: p.status,
    startedAt: p.startedAt,
    exitCode: p.exitCode,
    logTail: p.logs.slice(-20),
  }));
}

function startDemoWorker(name = "demo-worker") {
  const id = createId();
  const script = `
    const start = Date.now();
    setInterval(() => {
      console.log(JSON.stringify({ tick: Math.floor((Date.now()-start)/1000), pid: process.pid }));
    }, 2000);
    process.on('SIGTERM', () => { console.log('shutting down'); process.exit(0); });
  `;
  const child = spawn(process.execPath, ["-e", script], {
    cwd: ROOT,
    env: { ...process.env, WORKER_NAME: name },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const record = {
    id,
    name,
    command: "node -e <demo-worker>",
    pid: child.pid,
    status: "running",
    startedAt: new Date().toISOString(),
    exitCode: null,
    logs: [],
    child,
  };

  const pushLog = (chunk) => {
    const text = String(chunk).trim();
    if (!text) return;
    for (const line of text.split(/\n/)) {
      record.logs.push(line);
      if (record.logs.length > 100) record.logs.shift();
    }
  };
  child.stdout.on("data", pushLog);
  child.stderr.on("data", pushLog);
  child.on("exit", (code) => {
    record.status = "stopped";
    record.exitCode = code;
    record.pid = null;
    record.child = null;
  });

  processes.set(id, record);
  return listProcesses().find((p) => p.id === id);
}

function getAckState() {
  return {
    acknowledged: Boolean(ackToken),
    acknowledgedAt: ackAt,
    token: ackToken,
  };
}

function acknowledgeEnv(note) {
  ackToken = "ack_" + Math.random().toString(36).slice(2, 12);
  ackAt = new Date().toISOString();
  return { ...getAckState(), note: note || "Saved to password manager" };
}

function killProcess(id, token) {
  const record = processes.get(id);
  if (!record) return { ok: false, error: "Process not found" };
  if (record.status !== "running") {
    return { ok: false, error: "Process is not running" };
  }
  if (!ackToken || token !== ackToken) {
    return {
      ok: false,
      error:
        "Acknowledge the env file first so you can save secrets to your password manager before killing processes.",
      requireAck: true,
    };
  }
  try {
    if (record.child) {
      record.child.kill("SIGTERM");
    } else if (record.pid) {
      process.kill(record.pid, "SIGTERM");
    }
    record.status = "stopping";
    return { ok: true, process: listProcesses().find((p) => p.id === id) };
  } catch (err) {
    return { ok: false, error: err.message || "Kill failed" };
  }
}

function seedIfEmpty() {
  if (processes.size === 0) {
    startDemoWorker("api-sidecar");
    startDemoWorker("queue-worker");
  }
}

module.exports = {
  listProcesses,
  startDemoWorker,
  killProcess,
  acknowledgeEnv,
  getAckState,
  seedIfEmpty,
  pathHint: path.join(ROOT, ".env"),
};
