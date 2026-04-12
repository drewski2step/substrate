import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "@/contexts/AuthContext";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuthContext();
  const navigate = useNavigate();

  const validate = () => {
    if (!email || !username || !password || !confirm) return "All fields are required";
    if (username.length < 3) return "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) return "Username can only contain letters, numbers, hyphens, and underscores";
    if (password.length < 8) return "Password must be at least 8 characters";
    if (!/[!@#$%^&*]/.test(password)) return "Password must contain at least one special character (!@#$%^&*)";
    if (password !== confirm) return "Passwords do not match";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }
    setLoading(true);
    try {
      await signUp(email, password, username);
      toast.success("Account created! Welcome to the Substrate.");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-xl font-semibold text-center mb-1">Join the Substrate</h1>
        <p className="text-sm text-muted-foreground text-center mb-8 font-mono">Create your account</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-xs">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="username" className="text-xs">Username</Label>
            <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="your_username" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="password" className="text-xs">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 chars, include a special character" className="mt-1" />
          </div>
          <div>
            <Label htmlFor="confirm" className="text-xs">Confirm Password</Label>
            <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" className="mt-1" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Log in</Link>
        </p>
      </main>
    </div>
  );
}
