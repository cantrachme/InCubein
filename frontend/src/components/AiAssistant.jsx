import React, { useState, useEffect, useRef } from "react";
import { Send, HelpCircle, Sparkles, Bot, AlertTriangle, User } from "lucide-react";

// Inline simple markdown to HTML parser helper
const parseMarkdownToHtml = (text) => {
  if (!text) return "";
  let html = text;

  // Escape HTML entities to prevent XSS
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Restore specific tag shapes we want to inject safely later, or just convert text
  // 1. Headers (### Header)
  html = html.replace(/^###\s+(.*?)$/gm, "<h3 style='font-size: 1.1rem; font-weight: 800; color: var(--primary); margin: 0.75rem 0 0.5rem 0;'>$1</h3>");
  html = html.replace(/^##\s+(.*?)$/gm, "<h2 style='font-size: 1.25rem; font-weight: 800; color: var(--primary); margin: 1rem 0 0.5rem 0;'>$1</h2>");
  html = html.replace(/^#\s+(.*?)$/gm, "<h1 style='font-size: 1.5rem; font-weight: 800; color: var(--primary); margin: 1rem 0 0.5rem 0;'>$1</h1>");

  // 2. Bold (**text**)
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // 3. Lists (- item or * item)
  // Wrap consecutive list items in <ul>
  html = html.replace(/^\s*[-*]\s+(.*?)$/gm, "<li style='margin-left: 1rem; margin-bottom: 0.25rem; list-style-type: disc;'>$1</li>");

  // 4. Clickable Links ([text](url))
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' rel='noreferrer' style='color: var(--secondary); text-decoration: underline;'>$1</a>");

  // 5. Convert Tables
  // Scan for table rows starting/ending with |
  const lines = html.split("\n");
  let inTable = false;
  let tableRows = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("|") && line.endsWith("|")) {
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      
      // Split cells
      const cells = line.split("|").slice(1, -1).map(c => c.trim());
      
      // Skip separator row (e.g. | :--- | :--- |)
      if (cells.every(c => c.startsWith(":") || c.startsWith("-"))) {
        continue;
      }
      
      tableRows.push(cells);
      lines[i] = ""; // clear original line from output
    } else {
      if (inTable) {
        // Output compiled table
        let tableHtml = "<div style='overflow-x: auto; margin: 0.75rem 0;'><table style='width: 100%; border-collapse: collapse; font-size: 0.85rem; border: 1px solid var(--border-color);'>";
        tableRows.forEach((row, rowIndex) => {
          const isHeader = rowIndex === 0;
          tableHtml += "<tr style='" + (isHeader ? "background: #f1f5f9; font-weight: 700; border-bottom: 2px solid var(--border-color);" : "border-bottom: 1px solid var(--border-color);") + "'>";
          row.forEach(cell => {
            const tag = isHeader ? "th" : "td";
            tableHtml += `<${tag} style="padding: 0.5rem; text-align: left; border-right: 1px solid var(--border-color);">${cell}</${tag}>`;
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

  // Convert double newlines to paragraphs
  html = html.replace(/\n\n/g, "<p style='margin-bottom: 0.75rem; line-height: 1.5;'></p>");
  // Single newlines to line breaks (unless inside list/table tags)
  html = html.replace(/\n/g, "<br />");
  
  // Clean up duplicate breaks near block tags
  html = html.replace(/<br \/><h/g, "<h");
  html = html.replace(/<br \/><ul/g, "<ul");
  html = html.replace(/<br \/><li/g, "<li");
  html = html.replace(/<\/li><br \/>/g, "</li>");
  
  return html;
};

export default function AiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      sender: "assistant",
      text: "Hello! I am your AI Ecosystem Research Assistant. Ask me queries about Indian incubators, their states, sectors, or general startup clusters (e.g. *'Which deep-tech incubators are in Pune?'*).",
      mode: "local"
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentMode, setCurrentMode] = useState("local"); // 'local', 'gemini_ai', or 'openrouter'
  
  // Model state variables
  const [availableModels, setAvailableModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  // Load OpenRouter models dynamically
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const res = await fetch("http://127.0.0.1:8000/api/ai/models");
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/api/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: userMessage.text,
          model: selectedModel || null
        })
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
          responseTime: data.response_time
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text: "I encountered an error trying to process that query: " + (data.detail || "Server error"),
          mode: "error"
        }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: "Could not connect to the backend server. Make sure it is running on http://127.0.0.1:8000.",
        mode: "error"
      }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <div 
        onClick={() => setIsOpen(true)}
        style={{
          position: "fixed",
          bottom: "35px",
          right: "35px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "linear-gradient(135deg, var(--primary), var(--secondary))",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 6px 20px rgba(79, 70, 229, 0.45)",
          transition: "all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.1) translateY(-3px)";
          e.currentTarget.style.boxShadow = "0 10px 25px rgba(79, 70, 229, 0.6)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1) translateY(0)";
          e.currentTarget.style.boxShadow = "0 6px 20px rgba(79, 70, 229, 0.45)";
        }}
        title="Open AI Assistant"
      >
        <Sparkles size={26} className="spin-slow" />
      </div>
    );
  }

  return (
    <>
      {/* Floating Chat Container */}
      <div className="glass-card" style={{ 
        position: "fixed",
        bottom: "110px",
        right: "35px",
        width: "420px",
        height: "600px",
        maxHeight: "calc(100vh - 160px)",
        maxWidth: "calc(100vw - 70px)",
        zIndex: 9999,
        padding: "1.25rem", 
        display: "flex", 
        flexDirection: "column", 
        background: "#ffffff",
        boxShadow: "0 15px 40px rgba(0, 0, 0, 0.18)",
        border: "1px solid var(--border-color)",
        borderRadius: "16px",
        overflow: "hidden"
      }}>
        {/* Header bar with Model Selector & Close Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Sparkles size={18} style={{ color: "var(--secondary)" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Ecosystem AI Assistant</h3>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {availableModels.length > 0 && (
              <select
                className="filter-select"
                style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", borderRadius: "6px", width: "120px", background: "#f8fafc", color: "black", border: "1px solid var(--border-color)" }}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {availableModels.map(m => (
                  <option key={m} value={m}>{m.split("/").pop()}</option>
                ))}
              </select>
            )}
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                color: "var(--text-dim)",
                fontWeight: "300",
                lineHeight: "1",
                padding: "0 0.25rem"
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Mode Banner Indicator */}
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          padding: "0.5rem 0.75rem", 
          background: (currentMode === "gemini_ai" || currentMode === "openrouter") ? "rgba(15,118,110,0.04)" : "rgba(234,88,12,0.04)", 
          border: `1px solid ${(currentMode === "gemini_ai" || currentMode === "openrouter") ? "rgba(15,118,110,0.1)" : "rgba(234,88,12,0.1)"}`,
          borderRadius: "8px",
          marginBottom: "0.75rem",
          fontSize: "0.75rem"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {(currentMode === "gemini_ai" || currentMode === "openrouter") ? (
              <Bot size={14} style={{ color: "var(--secondary)" }} />
            ) : (
              <AlertTriangle size={14} style={{ color: "var(--accent-amber)" }} />
            )}
            <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
              {(currentMode === "gemini_ai" || currentMode === "openrouter") ? "Online (LLM)" : "Local Keyword Mode"}
            </span>
          </div>
          <span style={{ color: "var(--text-dim)", fontSize: "0.7rem" }}>
            {(currentMode === "gemini_ai" || currentMode === "openrouter") ? "Using LLM contextual reasoning" : "Using pre-filters"}
          </span>
        </div>

        {/* Messages dialogue board */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          paddingRight: "0.25rem", 
          display: "flex", 
          flexDirection: "column", 
          gap: "0.75rem",
          marginBottom: "0.75rem"
        }}>
          {messages.map((m) => (
            <div key={m.id} style={{ 
              display: "flex", 
              justifyContent: m.sender === "user" ? "flex-end" : "flex-start",
              gap: "0.35rem",
              alignItems: "flex-start"
            }}>
              {m.sender === "assistant" && (
                <div style={{ 
                  width: "24px", 
                  height: "24px", 
                  borderRadius: "50%", 
                  background: "var(--primary-glow)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "var(--primary)",
                  flexShrink: 0,
                  marginTop: "2px"
                }}>
                  <Bot size={12} />
                </div>
              )}
              
              <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", maxWidth: "85%" }}>
                <div style={{ 
                  padding: "0.6rem 0.85rem", 
                  borderRadius: "12px", 
                  fontSize: "0.85rem",
                  lineHeight: "1.4",
                  background: m.sender === "user" ? "var(--primary)" : "#f8fafc",
                  color: m.sender === "user" ? "#ffffff" : "var(--text-primary)",
                  border: m.sender === "user" ? "none" : "1px solid var(--border-color)",
                  boxShadow: m.sender === "user" ? "0 2px 6px rgba(79, 70, 229, 0.2)" : "none"
                }}>
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
                  <span style={{ fontSize: "0.65rem", color: "var(--text-dim)", paddingLeft: "4px" }}>
                    via {m.modelUsed.split("/").pop()} ({m.responseTime || 0}s)
                  </span>
                )}
              </div>

              {m.sender === "user" && (
                <div style={{ 
                  width: "24px", 
                  height: "24px", 
                  borderRadius: "50%", 
                  background: "#e2e8f0", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  color: "var(--text-dim)",
                  flexShrink: 0,
                  marginTop: "2px"
                }}>
                  <User size={12} />
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
              <div style={{ 
                width: "24px", 
                height: "24px", 
                borderRadius: "50%", 
                background: "var(--primary-glow)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--primary)"
              }}>
                <Bot size={12} />
              </div>
              <div className="glass-card" style={{ padding: "0.5rem 0.75rem", borderRadius: "12px", display: "flex", gap: "0.2rem", alignItems: "center" }}>
                <div className="typing-dot" style={{ width: "4px", height: "4px", background: "var(--primary)", borderRadius: "50%", animation: "typing-bounce 1s infinite 0.1s" }}></div>
                <div className="typing-dot" style={{ width: "4px", height: "4px", background: "var(--primary)", borderRadius: "50%", animation: "typing-bounce 1s infinite 0.2s" }}></div>
                <div className="typing-dot" style={{ width: "4px", height: "4px", background: "var(--primary)", borderRadius: "50%", animation: "typing-bounce 1s infinite 0.3s" }}></div>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Submit box */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "0.5rem", borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1, padding: "0.5rem 0.75rem", background: "#f8fafc", color: "var(--text-primary)", fontSize: "0.8rem", borderRadius: "8px" }}
            placeholder="Ask AI Assistant..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ padding: "0.5rem 1rem", borderRadius: "8px" }}
            disabled={loading || !inputValue.trim()}
          >
            <Send size={14} />
          </button>
        </form>
      </div>

      {/* Floating Toggle Button (Active State) */}
      <div 
        onClick={() => setIsOpen(false)}
        style={{
          position: "fixed",
          bottom: "35px",
          right: "35px",
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          background: "#e2e8f0",
          color: "var(--text-dim)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 4px 15px rgba(0,0,0,0.1)",
          transition: "transform 0.2s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <span style={{ fontSize: "1.75rem", fontWeight: "300", color: "var(--text-primary)" }}>×</span>
      </div>
    </>
  );
}
