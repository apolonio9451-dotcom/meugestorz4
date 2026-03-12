import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send, Loader2, Trash2, Bot, User, Zap, ChevronDown, ChevronUp,
  MessageCircle, RotateCcw, Smartphone
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  context?: string;
  decisions?: string[];
  commands?: string[];
}

interface Props {
  companyId: string;
}

export default function ChatSimulator({ companyId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [simulateAs, setSimulateAs] = useState("new_contact");
  const [expandedDecisions, setExpandedDecisions] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      // Build conversation history (exclude current message)
      const history = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("chatbot-simulator", {
        body: {
          company_id: companyId,
          message: text,
          conversation_history: history,
          simulate_as: simulateAs,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply || "Sem resposta",
        timestamp: new Date(),
        context: data.context,
        decisions: data.decisions,
        commands: data.commands,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `❌ Erro: ${err.message}`,
        timestamp: new Date(),
        context: "error",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClear = () => {
    setMessages([]);
    setExpandedDecisions(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const contextLabels: Record<string, string> = {
    new_contact: "Novo Contato",
    client: "Cliente",
    auto_reply: "Gatilho",
    transfer: "Transferência",
    error: "Erro",
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col" style={{ height: "600px" }}>
      {/* Header */}
      <div className="bg-primary/10 border-b border-border/30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Smartphone className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Simulador de Conversa</p>
            <p className="text-[10px] text-muted-foreground">Teste o bot sem enviar mensagens reais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={simulateAs} onValueChange={setSimulateAs}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new_contact">
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3 h-3" /> Novo Contato
                </span>
              </SelectItem>
              <SelectItem value="client">
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" /> Cliente
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClear} title="Limpar conversa">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/30">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-3 opacity-60">
            <Bot className="w-12 h-12 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Simulador pronto!</p>
              <p className="text-xs text-muted-foreground mt-1">
                Digite uma mensagem para testar como o bot responderá.
                <br />
                Selecione "Novo Contato" ou "Cliente" para simular contextos diferentes.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[80%] space-y-1`}>
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-secondary/80 text-foreground rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>

              {/* Context badge + commands */}
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 px-1 flex-wrap">
                  {msg.context && (
                    <Badge variant="outline" className="text-[10px] h-5">
                      {contextLabels[msg.context] || msg.context}
                    </Badge>
                  )}
                  {msg.commands && msg.commands.length > 0 && msg.commands.map((cmd, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] h-5 font-mono">
                      <Zap className="w-2.5 h-2.5 mr-0.5" />
                      {cmd}
                    </Badge>
                  ))}
                  {msg.decisions && msg.decisions.length > 0 && (
                    <button
                      onClick={() => setExpandedDecisions(expandedDecisions === msg.id ? null : msg.id)}
                      className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                    >
                      {expandedDecisions === msg.id ? (
                        <ChevronUp className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                      Decisões ({msg.decisions.length})
                    </button>
                  )}
                </div>
              )}

              {/* Decision trail */}
              {msg.role === "assistant" && expandedDecisions === msg.id && msg.decisions && (
                <div className="bg-muted/50 rounded-lg px-3 py-2 text-[11px] text-muted-foreground space-y-0.5 font-mono">
                  {msg.decisions.map((d, i) => (
                    <p key={i}>{d}</p>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-muted-foreground/60 px-1">
                {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary/80 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">digitando...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/30 p-3 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          disabled={loading}
          className="flex-1 bg-secondary/30 border-border/50"
        />
        <Button onClick={handleSend} disabled={loading || !input.trim()} size="icon" className="shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
