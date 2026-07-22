import os


class Settings:
    """
    Central config, read from environment variables (injected via
    Kubernetes ConfigMap + Secret in production, or a .env file locally).
    """

    # --- AI provider settings -------------------------------------------------
    # Default target: NVIDIA's free OpenAI-compatible NIM endpoint serving
    # Nemotron 3 Ultra. Get a free key at https://build.nvidia.com
    #
    # To switch providers (e.g. OpenRouter, OpenAI, Azure OpenAI) you only need
    # to change AI_BASE_URL / AI_MODEL / AI_API_KEY — the client code is
    # provider-agnostic because it just speaks the OpenAI chat.completions
    # wire format.
    AI_BASE_URL: str = os.getenv("AI_BASE_URL", "https://integrate.api.nvidia.com/v1")
    AI_MODEL: str = os.getenv("AI_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")
    AI_API_KEY: str = os.getenv("AI_API_KEY", "")

    # OpenRouter requires these two extra headers on every request (used for
    # their leaderboard/rankings). Ignored by providers that don't need them.
    AI_SITE_URL: str = os.getenv("AI_SITE_URL", "http://localhost")
    AI_SITE_NAME: str = os.getenv("AI_SITE_NAME", "IT Helpdesk Assistant")

    # generation params
    AI_TEMPERATURE: float = float(os.getenv("AI_TEMPERATURE", "0.3"))
    AI_MAX_TOKENS: int = int(os.getenv("AI_MAX_TOKENS", "800"))

    # --- service settings ------------------------------------------------------
    SERVICE_NAME: str = os.getenv("SERVICE_NAME", "chat-service")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    CORS_ORIGINS: list[str] = os.getenv("CORS_ORIGINS", "*").split(",")

    # how many prior turns of a conversation to send back to the model
    MAX_HISTORY_TURNS: int = int(os.getenv("MAX_HISTORY_TURNS", "12"))


settings = Settings()
