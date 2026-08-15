const state = {
  env: null,
  ackToken: null,
  processes: [],
};

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 2200);
}

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(opts && opts.headers) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || "Request failed");
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

async function copyText(text) {
  await navigator.clipboard.writeText(text);
}

function passwordManagerExport(entries) {
  return entries.map((e) => `${e.key}=${e.value}`).join("\n");
}

function setAckUI(ack) {
  state.ackToken = ack && ack.acknowledged ? ack.token : null;
  const pill = $("ack-pill");
  const hint = $("kill-hint");
  if (state.ackToken) {
    pill.textContent = "Saved · kill unlocked";
    pill.classList.add("ok");
    hint.textContent = "Env acknowledged. You can stop processes safely.";
    hint.classList.add("ready");
  } else {
    pill.textContent = "Not saved yet";
    pill.classList.remove("ok");
    hint.textContent = "Acknowledge the env file above before stopping processes.";
    hint.classList.remove("ready");
  }
  renderProcesses();
}

function renderEnv(payload) {
  const primary = payload.primary;
  state.env = primary;
  setAckUI(payload.ack);

  if (!primary) {
    $("env-path").textContent = "No env file found";
    $("env-rows").innerHTML = "";
    $("env-raw").textContent = "";
    $("env-meta").textContent = "";
    return;
  }

  $("env-path").textContent = primary.path;
  $("env-meta").textContent = `${primary.name} · ${primary.entries.length} keys · ${primary.size} bytes · updated ${new Date(primary.mtime).toLocaleString()}`;
  $("env-raw").textContent = primary.content;

  $("env-rows").innerHTML = primary.entries
    .map(
      (e, i) => `
      <tr>
        <td class="key">${escapeHtml(e.key)}</td>
        <td class="val" data-i="${i}">${escapeHtml(mask(e.value))}</td>
        <td>
          <button type="button" class="ghost small" data-reveal="${i}">Reveal</button>
          <button type="button" class="ghost small" data-copy-key="${i}">Copy</button>
        </td>
      </tr>`
    )
    .join("");
}

function mask(v) {
  if (!v) return "";
  if (v.length <= 4) return "••••";
  return v.slice(0, 2) + "•".repeat(Math.min(12, v.length - 2)) + v.slice(-2);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderProcesses() {
  const list = $("proc-list");
  if (!state.processes.length) {
    list.innerHTML = "<li class='proc-item'><div><h3>No processes</h3><p class='proc-meta'>Start a worker to try the safe-stop flow.</p></div></li>";
    return;
  }
  list.innerHTML = state.processes
    .map((p) => {
      const canKill = p.status === "running";
      return `
        <li class="proc-item">
          <div>
            <h3>${escapeHtml(p.name)} <span class="badge ${p.status}">${p.status}</span></h3>
            <p class="proc-meta">id=${escapeHtml(p.id)} · pid=${p.pid ?? "—"} · ${escapeHtml(p.command)}</p>
          </div>
          <button type="button" class="danger" data-kill="${p.id}" ${canKill && state.ackToken ? "" : "disabled"}>
            Stop process
          </button>
        </li>`;
    })
    .join("");
}

async function loadEnv() {
  const data = await api("/api/env");
  renderEnv(data);
}

async function loadProcesses() {
  const data = await api("/api/processes");
  state.processes = data.processes;
  setAckUI(data.ack);
}

$("refresh-env").addEventListener("click", () => loadEnv().catch((e) => toast(e.message)));
$("refresh-proc").addEventListener("click", () => loadProcesses().catch((e) => toast(e.message)));

$("copy-path").addEventListener("click", async () => {
  if (!state.env) return;
  await copyText(state.env.path);
  toast("Path copied");
});

$("copy-all").addEventListener("click", async () => {
  if (!state.env) return;
  await copyText(passwordManagerExport(state.env.entries));
  toast("Env content copied — paste into your password manager");
});

$("ack-btn").addEventListener("click", async () => {
  const data = await api("/api/ack", {
    method: "POST",
    body: JSON.stringify({ note: "Saved to password manager" }),
  });
  setAckUI(data);
  toast("Acknowledged. Process stop unlocked.");
});

$("spawn-btn").addEventListener("click", async () => {
  await api("/api/processes", {
    method: "POST",
    body: JSON.stringify({ name: "demo-worker" }),
  });
  await loadProcesses();
  toast("Worker started");
});

$("env-rows").addEventListener("click", async (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLElement) || !state.env) return;
  const reveal = t.getAttribute("data-reveal");
  const copy = t.getAttribute("data-copy-key");
  if (reveal != null) {
    const i = Number(reveal);
    const cell = document.querySelector(`td.val[data-i="${i}"]`);
    if (!cell) return;
    const showing = cell.getAttribute("data-shown") === "1";
    cell.textContent = showing ? mask(state.env.entries[i].value) : state.env.entries[i].value;
    cell.setAttribute("data-shown", showing ? "0" : "1");
    t.textContent = showing ? "Reveal" : "Hide";
  }
  if (copy != null) {
    const i = Number(copy);
    const e = state.env.entries[i];
    await copyText(`${e.key}=${e.value}`);
    toast(`Copied ${e.key}`);
  }
});

$("proc-list").addEventListener("click", async (ev) => {
  const t = ev.target;
  if (!(t instanceof HTMLElement)) return;
  const id = t.getAttribute("data-kill");
  if (!id) return;
  try {
    await api(`/api/processes/${id}/kill`, {
      method: "POST",
      body: JSON.stringify({ token: state.ackToken }),
    });
    toast("Stop signal sent");
    setTimeout(() => loadProcesses(), 400);
  } catch (err) {
    toast(err.message);
  }
});

Promise.all([loadEnv(), loadProcesses()]).catch((e) => toast(e.message));
setInterval(() => {
  loadProcesses().catch(() => {});
}, 4000);
