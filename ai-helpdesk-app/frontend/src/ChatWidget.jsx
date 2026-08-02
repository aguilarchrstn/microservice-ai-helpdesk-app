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
  ChevronRight,
  Wifi,
  KeyRound,
  Laptop,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  RotateCcw,
  Bot,
  User,
  X,
  Plus,
  ShieldAlert,
  Search,
  Cpu,
  Zap,
  HardDrive,
  FileText,
  Lock,
  Download
} from "lucide-react";
import { renderMessageContent } from "./MessageContent.jsx";
import { copyText } from "./clipboard.js";

const API_ENDPOINT = "/api/chat";

function makeSessionId() {
  return "sess_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

const SUGGESTIONS = [
  {
    icon: Wifi,
    tint: "tint-blue",
    title: "VPN & Network",
    subtitle: "Troubleshoot VPN drops, DNS, or office Wi-Fi",
    eta: "~30 sec triage",
    prompt: "I'm having trouble connecting — my VPN keeps dropping every few minutes.",
  },
  {
    icon: KeyRound,
    tint: "tint-rose",
    title: "SSO & Access",
    subtitle: "Reset Okta password, unlock AD account, or 2FA",
    eta: "Instant guide",
    prompt: "I'm locked out of my corporate Okta account and need to reset my password.",
  },
  {
    icon: Laptop,
    tint: "tint-green",
    title: "Hardware & Repair",
    subtitle: "Request laptop replacement, monitor, or repair",
    eta: "Automated ticket",
    prompt: "My laptop battery is swelling and I need to request an urgent hardware repair.",
  },
];

const QUICK_CHIPS = [
  { label: "⚡ Reset SSO Password", prompt: "How do I reset my SSO password?" },
  { label: "🌐 Fix VPN Disconnects", prompt: "My VPN keeps dropping connection." },
  { label: "💻 Request M3 MacBook", prompt: "I need to request a new developer laptop." },
  { label: "🔒 MFA Troubleshooting", prompt: "My Authenticator app code isn't working." },
  { label: "📁 Shared Drive Access", prompt: "How do I get permission to access the team drive?" }
];

const SAMPLE_TICKETS = [
  { id: "TICK-9042", title: "Cisco AnyConnect Auth Error 403", status: "In Progress", priority: "High", time: "10m ago", tag: "tag-amber" },
  { id: "TICK-8910", title: "Developer M3 Max Laptop Request", status: "Approved", priority: "Medium", time: "2h ago", tag: "tag-green" },
  { id: "TICK-8722", title: "Slack SSO OAuth Re-authentication", status: "Resolved", priority: "Low", time: "1d ago", tag: "tag-blue" },
];

const SAMPLE_KB_ARTICLES = [
  { title: "Fixing Cisco VPN Certificate & Tunnel Disconnects", category: "Network", desc: "Step-by-step guide to clearing cached gateway credentials and updating root certificates." },
  { title: "Okta & Azure AD Multi-Factor Auth Reset", category: "Access", desc: "How to register a new smartphone or hardware key when locked out of 2FA." },
  { title: "IT Asset Procurement & Hardware Exchange Policy", category: "Hardware", desc: "Guidelines for requesting replacement peripherals, monitors, or upgraded workstations." },
  { title: "Installing Enterprise Root Certificates on macOS & Windows", category: "Security", desc: "Resolve browser SSL trust warnings when accessing internal dev clusters." }
];

export default function HelpdeskApp() {
  const [entered, setEntered] = useState(false);
  const [sessionId, setSessionId] = useState(makeSessionId);
  const [toast, setToast] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("ready"); // ready | sending | error
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [feedback, setFeedback] = useState({}); // { [index]: "up" | "down" }
  const [errorMsg, setErrorMsg] = useState("");
  
  // UI State
  const [accentTheme, setAccentTheme] = useState("indigo"); // indigo | cyan | violet | emerald
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState(null); // null | 'tickets' | 'kb' | 'settings'
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [kbSearch, setKbSearch] = useState("");

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
      setErrorMsg(err.message || "Something went wrong reaching the AI assistant.");
    }
  }

  async function handleCopyMessage(index, text) {
    const ok = await copyText(text);
    if (ok) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex((cur) => (cur === index ? null : cur)), 1500);
    } else {
      showToast("Unable to copy to clipboard");
    }
  }

  function handleFeedback(index, value) {
    setFeedback((prev) => ({ ...prev, [index]: prev[index] === value ? null : value }));
    showToast(value === "up" ? "Feedback saved — Thank you!" : "Feedback recorded for model tuning");
  }

  function handleRegenerate() {
    if (messages.length < 2) return;
    const lastUserMsgIndex = [...messages].reverse().findIndex(m => m.role === "user");
    if (lastUserMsgIndex !== -1) {
      const actualIndex = messages.length - 1 - lastUserMsgIndex;
      const lastUserText = messages[actualIndex].content;
      // Remove messages after that user message
      setMessages(messages.slice(0, actualIndex + 1));
      setStatus("sending");
      setErrorMsg("");
      
      fetch(API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: lastUserText }),
      })
        .then(res => res.json())
        .then(data => {
          setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
          setStatus("ready");
        })
        .catch(err => {
          setStatus("error");
          setErrorMsg(err.message || "Error regenerating response.");
        });
    }
  }

  function handleNewChat() {
    setMessages([]);
    setSessionId(makeSessionId());
    setStatus("ready");
    setErrorMsg("");
    setInput("");
    setActiveDrawer(null);
  }

  function showToast(label) {
    setToast(label);
    setTimeout(() => setToast((cur) => (cur === label ? null : cur)), 2500);
  }

  function handleAttachSnippet(type) {
    setAttachMenuOpen(false);
    let snippet = "";
    if (type === "sysinfo") {
      snippet = `[ATTACHMENT] OS: Windows 11 Enterprise (23H2)\nIP: 10.142.3.88\nDNS Server: 10.142.0.1\nVPN Interface: Tun0 (Disconnected)`;
    } else if (type === "logs") {
      snippet = `[ATTACHMENT: vpn_client.log]\n2026-08-02 10:04:12 [ERROR] TLS Handshake failed: Gateway timeout 504\n2026-08-02 10:04:15 [WARN] Retrying connection attempt 3/5...`;
    } else {
      snippet = `[ATTACHMENT: screenshot_diag.png] System diagnostics captured.`;
    }
    setInput((prev) => (prev ? `${prev}\n${snippet}` : snippet));
    showToast(`Attached ${type} snippet`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    send(input);
  }

  const filteredKb = SAMPLE_KB_ARTICLES.filter(
    a => a.title.toLowerCase().includes(kbSearch.toLowerCase()) || a.desc.toLowerCase().includes(kbSearch.toLowerCase())
  );

  if (!entered) {
    return (
      <div className="app app--splash" data-accent={accentTheme}>
        <div className="splash">
          <div className="splash__orb" aria-hidden="true">
            <div className="splash__glow" />
            <div className="splash__grid" />
          </div>
          <div className="splash__content">
            <div className="splash__status-tag">
              <span className="status-dot" />
              Nexus AI Engine • Online & Operational
            </div>
            <div className="splash__logo">
              <Sparkles size={28} />
            </div>
            <h1>Nexus IT Assistant</h1>
            <p>
              Next-generation AI triage for corporate networks, identity access, software permissions, and hardware fulfillment.
            </p>
            <div className="splash__features">
              <span className="splash__chip"><Zap size={12} /> Instant AI Resolution</span>
              <span className="splash__chip"><Lock size={12} /> Enterprise Grade</span>
              <span className="splash__chip"><Cpu size={12} /> Nemotron 3 Ultra</span>
            </div>
            <button className="splash__cta" onClick={() => setEntered(true)}>
              Launch Assistant
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-accent={accentTheme}>
      {/* --- Sidebar Navigation --- */}
      <aside className={`sidebar ${sidebarExpanded ? "sidebar--expanded" : ""}`}>
        <button 
          className="sidebar__toggle" 
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          aria-label={sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {sidebarExpanded ? <ChevronRight size={14} style={{ transform: "rotate(180deg)" }} /> : <ChevronRight size={14} />}
        </button>

        <button className="sidebar__logo-btn" onClick={handleNewChat} aria-label="New Chat Session">
          <Sparkles size={18} />
          {sidebarExpanded && <span className="sidebar__logo-text">Nexus AI</span>}
        </button>

        <nav className="sidebar__nav">
          <button
            className={`sidebar__item ${!started && !activeDrawer ? "sidebar__item--active" : ""}`}
            onClick={handleNewChat}
            data-tooltip="New Chat"
          >
            <Home size={18} />
            {sidebarExpanded && <span className="sidebar__item-label">Home / New Chat</span>}
          </button>

          <button
            className={`sidebar__item ${activeDrawer === "tickets" ? "sidebar__item--active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "tickets" ? null : "tickets")}
            data-tooltip="My Tickets"
          >
            <Inbox size={18} />
            {sidebarExpanded && <span className="sidebar__item-label">My Tickets</span>}
            <span className="sidebar__badge">3</span>
          </button>

          <button
            className={`sidebar__item ${activeDrawer === "kb" ? "sidebar__item--active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "kb" ? null : "kb")}
            data-tooltip="Knowledge Base"
          >
            <Table2 size={18} />
            {sidebarExpanded && <span className="sidebar__item-label">Knowledge Base</span>}
          </button>
        </nav>

        <div className="sidebar__bottom">
          <button
            className={`sidebar__item ${activeDrawer === "settings" ? "sidebar__item--active" : ""}`}
            onClick={() => setActiveDrawer(activeDrawer === "settings" ? null : "settings")}
            data-tooltip="Settings & Theme"
          >
            <Settings size={18} />
            {sidebarExpanded && <span className="sidebar__item-label">Settings</span>}
          </button>
        </div>

        {sidebarExpanded && (
          <div className="sidebar__status-box">
            <span className="status-dot" />
            <div className="sidebar__status-text">
              <strong>System Normal</strong>
              <span>FastAPI Backend Ready</span>
            </div>
          </div>
        )}
      </aside>

      {/* --- Main Workspace --- */}
      <main className="main">
        {/* Top Header */}
        <header className="topbar">
          <div className="topbar__left">
            <div className="topbar__title">
              <Bot size={20} style={{ color: "var(--accent-primary)" }} />
              IT Support Hub
            </div>
            <span className="topbar__model-badge">
              <Cpu size={12} />
              Nemotron 3 Ultra
            </span>
          </div>

          <div className="topbar__right">
            <div className="topbar__pill">
              <span className="status-dot" />
              <span>Session: <strong style={{ color: "var(--text-main)" }}>{sessionId}</strong></span>
            </div>
            <button className="topbar__profile" onClick={() => setActiveDrawer("settings")}>
              <span className="topbar__avatar">IT</span>
              <span className="topbar__name">User Support</span>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {/* Empty State / Hero view */}
        {!started ? (
          <div className="hero">
            <div className="hero__orb" aria-hidden="true">
              <div className="hero__orb-glow" />
              <div className="hero__grid" />
            </div>

            <div className="hero__copy">
              <h1>Welcome to Intelligent IT Triage 👋</h1>
              <p>How can I assist your workstation, network, or account today?</p>
            </div>

            <div className="suggestions">
              {SUGGESTIONS.map(({ icon: Icon, tint, title, subtitle, eta, prompt }) => (
                <button
                  key={title}
                  className={`suggestion ${tint}`}
                  onClick={() => send(prompt)}
                >
                  <div className="suggestion__top">
                    <span className="suggestion__badge">
                      <Icon size={13} />
                      {title}
                    </span>
                    <span className="suggestion__eta">{eta}</span>
                  </div>
                  <span className="suggestion__subtitle">{subtitle}</span>
                </button>
              ))}
            </div>

            <span className="hero__chips-label">Frequent Quick Actions</span>
            <div className="hero__chips">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  className="chip-btn"
                  onClick={() => send(chip.prompt)}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Active Chat Log */
          <div className="log" ref={logRef}>
            {messages.map((m, i) => (
              <div key={i} className={`bubble bubble--${m.role}`}>
                <div className="bubble__header">
                  <span className="bubble__avatar">
                    {m.role === "user" ? <User size={12} /> : <Bot size={12} />}
                  </span>
                  <span className="bubble__label">
                    {m.role === "user" ? "You" : "Nexus AI Helpdesk"}
                  </span>
                </div>
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
                    <span>{copiedIndex === i ? "Copied" : "Copy"}</span>
                  </button>
                  {m.role === "assistant" && (
                    <>
                      <button
                        type="button"
                        className={`bubble__action ${feedback[i] === "up" ? "bubble__action--active" : ""}`}
                        onClick={() => handleFeedback(i, "up")}
                        aria-label="Helpful"
                      >
                        <ThumbsUp size={13} />
                      </button>
                      <button
                        type="button"
                        className={`bubble__action ${feedback[i] === "down" ? "bubble__action--down-active" : ""}`}
                        onClick={() => handleFeedback(i, "down")}
                        aria-label="Not helpful"
                      >
                        <ThumbsDown size={13} />
                      </button>
                      {i === messages.length - 1 && (
                        <button
                          type="button"
                          className="bubble__action"
                          onClick={handleRegenerate}
                          aria-label="Regenerate answer"
                        >
                          <RotateCcw size={13} />
                          <span>Retry</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}

            {status === "sending" && (
              <div className="bubble bubble--assistant bubble--pending">
                <div className="bubble__header">
                  <span className="bubble__avatar"><Bot size={12} /></span>
                  <span className="bubble__label">Nexus AI Helpdesk</span>
                </div>
                <div className="typing-container">
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="typing-text">Analyzing query & searching KB...</span>
                </div>
              </div>
            )}

            {status === "error" && (
              <div className="log__error">
                <ShieldAlert size={14} style={{ display: "inline", marginRight: "6px" }} />
                Error: {errorMsg}
              </div>
            )}
          </div>
        )}

        {/* --- Floating Composer --- */}
        <div className="composer-wrapper">
          {attachMenuOpen && (
            <div className="attach-menu">
              <button className="attach-option" onClick={() => handleAttachSnippet("sysinfo")}>
                <HardDrive size={14} />
                <span>Attach System Diagnostics</span>
              </button>
              <button className="attach-option" onClick={() => handleAttachSnippet("logs")}>
                <FileText size={14} />
                <span>Attach VPN / App Logs</span>
              </button>
            </div>
          )}

          <form className="composer" onSubmit={handleSubmit}>
            <div className="composer__icon">
              <Sparkles size={16} />
            </div>
            <input
              type="text"
              placeholder="Describe your IT issue or question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={status === "sending"}
            />
            <div className="composer__actions">
              <button
                type="button"
                className="composer__btn"
                onClick={() => setAttachMenuOpen(!attachMenuOpen)}
                aria-label="Attach Diagnostics"
              >
                <Paperclip size={14} />
                <span>Attach Context</span>
              </button>
              <button
                type="submit"
                className="composer__send"
                disabled={status === "sending" || !input.trim()}
                aria-label="Send prompt"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* --- Drawers & Modals --- */}
      {activeDrawer && (
        <>
          <div className="drawer-backdrop" onClick={() => setActiveDrawer(null)} />
          <div className="drawer">
            <div className="drawer__header">
              <div className="drawer__title">
                {activeDrawer === "tickets" && <><Inbox size={20} /> Active Tickets</>}
                {activeDrawer === "kb" && <><Table2 size={20} /> Knowledge Base</>}
                {activeDrawer === "settings" && <><Settings size={20} /> Assistant Settings</>}
              </div>
              <button className="drawer__close" onClick={() => setActiveDrawer(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="drawer__content">
              {activeDrawer === "tickets" && (
                <>
                  <p style={{ color: "var(--text-sub)", fontSize: "13px" }}>
                    Track your reported support tickets or escalate a conversation into an enterprise ticket.
                  </p>
                  {SAMPLE_TICKETS.map(ticket => (
                    <div key={ticket.id} className="item-card">
                      <div className="item-card__top">
                        <span className="item-card__title">{ticket.id}: {ticket.title}</span>
                        <span className={`item-card__tag ${ticket.tag}`}>{ticket.status}</span>
                      </div>
                      <span className="item-card__desc">Priority: {ticket.priority} • Updated {ticket.time}</span>
                    </div>
                  ))}
                  <button 
                    className="splash__cta" 
                    style={{ marginTop: "12px" }}
                    onClick={() => {
                      showToast("Ticket #TICK-9105 created from chat history");
                      setActiveDrawer(null);
                    }}
                  >
                    <Plus size={16} />
                    File New Ticket from Chat
                  </button>
                </>
              )}

              {activeDrawer === "kb" && (
                <>
                  <div style={{ position: "relative" }}>
                    <Search size={16} style={{ position: "absolute", left: "12px", top: "12px", color: "var(--text-sub)" }} />
                    <input
                      type="text"
                      className="composer input"
                      style={{ width: "100%", paddingLeft: "36px", background: "var(--bg-card)", border: "1px solid var(--border-glass)", borderRadius: "var(--radius-md)" }}
                      placeholder="Search troubleshooting articles..."
                      value={kbSearch}
                      onChange={(e) => setKbSearch(e.target.value)}
                    />
                  </div>
                  {filteredKb.map(article => (
                    <div key={article.title} className="item-card">
                      <div className="item-card__top">
                        <span className="item-card__title">{article.title}</span>
                        <span className="item-card__tag tag--blue">{article.category}</span>
                      </div>
                      <span className="item-card__desc">{article.desc}</span>
                      <button
                        className="composer__btn"
                        style={{ alignSelf: "flex-start", marginTop: "6px" }}
                        onClick={() => {
                          send(`I'm reading the KB article "${article.title}". Can you walk me through it?`);
                          setActiveDrawer(null);
                        }}
                      >
                        Ask AI about this article
                      </button>
                    </div>
                  ))}
                </>
              )}

              {activeDrawer === "settings" && (
                <>
                  <div>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--text-main)" }}>UI Theme Accent</h4>
                    <div className="accent-selector">
                      <button
                        className={`accent-opt ${accentTheme === "indigo" ? "accent-opt--active" : ""}`}
                        onClick={() => setAccentTheme("indigo")}
                      >
                        Indigo
                      </button>
                      <button
                        className={`accent-opt ${accentTheme === "cyan" ? "accent-opt--active" : ""}`}
                        onClick={() => setAccentTheme("cyan")}
                      >
                        Cyber Cyan
                      </button>
                      <button
                        className={`accent-opt ${accentTheme === "violet" ? "accent-opt--active" : ""}`}
                        onClick={() => setAccentTheme("violet")}
                      >
                        Neon Violet
                      </button>
                      <button
                        className={`accent-opt ${accentTheme === "emerald" ? "accent-opt--active" : ""}`}
                        onClick={() => setAccentTheme("emerald")}
                      >
                        Emerald
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px" }}>
                    <h4 style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--text-main)" }}>AI Model Engine</h4>
                    <div className="item-card">
                      <div className="item-card__top">
                        <span className="item-card__title">nvidia/nemotron-3-ultra:free</span>
                        <span className="item-card__tag tag--green">Active</span>
                      </div>
                      <span className="item-card__desc">FastAPI Microservice backend connected via OpenRouter API.</span>
                    </div>
                  </div>

                  <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <button className="composer__btn" style={{ justifyContent: "center" }} onClick={handleNewChat}>
                      <RotateCcw size={14} /> Clear Current Session & Reset
                    </button>
                    <button
                      className="composer__btn"
                      style={{ justifyContent: "center" }}
                      onClick={() => {
                        const transcript = JSON.stringify(messages, null, 2);
                        const blob = new Blob([transcript], { type: "application/json" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `it_chat_transcript_${sessionId}.json`;
                        a.click();
                        showToast("Transcript downloaded");
                      }}
                    >
                      <Download size={14} /> Export Chat Transcript
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* --- Toast Notifications --- */}
      {toast && (
        <div className="toast">
          <Sparkles size={14} style={{ color: "var(--accent-primary)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}
