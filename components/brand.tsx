import { MessageCircle, ArrowUpRight } from "lucide-react";
export function BrandSymbol() {
  return (
    <span className="brand-symbol" aria-hidden="true">
      <MessageCircle size={25} fill="currentColor" strokeWidth={0} />
      <i />
    </span>
  );
}
export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button
      className="brand"
      onClick={
        onClick || (() => window.scrollTo({ top: 0, behavior: "smooth" }))
      }
      aria-label="DropBy home"
    >
      <BrandSymbol />
      <span>
        dropby<span className="brand-dot">.</span>
      </span>
    </button>
  );
}
export function Avatar({
  avatar,
  name,
  color,
  small = false,
}: {
  avatar?: string;
  name: string;
  color?: string;
  small?: boolean;
}) {
  return (
    <span
      className={"avatar " + (small ? "small" : "")}
      style={{ background: color ? color + "28" : undefined }}
      aria-label={name}
    >
      {avatar?.startsWith("media:") ? (
        <img
          src={"/api/media/" + encodeURIComponent(avatar.slice(6))}
          alt=""
          loading="lazy"
        />
      ) : (
        avatar || name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}
export function Footer({ onInfo }: { onInfo: (s: string) => void }) {
  return (
    <footer>
      <Brand />
      <span>A little closer, wherever you are.</span>
      <div>
        <a href="/about">About the creator</a>
        {["Privacy", "Terms", "Contact"].map((s) => (
          <button key={s} onClick={() => onInfo(s)}>
            {s}
          </button>
        ))}
        <span>
          Made for connection <ArrowUpRight size={13} />
        </span>
      </div>
    </footer>
  );
}
