# IT Helpdesk Chat Assistant

An AI-powered IT helpdesk chat assistant: a React chat widget backed by a
Python (FastAPI) microservice, running as two Docker containers via Docker
Compose. The AI backend is OpenRouter, calling the free **Nemotron 3
Ultra** model — swappable to any other OpenAI-compatible provider via env
vars.

## Architecture

```
 ┌─────────────┐        /api/*         ┌────────────────┐        HTTPS         ┌───────────────────┐
 │   Browser   │ ───────────────────▶  │ frontend         │ ───────────────────▶ │   chat-service     │
 │ (React SPA) │  ◀───────────────────  │ container (nginx,│   proxy_pass /api/  │   container (FastAPI)│
 └─────────────┘                       │ static build)    │                      └─────────┬──────────┘
                                        └────────────────┘                                │
                                                                                            │ Bearer token
                                                                                            ▼
                                                                                  OpenRouter API
                                                                          (nvidia/nemotron-3-ultra:free,
                                                                           or any OpenAI-compatible model)
```

- **frontend** — React chat widget (Vite build), served as static files by
  nginx. Nginx reverse-proxies `/api/*` to the `chat-service` container
  (Compose gives containers DNS names matching their service name), so the
  browser only ever talks to one origin.
- **chat-service** — FastAPI microservice with one endpoint,
  `POST /api/chat`. Holds the system prompt tuned for IT helpdesk triage,
  keeps short in-memory conversation history per session, and forwards
  requests to OpenRouter.

## Repo layout

```
ai-helpdesk-app/
├── frontend/                  React chat widget (Vite + nginx)
├── services/
│   └── chat-service/           FastAPI microservice that talks to the AI API
├── docker-compose.yaml         The only thing you run — builds and starts both containers
└── README.md
```

---

## Prerequisites (Ubuntu/Debian server)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER && newgrp docker

# firewall, if ufw is active
sudo ufw allow 8080/tcp   # frontend
sudo ufw allow 8000/tcp   # chat-service (optional — only needed if you call it directly)
```

If this is an AWS EC2 box, also open port 8080 (and 8000 if needed) in the
**Security Group**.

## Get an AI API key (OpenRouter)

1. Sign up at https://openrouter.ai and create a key at
   https://openrouter.ai/keys.
2. **Never paste API keys into a chat tool, ticket, or Slack message** —
   treat any key pasted somewhere outside your own terminal as compromised
   and regenerate it.
3. Default model: `nvidia/nemotron-3-ultra-550b-a55b:free`.

## Run it

```bash
cd ai-helpdesk-app
export AI_API_KEY=your-openrouter-key-here
docker compose up --build
```

Open `http://your-server-ip:8080`.

To run it in the background instead of holding your terminal:

```bash
docker compose up --build -d
```

Check status / logs:

```bash
docker compose ps
docker compose logs -f chat-service
docker compose logs -f frontend
```

Stop it:

```bash
docker compose down
```

## Updating the app after a code change

```bash
docker compose up --build
```

Compose rebuilds whichever image's source changed and restarts just that
container.

## Updating the API key

Set the new value and restart:

```bash
export AI_API_KEY=your-new-key-here
docker compose up -d --force-recreate chat-service
```

Or put it in a `.env` file next to `docker-compose.yaml` (gitignored) so you
don't need to `export` it every session:

```
AI_API_KEY=your-openrouter-key-here
```

## Troubleshooting

**A chat message fails / errors out in the widget**
Check chat-service's logs first — this is almost always a bad/missing API
key or wrong model name:
```bash
docker compose logs -f chat-service
```
Then test chat-service directly, bypassing the browser/frontend:
```bash
curl -s -X POST http://localhost:8000/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"session_id":"test1","message":"hello"}'
```

**Frontend container shows `unhealthy` or the page won't load**
```bash
docker compose logs -f frontend
```

**Port already in use**
Something else on the server is already bound to 8080 or 8000 — either stop
it, or change the left-hand side of the `ports:` mapping in
`docker-compose.yaml` (e.g. `"8081:8080"`).

## API reference

`POST /api/chat`
```json
{ "session_id": "sess_abc123", "message": "My VPN keeps disconnecting" }
```
```json
{ "session_id": "sess_abc123", "reply": "Let's narrow it down..." }
```

`GET /health` — liveness/readiness probe target, returns `{"status": "ok"}`.

## Known limitations before production use

- **Session history is in-memory in the chat-service container.** Restarting
  the container clears all active conversations. Fine for a single-instance
  setup like this; `services/chat-service/app/store.py` has the swap-in
  points for a Redis-backed store if you ever need persistence across
  restarts.
- **No auth on the chat endpoint.** Put this behind a reverse proxy with
  auth (e.g. an nginx/Caddy layer with basic auth or your SSO) before
  exposing it beyond a pilot group.
- **No TLS configured.** Put a reverse proxy (Caddy is the simplest option)
  in front of this with a real domain for HTTPS.
- **OpenRouter's free tier** has rate limits — fine for testing/pilot, not
  guaranteed for production load.
