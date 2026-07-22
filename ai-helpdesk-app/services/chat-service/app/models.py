from typing import Literal, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str


class ChatRequest(BaseModel):
    session_id: str = Field(..., description="Stable id for the support conversation")
    message: str = Field(..., min_length=1, max_length=4000)
    # Optional prior turns, if the caller (frontend) manages history itself
    # instead of relying on the in-memory session store.
    history: Optional[list[ChatMessage]] = None


class ChatResponse(BaseModel):
    session_id: str
    reply: str
    category: Optional[str] = None  # e.g. "network", "account", "hardware"
    suggested_priority: Optional[Literal["low", "medium", "high", "urgent"]] = None


class HealthResponse(BaseModel):
    status: str
    service: str
