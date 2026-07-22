# IT Helpdesk Chat Assistant

An AI-powered IT helpdesk chat assistant: a React chat widget backed by a
Python (FastAPI) microservice, deployed on Kubernetes (k3s). The AI backend
is OpenRouter, calling the free **Nemotron 3 Ultra** model — swappable to
any other OpenAI-compatible provider via env vars.

## Architecture

```
 ┌─────────────┐        /api/*         ┌────────────────┐        HTTPS         ┌───────────────────┐
 │   Browser   │ ───────────────────▶  │  frontend pod  │ ───────────────────▶ │   chat-service pod │
 │ (React SPA) │  ◀───────────────────  │ (nginx, static │   proxy_pass /api/  │   (FastAPI)         │
 └─────────────┘                       │  build + proxy)│                      └─────────┬──────────┘
                                        └────────────────┘                                │
                                                                                            │ Bearer token
                                                                                            ▼
                                                                                  OpenRouter API
                                                                          (nvidia/nemotron-3-ultra:free,
                                                                           or any OpenAI-compatible model)
```

- **frontend** — React chat widget (Vite build), served as static files by
  nginx. Nginx reverse-proxies `/api/*` to the `chat-service` Kubernetes
  Service, so the browser only ever talks to one origin.
- **chat-service** — FastAPI microservice with one endpoint,
  `POST /api/chat`. Holds the system prompt tuned for IT helpdesk triage,
  keeps short in-memory conversation history per session, and forwards
  requests to OpenRouter (or whichever OpenAI-compatible endpoint you
  configure).

## Repo layout

```
ai-helpdesk-app/
├── frontend/                  React chat widget (Vite + nginx)
├── services/
│   └── chat-service/           FastAPI microservice that talks to the AI API
├── k8s/                        Kubernetes manifests
├── docker-compose.yaml         Local dev without Kubernetes (optional)
└── README.md
```

---

## Part 1 — Server prerequisites (Ubuntu/Debian, single node)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ca-certificates docker.io

# Kubernetes wants swap off
sudo swapoff -a
sudo sed -i '/ swap / s/^/#/' /etc/fstab

# let your user run docker without sudo
sudo usermod -aG docker $USER && newgrp docker

# firewall (skip if ufw isn't in use)
sudo ufw allow 6443/tcp   # k8s API
sudo ufw allow 80/tcp     # HTTP ingress
sudo ufw allow 443/tcp    # HTTPS ingress
sudo ufw allow 10250/tcp  # kubelet
```

If this is an AWS EC2 box, also open the equivalent ports (80, 443, and
whatever you use for port-forward testing, e.g. 8080) in the **Security
Group**, not just `ufw`.

## Part 2 — Install k3s

```bash
curl -sfL https://get.k3s.io | sh -
sudo systemctl status k3s --no-pager   # confirm it's active
```

### Let your normal user run `kubectl` without `sudo`

k3s writes its kubeconfig as root-only by default. Copy it into your own
home directory and take ownership:

```bash
mkdir -p ~/.kube
sudo cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
sudo chown $(id -u):$(id -g) ~/.kube/config
chmod 600 ~/.kube/config

echo 'export KUBECONFIG=~/.kube/config' >> ~/.bashrc
source ~/.bashrc

kubectl get nodes   # should show one node, status Ready
```

Do this **for every user** who needs to run `kubectl` on this box — each
user needs their own `~/.kube/config` copy. (Alternative if this is a
single-user dev box and you don't mind looser permissions: `sudo chmod 644
/etc/rancher/k3s/k3s.yaml` and point `KUBECONFIG` straight at that file
instead — not recommended on a shared or production server.)

## Part 3 — Get an AI API key (OpenRouter)

1. Sign up at https://openrouter.ai and create a key at
   https://openrouter.ai/keys.
2. **Never paste API keys into a chat tool, ticket, or Slack message** —
   treat any key that's been pasted somewhere outside your own terminal as
   compromised and regenerate it before use.
3. The free model this app defaults to is `nvidia/nemotron-3-ultra-550b-a55b:free`.

## Part 4 — Build and deploy

From the repo root on the server:

```bash
cd ~/microservice-ai-helpdesk-app/ai-helpdesk-app

# 1. Build images locally
docker build -t chat-service:1.0.0 ./services/chat-service
docker build -t frontend:1.0.0 ./frontend

# 2. Single-node k3s: import straight into its containerd, no registry needed
docker save chat-service:1.0.0 | sudo k3s ctr images import -
docker save frontend:1.0.0 | sudo k3s ctr images import -

# 3. Namespace + config
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/10-chat-service-configmap.yaml

# 4. Secret — paste your key directly at this prompt, not into any chat
kubectl create secret generic chat-service-secret \
  --namespace=it-helpdesk \
  --from-literal=AI_API_KEY=your-openrouter-key-here

# 5. Deploy both services
kubectl apply -f k8s/12-chat-service-deployment.yaml
kubectl apply -f k8s/13-chat-service-service.yaml
kubectl apply -f k8s/20-frontend-deployment.yaml
kubectl apply -f k8s/21-frontend-service.yaml
```

Watch it come up:

```bash
kubectl -n it-helpdesk get pods -w
```

Wait for both pods to show `1/1 Running`, then `Ctrl+C`.

## Part 5 — Access it

Quick test without setting up Ingress:

```bash
kubectl -n it-helpdesk port-forward svc/frontend 8080:80
```

Open `http://your-server-ip:8080`.

For permanent access on port 80 (no port-forward), use the Ingress — k3s
ships **Traefik** by default, not nginx, so the ingress class needs to
match:

```bash
sed -i 's/ingressClassName: nginx/ingressClassName: traefik/' k8s/30-ingress.yaml
# edit the `host:` line in that file to your real domain or server IP
kubectl apply -f k8s/30-ingress.yaml
```

## Part 6 — Optional: autoscaling

The HPA needs `metrics-server`, which k3s doesn't install by default:

```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl apply -f k8s/14-chat-service-hpa.yaml
```

---

## Updating the app after a code change

```bash
docker build -t chat-service:1.0.0 ./services/chat-service   # or frontend
docker save chat-service:1.0.0 | sudo k3s ctr images import -
kubectl -n it-helpdesk rollout restart deployment/chat-service
kubectl -n it-helpdesk rollout status deployment/chat-service
```

## Updating the API key later

```bash
kubectl -n it-helpdesk delete secret chat-service-secret
kubectl create secret generic chat-service-secret \
  --namespace=it-helpdesk \
  --from-literal=AI_API_KEY=your-new-key-here
kubectl -n it-helpdesk rollout restart deployment/chat-service
```

## Troubleshooting

**`kubectl get nodes` asks for `sudo` / permission denied**
Your user doesn't have its own kubeconfig yet — see the "let your normal
user run kubectl" step in Part 2.

**Pod stuck in `ImagePullBackOff`**
The image wasn't imported into k3s's containerd (or the tag doesn't match
what's in the Deployment yaml). Re-run the `docker save | sudo k3s ctr
images import -` step and confirm the tag matches exactly, including the
`:1.0.0`.

**Frontend container shows `unhealthy` (in Docker Compose) or `CrashLoopBackOff`/not-ready (in k8s)**
Check logs first:
```bash
docker logs ai-helpdesk-app-frontend-1 --tail 50        # docker compose
kubectl -n it-helpdesk logs deployment/frontend          # kubernetes
```

**Chat replies with a 502 / "Could not reach AI provider"**
Almost always a bad or missing `AI_API_KEY`, or `AI_MODEL`/`AI_BASE_URL`
mismatched with the provider. Check:
```bash
kubectl -n it-helpdesk logs deployment/chat-service
```

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

- **Session history is in-memory per pod.** With 2+ replicas and no sticky
  sessions, a follow-up message can land on a different pod and lose
  context. `services/chat-service/app/store.py` has the swap-in points and
  a commented Redis-backed implementation.
- **No auth on the chat endpoint.** Put this behind SSO before exposing it
  beyond a pilot group.
- **No TLS configured.** Pair k3s with `cert-manager` + Let's Encrypt for
  HTTPS on a real domain.
- **OpenRouter's free tier** has rate limits — fine for testing/pilot, not
  guaranteed for production load.

## Growing this into a fuller helpdesk system

- a **ticket-service** to persist conversations as real tickets (Postgres)
- an **auth-service** or SSO gateway in front of everything
- a **notification** path (email/Slack) when the assistant flags something
  as needing a human
- observability (Prometheus metrics, structured logs)

The current structure (one Deployment + Service per concern, config via
ConfigMap/Secret) is meant to make each of those a same-shaped addition
rather than a rewrite.
