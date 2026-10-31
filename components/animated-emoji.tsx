"use client";
import { useEffect, useRef, useState } from "react";
import {
  emojiMotion,
  emojiTokens,
  type EmojiMotion,
} from "../lib/emoji-motion";
const frames: Record<EmojiMotion, Keyframe[]> = {
  heartbeat: [
    { transform: "scale(1)" },
    { transform: "scale(1.28)", offset: 0.25 },
    { transform: "scale(1.04)", offset: 0.45 },
    { transform: "scale(1.2)", offset: 0.65 },
    { transform: "scale(1)" },
  ],
  bounce: [
    { transform: "translateY(0) scale(1)" },
    { transform: "translateY(-.34em) scale(1.12,.94)", offset: 0.3 },
    { transform: "translateY(.03em) scale(.95,1.08)", offset: 0.65 },
    { transform: "translateY(0) scale(1)" },
  ],
  spin: [
    { transform: "rotate(0) translateY(0)" },
    { transform: "rotate(180deg) translateY(-.18em)", offset: 0.5 },
    { transform: "rotate(360deg) translateY(0)" },
  ],
  float: [
    { transform: "translateY(0) rotate(0)" },
    { transform: "translateY(-.24em) rotate(-12deg)", offset: 0.35 },
    { transform: "translateY(-.12em) rotate(10deg)", offset: 0.7 },
    { transform: "translateY(0) rotate(0)" },
  ],
  celebrate: [
    { transform: "scale(1) rotate(0)" },
    { transform: "scale(1.3) rotate(-15deg)", offset: 0.25 },
    { transform: "scale(1.12) rotate(15deg)", offset: 0.55 },
    { transform: "scale(1.2) rotate(-7deg)", offset: 0.75 },
    { transform: "scale(1) rotate(0)" },
  ],
  wiggle: [
    { transform: "rotate(0) scale(1)" },
    { transform: "rotate(-18deg) scale(1.12)", offset: 0.25 },
    { transform: "rotate(16deg) scale(1.12)", offset: 0.5 },
    { transform: "rotate(-8deg)", offset: 0.75 },
    { transform: "rotate(0) scale(1)" },
  ],
  gleam: [
    { transform: "scale(1)", filter: "brightness(1)" },
    {
      transform: "scale(1.25) rotate(12deg)",
      filter: "brightness(1.2)",
      offset: 0.5,
    },
    { transform: "scale(1)", filter: "brightness(1)" },
  ],
};
function allowed(element?: Element | null) {
  return (
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
    !element?.closest(".motion-off")
  );
}
export function burstEmoji(emoji: string, element: Element) {
  if (!allowed(element)) return;
  const box = element.getBoundingClientRect();
  window.dispatchEvent(
    new CustomEvent("dropby:emoji-burst", {
      detail: { emoji, x: box.x + box.width / 2, y: box.y + box.height / 2 },
    }),
  );
}
export function EmojiGlyph({ emoji }: { emoji: string }) {
  return (
    <span className={"emoji-glyph emoji-motion-" + emojiMotion(emoji)}>
      {emoji}
    </span>
  );
}
export function AnimatedEmoji({
  emoji,
  large = false,
}: {
  emoji: string;
  large?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  function play() {
    const node = ref.current?.querySelector<HTMLElement>(".emoji-glyph");
    if (!node || !allowed(ref.current)) return;
    node.getAnimations().forEach((a) => a.cancel());
    node.animate(frames[emojiMotion(emoji)], {
      duration: emojiMotion(emoji) === "spin" ? 950 : 780,
      easing: "cubic-bezier(.22,.7,.3,1)",
      iterations: large ? 2 : 1,
    });
  }
  useEffect(() => {
    play();
    return () =>
      ref.current
        ?.querySelector(".emoji-glyph")
        ?.getAnimations()
        .forEach((a) => a.cancel());
  }, [emoji, large]);
  return (
    <button
      ref={ref}
      type="button"
      className={"animated-emoji " + (large ? "large-emoji" : "")}
      aria-label={"Animate " + emoji}
      title="Tap to animate"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") play();
      }}
      onClick={(e) => {
        e.stopPropagation();
        play();
        burstEmoji(emoji, e.currentTarget);
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <EmojiGlyph emoji={emoji} />
    </button>
  );
}
export function EmojiText({
  text,
  large = false,
}: {
  text: string;
  large?: boolean;
}) {
  return (
    <>
      {emojiTokens(text).map((t, i) =>
        t.emoji ? (
          <AnimatedEmoji
            key={i + ":" + t.value}
            emoji={t.value}
            large={large}
          />
        ) : (
          t.value
        ),
      )}
    </>
  );
}
type Burst = { id: number; emoji: string; x: number; y: number };
export function EmojiEffects({ enabled = true }: { enabled?: boolean }) {
  const [bursts, setBursts] = useState<Burst[]>([]),
    next = useRef(0),
    timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    if (!enabled) {
      setBursts([]);
      document
        .querySelectorAll(".chat-app.motion-off .emoji-glyph")
        .forEach((el) =>
          el.getAnimations().forEach((animation) => animation.cancel()),
        );
      return;
    }
    const listener = (event: Event) => {
      if (!allowed()) return;
      const detail = (event as CustomEvent).detail,
        id = next.current++;
      setBursts((b) => [...b.slice(-3), { ...detail, id }]);
      const timer = setTimeout(() => {
        setBursts((b) => b.filter((x) => x.id !== id));
        timers.current.delete(timer);
      }, 1450);
      timers.current.add(timer);
    };
    window.addEventListener("dropby:emoji-burst", listener);
    return () => {
      window.removeEventListener("dropby:emoji-burst", listener);
      timers.current.forEach(clearTimeout);
      timers.current.clear();
    };
  }, [enabled]);
  return (
    <div className="emoji-effects" aria-hidden="true">
      {bursts.map((b) => (
        <div
          className={"emoji-burst burst-" + emojiMotion(b.emoji)}
          key={b.id}
          style={{ left: b.x, top: b.y }}
        >
          <span className="burst-ring" />
          {Array.from({ length: 8 }, (_, i) => {
            const angle = (i * Math.PI) / 4,
              distance = 55 + (i % 3) * 18;
            return (
              <span
                className="emoji-particle"
                key={i}
                style={
                  {
                    "--dx": Math.cos(angle) * distance + "px",
                    "--dy": Math.sin(angle) * distance - 35 + "px",
                    "--turn": (i % 2 ? 30 : -30) + "deg",
                    "--delay": i * 18 + "ms",
                  } as React.CSSProperties
                }
              >
                {i % 3 === 0 ? "✨" : b.emoji}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
