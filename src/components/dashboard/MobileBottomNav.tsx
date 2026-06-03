import { Home, Users, MessageCircle, Bell, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const items = [
  { icon: Home, path: "/dashboard", label: "Accueil" },
  { icon: Users, path: "/friends", label: "Amis" },
  { icon: MessageCircle, path: "/messages", label: "Messages" },
  { icon: Bell, path: "/notifications", label: "Alertes" },
  { icon: User, path: "/profile", label: "Profil" },
];

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 h-14 bg-card border-t border-border flex items-center justify-around">
      {items.map((item) => {
        const isActive = location.pathname === item.path.split("?")[0];
        return (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              isActive ? "text-primary" : "text-muted-foreground"
            }`}
            aria-label={item.label}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;
