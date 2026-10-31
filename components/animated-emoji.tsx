"use client";
import { useEffect, useRef, useState } from "react";
import {
  emojiMotion,
  emojiTokens,
  type EmojiMotion,
} from "../lib/emoji-motion";
import {
  emojiExpression,
  EMOJI_EXPRESSION_DURATION,
} from "../lib/emoji-expressions";
import { EmojiFace } from "./emoji-face";
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
export function EmojiGlyph({ emoji }: { emoji: string }) {
  return <span className="emoji-glyph">{emoji}</span>;
}
export function AnimatedEmoji({
  emoji,
  large = false,
  animateOnMount = true,
}: {
  emoji: string;
  large?: boolean;
  animateOnMount?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expressing, setExpressing] = useState(false),
    [run, setRun] = useState(0);
  const expression = emojiExpression(emoji);
  function stop() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    ref.current
      ?.querySelector(".emoji-glyph")
      ?.getAnimations()
      .forEach((a) => a.cancel());
    setExpressing(false);
  }
  function play() {
    const node = ref.current?.querySelector<HTMLElement>(".emoji-glyph");
    if (!node || !allowed(ref.current)) return;
    stop();
    setRun((r) => r + 1);
    setExpressing(true);
    if (!expression)
      node.animate(frames[emojiMotion(emoji)], {
        duration: EMOJI_EXPRESSION_DURATION / 2,
        easing: "cubic-bezier(.22,.7,.3,1)",
        iterations: 2,
      });
    timer.current = setTimeout(stop, EMOJI_EXPRESSION_DURATION);
  }
  useEffect(() => {
    const node = ref.current;
    if (animateOnMount) play();
    window.addEventListener("dropby:stop-emoji", stop);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      node
        ?.querySelector(".emoji-glyph")
        ?.getAnimations()
        .forEach((a) => a.cancel());
      window.removeEventListener("dropby:stop-emoji", stop);
    };
  }, [emoji, animateOnMount]);
  return (
    <button
      ref={ref}
      type="button"
      className={
        "animated-emoji " +
        (large ? "large-emoji " : "") +
        (expression ? "has-face" : "")
      }
      data-expressing={expressing ? "true" : undefined}
      aria-label={"Animate " + emoji}
      title="Tap to animate"
      onClick={(e) => {
        e.stopPropagation();
        play();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <EmojiGlyph emoji={emoji} />
      {expression && expressing && (
        <EmojiFace key={run} expression={expression} emoji={emoji} />
      )}
    </button>
  );
}
export function EmojiText({
  text,
  large = false,
  animateOnMount = true,
}: {
  text: string;
  large?: boolean;
  animateOnMount?: boolean;
}) {
  return (
    <>
      {emojiTokens(text).map((t, i) =>
        t.emoji ? (
          <AnimatedEmoji
            key={i + ":" + t.value}
            emoji={t.value}
            large={large}
            animateOnMount={animateOnMount}
          />
        ) : (
          t.value
        ),
      )}
    </>
  );
}
export function EmojiMotionControl({ enabled = true }: { enabled?: boolean }) {
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const stop = () => {
      if (!enabled || query.matches)
        window.dispatchEvent(new Event("dropby:stop-emoji"));
    };
    stop();
    query.addEventListener("change", stop);
    return () => query.removeEventListener("change", stop);
  }, [enabled]);
  return null;
}
