import { useState, useRef, useEffect } from "react";
import { useBlockChats, useCreateBlockChat } from "@/hooks/use-block-chats";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export function BlockChatPanel({ blockId }: { blockId: string }) {
  const { data: chats, isLoading } = useBlockChats(blockId);
  const createChat = useCreateBlockChat();
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState(() => localStorage.getItem("substrate_sender") || "");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats?.length]);

  const handleSend = () => {
    const name = senderName.trim() || "Anonymous";
    if (!message.trim()) return;
    localStorage.setItem("substrate_sender", name);
    createChat.mutate(
      { block_id: blockId, sender_name: name, message: message.trim() },
      {
        onSuccess: () => setMessage(""),
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-2 border-b border-border bg-muted/30">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider font-mono">Chat</h3>
      </div>
      <ScrollArea className="flex-1 px-4 py-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Loading...</p>
        ) : !chats || chats.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No messages yet. Start the conversation.</p>
        ) : (
          <div className="space-y-3">
            {chats.map((chat) => (
              <div key={chat.id} className="text-sm">
                <div className="flex items-center gap-2 text-xs mb-0.5">
                  <span className="font-semibold">{chat.sender_name}</span>
                  <span className="text-muted-foreground">{format(new Date(chat.created_at), "MMM d, h:mm a")}</span>
                </div>
                <p className="leading-relaxed">{chat.message}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>
      <div className="p-3 border-t border-border space-y-2">
        {!senderName && (
          <Textarea
            placeholder="Your name"
            value={senderName}
            onChange={(e) => setSenderName(e.target.value)}
            className="text-xs min-h-[32px] h-8 resize-none"
            rows={1}
          />
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            className="text-sm min-h-[40px] resize-none"
            rows={1}
          />
          <Button size="sm" onClick={handleSend} disabled={!message.trim() || createChat.isPending}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
