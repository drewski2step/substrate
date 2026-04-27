import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import MissionBoard from "./pages/MissionBoard";
import MissionView from "./pages/MissionView";
import BlockView from "./pages/BlockView";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import UserProfile from "./pages/UserProfile";
import Discussions from "./pages/Discussions";
import GraphView from "./pages/GraphView";
import CompletedBlocks from "./pages/CompletedBlocks";
import PledgedBlocks from "./pages/PledgedBlocks";
import UserMissions from "./pages/UserMissions";
import UserDiscussions from "./pages/UserDiscussions";

const queryClient = new QueryClient();


const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<MissionBoard />} />
            <Route path="/discussions" element={<Discussions />} />
            <Route path="/graph" element={<GraphView />} />
            <Route path="/profile/:username/completed" element={<CompletedBlocks />} />
            <Route path="/profile/:username/pledged" element={<PledgedBlocks />} />
            <Route path="/profile/:username/missions" element={<UserMissions />} />
            <Route path="/profile/:username/discussions" element={<UserDiscussions />} />
            <Route path="/mission/:missionId" element={<MissionView />} />
            <Route path="/mission/:missionId/block/:blockId" element={<BlockView />} />
            <Route path="/mission/:missionId/task/:taskId" element={<BlockView />} />
            <Route path="/profile/:username" element={<UserProfile />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
