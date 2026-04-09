import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { useCreateGoal } from "@/hooks/use-goals";
import { toast } from "sonner";

export function CreateMissionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const createGoal = useCreateGoal();

  const reset = () => { setTitle(""); setDescription(""); };

  const handleCreate = () => {
    if (!title.trim()) return;
    createGoal.mutate(
      { title: title.trim(), description: description.trim() || undefined },
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
