import { useState, useEffect } from "react";
import { Search, MessageCircle, ChevronDown, Settings, LogOut, User, Home, Video, Store, Users, Menu, Plus, Bell, UserPlus } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import NotificationsDropdown from "./NotificationsDropdown";

interface DashboardNavbarProps {
  user: { name: string; firstName: string; avatar: string };
}

const DashboardNavbar = ({ user }: DashboardNavbarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const navItems = [
    { icon: Home, path: "/dashboard", label: "Accueil" },
    { icon: Users, path: "/friends", label: "Amis" },
    { icon: Video, path: "#", label: "Vidéos" },
    { icon: Store, path: "/users", label: "Utilisateurs" },
  ];

  const mobileTabs: { icon: typeof Home; path: string; label: string; badge?: string }[] = [
    { icon: Home, path: "/dashboard", label: "Accueil" },
    { icon: Video, path: "#", label: "Reels" },
    { icon: UserPlus, path: "/friends", label: "Amis" },
    { icon: Store, path: "/users", label: "Marketplace" },
    { icon: Bell, path: "/notifications", label: "Notifications" },
    { icon: Menu, path: "/settings", label: "Menu" },
  ];

  return (
    <>
      {/* ---------- MOBILE HEADER (Nexora style) ---------- */}
      <nav className="lg:hidden fixed top-0 inset-x-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <button onClick={() => navigate("/dashboard")} className="text-[28px] font-extrabold text-primary tracking-tight leading-none">
            Nexora
          </button>
          <div className="flex items-center gap-2">
            <button className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Plus className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button onClick={() => navigate("/users")} className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Search className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <button onClick={() => navigate("/messages")} className="relative w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <MessageCircle className="w-5 h-5" strokeWidth={2.5} />
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">5</span>
            </button>
            <button onClick={() => navigate("/profile")} aria-label="Mon profil" className="rounded-full">
              <Avatar className="w-9 h-9">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback>{user.firstName[0]}</AvatarFallback>
              </Avatar>
            </button>
          </div>
        </div>
        <div className="flex items-center justify-around px-1">
          {mobileTabs.map((t) => {
            const isActive = t.path === "/dashboard" && location.pathname === "/dashboard";
            return (
              <button
                key={t.label}
                onClick={() => t.path.startsWith("/") && navigate(t.path)}
                className={`relative flex-1 flex items-center justify-center h-11 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                aria-label={t.label}
              >
                <t.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                {t.badge && (
                  <span className="absolute top-1 right-1/2 translate-x-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[20px] h-[18px] px-1 flex items-center justify-center">
                    {t.badge}
                  </span>
                )}
                {isActive && <span className="absolute bottom-0 inset-x-3 h-[3px] bg-primary rounded-t-full" />}
              </button>
            );
          })}
        </div>
      </nav>

      {/* ---------- DESKTOP HEADER ---------- */}
      <nav className="hidden lg:block fixed top-0 left-0 right-0 z-50 h-14 bg-card shadow-sm border-b border-border">
        <div className="h-full flex items-center justify-between px-4 max-w-[1920px] mx-auto gap-2">
          <div className="flex items-center gap-2 w-[280px] shrink-0">
            <button onClick={() => navigate("/dashboard")} className="text-2xl font-extrabold text-primary tracking-tight">
              Nexora
            </button>
            <div className={`relative transition-all duration-200 ${searchFocused ? "w-64" : "w-56"}`}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher sur Nexora"
                className="pl-9 h-9 rounded-full bg-muted border-0 text-sm focus-visible:ring-1"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>
          </div>

          <div className="flex items-center gap-1 flex-1 justify-center max-w-[500px]">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.label}
                  onClick={() => item.path !== "#" && navigate(item.path)}
                  className={`relative flex items-center justify-center h-12 px-8 rounded-lg transition-all duration-200 group ${
                    isActive ? "text-primary" : "text-muted-foreground hover:bg-muted"
                  }`}
                  title={item.label}
                >
                  <item.icon className={`w-6 h-6 transition-transform group-hover:scale-110 ${isActive ? "text-primary" : ""}`} />
                  {isActive && <span className="absolute bottom-0 inset-x-2 h-[3px] bg-primary rounded-t-full" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 w-[280px] justify-end shrink-0">
            <button
              onClick={() => navigate("/messages")}
              className="relative w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors group"
            >
              <MessageCircle className="w-5 h-5 text-foreground group-hover:scale-110 transition-transform" />
            </button>

            {userId && <NotificationsDropdown userId={userId} />}

            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1 p-1 rounded-full hover:bg-muted transition-colors"
              >
                <Avatar className="w-9 h-9">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>{user.firstName[0]}</AvatarFallback>
                </Avatar>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`} />
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-72 bg-card rounded-xl shadow-xl border border-border z-50 animate-scale-in overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <div
                        onClick={() => { setMenuOpen(false); navigate("/profile"); }}
                        className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback>{user.firstName[0]}</AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground">{user.name}</span>
                      </div>
                    </div>
                    <div className="p-2">
                      <button onClick={() => { setMenuOpen(false); navigate("/profile"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><User className="w-4 h-4" /></div>
                        <span className="text-sm font-medium text-foreground">Mon profil</span>
                      </button>
                      <button onClick={() => { setMenuOpen(false); navigate("/settings"); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><Settings className="w-4 h-4" /></div>
                        <span className="text-sm font-medium text-foreground">Paramètres</span>
                      </button>
                      <button
                        onClick={async () => {
                          await supabase.auth.signOut();
                          navigate("/login");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"><LogOut className="w-4 h-4" /></div>
                        <span className="text-sm font-medium text-foreground">Déconnexion</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default DashboardNavbar;
