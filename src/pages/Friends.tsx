import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import { toast } from "sonner";

interface UserProfile {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  created_at: string;
  profile?: UserProfile;
}

type Chip = "online" | "suggestions" | "friends";

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} sem`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)} mois`;
  return `${Math.floor(diff / 31536000)} a`;
};

const Friends = () => {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [chip, setChip] = useState<Chip>("suggestions");
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendRequest[]>([]);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [removedSuggestions, setRemovedSuggestions] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [userInfo, setUserInfo] = useState({ name: "Utilisateur", firstName: "U", avatar: "" });
  const navigate = useNavigate();

  const fetchData = useCallback(async (userId: string) => {
    const [{ data: incoming }, { data: accepted }, { data: sent }, { data: presence }] = await Promise.all([
      supabase.from("friendships").select("*").eq("addressee_id", userId).eq("status", "pending"),
      supabase.from("friendships").select("*").eq("status", "accepted").or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      supabase.from("friendships").select("*").eq("requester_id", userId).eq("status", "pending"),
      supabase.from("user_presence").select("user_id").eq("is_online", true),
    ]);

    const sentSet = new Set((sent || []).map((s) => s.addressee_id));
    setSentRequests(sentSet);
    setOnlineCount((presence || []).filter((p) => p.user_id !== userId).length);

    const ids = new Set<string>();
    (incoming || []).forEach((r) => ids.add(r.requester_id));
    (accepted || []).forEach((r) => ids.add(r.requester_id === userId ? r.addressee_id : r.requester_id));

    let pmap = new Map<string, UserProfile>();
    if (ids.size > 0) {
      const { data: profs } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, bio").in("user_id", [...ids]);
      pmap = new Map((profs || []).map((p) => [p.user_id, p]));
    }

    setRequests((incoming || []).map((r) => ({ ...r, profile: pmap.get(r.requester_id) })).filter((r) => r.profile?.first_name));
    setFriends((accepted || []).map((r) => {
      const o = r.requester_id === userId ? r.addressee_id : r.requester_id;
      return { ...r, profile: pmap.get(o) };
    }).filter((r) => r.profile?.first_name));

    const exclude = new Set<string>([userId]);
    (incoming || []).forEach((r) => exclude.add(r.requester_id));
    (accepted || []).forEach((r) => { exclude.add(r.requester_id); exclude.add(r.addressee_id); });
    sentSet.forEach((id) => exclude.add(id));

    const { data: all } = await supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, bio").not("first_name", "is", null).neq("first_name", "");
    setSuggestions((all || []).filter((p) => !exclude.has(p.user_id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setCurrentUserId(session.user.id);
      const { data: profile } = await supabase.from("profiles").select("first_name, last_name, avatar_url").eq("user_id", session.user.id).maybeSingle();
      if (profile) {
        const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Utilisateur";
        setUserInfo({ name, firstName: profile.first_name || "U", avatar: profile.avatar_url || "" });
      }
      fetchData(session.user.id);
    })();
  }, [navigate, fetchData]);

  const mark = (id: string, on: boolean) => setProcessing((p) => { const n = new Set(p); on ? n.add(id) : n.delete(id); return n; });

  const accept = async (req: FriendRequest) => {
    mark(req.id, true);
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", req.id);
    await supabase.from("notifications").insert({
      user_id: req.requester_id, type: "friend_accepted",
      message: "a accepté votre demande d'ami", from_user_id: currentUserId!, reference_id: req.id,
    });
    toast.success(`Vous êtes ami(e) avec ${req.profile?.first_name} !`);
    if (currentUserId) fetchData(currentUserId);
    mark(req.id, false);
  };

  const reject = async (req: FriendRequest) => {
    mark(req.id, true);
    await supabase.from("friendships").delete().eq("id", req.id);
    setRequests((p) => p.filter((r) => r.id !== req.id));
    mark(req.id, false);
  };

  const sendReq = async (uid: string) => {
    if (!currentUserId) return;
    mark(uid, true);
    const { data, error } = await supabase.from("friendships").insert({ requester_id: currentUserId, addressee_id: uid }).select().single();
    if (!error && data) {
      await supabase.from("notifications").insert({
        user_id: uid, type: "friend_request",
        message: "vous a envoyé une demande d'ami", from_user_id: currentUserId, reference_id: data.id,
      });
      setSentRequests((p) => new Set(p).add(uid));
      toast.success("Demande envoyée");
    }
    mark(uid, false);
  };

  const dismiss = (uid: string) => setRemovedSuggestions((p) => new Set(p).add(uid));

  const getName = (p?: UserProfile) => p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Utilisateur" : "Utilisateur";

  const chips: { key: Chip; label: string; dot?: boolean }[] = [
    { key: "online", label: `${onlineCount} en ligne`, dot: true },
    { key: "suggestions", label: "Suggestions" },
    { key: "friends", label: "Vos ami(e)s" },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const visibleSuggestions = suggestions.filter((s) => !removedSuggestions.has(s.user_id));
  const showRequests = chip === "suggestions" && requests.length > 0;

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <DashboardNavbar user={userInfo} />
      <div className="pt-[88px] lg:pt-14 max-w-2xl mx-auto">
        {/* Chips row */}
        <div className="flex items-center gap-2 px-3 py-3 overflow-x-auto no-scrollbar">
          {chips.map((c) => (
            <button
              key={c.key}
              onClick={() => setChip(c.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 h-9 rounded-full text-[15px] font-semibold transition-colors ${
                chip === c.key ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
              }`}
            >
              {c.dot && <span className="w-2 h-2 rounded-full bg-green-500" />}
              {c.label}
            </button>
          ))}
        </div>
        <div className="h-px bg-border" />

        {/* Invitations header (only on suggestions tab, like FB) */}
        {showRequests && (
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <h2 className="text-[20px] font-extrabold text-foreground">
              Invitations <span className="text-destructive">{requests.length}</span>
            </h2>
            <button className="text-primary text-[15px] font-semibold">Voir tout</button>
          </div>
        )}

        {/* INVITATIONS LIST */}
        {showRequests && (
          <div>
            {requests.map((req, i) => {
              const name = getName(req.profile);
              const isProc = processing.has(req.id);
              return (
                <div key={req.id} className={`px-4 py-3 flex gap-3 ${i === 0 ? "bg-primary/5" : ""}`}>
                  <button onClick={() => navigate(`/profile/${req.requester_id}`)} className="shrink-0">
                    <Avatar className="w-[88px] h-[88px]">
                      <AvatarImage src={req.profile?.avatar_url || undefined} />
                      <AvatarFallback className="text-2xl font-bold bg-muted">{name[0]}</AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-[17px] truncate">{name}</p>
                    <p className="text-[13px] text-muted-foreground mt-0.5">{timeAgo(req.created_at)}</p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => accept(req)}
                        disabled={isProc}
                        className="flex-1 h-9 rounded-md bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] disabled:opacity-60"
                      >
                        {isProc ? "..." : "Confirmer"}
                      </button>
                      <button
                        onClick={() => reject(req)}
                        disabled={isProc}
                        className="flex-1 h-9 rounded-md bg-muted text-foreground font-semibold text-[15px] active:scale-[0.98]"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="h-2 bg-muted/60" />
          </div>
        )}

        {/* SUGGESTIONS */}
        {chip === "suggestions" && (
          <>
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[20px] font-extrabold text-foreground">Personnes que vous pourriez connaître</h2>
            </div>
            {visibleSuggestions.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Aucune suggestion</p>
            ) : (
              visibleSuggestions.map((u) => {
                const name = getName(u);
                const isProc = processing.has(u.user_id);
                const isSent = sentRequests.has(u.user_id);
                return (
                  <div key={u.user_id} className="px-4 py-3 flex gap-3">
                    <button onClick={() => navigate(`/profile/${u.user_id}`)} className="shrink-0">
                      <Avatar className="w-[88px] h-[88px]">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-2xl font-bold bg-muted">{name[0]}</AvatarFallback>
                      </Avatar>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground text-[17px] truncate">{name}</p>
                      {u.bio && <p className="text-[13px] text-muted-foreground truncate mt-0.5">{u.bio}</p>}
                      <div className="mt-2 space-y-2">
                        {isSent ? (
                          <button disabled className="w-full h-9 rounded-md bg-muted text-muted-foreground font-semibold text-[15px]">
                            Demande envoyée
                          </button>
                        ) : (
                          <button
                            onClick={() => sendReq(u.user_id)}
                            disabled={isProc}
                            className="w-full h-9 rounded-md bg-primary text-primary-foreground font-semibold text-[15px] active:scale-[0.98] disabled:opacity-60"
                          >
                            {isProc ? "..." : "Ajouter ami(e)"}
                          </button>
                        )}
                        <button
                          onClick={() => dismiss(u.user_id)}
                          className="w-full h-9 rounded-md bg-muted text-foreground font-semibold text-[15px] active:scale-[0.98]"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* FRIENDS LIST */}
        {chip === "friends" && (
          <div>
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[20px] font-extrabold text-foreground">Vos ami(e)s · {friends.length}</h2>
            </div>
            {friends.length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Aucun ami pour le moment</p>
            ) : friends.map((f) => {
              const name = getName(f.profile);
              const otherId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
              return (
                <button key={f.id} onClick={() => navigate(`/profile/${otherId}`)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 text-left">
                  <Avatar className="w-14 h-14">
                    <AvatarImage src={f.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted font-bold">{name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-foreground text-[16px]">{name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* ONLINE */}
        {chip === "online" && (
          <div>
            <div className="px-4 pt-4 pb-2">
              <h2 className="text-[20px] font-extrabold text-foreground">Ami(e)s en ligne</h2>
            </div>
            {friends.filter((f) => f.profile).length === 0 ? (
              <p className="text-center text-muted-foreground py-10 text-sm">Personne en ligne</p>
            ) : friends.map((f) => {
              const name = getName(f.profile);
              const otherId = f.requester_id === currentUserId ? f.addressee_id : f.requester_id;
              return (
                <button key={f.id} onClick={() => navigate(`/profile/${otherId}`)} className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 text-left">
                  <div className="relative">
                    <Avatar className="w-14 h-14">
                      <AvatarImage src={f.profile?.avatar_url || undefined} />
                      <AvatarFallback className="bg-muted font-bold">{name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-background" />
                  </div>
                  <span className="font-semibold text-foreground text-[16px]">{name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <MobileBottomNav />
      <style>{`.no-scrollbar::-webkit-scrollbar{display:none}.no-scrollbar{scrollbar-width:none}`}</style>
    </div>
  );
};

export default Friends;
