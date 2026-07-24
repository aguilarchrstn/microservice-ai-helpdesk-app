import logging
import httpx

from .config import settings

logger = logging.getLogger(settings.SERVICE_NAME)

SYSTEM_PROMPT = """You are an IT Helpdesk support assistant embedded in a company chat widget.
Your job:
- Help employees troubleshoot common IT issues (network/VPN, email, password/account
  lockouts, printer, hardware, software installs, access requests).
- Ask concise clarifying questions when the issue is ambiguous.
- Give clear, numbered step-by-step instructions when you propose a fix.
- If the issue requires human intervention (hardware replacement, security incident,
  access approval, anything you can't resolve conversationally), say so plainly and
  recommend escalating to a human technician, and suggest a priority level.
- Keep responses concise and professional. Avoid speculation about internal systems
  you have not been told about.
- Do not give info about non IT Related issue.

Formatting:
- Use **bold** for key actions, buttons, or settings the user needs to click ("go to
  **Settings > Network**").
- Use *italics* sparingly, for a brief aside or note.
- Use `inline code` for file paths, commands, error codes, or exact values.
- Use fenced code blocks (```) for anything meant to be copy-pasted verbatim — a
  terminal command, a config snippet, an exact error message.
- A light touch of emoji is fine to keep tone friendly (e.g. ✅ for a completed step,
  ⚠️ for a warning, 🔧 for a fix) — don't overuse them.
"""


class AIClientError(Exception):
    pass


class AIClient:
    """
    Thin wrapper around an OpenAI-compatible chat.completions endpoint.
    Works out of the box with NVIDIA's NIM free endpoint (Nemotron 3 Ultra),
    and can be repointed at OpenRouter/OpenAI/Azure OpenAI by changing env vars.
    """

    def __init__(self) -> None:
        self.base_url = settings.AI_BASE_URL.rstrip("/")
        self.model = settings.AI_MODEL
        self.api_key = settings.AI_API_KEY

    async def chat(self, history: list[dict]) -> str:
        if not self.api_key:
            raise AIClientError(
                "AI_API_KEY is not set. Get a free key at https://build.nvidia.com "
                "and set it via the chat-service Kubernetes Secret (or .env locally)."
            )

        payload = {
            "model": self.model,
            "messages": [{"role": "system", "content": SYSTEM_PROMPT}, *history],
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
            "stream": False,
        }
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            # Required by OpenRouter; harmlessly ignored by other providers.
            "HTTP-Referer": settings.AI_SITE_URL,
            "X-Title": settings.AI_SITE_NAME,
        }

        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                logger.error("AI provider error %s: %s", e.response.status_code, e.response.text)
                raise AIClientError(
                    f"AI provider returned {e.response.status_code}: {e.response.text[:300]}"
                ) from e
            except httpx.RequestError as e:
                logger.error("AI provider request failed: %s", e)
                raise AIClientError(f"Could not reach AI provider: {e}") from e

        data = resp.json()
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as e:
            logger.error("Unexpected AI provider response shape: %s", data)
            raise AIClientError("Unexpected response shape from AI provider") from e


ai_client = AIClient()
