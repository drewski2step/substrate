import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Globe, Lock } from "lucide-react";
import { useCreateGoal } from "@/hooks/use-goals";
import { useAuthContext } from "@/contexts/AuthContext";
import { AuthGate } from "@/components/AuthGate";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function CreateMissionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const navigate = useNavigate();
  const createGoal = useCreateGoal();
  const { user } = useAuthContext();

  const reset = () => { setTitle(""); setDescription(""); setVisibility("public"); };

  const handleCreate = () => {
    if (!title.trim()) return;
    createGoal.mutate(
      { title: title.trim(), description: description.trim() || undefined, visibility },
      {
        onSuccess: (data) => {
          reset();
          setOpen(false);
          if (data?.id) navigate(`/mission/${data.id}`);
        },
        onError: (err: any) => {
          toast.error(`Failed to create mission: ${err.message}`);
        },
      }
    );
  };

  const handleOpenChange = (o: boolean) => {
    if (o && !user) {
      navigate("/signup");
      return;
    }
    if (!o) reset();
    setOpen(o);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Mission
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Create a new mission</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input placeholder="Mission title" value={title} onChange={(e) => setTitle(e.target.value)} className="text-sm" />
          <Textarea placeholder="Describe the mission..." value={description} onChange={(e) => setDescription(e.target.value)} className="text-sm min-h-[80px]" />

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  visibility === "public"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-medium">Public</span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Anyone can find and contribute to this mission
                </span>
              </button>
              <button
                type="button"
                onClick={() => setVisibility("private")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  visibility === "private"
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-muted-foreground/30"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-orange-500" />
                  <span className="text-xs font-medium">Private</span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-tight">
                  Only people you invite can see this mission
                </span>
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleCreate} disabled={!title.trim() || createGoal.isPending}>
            {createGoal.isPending ? "Creating..." : "Create mission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
