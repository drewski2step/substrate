import { useState } from "react";
import { ChatMessage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (agentName: string, content: string) => void;
  label?: string;
}

export function ChatBox({ messages, onSendMessage, label = "Chat" }: ChatBoxProps) {
  const [expanded, setExpanded] = useState(false);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!name.trim() || !message.trim()) return;
    onSendMessage(name.trim(), message.trim());
    setMessage("");
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-accent/50 transition-colors"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <MessageSquare className="w-3 h-3" />
        {label}
        {messages.length > 0 && (
          <span className="ml-auto bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums">
            {messages.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-border">
          <div className="max-h-48 overflow-y-auto p-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-2">No messages yet</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className="text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">{msg.agentName}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">
                    {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-foreground/80 mt-0.5">{msg.content}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border p-2 flex gap-1.5">
            <Input
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-7 text-[11px] w-24 shrink-0"
            />
            <Input
              placeholder="Message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="h-7 text-[11px]"
              onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
            />
            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleSend} disabled={!name.trim() || !message.trim()}>
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
