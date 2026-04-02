import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
import { Task, TaskStatus } from "@/lib/types";

interface CreateTaskDialogProps {
  missionId: string;
  existingTasks: Task[];
  onCreateTask: (missionId: string, task: Omit<Task, "id" | "order" | "traces">) => void;
}

export function CreateTaskDialog({ missionId, existingTasks, onCreateTask }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requiredAgentType, setRequiredAgentType] = useState("");
  const [locationRadius, setLocationRadius] = useState("");
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setRequiredAgentType("");
    setLocationRadius("");
    setSelectedDeps([]);
  };

  const handleCreate = () => {
    if (!title.trim() || !requiredAgentType.trim()) return;

    const hasDeps = selectedDeps.length > 0;
    const allDepsMet = hasDeps
      ? selectedDeps.every((depId) => existingTasks.find((t) => t.id === depId)?.status === "complete")
      : true;

    const status: TaskStatus = hasDeps && !allDepsMet ? "locked" : "open";

    onCreateTask(missionId, {
      missionId,
      title: title.trim(),
      description: description.trim(),
      status,
      dependencies: selectedDeps,
      requiredAgentType: requiredAgentType.trim(),
      locationRadius: locationRadius.trim() || undefined,
      suggestedAgentIds: [],
    });

    reset();
    setOpen(false);
  };

  const toggleDep = (taskId: string) => {
    setSelectedDeps((prev) =>
      prev.includes(taskId) ? prev.filter((d) => d !== taskId) : [...prev, taskId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 font-mono">
          <Plus className="w-3.5 h-3.5" />
          Add trace
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">New trace</DialogTitle>
        </DialogHeader>
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
          {existingTasks.length > 0 && (
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-mono">Dependencies (optional)</label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {existingTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer py-1 px-1 rounded hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={selectedDeps.includes(t.id)}
                      onChange={() => toggleDep(t.id)}
                      className="rounded border-border"
                    />
                    <span className="truncate">{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <Button onClick={handleCreate} disabled={!title.trim() || !requiredAgentType.trim()} className="w-full mt-2" size="sm">
            Create trace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
