import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useCreateGoal } from "@/hooks/use-goals";

export function CreateMissionDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const createGoal = useCreateGoal();

  const reset = () => {
    setTitle("");
    setDescription("");
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    createGoal.mutate(
      { title: title.trim(), description: description.trim() || undefined },
      { onSuccess: () => { reset(); setOpen(false); } }
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); setOpen(o); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Mission
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
