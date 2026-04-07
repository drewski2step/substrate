import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Task, TaskStatus } from "@/lib/types";

interface AddSuccessorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentTask: Task;
  missionId: string;
  onCreateTask: (missionId: string, task: Omit<Task, "id" | "order" | "traces">) => void;
}

export function AddSuccessorDialog({ open, onOpenChange, parentTask, missionId, onCreateTask }: AddSuccessorDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredAgentType, setRequiredAgentType] = useState("");
  const [locationRadius, setLocationRadius] = useState("");

  const reset = () => {
    setTitle("");
    setDescription("");
    setRequiredAgentType("");
    setLocationRadius("");
  };

  const handleCreate = () => {
    if (!title.trim() || !requiredAgentType.trim()) return;

    const status: TaskStatus = parentTask.status === "complete" ? "open" : "locked";

    onCreateTask(missionId, {
      missionId,
      title: title.trim(),
      description: description.trim(),
      status,
      dependencies: [parentTask.id],
      requiredAgentType: requiredAgentType.trim(),
      locationRadius: locationRadius.trim() || undefined,
      suggestedAgentIds: [],
      chatMessages: [],
    });

    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add successor to "{parentTask.title}"</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">This trace will depend on <strong>{parentTask.title}</strong> and appear above it in the graph.</p>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Install kitchen cabinets" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done?" rows={3} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Required agent type</label>
            <Input value={requiredAgentType} onChange={(e) => setRequiredAgentType(e.target.value)} placeholder="e.g. licensed electrician" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Location radius (optional)</label>
            <Input value={locationRadius} onChange={(e) => setLocationRadius(e.target.value)} placeholder="e.g. Denver, CO — 25mi" />
          </div>
          <Button onClick={handleCreate} disabled={!title.trim() || !requiredAgentType.trim()} className="w-full mt-2" size="sm">
            Create successor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
