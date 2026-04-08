import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, CalendarIcon, Check } from "lucide-react";
import { Task, TaskStatus, RecurrenceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

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
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>("none");

  const reset = () => {
    setTitle("");
    setDescription("");
    setRequiredAgentType("");
    setLocationRadius("");
    setSelectedDeps([]);
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
      requiredAgentType: requiredAgentType.trim() || undefined,
      locationRadius: locationRadius.trim() || undefined,
      deadline: buildDeadline(),
      suggestedAgentIds: [],
      chatMessages: [],
      recurrence: recurrence !== "none" ? recurrence : undefined,
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
          {/* Deadline with time */}
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
              <Input type="time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} className="w-28 text-sm" placeholder="Time" />
            </div>
          </div>
          {/* Recurrence */}
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
          <Button onClick={handleCreate} disabled={!title.trim()} className="w-full mt-2" size="sm">
            Create trace
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
