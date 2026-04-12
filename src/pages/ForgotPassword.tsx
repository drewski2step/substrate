import { useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch {
      // Show success regardless to prevent email enumeration
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-sm px-6 py-16">
        <h1 className="text-xl font-semibold text-center mb-1">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center mb-8 font-mono">
          Enter your email to receive a reset link
        </p>
        {sent ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              If an account exists with that email, a reset link has been sent.
            </p>
            <Link to="/login" className="text-xs text-primary hover:underline">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-xs">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="mt-1" />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? "Sending..." : "Send reset link"}
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-4">
              <Link to="/login" className="text-primary hover:underline">Back to login</Link>
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
