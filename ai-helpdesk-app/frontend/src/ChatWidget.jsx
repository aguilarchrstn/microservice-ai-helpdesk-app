import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowRight,
  Home,
  Inbox,
  Mail,
  Table2,
  Settings,
  MoreHorizontal,
  Paperclip,
  Sparkles,
  ChevronDown,
  Wifi,
  KeyRound,
  Laptop,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { renderMessageContent } from "./MessageContent.jsx";

// Bump this string whenever you ship a change, and check it in the browser
// console (F12 → Console) after deploying to confirm the new build is
// actually the one running — helps rule out stale Docker/browser caches.
console.log("IT Helpdesk widget build: 2026-07-23-v2 (markdown + actions + mobile-fix)");

const API_ENDPOINT = "/api/chat";

function makeSessionId() {
  return "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SUGGESTIONS = [
  {
    icon: Wifi,
    tint: "tint-blue",
    title: "Network Issue",
    subtitle: "Help me fix VPN or Wi-Fi problems",
    prompt: "I'm having trouble connecting — my VPN keeps dropping.",
  },
  {
    icon: KeyRound,
    tint: "tint-rose",
    title: "Account Access",
    subtitle: "Reset a password or unlock my account",
    prompt: "I'm locked out of my account and need to reset my password.",
  },
  {
    icon: Laptop,
    tint: "tint-green",
    title: "Hardware Request",
    subtitle: "Request new equipment or a repair",
    prompt: "I need to request a repair or replacement for my laptop.",
  },
];

export default function HelpdeskApp() {
  const [entered, setEntered] = useState(false);
  const [sessionId] = useState(makeSessionId);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("ready"); // ready | sending | error
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [feedback, setFeedback] = useState({}); // { [messageIndex]: "up" | "down" }
  const [errorMsg, setErrorMsg] = useState("");
  const logRef = useRef(null);

  const started = messages.length > 0;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || status === "sending") return;

    setMessages((m) => [...m, { role: "user", content: trimmed }]);
    setInput("");
    setStatus("sending");
    setErrorMsg("");

    try {
      const res = await fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
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

  async function handleCopyMessage(index, text) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
    } catch {
      // Clipboard API unavailable — fail quietly.
    }
  }

  function handleFeedback(index, value) {
    setFeedback((prev) => ({ ...prev, [index]: prev[index] === value ? null : value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  if (!entered) {
    return (
      <div className="app app--splash">
        <div className="splash">
          <div className="splash__orb" aria-hidden="true">
            <div className="hero__orb-glow" />
            <div className="hero__grid" />
          </div>
          <div className="splash__content">
            <div className="splash__mark">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>IT Helpdesk Assistant</h1>
            <p>Fast answers for network, account, and hardware issues — any time, no ticket queue to wait in.</p>
            <button className="splash__cta" onClick={() => setEntered(true)}>
              Start chat
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M7 17L17 7M17 7H9M17 7V15" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <nav className="sidebar__nav">
          <button className="sidebar__icon sidebar__icon--active" aria-label="Home">
            <Home size={18} />
          </button>
          <button className="sidebar__icon" aria-label="Tickets">
            <Inbox size={18} />
          </button>
          <button className="sidebar__icon" aria-label="Messages">
            <Mail size={18} />
          </button>
          <button className="sidebar__icon" aria-label="Knowledge base">
            <Table2 size={18} />
          </button>
        </nav>
        <div className="sidebar__bottom">
          <button className="sidebar__icon" aria-label="Settings">
            <Settings size={18} />
          </button>
          <button className="sidebar__icon" aria-label="More">
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar__spacer" />
          <button className="topbar__profile">
            <span className="topbar__avatar" aria-hidden="true" />
            <span className="topbar__name">IT Helpdesk</span>
            <ChevronDown size={14} />
          </button>
        </header>

        {!started ? (
          <div className="hero">
            <div className="hero__orb" aria-hidden="true">
              <div className="hero__orb-glow" />
              <div className="hero__grid" />
            </div>

            <div className="hero__copy">
              <h1>
                Hey there <span className="hero__accent">👋</span>
              </h1>
              <h1>What can I help with?</h1>
            </div>

            <div className="suggestions">
              {SUGGESTIONS.map(({ icon: Icon, tint, title, subtitle, prompt }) => (
                <button
                  key={title}
                  className={`suggestion ${tint}`}
                  onClick={() => send(prompt)}
                >
                  <span className="suggestion__badge">
                    <Icon size={13} />
                    {title}
                  </span>
                  <span className="suggestion__subtitle">{subtitle}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble--${m.role}`}>
                <div className="bubble__label">{m.role === "user" ? "You" : "IT Helpdesk"}</div>
                <div className="bubble__text">
                  {m.role === "assistant" ? renderMessageContent(m.content) : m.content}
                </div>
                <div className="bubble__actions">
                  <button
                    type="button"
                    className="bubble__action"
                    onClick={() => handleCopyMessage(i, m.content)}
                    aria-label="Copy message"
                  >
                    {copiedIndex === i ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                  {m.role === "assistant" && (
                    <>
                      <button
                        type="button"
                        className={`bubble__action ${feedback[i] === "up" ? "bubble__action--up" : ""}`}
                        onClick={() => handleFeedback(i, "up")}
                        aria-label="Good response"
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        className={`bubble__action ${feedback[i] === "down" ? "bubble__action--down" : ""}`}
                        onClick={() => handleFeedback(i, "down")}
                        aria-label="Bad response"
                      >
                        <ThumbsDown size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}

            {status === "sending" && (
              <div className="bubble bubble--assistant bubble--pending">
                <div className="bubble__label">IT Helpdesk</div>
                <div className="bubble__text typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="log__error">Couldn't reach the assistant: {errorMsg}</div>
            )}
          </div>
        )}

        <form className="composer" onSubmit={handleSubmit}>
          <div className="composer__icon">
            <Sparkles size={14} />
          </div>
          <input
            type="text"
            placeholder="Ask me anything......."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={status === "sending"}
          />
          <button type="button" className="composer__attach">
            <Paperclip size={13} />
            <span>Attach file</span>
          </button>
          <button type="submit" className="composer__send" disabled={status === "sending" || !input.trim()}>
            <ArrowUp size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}
