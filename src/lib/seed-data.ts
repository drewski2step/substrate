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

const traces: Record<string, TraceEntry[]> = {
  "t-001": [
    { id: "tr-001", taskId: "t-001", agentId: "a-001", agentName: "Marcus Rivera", action: "claimed", content: "Claiming survey task. I have a licensed surveyor subcontractor.", timestamp: "2026-02-01T08:00:00Z", dependencies: [], subTraces: [] },
    { id: "tr-002", taskId: "t-001", agentId: "a-001", agentName: "Marcus Rivera", action: "updated", content: "Survey crew scheduled for Feb 5. Property boundaries confirmed with county records.", timestamp: "2026-02-03T10:00:00Z", dependencies: ["tr-001"], subTraces: [] },
    { id: "tr-003", taskId: "t-001", agentId: "a-001", agentName: "Marcus Rivera", action: "completed", content: "Survey complete. Lot is 0.28 acres, 75×160 ft. No encroachments. Setbacks: 25ft front, 5ft sides, 15ft rear. Plat filed with county.", timestamp: "2026-02-06T15:00:00Z", dependencies: ["tr-002"], subTraces: [] },
  ],
  "t-002": [
    { id: "tr-004", taskId: "t-002", agentId: "a-001", agentName: "Marcus Rivera", action: "claimed", content: "Handling permit applications. Will need survey results from Task 1.", timestamp: "2026-02-07T08:00:00Z", dependencies: [], subTraces: [] },
    { id: "tr-005", taskId: "t-002", agentId: "a-001", agentName: "Marcus Rivera", action: "updated", content: "Submitted building permit application to Denver DOTI. Reference #BLD-2026-04821. Estimated 10 business day review.", timestamp: "2026-02-08T11:00:00Z", dependencies: ["tr-004"], subTraces: [] },
    { id: "tr-006", taskId: "t-002", agentId: "a-001", agentName: "Marcus Rivera", action: "completed", content: "Building permit approved. Electrical and plumbing sub-permits also cleared. Construction can begin.", timestamp: "2026-02-22T14:30:00Z", dependencies: ["tr-005"], subTraces: [] },
  ],
  "t-003": [
    { id: "tr-007", taskId: "t-003", agentId: "a-003", agentName: "Front Range Concrete", action: "claimed", content: "We can pour the foundation. Need to confirm soil report and footing specs.", timestamp: "2026-02-23T07:00:00Z", dependencies: [], subTraces: [] },
    { id: "tr-008", taskId: "t-003", agentId: "a-003", agentName: "Front Range Concrete", action: "updated", content: "Excavation complete. Footings dug per structural engineer spec — 24\" wide, 36\" deep for frost line. Rebar placed.", timestamp: "2026-02-28T16:00:00Z", dependencies: ["tr-007"], subTraces: [] },
    { id: "tr-009", taskId: "t-003", agentId: "a-003", agentName: "Front Range Concrete", action: "completed", content: "Foundation poured and cured. 2,800 sq ft slab on grade with stem walls. Passed foundation inspection.", timestamp: "2026-03-08T12:00:00Z", dependencies: ["tr-008"], subTraces: [] },
  ],
  "t-004": [
    { id: "tr-010", taskId: "t-004", agentId: "a-001", agentName: "Marcus Rivera", action: "claimed", content: "Starting framing. Lumber order placed with 84 Lumber — delivery scheduled March 12.", timestamp: "2026-03-10T08:00:00Z", dependencies: [], subTraces: [] },
    { id: "tr-011", taskId: "t-004", agentId: "a-001", agentName: "Marcus Rivera", action: "updated", content: "First floor walls up. Starting second floor joists tomorrow. Crew of 4 on site.", timestamp: "2026-03-15T17:00:00Z", dependencies: ["tr-010"], subTraces: [] },
  ],
  "t-005": [
    { id: "tr-012", taskId: "t-005", agentId: "a-002", agentName: "Volt Electric LLC", action: "claimed", content: "Ready for rough-in once framing passes inspection. Reviewing electrical plans.", timestamp: "2026-03-16T09:00:00Z", dependencies: [], subTraces: [] },
  ],
};

export const seedTasks: Task[] = [
  { id: "t-001", missionId: MISSION_ID, title: "Survey land", description: "Complete property survey including boundary markers, topography, and setback verification. File plat with county.", status: "complete", dependencies: [], requiredAgentType: "Licensed surveyor", locationRadius: "Denver metro", traces: traces["t-001"], suggestedAgentIds: [], order: 0 },
  { id: "t-002", missionId: MISSION_ID, title: "Pull permits", description: "Obtain building permit, electrical sub-permit, plumbing sub-permit, and mechanical sub-permit from Denver DOTI.", status: "complete", dependencies: ["t-001"], requiredAgentType: "General contractor", locationRadius: "Denver metro", assignedAgentId: "a-001", assignedAgentName: "Marcus Rivera", traces: traces["t-002"], suggestedAgentIds: [], order: 1 },
  { id: "t-003", missionId: MISSION_ID, title: "Pour foundation", description: "Excavate, set footings per structural plans, pour concrete foundation with stem walls. Must pass foundation inspection.", status: "complete", dependencies: ["t-002"], requiredAgentType: "Concrete contractor", locationRadius: "Denver metro", assignedAgentId: "a-003", assignedAgentName: "Front Range Concrete", traces: traces["t-003"], suggestedAgentIds: [], order: 2 },
  { id: "t-004", missionId: MISSION_ID, title: "Frame structure", description: "Frame all walls, floors, and roof structure per architectural plans. Include sheathing and house wrap.", status: "active", dependencies: ["t-003"], requiredAgentType: "Framing contractor", locationRadius: "Denver metro", assignedAgentId: "a-001", assignedAgentName: "Marcus Rivera", traces: traces["t-004"], suggestedAgentIds: [], order: 3 },
  { id: "t-005", missionId: MISSION_ID, title: "Rough electrical", description: "Run all electrical wiring, install boxes, set panel. Must be completed before insulation.", status: "open", dependencies: ["t-004"], requiredAgentType: "Licensed electrician", locationRadius: "Denver metro", traces: traces["t-005"], suggestedAgentIds: ["a-002"], order: 4 },
  { id: "t-006", missionId: MISSION_ID, title: "Rough plumbing", description: "Install all supply and drain lines, set fixtures rough-ins, water heater connections.", status: "locked", dependencies: ["t-004"], requiredAgentType: "Licensed plumber", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 5 },
  { id: "t-007", missionId: MISSION_ID, title: "HVAC rough-in", description: "Install ductwork, furnace, and AC condenser pad. Run refrigerant lines.", status: "locked", dependencies: ["t-004"], requiredAgentType: "HVAC contractor", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 6 },
  { id: "t-008", missionId: MISSION_ID, title: "Insulation", description: "Install batt insulation in exterior walls (R-21) and attic (R-49). Vapor barrier in bathrooms.", status: "locked", dependencies: ["t-005", "t-006", "t-007"], requiredAgentType: "Insulation contractor", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 7 },
  { id: "t-009", missionId: MISSION_ID, title: "Drywall", description: "Hang, tape, mud, and sand all drywall. Level 4 finish on walls, Level 5 on ceilings.", status: "locked", dependencies: ["t-008"], requiredAgentType: "Drywall contractor", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 8 },
  { id: "t-010", missionId: MISSION_ID, title: "Finish electrical", description: "Install all outlets, switches, light fixtures, and cover plates. Connect panel circuits.", status: "locked", dependencies: ["t-009"], requiredAgentType: "Licensed electrician", locationRadius: "Denver metro", traces: [], suggestedAgentIds: ["a-002"], order: 9 },
  { id: "t-011", missionId: MISSION_ID, title: "Finish plumbing", description: "Install all fixtures — sinks, toilets, shower valves, dishwasher connection, hose bibs.", status: "locked", dependencies: ["t-009"], requiredAgentType: "Licensed plumber", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 10 },
  { id: "t-012", missionId: MISSION_ID, title: "Paint", description: "Prime and paint all interior walls and trim. Two coats on walls, one on ceilings. Touch up after flooring.", status: "locked", dependencies: ["t-009"], requiredAgentType: "Painter", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 11 },
  { id: "t-013", missionId: MISSION_ID, title: "Flooring", description: "Install hardwood in living areas, tile in bathrooms and kitchen, carpet in bedrooms.", status: "locked", dependencies: ["t-012"], requiredAgentType: "Flooring contractor", locationRadius: "Denver metro", traces: [], suggestedAgentIds: [], order: 12 },
  { id: "t-014", missionId: MISSION_ID, title: "Final inspection", description: "Schedule and pass final building inspection with Denver DOTI. Obtain certificate of occupancy.", status: "locked", dependencies: ["t-010", "t-011", "t-013"], requiredAgentType: "General contractor", locationRadius: "Denver metro", traces: [], suggestedAgentIds: ["a-001"], order: 13 },
];

export const seedMission: Mission = {
  id: MISSION_ID,
  title: "Build a 3-bedroom house in Denver, CO",
  description: "Construct a new 3-bedroom, 2-bathroom single-family home at 123 Main St, Denver CO 80202. Approximately 2,800 sq ft, two stories, attached two-car garage. Standard residential construction to current Denver building code.",
  location: "123 Main St, Denver, CO 80202",
  status: "active",
  creatorId: "a-001",
  tasks: seedTasks,
};
