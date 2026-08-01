"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Send, RotateCcw, Trash2, ArrowRight } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  aiModelUsed?: string;
}

interface ShipmentCopilotProps {
  result: AnalysisResult;
}

const SUGGESTIONS = [
  "Why is my risk high?",
  "How can I reduce costs?",
  "Explain my shipment",
  "What is my biggest risk?",
  "Summarize the analysis",
  "Explain the recommendations",
];

export function ShipmentCopilot({ result }: ShipmentCopilotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const askQuestion = async (questionText: string) => {
    if (!questionText.trim() || loading) return;

    const userMsg: Message = { role: "user", content: questionText.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    try {
      const chatHistory = [...messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatHistory,
          analysisResult: result,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to get response");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "I couldn't process that query. Please try again.",
          aiModelUsed: data.aiModelUsed || "Google Gemini",
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an issue connecting to my reasoning core. Please retry.",
          aiModelUsed: "Error",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
    setInputValue("");
  };

  // Helper to render markdown bolding and lists client-side
  const renderBold = (text: string) => {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <strong key={i} className="font-semibold text-foreground bg-accent/8 px-1 py-0.5 rounded text-[12.5px]">
            {part}
          </strong>
        );
      }
      return part;
    });
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      const trimmed = line.trim();

      if (!trimmed) {
        return <div key={i} className="h-1.5" />;
      }

      // Headings: ###
      if (trimmed.startsWith("###")) {
        const headingText = trimmed.replace(/^###\s*/, "").replace(/\*\*/g, "");
        return (
          <h4 key={i} className="text-[11px] font-bold mono text-accent uppercase tracking-wider mt-4 mb-2 border-b border-border/40 pb-1.5 flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            {headingText}
          </h4>
        );
      }

      // Headings: ##
      if (trimmed.startsWith("##")) {
        const headingText = trimmed.replace(/^##\s*/, "").replace(/\*\*/g, "");
        return (
          <h3 key={i} className="text-xs font-semibold text-foreground mt-3 mb-1.5 flex items-center gap-1.5">
            {headingText}
          </h3>
        );
      }

      // Numbered List (e.g. "1. ")
      const numMatch = trimmed.match(/^(\d+)\.\s*(.*)/);
      if (numMatch) {
        const num = numMatch[1];
        const content = numMatch[2];
        return (
          <div key={i} className="flex gap-2.5 mt-2.5 items-start pl-1 text-[13px] text-foreground/90">
            <span className="mono text-accent font-bold text-[10px] bg-accent/10 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{num}</span>
            <div className="flex-1 leading-relaxed">{renderBold(content)}</div>
          </div>
        );
      }

      // Bullet List (e.g. "- " or "* ")
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        const content = trimmed.substring(2);
        return (
          <div key={i} className="flex gap-2 mt-1.5 items-start pl-2 text-[13px] text-foreground/90">
            <span className="text-accent text-base shrink-0 leading-none mt-[-1px]">•</span>
            <div className="flex-1 leading-relaxed">{renderBold(content)}</div>
          </div>
        );
      }

      // Normal paragraph
      return (
        <p key={i} className="mb-2 leading-relaxed text-[13px] text-foreground/95">
          {renderBold(trimmed)}
        </p>
      );
    });
  };

  return (
    <section className="rounded-2xl border border-border bg-panel/70 p-5 order-3 flex flex-col min-h-[450px]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3.5 mb-4">
        <div>
          <h3 className="text-[11px] mono uppercase tracking-wider text-muted">AI Shipment Copilot</h3>
          <h2 className="text-base font-semibold mt-0.5 flex items-center gap-1.5">
            <Sparkles className="size-4.5 text-accent animate-pulse" />
            Shipment Advisory Assistant
          </h2>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            className="text-[10px] mono inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-border bg-panel-2 text-muted hover:text-foreground transition cursor-pointer"
          >
            <RotateCcw className="size-3" /> Clear Chat
          </button>
        )}
      </div>

      {/* Main chat body */}
      <div className="flex-1 flex flex-col justify-between">
        {/* Messages viewport */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto max-h-[320px] pr-2 space-y-4 text-sm"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center py-6 text-center">
              <Sparkles className="size-8 text-accent/30 mb-3" />
              <h4 className="text-sm font-semibold text-foreground/80 mb-1">
                Ask anything about this shipment
              </h4>
              <p className="text-xs text-muted max-w-sm mb-6 leading-relaxed">
                I can summarize the analysis, explain specific risk factors, help evaluate route trade-offs, and detail recommendations.
              </p>

              {/* Suggestions chips */}
              <div className="w-full max-w-xl">
                <span className="block text-[10px] mono text-muted uppercase tracking-wider text-center mb-3">
                  Suggested Questions
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {SUGGESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => askQuestion(q)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border bg-panel-2 text-muted hover:text-foreground hover:border-accent/40 transition cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-xl p-3",
                    m.role === "user"
                      ? "ml-auto bg-panel-2 border border-border text-foreground"
                      : "mr-auto bg-accent/5 border border-accent/15 text-foreground"
                  )}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center gap-1 text-[10px] mono text-accent/80 font-bold uppercase tracking-wider mb-2 border-b border-accent/10 pb-1">
                      <Sparkles className="size-3" />
                      <span>Copilot response</span>
                    </div>
                  )}

                  <div className="space-y-1.5">{renderMarkdown(m.content)}</div>

                  {m.role === "assistant" && m.aiModelUsed && (
                    <div className="mt-2.5 pt-1.5 border-t border-accent/10 flex items-center gap-1.5 text-[8.5px] mono text-muted uppercase">
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          m.aiModelUsed.includes("Fallback") ? "bg-warn" : "bg-ok"
                        )}
                      />
                      <span>Reasoned via {m.aiModelUsed}</span>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="mr-auto max-w-[85%] rounded-xl p-3 bg-accent/5 border border-accent/15 text-foreground flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="size-1.5 bg-accent rounded-full animate-bounce" />
                    <span className="size-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="size-1.5 bg-accent rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span className="text-xs text-muted font-medium ml-1">
                    Copilot is formulating response...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            askQuestion(inputValue);
          }}
          className="mt-4 pt-3 border-t border-border/60 flex gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={loading}
            placeholder="Ask a question about this shipment (e.g. 'how can I reduce costs?')"
            className="flex-1 rounded-lg bg-panel-2 border border-border px-3 py-2.5 text-xs outline-none focus:border-accent/60 focus:ring-1 focus:ring-accent/30 transition text-foreground placeholder:text-muted/80 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            className="px-4 py-2.5 rounded-lg bg-accent text-white flex items-center justify-center gap-1 text-xs font-semibold hover:bg-accent/90 transition disabled:opacity-50 cursor-pointer shrink-0"
          >
            Ask <Send className="size-3.5" />
          </button>
        </form>
      </div>
    </section>
  );
}
