import React, { useEffect, useRef, useState } from "react";

// Chat widget talks to the chat-service via same-origin /api (proxied in dev
// by vite.config.js, and by the Ingress path rule in production).
const API_ENDPOINT = "/api/chat";

function makeSessionId() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const WELCOME = {
  role: "assistant",
  content:
    "Hi, I'm the IT Helpdesk assistant. Tell me what's going on — VPN, email, password, printer, hardware, anything — and I'll help you sort it out.",
};

export default function ChatWidget() {
  const [sessionId] = useState(makeSessionId);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("ready"); // ready | sending | error
  const [errorMsg, setErrorMsg] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || status === "sending") return;

    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Request failed (${res.status})`);
      }

      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong reaching the assistant.");
    }
  }

  return (
    <div className="widget">
      <header className="widget__header">
        <div className="widget__title">
          <span className={`dot dot--${status === "error" ? "error" : "live"}`} />
          IT Helpdesk Assistant
        </div>
        <div className="widget__session">session {sessionId.slice(0, 14)}</div>
      </header>

      <div className="widget__log" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble bubble--${m.role}`}>
            <div className="bubble__label">{m.role === "user" ? "You" : "Assistant"}</div>
            <div className="bubble__text">{m.content}</div>
          </div>
        ))}

        {status === "sending" && (
          <div className="bubble bubble--assistant bubble--pending">
            <div className="bubble__label">Assistant</div>
            <div className="bubble__text typing">
              <span /><span /><span />
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="widget__error">
            Couldn't reach the assistant: {errorMsg}
          </div>
        )}
      </div>

      <form className="widget__composer" onSubmit={sendMessage}>
        <input
          type="text"
          placeholder="Describe your IT issue…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status === "sending"}
        />
        <button type="submit" disabled={status === "sending" || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
