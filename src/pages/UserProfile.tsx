import { useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { useUserFollowedMissions } from "@/hooks/use-mission-followers";
import { getAvatarUrl } from "@/hooks/use-auth";
import { AppHeader } from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Pencil, Camera, MapPin, Plus, Trash2, ExternalLink,
  Instagram, Youtube, Twitter, Linkedin, Github, Globe, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

type Experience = {
  id: string;
  user_id: string;
  title: string;
  organization: string;
  experience_type: "work" | "education" | "mission" | "volunteer" | "project";
  start_date: string;
  end_date: string | null;
  description: string | null;
  created_at: string;
};

const EXP_TYPE_LABELS: Record<string, string> = {
  work: "Work",
  education: "Education",
  mission: "Mission",
  volunteer: "Volunteer",
  project: "Project",
};

const EMPTY_EXP = {
  title: "",
  organization: "",
  experience_type: "work" as const,
  start_date: "",
  end_date: "",
  description: "",
};

function formatDate(dateStr: string) {
  const [y, m] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Convert YYYY-MM-DD from DB back to YYYY-MM for the month input
function toMonthInput(dateStr: string | null | undefined) {
  if (!dateStr) return "";
  return dateStr.slice(0, 7); // "2026-03-01" → "2026-03"
}

export default function UserProfile() {
  const { username } = useParams<{ username: string }>();
  const { user, refreshProfile } = useAuthContext();
  const queryClient = useQueryClient();

  // Username edit
  const [editOpen, setEditOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");

  // Avatar
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Location inline edit
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationVal, setLocationVal] = useState("");

  // About / life story inline edit
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutVal, setAboutVal] = useState("");

  // Experience
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Experience | null>(null);
  const [expForm, setExpForm] = useState(EMPTY_EXP);

  // Social links dialog
  const [socialOpen, setSocialOpen] = useState(false);
  const [socialForm, setSocialForm] = useState({
    social_instagram: "",
    social_youtube: "",
    social_twitter: "",
    social_linkedin: "",
    social_substack: "",
    social_github: "",
    social_website: "",
  });

  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile", username],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("username", username!).maybeSingle();
      return data;
    },
    enabled: !!username,
  });

  const isOwn = !!user && !!profile && user.id === profile.id;

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profile?.id],
    queryFn: async () => {
      const [, blocks, posts, completed] = await Promise.all([
        Promise.resolve({ count: 0 }),
        supabase.from("blocks").select("id", { count: "exact", head: true }).eq("created_by", profile!.id).is("deleted_at", null),
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", profile!.id).is("parent_id", null),
        supabase.from("blocks").select("id", { count: "exact", head: true }).eq("completed_by", profile!.id).is("deleted_at", null),
      ]);
      return { blocks: blocks.count ?? 0, posts: posts.count ?? 0, completed: completed.count ?? 0 };
    },
    enabled: !!profile?.id,
  });

  const { data: followedMissions } = useUserFollowedMissions(profile?.id);
  const missionsCount = followedMissions?.length ?? 0;

  const { data: pledgeCount } = useQuery({
    queryKey: ["profile-pledge-count", profile?.id],
    queryFn: async () => {
      const { data: pledges } = await supabase.from("block_pledges").select("block_id").eq("user_id", profile!.id).eq("active", true);
      if (!pledges?.length) return 0;
      const blockIds = pledges.map((p) => p.block_id);
      const { count } = await supabase.from("blocks").select("id", { count: "exact", head: true }).in("id", blockIds).is("deleted_at", null).is("completed_at", null);
      return count ?? 0;
    },
    enabled: !!profile?.id,
  });

  const { data: experiences } = useQuery({
    queryKey: ["profile-experiences", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_experiences" as any)
        .select("*")
        .eq("user_id", profile!.id)
        .order("start_date", { ascending: false });
      return (data ?? []) as Experience[];
    },
    enabled: !!profile?.id,
  });

  // ── Avatar upload ──────────────────────────────────────────────────────────
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: urlWithBust } as any).eq("id", user.id);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      refreshProfile();
      toast.success("Profile photo updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload photo");
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  // ── Username ───────────────────────────────────────────────────────────────
  const updateUsername = useMutation({
    mutationFn: async (uname: string) => {
      const { data: existing } = await supabase.from("profiles").select("id").eq("username", uname).neq("id", user!.id).maybeSingle();
      if (existing) throw new Error("Username is already taken");
      const { error } = await supabase.from("profiles").update({ username: uname } as any).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Username updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Location ───────────────────────────────────────────────────────────────
  const saveLocation = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await supabase.from("profiles").update({ location: val || null } as any).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditingLocation(false);
      toast.success("Location updated");
    },
    onError: () => toast.error("Failed to save location"),
  });

  // ── About ──────────────────────────────────────────────────────────────────
  const saveAbout = useMutation({
    mutationFn: async (val: string) => {
      const { error } = await supabase.from("profiles").update({ about: val || null } as any).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setEditingAbout(false);
      toast.success("Life story updated");
    },
    onError: () => toast.error("Failed to save"),
  });

  // ── Social links ───────────────────────────────────────────────────────────
  const saveSocial = useMutation({
    mutationFn: async (vals: typeof socialForm) => {
      const { error } = await supabase.from("profiles").update(vals as any).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      setSocialOpen(false);
      toast.success("Social links updated");
    },
    onError: () => toast.error("Failed to save"),
  });

  function openSocialDialog() {
    setSocialForm({
      social_instagram: (profile as any)?.social_instagram ?? "",
      social_youtube: (profile as any)?.social_youtube ?? "",
      social_twitter: (profile as any)?.social_twitter ?? "",
      social_linkedin: (profile as any)?.social_linkedin ?? "",
      social_substack: (profile as any)?.social_substack ?? "",
      social_github: (profile as any)?.social_github ?? "",
      social_website: (profile as any)?.social_website ?? "",
    });
    setSocialOpen(true);
  }

  // ── Experiences ────────────────────────────────────────────────────────────
  function openAddExp() {
    setEditingExp(null);
    setExpForm(EMPTY_EXP);
    setExpDialogOpen(true);
  }

  function openEditExp(exp: Experience) {
    setEditingExp(exp);
    setExpForm({
      title: exp.title,
      organization: exp.organization,
      experience_type: exp.experience_type,
      start_date: toMonthInput(exp.start_date),
      end_date: toMonthInput(exp.end_date),
      description: exp.description ?? "",
    });
    setExpDialogOpen(true);
  }

  const saveExp = useMutation({
    mutationFn: async () => {
      const toDate = (val: string) => val ? `${val}-01` : null;
      const payload = {
        user_id: user!.id,
        title: expForm.title.trim(),
        organization: expForm.organization.trim(),
        experience_type: expForm.experience_type,
        start_date: toDate(expForm.start_date),
        end_date: toDate(expForm.end_date),
        description: expForm.description.trim() || null,
      };
      if (editingExp) {
        const { error } = await supabase.from("profile_experiences" as any).update(payload as any).eq("id", editingExp.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("profile_experiences" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-experiences"] });
      setExpDialogOpen(false);
      toast.success(editingExp ? "Experience updated" : "Experience added");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save experience"),
  });

  const deleteExp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("profile_experiences" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-experiences"] });
      toast.success("Experience removed");
    },
    onError: () => toast.error("Failed to delete"),
  });

  // ── Social links config ────────────────────────────────────────────────────
  const socialLinks = [
    { key: "social_instagram", icon: Instagram, label: "Instagram", prefix: "https://instagram.com/", placeholder: "username" },
    { key: "social_youtube", icon: Youtube, label: "YouTube", prefix: "https://youtube.com/@", placeholder: "username or @username" },
    { key: "social_twitter", icon: Twitter, label: "Twitter / X", prefix: "https://x.com/", placeholder: "username" },
    { key: "social_linkedin", icon: Linkedin, label: "LinkedIn", prefix: "https://linkedin.com/in/", placeholder: "Full URL or username" },
    { key: "social_substack", icon: BookOpen, label: "Substack", prefix: "https://", placeholder: "yourname.substack.com" },
    { key: "social_github", icon: Github, label: "GitHub", prefix: "https://github.com/", placeholder: "username" },
    { key: "social_website", icon: Globe, label: "Website", prefix: "https://", placeholder: "https://yoursite.com" },
  ] as const;

  function getSocialHref(key: string, val: string) {
    const cfg = socialLinks.find((s) => s.key === key);
    if (!cfg) return val;
    // Full URL — pass through as-is
    if (val.startsWith("http://") || val.startsWith("https://")) return val;
    // YouTube: strip leading @ so we always add exactly one
    if (key === "social_youtube") {
      const handle = val.startsWith("@") ? val.slice(1) : val;
      return `https://youtube.com/@${handle}`;
    }
    return cfg.prefix + val;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (<><AppHeader /><div className="mx-auto max-w-5xl px-6 py-16 text-center text-muted-foreground font-mono text-sm">Loading…</div></>);
  }
  if (!profile) {
    return (<><AppHeader /><div className="mx-auto max-w-5xl px-6 py-16 text-center"><h1 className="text-xl font-semibold font-mono mb-2">User not found</h1><p className="text-muted-foreground text-sm">No user with the username "{username}" exists.</p></div></>);
  }

  const filledSocials = socialLinks.filter((s) => !!(profile as any)[s.key]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-10 animate-fade-in-up">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-5 mb-4">
          <div className="relative shrink-0 group">
            <img
              src={profile.avatar_url || getAvatarUrl(profile.avatar_seed)}
              alt={profile.username}
              className="w-20 h-20 rounded-full bg-muted object-cover"
            />
            {isOwn && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Change profile photo"
                >
                  {avatarUploading
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Camera className="w-5 h-5 text-white" />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={handleAvatarUpload} />
              </>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold font-mono truncate">{profile.username}</h1>
              {isOwn && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setNewUsername(profile.username); setEditOpen(true); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>

            {/* Location */}
            {editingLocation ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  autoFocus
                  value={locationVal}
                  onChange={(e) => setLocationVal(e.target.value)}
                  placeholder="City, State, Country"
                  className="h-7 text-sm font-mono max-w-xs"
                  onKeyDown={(e) => { if (e.key === "Enter") saveLocation.mutate(locationVal); if (e.key === "Escape") setEditingLocation(false); }}
                />
                <Button size="sm" className="h-7 text-xs" onClick={() => saveLocation.mutate(locationVal)} disabled={saveLocation.isPending}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingLocation(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 mt-1">
                {(profile as any).location ? (
                  <button
                    onClick={() => { if (isOwn) { setLocationVal((profile as any).location ?? ""); setEditingLocation(true); } }}
                    className={`flex items-center gap-1 text-sm text-muted-foreground font-mono ${isOwn ? "hover:text-foreground cursor-pointer" : ""}`}
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {(profile as any).location}
                    {isOwn && <Pencil className="w-3 h-3 opacity-50 ml-0.5" />}
                  </button>
                ) : isOwn ? (
                  <button
                    onClick={() => { setLocationVal(""); setEditingLocation(true); }}
                    className="flex items-center gap-1 text-xs text-muted-foreground font-mono hover:text-foreground"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="opacity-60">Add location</span>
                  </button>
                ) : null}
              </div>
            )}

            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              Joined {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* ── Social links ─────────────────────────────────────────────── */}
        {(filledSocials.length > 0 || isOwn) && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            {filledSocials.map(({ key, icon: Icon, label }) => (
              <a
                key={key}
                href={getSocialHref(key, (profile as any)[key])}
                target="_blank"
                rel="noopener noreferrer"
                title={label}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
            {isOwn && (
              <button
                onClick={openSocialDialog}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-border text-xs font-mono text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                {filledSocials.length > 0 ? "Edit socials" : "Add socials"}
              </button>
            )}
          </div>
        )}

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Missions", value: missionsCount, to: `/profile/${profile.username}/missions` },
            { label: "Discussions", value: stats?.posts ?? 0, to: `/profile/${profile.username}/discussions` },
            { label: "Completed", value: stats?.completed ?? 0, to: `/profile/${profile.username}/completed` },
            { label: "Pledged", value: pledgeCount ?? 0, to: `/profile/${profile.username}/pledged` },
          ].map((s) => (
            <Link key={s.label} to={s.to}>
              <Card className="cursor-pointer hover:border-orange-400 transition-colors">
                <CardContent className="p-3 text-center">
                  <div className="text-2xl font-bold font-mono">{s.value}</div>
                  <div className="text-xs text-muted-foreground font-mono uppercase tracking-wide">{s.label}</div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* ── Life Story ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">Life Story</h2>
          {editingAbout ? (
            <div className="space-y-2">
              <Textarea
                autoFocus
                value={aboutVal}
                onChange={(e) => setAboutVal(e.target.value.slice(0, 1000))}
                placeholder="Tell your story…"
                className="min-h-[120px] font-mono text-sm resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">{aboutVal.length}/1000</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingAbout(false)}>Cancel</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => saveAbout.mutate(aboutVal)} disabled={saveAbout.isPending}>Save</Button>
                </div>
              </div>
            </div>
          ) : (
            <div
              onClick={() => { if (isOwn) { setAboutVal((profile as any).about ?? ""); setEditingAbout(true); } }}
              className={`text-sm font-mono leading-relaxed whitespace-pre-wrap ${isOwn ? "cursor-pointer hover:text-foreground" : ""} ${!(profile as any).about ? "text-muted-foreground/50 italic" : "text-foreground"}`}
            >
              {(profile as any).about || (isOwn ? "Click to add your life story…" : "")}
            </div>
          )}
        </div>

        {/* ── Experience ──────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Experience</h2>
            {isOwn && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={openAddExp}>
                <Plus className="w-3.5 h-3.5" /> Add
              </Button>
            )}
          </div>

          {!experiences?.length ? (
            <p className="text-sm text-muted-foreground font-mono italic">
              {isOwn ? "Add work, education, projects, and more." : "Nothing here yet."}
            </p>
          ) : (
            <div className="relative border-l border-border ml-2 space-y-0">
              {experiences.map((exp) => (
                <div key={exp.id} className="relative pl-6 pb-6 last:pb-0 group">
                  {/* timeline dot */}
                  <span className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-border bg-background" />
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-mono leading-tight">{exp.title}</p>
                      <p className="text-sm text-muted-foreground font-mono">{exp.organization}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">
                        <span className="mr-2 inline-block px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase tracking-wide">{EXP_TYPE_LABELS[exp.experience_type]}</span>
                        {formatDate(exp.start_date)} — {exp.end_date ? formatDate(exp.end_date) : "Present"}
                      </p>
                      {exp.description && (
                        <p className="text-xs text-muted-foreground font-mono mt-1.5 whitespace-pre-wrap leading-relaxed">{exp.description}</p>
                      )}
                    </div>
                    {isOwn && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button onClick={() => openEditExp(exp)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteExp.mutate(exp.id)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </main>

      {/* ── Username edit dialog ─────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Username</label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="mt-1" />
            </div>
            {user?.email && (
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Email</label>
                <p className="text-sm font-mono mt-1">{user.email}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button disabled={!newUsername.trim() || newUsername === profile.username || updateUsername.isPending} onClick={() => updateUsername.mutate(newUsername.trim())}>
              {updateUsername.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Social links dialog ──────────────────────────────────────────── */}
      <Dialog open={socialOpen} onOpenChange={setSocialOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Social links</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {socialLinks.map(({ key, icon: Icon, placeholder }) => (
              <div key={key} className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <Input
                  placeholder={placeholder}
                  value={socialForm[key as keyof typeof socialForm]}
                  onChange={(e) => setSocialForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="font-mono text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => saveSocial.mutate(socialForm)} disabled={saveSocial.isPending}>
              {saveSocial.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Experience add/edit dialog ───────────────────────────────────── */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{editingExp ? "Edit experience" : "Add experience"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Title</label>
                <Input value={expForm.title} onChange={(e) => setExpForm((f) => ({ ...f, title: e.target.value }))} placeholder="Software Engineer" className="mt-1" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Organization</label>
                <Input value={expForm.organization} onChange={(e) => setExpForm((f) => ({ ...f, organization: e.target.value }))} placeholder="Acme Corp" className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Type</label>
                <Select value={expForm.experience_type} onValueChange={(v) => setExpForm((f) => ({ ...f, experience_type: v as any }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EXP_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Start date</label>
                <Input type="month" value={expForm.start_date} onChange={(e) => setExpForm((f) => ({ ...f, start_date: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">End date (leave blank for current)</label>
                <Input type="month" value={expForm.end_date} onChange={(e) => setExpForm((f) => ({ ...f, end_date: e.target.value }))} className="mt-1" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Description (optional)</label>
                <Textarea value={expForm.description} onChange={(e) => setExpForm((f) => ({ ...f, description: e.target.value }))} placeholder="What did you do?" className="mt-1 min-h-[80px] text-sm font-mono resize-none" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!expForm.title.trim() || !expForm.organization.trim() || !expForm.start_date || saveExp.isPending}
              onClick={() => saveExp.mutate()}
            >
              {saveExp.isPending ? "Saving…" : editingExp ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
