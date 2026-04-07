import { Agent, Mission, Task, TraceEntry } from "./types";

const MISSION_ID = "m-001";

export const seedAgents: Agent[] = [
  {
    id: "a-001",
    name: "Marcus Rivera",
    type: "individual",
    skills: ["General contracting", "Project management", "Framing", "Finish carpentry"],
    location: "Denver, CO",
    reputationScore: 94,
    completedTasks: [
      { taskId: "t-ext-1", taskTitle: "Frame residential addition", missionId: "m-ext-1", missionTitle: "Garage conversion in Aurora, CO", completedAt: "2026-01-15T10:00:00Z" },
      { taskId: "t-ext-2", taskTitle: "Install subfloor", missionId: "m-ext-2", missionTitle: "Basement finish in Lakewood, CO", completedAt: "2026-02-20T14:00:00Z" },
    ],
  },
  {
    id: "a-002",
    name: "Volt Electric LLC",
    type: "business",
    skills: ["Licensed electrician", "Panel upgrades", "Rough electrical", "Finish electrical", "EV charger installation"],
    location: "Denver, CO",
    reputationScore: 91,
    completedTasks: [
      { taskId: "t-ext-3", taskTitle: "Rough electrical — kitchen remodel", missionId: "m-ext-3", missionTitle: "Kitchen remodel in Westminster, CO", completedAt: "2026-01-28T16:00:00Z" },
      { taskId: "t-ext-4", taskTitle: "Panel upgrade 100A to 200A", missionId: "m-ext-4", missionTitle: "Electrical upgrade in Arvada, CO", completedAt: "2026-03-01T11:00:00Z" },
    ],
  },
  {
    id: "a-003",
    name: "Front Range Concrete",
    type: "business",
    skills: ["Concrete supplier", "Foundation pouring", "Flatwork", "Stamped concrete"],
    location: "Denver, CO",
    reputationScore: 88,
    completedTasks: [
      { taskId: "t-ext-5", taskTitle: "Pour garage slab", missionId: "m-ext-1", missionTitle: "Garage conversion in Aurora, CO", completedAt: "2026-01-10T09:00:00Z" },
      { taskId: "t-ext-6", taskTitle: "Driveway replacement", missionId: "m-ext-5", missionTitle: "Driveway repair in Englewood, CO", completedAt: "2026-02-14T13:00:00Z" },
    ],
  },
];

const t = (id: string, taskId: string, agentId: string, agentName: string, action: TraceEntry["action"], content: string, timestamp: string, deps: string[] = []): TraceEntry => ({
  id, taskId, agentId, agentName, action, content, timestamp, dependencies: deps, subTraces: [], chatMessages: [],
});

const traces: Record<string, TraceEntry[]> = {
  "t-001": [
    t("tr-001", "t-001", "a-001", "Marcus Rivera", "claimed", "Claiming survey task. I have a licensed surveyor subcontractor.", "2026-02-01T08:00:00Z"),
    t("tr-002", "t-001", "a-001", "Marcus Rivera", "updated", "Survey crew scheduled for Feb 5. Property boundaries confirmed with county records.", "2026-02-03T10:00:00Z", ["tr-001"]),
    t("tr-003", "t-001", "a-001", "Marcus Rivera", "completed", "Survey complete. Lot is 0.28 acres, 75×160 ft. No encroachments.", "2026-02-06T15:00:00Z", ["tr-002"]),
  ],
  "t-002": [
    t("tr-004", "t-002", "a-001", "Marcus Rivera", "claimed", "Handling permit applications. Will need survey results from Task 1.", "2026-02-07T08:00:00Z"),
    t("tr-005", "t-002", "a-001", "Marcus Rivera", "updated", "Submitted building permit application to Denver DOTI. Reference #BLD-2026-04821.", "2026-02-08T11:00:00Z", ["tr-004"]),
    t("tr-006", "t-002", "a-001", "Marcus Rivera", "completed", "Building permit approved. Construction can begin.", "2026-02-22T14:30:00Z", ["tr-005"]),
  ],
  "t-003": [
    t("tr-007", "t-003", "a-003", "Front Range Concrete", "claimed", "We can pour the foundation. Need to confirm soil report and footing specs.", "2026-02-23T07:00:00Z"),
    t("tr-008", "t-003", "a-003", "Front Range Concrete", "updated", "Excavation complete. Footings dug per structural engineer spec. Rebar placed.", "2026-02-28T16:00:00Z", ["tr-007"]),
    t("tr-009", "t-003", "a-003", "Front Range Concrete", "completed", "Foundation poured and cured. Passed foundation inspection.", "2026-03-08T12:00:00Z", ["tr-008"]),
  ],
  "t-004": [
    t("tr-010", "t-004", "a-001", "Marcus Rivera", "claimed", "Starting framing. Lumber order placed with 84 Lumber.", "2026-03-10T08:00:00Z"),
    t("tr-011", "t-004", "a-001", "Marcus Rivera", "updated", "First floor walls up. Starting second floor joists tomorrow.", "2026-03-15T17:00:00Z", ["tr-010"]),
  ],
  "t-005": [
    t("tr-012", "t-005", "a-002", "Volt Electric LLC", "claimed", "Ready for rough-in once framing passes inspection.", "2026-03-16T09:00:00Z"),
  ],
};

const task = (id: string, title: string, description: string, status: Task["status"], deps: string[], agentType: string, opts: Partial<Task> = {}): Task => ({
  id, missionId: MISSION_ID, title, description, status, dependencies: deps, requiredAgentType: agentType,
  locationRadius: "Denver metro", traces: traces[id] || [], suggestedAgentIds: [], order: 0, chatMessages: [], ...opts,
});

export const seedTasks: Task[] = [
  task("t-001", "Survey land", "Complete property survey including boundary markers, topography, and setback verification.", "complete", [], "Licensed surveyor", { order: 0 }),
  task("t-002", "Pull permits", "Obtain building permit, electrical sub-permit, plumbing sub-permit from Denver DOTI.", "complete", ["t-001"], "General contractor", { order: 1, assignedAgentId: "a-001", assignedAgentName: "Marcus Rivera" }),
  task("t-003", "Pour foundation", "Excavate, set footings per structural plans, pour concrete foundation with stem walls.", "complete", ["t-002"], "Concrete contractor", { order: 2, assignedAgentId: "a-003", assignedAgentName: "Front Range Concrete" }),
  task("t-004", "Frame structure", "Frame all walls, floors, and roof structure per architectural plans.", "active", ["t-003"], "Framing contractor", { order: 3, assignedAgentId: "a-001", assignedAgentName: "Marcus Rivera" }),
  task("t-005", "Rough electrical", "Run all electrical wiring, install boxes, set panel.", "open", ["t-004"], "Licensed electrician", { order: 4, suggestedAgentIds: ["a-002"] }),
  task("t-006", "Rough plumbing", "Install all supply and drain lines, set fixtures rough-ins.", "locked", ["t-004"], "Licensed plumber", { order: 5 }),
  task("t-007", "HVAC rough-in", "Install ductwork, furnace, and AC condenser pad.", "locked", ["t-004"], "HVAC contractor", { order: 6 }),
  task("t-008", "Insulation", "Install batt insulation in exterior walls and attic.", "locked", ["t-005", "t-006", "t-007"], "Insulation contractor", { order: 7 }),
  task("t-009", "Drywall", "Hang, tape, mud, and sand all drywall.", "locked", ["t-008"], "Drywall contractor", { order: 8 }),
  task("t-010", "Finish electrical", "Install all outlets, switches, light fixtures.", "locked", ["t-009"], "Licensed electrician", { order: 9, suggestedAgentIds: ["a-002"] }),
  task("t-011", "Finish plumbing", "Install all fixtures — sinks, toilets, shower valves.", "locked", ["t-009"], "Licensed plumber", { order: 10 }),
  task("t-012", "Paint", "Prime and paint all interior walls and trim.", "locked", ["t-009"], "Painter", { order: 11 }),
  task("t-013", "Flooring", "Install hardwood in living areas, tile in bathrooms.", "locked", ["t-012"], "Flooring contractor", { order: 12 }),
  task("t-014", "Final inspection", "Schedule and pass final building inspection.", "locked", ["t-010", "t-011", "t-013"], "General contractor", { order: 13, suggestedAgentIds: ["a-001"] }),
];

export const seedMission: Mission = {
  id: MISSION_ID,
  title: "Build a 3-bedroom house in Denver, CO",
  description: "Construct a new 3-bedroom, 2-bathroom single-family home at 123 Main St, Denver CO 80202.",
  location: "123 Main St, Denver, CO 80202",
  status: "active",
  creatorId: "a-001",
  tasks: seedTasks,
};
