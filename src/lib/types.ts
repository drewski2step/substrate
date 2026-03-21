export type TaskStatus = "open" | "active" | "complete" | "blocked" | "locked";
export type MissionStatus = "active" | "complete" | "paused";
export type AgentType = "individual" | "business";

export interface TraceEntry {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  action: "claimed" | "updated" | "completed" | "note" | "blocked" | "unblocked";
  content: string;
  timestamp: string;
}

export interface Task {
  id: string;
  missionId: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[];
  requiredAgentType: string;
  locationRadius?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  traces: TraceEntry[];
  suggestedAgentIds: string[];
  order: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  location?: string;
  status: MissionStatus;
  creatorId: string;
  tasks: Task[];
}

export interface CompletedTask {
  taskId: string;
  taskTitle: string;
  missionId: string;
  missionTitle: string;
  completedAt: string;
}

export interface Agent {
  id: string;
  name: string;
  type: AgentType;
  skills: string[];
  location: string;
  reputationScore: number;
  completedTasks: CompletedTask[];
}
