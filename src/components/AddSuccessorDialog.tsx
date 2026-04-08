import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { Task, TaskStatus, RecurrenceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");

  const reset = () => {
    setTitle("");
    setDescription("");
    setRequiredAgentType("");
    setLocationRadius("");
    setDeadline(undefined);
    setDeadlineTime("");
    setRecurrence("none");
  };

  const buildDeadline = (): string | undefined => {
    if (!deadline) return undefined;
    if (deadlineTime) {
      const [h, m] = deadlineTime.split(":").map(Number);
      const d = new Date(deadline);
      d.setHours(h, m, 0, 0);
      return d.toISOString();
    }
    return deadline.toISOString();
  };

  const handleCreate = () => {
    if (!title.trim()) return;

    const status: TaskStatus = parentTask.status === "complete" ? "open" : "locked";

    onCreateTask(missionId, {
      missionId,
      title: title.trim(),
      description: description.trim(),
      status,
      dependencies: [parentTask.id],
      requiredAgentType: requiredAgentType.trim() || undefined,
      locationRadius: locationRadius.trim() || undefined,
      deadline: buildDeadline(),
      suggestedAgentIds: [],
      chatMessages: [],
      recurrence: recurrence !== "none" ? recurrence : undefined,
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
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Description (optional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs to be done?" rows={3} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Agent type (optional)</label>
            <Input value={requiredAgentType} onChange={(e) => setRequiredAgentType(e.target.value)} placeholder="e.g. licensed electrician" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Location radius (optional)</label>
            <Input value={locationRadius} onChange={(e) => setLocationRadius(e.target.value)} placeholder="e.g. Denver, CO — 25mi" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Deadline (optional)</label>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal text-sm", !deadline && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {deadline ? format(deadline, "MMM d, yyyy") : "Pick date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-28 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block font-mono">Recurrence (optional)</label>
            <Select value={recurrence} onValueChange={(v) => setRecurrence(v as RecurrenceType)}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (one-time)</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Biweekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreate} disabled={!title.trim()} className="w-full mt-2" size="sm">
            Create successor
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
