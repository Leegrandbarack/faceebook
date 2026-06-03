import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, MoreHorizontal, MessageCircle, Users, Heart, Bell } from "lucide-react";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import MobileBottomNav from "@/components/dashboard/MobileBottomNav";
import { useNotifications } from "@/hooks/useNotifications";

const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} s`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} j`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} sem`;
  return `${Math.floor(diff / 2592000)} mois`;
};

const typeBadge = (type: string) => {
  if (type.includes("friend")) return { Icon: Users, bg: "bg-primary" };
  if (type.includes("like")) return { Icon: Heart, bg: "bg-destructive" };
  if (type.includes("message") || type.includes("comment")) return { Icon: MessageCircle, bg: "bg-green-500" };
  return { Icon: Bell, bg: "bg-muted-foreground" };
};

const Notifications = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState({ name: "Utilisateur", firstName: "U", avatar: "" });
  const [authors, setAuthors] = useState<Record<string, { name: string; avatar: string | null }>>({});
  const { notifications, markAllRead } = useNotifications(userId);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      setUserId(session.user.id);
      const { data: p } = await supabase.from("profiles").select("first_name, last_name, avatar_url").eq("user_id", session.user.id).maybeSingle();
      if (p) {
        const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Utilisateur";
        setUserInfo({ name, firstName: p.first_name || "U", avatar: p.avatar_url || "" });
      }
    })();
  }, [navigate]);

  useEffect(() => {
    const ids = [...new Set(notifications.map((n) => n.from_user_id).filter(Boolean))] as string[];
    if (ids.length === 0) return;
    supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", ids).then(({ data }) => {
      const map: Record<string, { name: string; avatar: string | null }> = {};
      (data || []).forEach((p) => {
        map[p.user_id] = {
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Utilisateur",
          avatar: p.avatar_url,
        };
      });
      setAuthors(map);
    });
  }, [notifications]);

  useEffect(() => { if (userId) markAllRead(); /* eslint-disable-next-line */ }, [userId]);

  if (!userId) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  const dayMs = 86400 * 1000;
  const recent = notifications.filter((n) => Date.now() - new Date(n.created_at).getTime() < dayMs);
  const earlier = notifications.filter((n) => Date.now() - new Date(n.created_at).getTime() >= dayMs);

  const renderItem = (n: typeof notifications[number], highlight: boolean) => {
    const author = n.from_user_id ? authors[n.from_user_id] : null;
    const { Icon, bg } = typeBadge(n.type);
    return (
      <div key={n.id} className={`px-4 py-3 flex gap-3 items-start ${highlight ? "bg-primary/5" : ""}`}>
        <div className="relative shrink-0">
          <Avatar className="w-14 h-14">
            <AvatarImage src={author?.avatar || undefined} />
            <AvatarFallback className="bg-muted font-bold">{(author?.name?.[0] || "?").toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className={`absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full ${bg} flex items-center justify-center border-2 border-background`}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] text-foreground leading-snug">
            {author && <span className="font-bold">{author.name} </span>}
            <span className="text-foreground/90">{n.message}</span>
          </p>
          <p className="text-[13px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
        </div>
        <button className="w-9 h-9 rounded-full hover:bg-muted flex items-center justify-center shrink-0">
          <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-16 lg:pb-0">
      <DashboardNavbar user={userInfo} />
      <div className="pt-[88px] lg:pt-14 max-w-2xl mx-auto">
        {notifications.length === 0 ? (
          <div className="py-20 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Aucune notification</p>
          </div>
        ) : (
          <>
            {recent.length > 0 && (
              <>
                <h2 className="px-4 pt-4 pb-1 text-[20px] font-extrabold text-foreground">Nouveau</h2>
                {recent.map((n) => renderItem(n, true))}
              </>
            )}
            {earlier.length > 0 && (
              <>
                <h2 className="px-4 pt-4 pb-1 text-[20px] font-extrabold text-foreground">Plus tôt</h2>
                {earlier.map((n) => renderItem(n, false))}
              </>
            )}
          </>
        )}
      </div>
      <MobileBottomNav />
    </div>
  );
};

export default Notifications;
