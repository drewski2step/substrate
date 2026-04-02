import React, { createContext, useContext, useState, useCallback } from "react";
import { Mission, Task, Agent, TraceEntry, TaskStatus } from "./types";
import { seedMission, seedAgents } from "./seed-data";

interface SubstrateState {
  missions: Mission[];
  agents: Agent[];
  completeTask: (missionId: string, taskId: string) => void;
  claimTask: (missionId: string, taskId: string, agentId: string) => void;
  addTrace: (missionId: string, taskId: string, entry: Omit<TraceEntry, "id" | "timestamp">) => void;
  addTask: (missionId: string, task: Omit<Task, "id" | "order" | "traces">) => void;
  deleteTask: (missionId: string, taskId: string) => void;
  updateTask: (missionId: string, taskId: string, updates: Partial<Pick<Task, "requiredAgentType" | "locationRadius" | "assignedAgentId" | "assignedAgentName" | "dependencies">>) => void;
  updateTraceInTask: (missionId: string, taskId: string, traceId: string, updates: Partial<Pick<TraceEntry, "dependencies">>) => void;
  addSubTrace: (missionId: string, taskId: string, parentTracePath: string[], entry: Omit<TraceEntry, "id" | "timestamp">) => void;
  getAgent: (id: string) => Agent | undefined;
  getMission: (id: string) => Mission | undefined;
  getTask: (missionId: string, taskId: string) => Task | undefined;
}

const SubstrateContext = createContext<SubstrateState | null>(null);

export function useSubstrate() {
  const ctx = useContext(SubstrateContext);
  if (!ctx) throw new Error("useSubstrate must be used within SubstrateProvider");
  return ctx;
}

export function SubstrateProvider({ children }: { children: React.ReactNode }) {
  const [missions, setMissions] = useState<Mission[]>([seedMission]);
  const [agents] = useState<Agent[]>(seedAgents);

  const unlockDependents = useCallback((mission: Mission, completedTaskId: string): Mission => {
    const updatedTasks = mission.tasks.map((task) => {
      if (task.status !== "locked") return task;
      const allDepsMet = task.dependencies.every((depId) => {
        if (depId === completedTaskId) return true;
        const depTask = mission.tasks.find((t) => t.id === depId);
        return depTask?.status === "complete";
      });
      if (allDepsMet) return { ...task, status: "open" as TaskStatus };
      return task;
    });
    return { ...mission, tasks: updatedTasks };
  }, []);

  const completeTask = useCallback((missionId: string, taskId: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;
        let updated = {
          ...m,
          tasks: m.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "complete" as TaskStatus,
                  traces: [
                    ...t.traces,
                    {
                      id: `tr-${Date.now()}`,
                      taskId,
                      agentId: t.assignedAgentId || "system",
                      agentName: t.assignedAgentName || "System",
                      action: "completed" as const,
                      content: "Task marked as complete.",
                      timestamp: new Date().toISOString(),
                      dependencies: [],
                      subTraces: [],
                    },
                  ],
                }
              : t
          ),
        };
        updated = unlockDependents(updated, taskId);
        const allComplete = updated.tasks.every((t) => t.status === "complete");
        if (allComplete) updated.status = "complete";
        return updated;
      })
    );
  }, [unlockDependents]);

  const claimTask = useCallback((missionId: string, taskId: string, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return;
    setMissions((prev) =>
      prev.map((m) =>
        m.id !== missionId
          ? m
          : {
              ...m,
              tasks: m.tasks.map((t) =>
                t.id === taskId
                  ? {
                      ...t,
                      status: "active" as TaskStatus,
                      assignedAgentId: agentId,
                      assignedAgentName: agent.name,
                      traces: [
                        ...t.traces,
                        {
                          id: `tr-${Date.now()}`,
                          taskId,
                          agentId,
                          agentName: agent.name,
                          action: "claimed" as const,
                          content: `${agent.name} claimed this task.`,
                          timestamp: new Date().toISOString(),
                          dependencies: [],
                          subTraces: [],
                        },
                      ],
                    }
                  : t
              ),
            }
      )
    );
  }, [agents]);

  const addTrace = useCallback((missionId: string, taskId: string, entry: Omit<TraceEntry, "id" | "timestamp">) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id !== missionId
          ? m
          : {
              ...m,
              tasks: m.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : {
                      ...t,
                      traces: [
                        ...t.traces,
                        { ...entry, id: `tr-${Date.now()}`, timestamp: new Date().toISOString(), dependencies: [], subTraces: [] },
                      ],
                    }
              ),
            }
      )
    );
  }, []);

  const addTask = useCallback((missionId: string, task: Omit<Task, "id" | "order" | "traces">) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;
        const newTask: Task = {
          ...task,
          id: `t-${Date.now()}`,
          order: m.tasks.length,
          traces: [],
        };
        return { ...m, tasks: [...m.tasks, newTask] };
      })
    );
  }, []);

  const updateTask = useCallback((missionId: string, taskId: string, updates: Partial<Pick<Task, "requiredAgentType" | "locationRadius" | "assignedAgentId" | "assignedAgentName" | "dependencies">>) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id !== missionId
          ? m
          : { ...m, tasks: m.tasks.map((t) => (t.id !== taskId ? t : { ...t, ...updates })) }
      )
    );
  }, []);

  const deleteTask = useCallback((missionId: string, taskId: string) => {
    setMissions((prev) =>
      prev.map((m) => {
        if (m.id !== missionId) return m;
        const updatedTasks = m.tasks
          .filter((t) => t.id !== taskId)
          .map((t) => ({
            ...t,
            dependencies: t.dependencies.filter((d) => d !== taskId),
          }));
        return { ...m, tasks: updatedTasks };
      })
    );
  }, []);

  const updateTraceInTask = useCallback((missionId: string, taskId: string, traceId: string, updates: Partial<Pick<TraceEntry, "dependencies">>) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id !== missionId
          ? m
          : {
              ...m,
              tasks: m.tasks.map((t) =>
                t.id !== taskId
                  ? t
                  : { ...t, traces: t.traces.map((tr) => (tr.id !== traceId ? tr : { ...tr, ...updates })) }
              ),
            }
      )
    );
  }, []);

  const insertSubTrace = (traces: TraceEntry[], path: string[], newEntry: TraceEntry): TraceEntry[] => {
    if (path.length === 0) return [...traces, newEntry];
    return traces.map((tr) => {
      if (tr.id === path[0]) {
        return { ...tr, subTraces: insertSubTrace(tr.subTraces, path.slice(1), newEntry) };
      }
      return tr;
    });
  };

  const addSubTrace = useCallback((missionId: string, taskId: string, parentTracePath: string[], entry: Omit<TraceEntry, "id" | "timestamp">) => {
    setMissions((prev) =>
      prev.map((m) =>
        m.id !== missionId
          ? m
          : {
              ...m,
              tasks: m.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const newEntry: TraceEntry = {
                  ...entry,
                  id: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  timestamp: new Date().toISOString(),
                };
                return { ...t, traces: insertSubTrace(t.traces, parentTracePath, newEntry) };
              }),
            }
      )
    );
  }, []);

  const getAgent = useCallback((id: string) => agents.find((a) => a.id === id), [agents]);
  const getMission = useCallback((id: string) => missions.find((m) => m.id === id), [missions]);
  const getTask = useCallback(
    (missionId: string, taskId: string) => missions.find((m) => m.id === missionId)?.tasks.find((t) => t.id === taskId),
    [missions]
  );

  return (
    <SubstrateContext.Provider value={{ missions, agents, completeTask, claimTask, addTrace, addTask, deleteTask, updateTask, updateTraceInTask, addSubTrace, getAgent, getMission, getTask }}>
      {children}
    </SubstrateContext.Provider>
  );
}
