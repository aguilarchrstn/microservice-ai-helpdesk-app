# IT Helpdesk Chat Assistant

An AI-powered IT helpdesk chat assistant: a React chat widget backed by a
Python (FastAPI) microservice, deployable to Kubernetes. The AI backend
defaults to **NVIDIA's free Nemotron 3 Ultra endpoint**, but any
OpenAI-compatible provider (OpenRouter, OpenAI, Azure OpenAI) works by
changing three env vars.

## Architecture

```
 ┌─────────────┐        /api/*         ┌────────────────┐        HTTPS         ┌───────────────────┐
 │   Browser   │ ───────────────────▶  │  frontend pod  │ ───────────────────▶ │   chat-service pod │
 │ (React SPA) │  ◀───────────────────  │ (nginx, static │   proxy_pass /api/  │   (FastAPI)         │
 └─────────────┘                       │  build + proxy)│                      └─────────┬──────────┘
                                        └────────────────┘                                │
                                                                                            │ Bearer token
                                                                                            ▼
                                                                             NVIDIA NIM / OpenRouter / etc.
                                                                             (Nemotron 3 Ultra or any
                                                                              OpenAI-compatible model)
```

- **frontend** — a small React chat widget (Vite build), served as static
  files by nginx. Nginx also reverse-proxies `/api/*` to the `chat-service`
  Kubernetes Service, so the browser only ever talks to one origin (no CORS
  headaches in production).
- **chat-service** — a FastAPI microservice with one real endpoint,
  `POST /api/chat`. It holds the system prompt tuned for IT helpdesk triage,
  keeps a short in-memory conversation history per session, and forwards
  requests to whichever OpenAI-compatible AI endpoint you configure.
- Both are independently containerized, independently scaled (see the HPA for
  chat-service), and deployed as separate Kubernetes Deployments — the
  "microservice" split you asked for. It's intentionally just two services;
  see "Growing this" below for where a real helpdesk system would add more.

## Repo layout

```
ai-helpdesk-app/
├── frontend/                  React chat widget (Vite + nginx)
├── services/
│   └── chat-service/           FastAPI microservice that talks to the AI API
├── k8s/                        Kubernetes manifests (namespace, config, deployments, services, ingress, HPA)
├── docker-compose.yaml         Local dev without Kubernetes
└── README.md
```

## 1. Get a free AI API key

Go to https://build.nvidia.com, sign in, and grab a free API key for
**Nemotron 3 Ultra** (`nvidia/nemotron-3-ultra-550b-a55b`). NVIDIA's free
endpoint speaks the standard OpenAI `chat/completions` format at
`https://integrate.api.nvidia.com/v1`, which is what `chat-service` calls by
default — no code changes needed.

> Prefer routing through OpenRouter instead? Set `AI_BASE_URL` to
> `https://openrouter.ai/api/v1` and `AI_MODEL` to
> `nvidia/nemotron-3-ultra-550b-a55b:free`. Same code, same env-var swap for
> OpenAI/Azure OpenAI too.

## 2. Run locally with Docker Compose (fastest way to try it)

```bash
cd ai-helpdesk-app
export AI_API_KEY=your-nvidia-key-here
docker compose up --build
```

Open http://localhost:8080 — that's the chat widget, talking to chat-service
on port 8000 via nginx's proxy.

## 3. Run on Kubernetes

### Build and push images

```bash
cd services/chat-service
docker build -t <your-registry>/chat-service:1.0.0 .
docker push <your-registry>/chat-service:1.0.0

cd ../../frontend
docker build -t <your-registry>/frontend:1.0.0 .
docker push <your-registry>/frontend:1.0.0
```

Update the `image:` fields in `k8s/12-chat-service-deployment.yaml` and
`k8s/20-frontend-deployment.yaml` to point at your pushed images.

### Create the secret with your API key

Don't commit real keys. Either:

```bash
kubectl create namespace it-helpdesk
kubectl create secret generic chat-service-secret \
  --namespace=it-helpdesk \
  --from-literal=AI_API_KEY=your-nvidia-key-here
```

or copy `k8s/11-chat-service-secret.example.yaml` to
`k8s/11-chat-service-secret.yaml`, fill in the real key, and apply it (this
file is already gitignored).

### Apply everything

```bash
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/10-chat-service-configmap.yaml
kubectl apply -f k8s/11-chat-service-secret.yaml   # if using the file approach
kubectl apply -f k8s/12-chat-service-deployment.yaml
kubectl apply -f k8s/13-chat-service-service.yaml
kubectl apply -f k8s/14-chat-service-hpa.yaml
kubectl apply -f k8s/20-frontend-deployment.yaml
kubectl apply -f k8s/21-frontend-service.yaml
kubectl apply -f k8s/30-ingress.yaml               # edit the host first
```

Check it came up:

```bash
kubectl -n it-helpdesk get pods
kubectl -n it-helpdesk get svc
```

Without an Ingress controller handy, you can also just port-forward for a
quick check:

```bash
kubectl -n it-helpdesk port-forward svc/frontend 8080:80
```

## API

`POST /api/chat`

```json
{ "session_id": "sess_abc123", "message": "My VPN keeps disconnecting" }
```

```json
{ "session_id": "sess_abc123", "reply": "Let's narrow it down..." }
```

`GET /health` — liveness/readiness probe target, returns `{"status": "ok"}`.

## Notes and things to know before production use

- **Session history is in-memory** in `chat-service`, per pod. With 2+
  replicas and no sticky sessions, a user's follow-up can land on a
  different pod and lose context. `services/chat-service/app/store.py` has
  the swap-in points and a commented Redis-backed implementation — wire that
  up (plus a Redis Deployment) before you rely on multi-turn memory at scale.
- **CORS is wide open (`*`)** by default for easy local testing. Tighten
  `CORS_ORIGINS` in the ConfigMap once you know your real frontend domain —
  though in the Kubernetes deployment as shipped, the browser never
  cross-origins anyway since nginx proxies `/api` same-origin.
- **NVIDIA's free endpoint** is meant for prototyping, not guaranteed
  production throughput/SLAs — see NVIDIA's API Trial Terms on build.nvidia.com.
- **No auth** on the chat endpoint yet. For an internal helpdesk tool, put
  this behind your existing SSO (e.g. an OAuth2-proxy sidecar/Ingress
  annotation, or your identity provider's Kubernetes-native gateway) before
  exposing it beyond a pilot group.

## Growing this into a fuller helpdesk system

The two services here cover "chat with an AI that understands IT issues."
A production helpdesk usually adds:
- a **ticket-service** to persist conversations as real tickets (Postgres),
- an **auth-service** or SSO gateway in front of everything,
- a **notification** path (email/Slack) when the assistant flags something
  as needing a human,
- observability (Prometheus metrics + a `/metrics` endpoint on chat-service,
  structured logs shipped somewhere).

The current structure (one Deployment + Service per concern, config via
ConfigMap/Secret) is meant to make each of those a same-shaped addition
rather than a rewrite.
