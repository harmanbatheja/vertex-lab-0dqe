# EnvGuard (vertex-lab-0dqe)

Show the location and content of your env file **before** killing processes, so you can save secrets in your password manager.

## Features

- Discovers `.env` / `.env.*` files and shows path + key/value content
- One-click copy formatted for password managers
- Demo workers you can start/stop
- Process kill is blocked until you acknowledge you've saved the env secrets

## Getting started

```bash
bun run start
# or: node src/index.js
```

Open `http://localhost:3000`. Health check: `GET /health` → `{ "ok": true }`.

On boot, EnvGuard creates a demo `.env` if missing and prints its location and content to the console before you manage processes.
