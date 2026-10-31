import {
  MessageCircle,
  Search,
  Image,
  Pin,
  Users,
  ArrowLeft,
} from "lucide-react";
import { Avatar, BrandSymbol } from "./brand";
import type { Identity } from "../lib/client";
export function RoomRail({
  panel,
  user,
  onNavigate,
  onHome,
}: {
  panel: string;
  user: Identity;
  onNavigate: (panel: string) => void;
  onHome: () => void;
}) {
  const items = [
    ["", "Conversation", MessageCircle],
    ["search", "Search messages", Search],
    ["media", "Shared files", Image],
    ["pinned", "Saved pins", Pin],
    ["members", "Room members", Users],
  ] as const;
  return (
    <nav className="room-rail" aria-label="Room navigation">
      <button
        className="rail-home"
        onClick={onHome}
        aria-label="Go to DropBy home"
        title="DropBy home"
      >
        <BrandSymbol />
      </button>
      <span className="rail-divider" />
      <div className="rail-links">
        {items.map(([id, label, Icon]) => (
          <button
            className={"rail-item " + (panel === id ? "active" : "")}
            aria-label={label}
            aria-current={panel === id ? "page" : undefined}
            title={label}
            key={label}
            onClick={() => onNavigate(id)}
          >
            <Icon size={20} />
            <span className="rail-label">{label}</span>
          </button>
        ))}
      </div>
      <div className="rail-bottom">
        <button
          className="rail-profile"
          aria-label="Your profile and room options"
          title={user.name + " · Room options"}
          onClick={() => onNavigate("more")}
        >
          <Avatar name={user.name} avatar={user.avatar} color={user.color} />
          <i />
        </button>
        <button
          className="rail-exit"
          aria-label="Return to homepage"
          title="Back to home"
          onClick={onHome}
        >
          <ArrowLeft size={17} />
        </button>
      </div>
    </nav>
  );
}
