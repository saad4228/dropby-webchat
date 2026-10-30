"use client";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { emojiGroups, allEmojis } from "../lib/emojis";
export function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const [group, setGroup] = useState(0),
    [search, setSearch] = useState("");
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close.current();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  const matches = search.trim()
    ? emojiGroups
        .filter((g) =>
          g.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .flatMap((g) => g.emojis)
    : emojiGroups[group].emojis;
  const emojis =
    search.trim() && matches.length === 0
      ? allEmojis.filter((e) => e.includes(search.trim()))
      : matches;
  return (
    <div className="emoji-picker" role="dialog" aria-label="Emoji picker">
      <header>
        <strong>A little expression</strong>
        <button onClick={onClose} aria-label="Close emoji picker">
          <X size={16} />
        </button>
      </header>
      <label className="emoji-search">
        <Search size={15} />
        <input
          placeholder="Search smileys, hearts, food…"
          aria-label="Search emojis"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <nav aria-label="Emoji categories">
        {emojiGroups.map((g, i) => (
          <button
            key={g.name}
            className={group === i && !search ? "selected" : ""}
            aria-label={g.name}
            title={g.name}
            onClick={() => {
              setGroup(i);
              setSearch("");
            }}
          >
            {g.icon}
          </button>
        ))}
      </nav>
      <small>
        {search ? "Search results" : emojiGroups[group].name}
        <span>{allEmojis.length}+ emojis</span>
      </small>
      <div className="emoji-picker-grid">
        {emojis.map((e) => (
          <button
            key={e}
            aria-label={"Insert " + e}
            onClick={() => onSelect(e)}
          >
            {e}
          </button>
        ))}
      </div>
      {emojis.length === 0 && <p>Try “hearts”, “nature”, “food” or “play”.</p>}
    </div>
  );
}
