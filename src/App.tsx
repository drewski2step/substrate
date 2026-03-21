import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SubstrateProvider } from "@/lib/substrate-context";
import MissionBoard from "./pages/MissionBoard";
import MissionView from "./pages/MissionView";
import TaskView from "./pages/TaskView";
import AgentList from "./pages/AgentList";
import AgentProfile from "./pages/AgentProfile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <SubstrateProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MissionBoard />} />
            <Route path="/mission/:missionId" element={<MissionView />} />
            <Route path="/mission/:missionId/task/:taskId" element={<TaskView />} />
            <Route path="/agents" element={<AgentList />} />
            <Route path="/agent/:agentId" element={<AgentProfile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </SubstrateProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
