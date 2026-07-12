import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Sparkles,
  Bot,
  AlertTriangle,
  User,
  X,
  MessageSquare,
  ChevronDown,
  Zap,
} from "lucide-react";

/* ── Markdown Parser ─────────────────────────────────────────── */
const parseMarkdownToHtml = (text) => {
  if (!text) return "";
  let html = text;

  html = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  html = html.replace(/^###\s+(.*?)$/gm, "<h3 style='font-size:1rem;font-weight:800;color:var(--primary);margin:0.75rem 0 0.4rem;'>$1</h3>");
  html = html.replace(/^##\s+(.*?)$/gm,  "<h2 style='font-size:1.1rem;font-weight:800;color:var(--primary);margin:1rem 0 0.4rem;'>$1</h2>");
  html = html.replace(/^#\s+(.*?)$/gm,   "<h1 style='font-size:1.25rem;font-weight:800;color:var(--primary);margin:1rem 0 0.4rem;'>$1</h1>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, "<li style='margin-left:1rem;margin-bottom:0.2rem;list-style-type:disc;'>$1</li>");
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' rel='noreferrer' style='color:var(--primary);text-decoration:underline;'>$1</a>");

  const lines = html.split("\n");
  let inTable = false;
  let tableRows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) { inTable = true; tableRows = []; }
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      if (cells.every(c => c.startsWith(":") || c.startsWith("-"))) continue;
      tableRows.push(cells);
      lines[i] = "";
    } else {
      if (inTable) {
        let tableHtml = "<div style='overflow-x:auto;margin:0.75rem 0;'><table style='width:100%;border-collapse:collapse;font-size:0.82rem;border:1px solid var(--border-color);border-radius:6px;overflow:hidden;'>";
        tableRows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          tableHtml += `<tr style='${isHeader ? "background:var(--bg-surface);font-weight:700;border-bottom:2px solid var(--border-color);" : "border-bottom:1px solid var(--border-color);"}'>`;
          row.forEach(cell => {
            const tag = isHeader ? "th" : "td";
            tableHtml += `<${tag} style="padding:0.45rem 0.65rem;text-align:left;border-right:1px solid var(--border-color);">${cell}</${tag}>`;
          });
          tableHtml += "</tr>";
        });
        tableHtml += "</table></div>";
        lines[i] = tableHtml + "\n" + lines[i];
        inTable = false;
      }
    }
  }

  html = lines.join("\n");
  html = html.replace(/\n\n/g, "<p style='margin-bottom:0.5rem;'></p>");
  html = html.replace(/\n/g, "<br />");
  html = html.replace(/<br \/><h/g, "<h");
  html = html.replace(/<br \/><ul/g, "<ul");
  html = html.replace(/<br \/><li/g, "<li");
  html = html.replace(/<\/li><br \/>/g, "</li>");
  return html;
};

/* ── Suggestion Chips ─────────────────────────────────────────── */
const SUGGESTIONS = [
  "Top incubators in Bangalore?",
  "Deep-tech TBIs in Pune",
  "Government incubators in Delhi",
  "Show biotech incubators",
];

/* ── Main AI Assistant Component ─────────────────────────────── */
export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your AI Ecosystem Research Assistant. Ask me about Indian incubators — their states, sectors, and startup clusters.",
      mode: "local",
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState("local");
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [showModelSelect, setShowModelSelect] = useState(false);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("/api/ai/models");
        if (res.ok) {
          const data = await res.json();
          setAvailableModels(data || []);
          if (data && data.length > 0) {
            const defaultModel = data.find(m => m.toLowerCase().includes("llama-3")) || data[0];
            setSelectedModel(defaultModel);
          }
        }
      } catch (e) {
        console.error("Error fetching AI models:", e);
      }
    };
    fetchModels();
  }, []);

  const handleSend = async (e, overrideText) => {
    if (e) e.preventDefault();
    const text = overrideText ?? inputValue.trim();
    if (!text) return;

    const userMessage = { id: Date.now().toString(), sender: "user", text };
    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, model: selectedModel || null }),
      });
      const data = await response.json();

      if (response.ok) {
        setCurrentMode(data.mode);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: data.message,
          mode: data.mode,
          modelUsed: data.model_used,
          responseTime: data.response_time,
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: "I encountered an error: " + (data.detail || "Server error"),
          mode: "error",
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Could not reach the backend server. Please verify it is running.",
        mode: "error",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const isAiMode = currentMode === "gemini_ai" || currentMode === "openrouter";

  /* ── Collapsed FAB ───────────────────────────────────────── */
  if (!isOpen) {
    return (
      <div className="chat-widget">
        <button
          className="chat-toggle-btn"
          onClick={() => setIsOpen(true)}
          title="Open AI Assistant"
          aria-label="Open AI Assistant"
        >
          <Sparkles size={22} />
        </button>
      </div>
    );
  }

  /* ── Expanded Chat Panel ─────────────────────────────────── */
  return (
    <div className="chat-widget">
      {/* Panel */}
      <div className="chat-panel">
        {/* Header */}
        <div className="chat-panel-header">
          <div className="chat-panel-title">
            <div className="chat-bot-avatar">
              <Bot size={16} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.875rem" }}>Ecosystem AI</div>
              <div style={{ fontSize: "0.68rem", opacity: 0.8, fontWeight: 500 }}>
                {isAiMode ? "LLM-powered answers" : "Keyword search mode"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Mode indicator */}
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.7rem",
              fontWeight: 600,
              padding: "3px 9px",
              borderRadius: "99px",
              background: isAiMode ? "rgba(255,255,255,0.2)" : "rgba(245,158,11,0.25)",
              color: "white",
            }}>
              {isAiMode ? <Zap size={11} /> : <AlertTriangle size={11} />}
              {isAiMode ? "AI" : "Local"}
            </div>

            {/* Model selector toggle */}
            {availableModels.length > 0 && (
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setShowModelSelect(p => !p)}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "white",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    borderRadius: "6px",
                    padding: "3px 8px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  Model <ChevronDown size={10} />
                </button>
                {showModelSelect && (
                  <div style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    right: 0,
                    background: "white",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-lg)",
                    padding: "6px",
                    minWidth: 170,
                    zIndex: 10,
                  }}>
                    {availableModels.map(m => (
                      <button
                        key={m}
                        onClick={() => { setSelectedModel(m); setShowModelSelect(false); }}
                        style={{
                          display: "block",
                          width: "100%",
                          padding: "6px 10px",
                          textAlign: "left",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          background: selectedModel === m ? "var(--primary-light)" : "transparent",
                          color: selectedModel === m ? "var(--primary)" : "var(--text-body)",
                          fontSize: "0.78rem",
                          fontWeight: selectedModel === m ? 700 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {m.split("/").pop()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="chat-close-btn" onClick={() => setIsOpen(false)} aria-label="Close chat">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-messages">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`chat-message${m.sender === "user" ? " user" : ""}`}
            >
              {/* Avatar */}
              <div className={`chat-avatar${m.sender === "user" ? " user-av" : " bot"}`}>
                {m.sender === "user" ? <User size={12} /> : <Bot size={12} />}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 3, maxWidth: "calc(100% - 40px)" }}>
                <div className={`chat-bubble${m.sender === "user" ? " user" : " bot"}`}>
                  {m.sender === "user" ? (
                    <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(m.text) }}
                      style={{ wordBreak: "break-word" }}
                    />
                  )}
                </div>
                {m.sender === "assistant" && m.modelUsed && (
                  <span style={{ fontSize: "0.63rem", color: "var(--text-dim)", paddingLeft: 4 }}>
                    via {m.modelUsed.split("/").pop()} · {m.responseTime || 0}s
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="chat-message">
              <div className="chat-avatar bot">
                <Bot size={12} />
              </div>
              <div className="chat-bubble bot">
                <div className="chat-typing">
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                  <div className="typing-dot" />
                </div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Suggestion chips (show only when no user messages yet) */}
        {messages.length <= 1 && (
          <div className="chat-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                className="chat-suggestion-chip"
                onClick={() => handleSend(null, s)}
                disabled={loading}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form className="chat-input-area" onSubmit={(e) => handleSend(e)}>
          <textarea
            ref={inputRef}
            className="chat-input"
            placeholder="Ask about incubators, sectors, states..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(e);
              }
            }}
            disabled={loading}
            rows={1}
          />
          <button
            type="submit"
            className="chat-send-btn"
            disabled={loading || !inputValue.trim()}
            aria-label="Send message"
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* FAB (close state) */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsOpen(false)}
        title="Close AI Assistant"
        style={{ background: "var(--text-dim)" }}
      >
        <X size={20} />
      </button>
    </div>
  );
}
