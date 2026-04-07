import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, CalendarIcon } from "lucide-react";
import { Mission } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CreateMissionDialogProps {
  onCreateMission: (mission: Omit<Mission, "id" | "tasks">) => void;
}

export function CreateMissionDialog({ onCreateMission }: CreateMissionDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();

  const reset = () => {
    setTitle("");
    setDescription("");
    setLocation("");
    setDeadline(undefined);
  };

  const handleCreate = () => {
    if (!title.trim()) return;
    onCreateMission({
      title: title.trim(),
      description: description.trim(),
      location: location.trim() || undefined,
      deadline: deadline?.toISOString(),
      status: "active",
      creatorId: "user",
    });
    reset();
    setOpen(false);
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
          <Input placeholder="Location (optional)" value={location} onChange={(e) => setLocation(e.target.value)} className="text-sm" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !deadline && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {deadline ? format(deadline, "PPP") : "Deadline (optional)"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={deadline} onSelect={setDeadline} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
        </div>
        <DialogFooter>
          <Button size="sm" onClick={handleCreate} disabled={!title.trim()}>Create mission</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
