import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .ai_client import ai_client, AIClientError
from .config import settings
from .models import ChatRequest, ChatResponse, HealthResponse
from .store import store

logging.basicConfig(level=settings.LOG_LEVEL)
logger = logging.getLogger(settings.SERVICE_NAME)

app = FastAPI(title="IT Helpdesk Chat Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness/readiness probe target."""
    return HealthResponse(status="ok", service=settings.SERVICE_NAME)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    # Use client-supplied history if given, else fall back to server-side
    # in-memory session store (see store.py for multi-replica caveats).
    if req.history is not None:
        history = [m.model_dump() for m in req.history]
    else:
        history = store.get(req.session_id)

    history.append({"role": "user", "content": req.message})

    try:
        reply = await ai_client.chat(history)
    except AIClientError as e:
        logger.error("AI client error: %s", e)
        raise HTTPException(status_code=502, detail=str(e))

    if req.history is None:
        store.append(req.session_id, "user", req.message)
        store.append(req.session_id, "assistant", reply)

    return ChatResponse(session_id=req.session_id, reply=reply)
