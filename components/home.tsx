"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Globe,
  Hash,
  Headphones,
  Heart,
  Link,
  Lock,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Smile,
  Sparkles,
  Sun,
  Moon,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { Brand, Avatar, Footer } from "./brand";
import { useState } from "react";
import { Modal } from "./modal";
export function DemoChat({
  theme = "alpine",
  onOpen,
}: {
  theme?: string;
  onOpen: () => void;
}) {
  return (
    <div className={"demo-wrap theme-" + theme}>
      <div className="demo-label">
        <span className="live-dot" /> A little preview of your next conversation
      </div>
      <div className="demo-chat">
        <header>
          <span className="room-emoji">⚽</span>
          <div>
            <strong>football-night</strong>
            <span>
              <i className="live-dot" /> Your people, in one place
            </span>
          </div>
          <div className="demo-header-actions">
            <Video size={19} />
            <Users size={18} />
            <MoreHorizontal size={20} />
          </div>
        </header>
        <div className="demo-conversation">
          <div className="date-label">Today, 8:24 PM</div>
          <div className="demo-msg">
            <Avatar name="Aarav" avatar="👨🏻" color="#d4a68f" />
            <div>
              <label>
                Aarav <span>8:24 PM</span>
              </label>
              <p>Match starts in 10 minutes! 🔥</p>
              <p className="small-bubble">Who’s watching?</p>
              <span className="demo-reaction">
                ❤️ 4 <span>🔥 3</span>
              </span>
            </div>
          </div>
          <div className="demo-out">
            <p>I’m here! Snacks are ready 🍿</p>
            <small>
              8:25 PM <CheckCheck size={13} />
            </small>
          </div>
          <div className="demo-msg photo-msg">
            <Avatar name="Zoya" avatar="👩🏽" color="#dbb5a0" />
            <div>
              <label>
                Zoya <span>8:25 PM</span>
              </label>
              <img
                src="/stadium.jpg"
                alt="Football stadium ready for the evening match"
              />
              <span className="demo-reaction">
                😍 6 <span>⚽ 4</span>
              </span>
            </div>
          </div>
          <div className="demo-msg voice-demo">
            <Avatar name="Manav" avatar="👨🏽‍🦱" color="#a6b7cc" />
            <div>
              <label>
                Manav <span>8:26 PM</span>
              </label>
              <button
                className="voice-bubble"
                onClick={onOpen}
                aria-label="Explore the conversation demo"
              >
                <Play size={13} fill="currentColor" />
                <span className="wave">
                  {Array.from({ length: 30 }, (_, i) => (
                    <i
                      key={i}
                      style={{
                        height:
                          Math.round(
                            8 + Math.sin(i * 2.7) * 8 + Math.cos(i) * 5,
                          ) + "px",
                      }}
                    />
                  ))}
                </span>
                <span>0:14</span>
              </button>
            </div>
          </div>
        </div>
        <button className="demo-composer" onClick={onOpen}>
          <Plus size={19} />
          <span>Say something nice...</span>
          <Smile size={18} />
          <Mic size={18} />
          <i>
            <ArrowRight size={17} />
          </i>
        </button>
      </div>
      <div className="floating-note note-top">
        <span>👋</span> No sign-up. Just show up.
      </div>
      <div className="floating-note note-bottom">
        <span className="note-heart">
          <Heart size={18} />
        </span>
        <div>
          A space that feels like you.<small>Your room. Your vibe.</small>
        </div>
        <Sparkles size={18} />
      </div>
    </div>
  );
}
export default function Home({
  onJoin,
  onCreate,
  onDemo,
  dark,
  onDark,
  onInfo,
}: {
  onJoin: (s: string) => void;
  onCreate: () => void;
  onDemo: () => void;
  dark: boolean;
  onDark: () => void;
  onInfo: (s: string) => void;
}) {
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [theme, setTheme] = useState("alpine");
  const [joinPrompt, setJoinPrompt] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const s = slug.trim().toLowerCase().replace(/\s+/g, "-");
    if (
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) ||
      s.length < 3 ||
      s.length > 48
    ) {
      setError("Enter a room name with 3–48 letters, numbers or hyphens.");
      return;
    }
    setJoinPrompt(false);
    onJoin(s);
  }
  return (
    <div className="homepage">
      <div className="home-scenery" />
      <nav className="home-nav">
        <Brand />
        <div className="nav-links">
          <a href="#features">The good stuff</a>
          <a href="#how-it-works">How it works</a>
          <a href="/about">Meet the creator</a>
        </div>
        <div className="nav-actions">
          <button
            className="icon-button"
            onClick={onDark}
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun size={19} /> : <Moon size={18} />}
          </button>
          <button
            className="nav-join"
            aria-label="Join a room"
            onClick={() => {
              setError("");
              setJoinPrompt(true);
            }}
          >
            <span className="nav-full">Join a room</span>
            <span className="nav-short">Join</span> <ArrowUpRight size={16} />
          </button>
          <button
            className="nav-create"
            onClick={onCreate}
            aria-label="Create a room"
          >
            <Plus size={15} />
            <span className="nav-full">Create a room</span>
            <span className="nav-short">Create</span>
          </button>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="live-dot" /> LESS SETUP. MORE CONNECTION.
            </div>
            <h1>
              Good conversations.
              <br />
              <span>Just a link away.</span>
            </h1>
            <p className="hero-description">
              A little space for your people. Chat, share, and hang out
              <br className="desktop-break" /> together — no downloads, no
              sign-ups, no fuss.
            </p>
            <form className="join-form" onSubmit={submit}>
              <div className="room-input">
                <Hash size={21} />
                <input
                  id="room-name"
                  placeholder="Give your room a name"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setError("");
                  }}
                  aria-label="Room name"
                  aria-describedby={error ? "room-error" : undefined}
                  maxLength={48}
                />
                <button type="submit">
                  Let’s go <ArrowRight size={17} />
                </button>
              </div>
              {error && (
                <span id="room-error" className="field-error">
                  {error}
                </span>
              )}
            </form>
            <div className="create-line">
              Got a fresh idea?{" "}
              <button onClick={onCreate}>
                Create a new room <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="hero-assurances">
              <span>
                <Check size={14} /> Free to drop in
              </span>
              <span>
                <Check size={14} /> No account needed
              </span>
              <span>
                <Check size={14} /> Yours to make
              </span>
            </div>
          </div>
          <DemoChat onOpen={onDemo} theme={theme} />
        </section>
        <section className="feature-strip" id="features">
          <div>
            <span className="feature-icon blue">
              <Zap size={21} />
            </span>
            <h3>From zero to hello.</h3>
            <p>
              Pick a name, share a link.
              <br />
              You’re already together.
            </p>
          </div>
          <div>
            <span className="feature-icon green">
              <ShieldCheck size={21} />
            </span>
            <h3>Your space. Your rules.</h3>
            <p>
              Go public or keep it private.
              <br />
              You decide who drops by.
            </p>
          </div>
          <div>
            <span className="feature-icon purple">
              <MessageCircle size={21} />
            </span>
            <h3>More than a message.</h3>
            <p>
              Photos, voice notes, video calls.
              <br />
              However you say it best.
            </p>
          </div>
          <div>
            <span className="feature-icon peach">
              <Globe size={21} />
            </span>
            <h3>Wherever you are.</h3>
            <p>
              On your phone or at your desk.
              <br />
              Your browser is all you need.
            </p>
          </div>
        </section>
        <section className="make-yours">
          <div>
            <span className="section-label">
              A ROOM WITH A LITTLE PERSONALITY
            </span>
            <h2>
              Your people.
              <br />
              Your kind of place.
            </h2>
            <p>
              Quiet catch-ups or match-night chaos.
              <br />
              Set the scene for whatever brings you together.
            </p>
            <div className="theme-samples">
              {[
                { id: "alpine", c: "#93b8d3", name: "Alpine" },
                { id: "lavender", c: "#b5a0dc", name: "Lavender" },
                { id: "ocean", c: "#75b7bd", name: "Ocean" },
                { id: "sunset", c: "#e8a585", name: "Sunset" },
                { id: "forest", c: "#91ac8d", name: "Forest" },
              ].map((t) => (
                <button
                  key={t.id}
                  aria-label={"Preview " + t.name + " theme"}
                  title={t.name}
                  style={{ background: t.c }}
                  className={theme === t.id ? "selected" : ""}
                  onClick={() => setTheme(t.id)}
                >
                  {theme === t.id && <Check size={15} />}
                </button>
              ))}
              <span>Find your vibe</span>
            </div>
            <button className="text-link" onClick={onCreate}>
              Make yourself at home <ArrowRight size={16} />
            </button>
          </div>
          <div className={"theme-preview theme-" + theme}>
            <div className="mini-room">
              <span>☕ &nbsp; the-little-things</span>
              <small>
                <span className="live-dot" /> A room for the everyday
              </small>
              <p>Same time, same place? 🌿</p>
              <p className="mini-out">Wouldn’t miss it. ☕</p>
              <div>
                <Heart size={14} /> The best plans start with a hello.
              </div>
            </div>
            <span className="theme-sticker">
              <Sparkles size={18} /> A whole new atmosphere.
            </span>
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <span className="section-label">
            REALLY, THAT’S ALL THERE IS TO IT
          </span>
          <h2>See you in three.</h2>
          <div className="steps">
            <div>
              <span>01</span>
              <h3>Find your little corner.</h3>
              <p>
                Create a room or join one.
                <br />A name is all it takes.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>02</span>
              <h3>Send a little invitation.</h3>
              <p>
                Copy your room’s link.
                <br />
                Send it to your favourite people.
              </p>
            </div>
            <ArrowRight />
            <div>
              <span>03</span>
              <h3>Make a little time.</h3>
              <p>
                Say hello. Share something.
                <br />
                Stay as long as you like.
              </p>
            </div>
          </div>
        </section>
        <a
          className="creator-section creator-link"
          id="about"
          href="/about"
          aria-label="About Mohammad Saad, creator of DropBy"
        >
          <span className="creator-avatar">MS</span>
          <div>
            <span className="section-label">A LITTLE ABOUT THE CREATOR</span>
            <h3>Mohammad Saad — the creator of DropBy.</h3>
            <p>
              A little about me and the idea behind DropBy. Always curious,
              always building.
            </p>
          </div>
          <span className="creator-link-arrow" aria-hidden="true">
            <ArrowUpRight size={21} />
          </span>
        </a>
      </main>
      <Footer onInfo={onInfo} />
      <div className="bottom-signature">
        A place to drop by. A reason to stay.
      </div>
      {joinPrompt && (
        <Modal className="join-room-modal" onClose={() => setJoinPrompt(false)}>
          <span className="section-label">YOUR PEOPLE ARE A ROOM AWAY</span>
          <h2>Join a room.</h2>
          <p>Enter the room name or use the name from your invitation.</p>
          <form onSubmit={submit}>
            <label className="input-label">
              Room name
              <div className="input-with-icon">
                <Hash size={18} />
                <input
                  aria-label="Room to join"
                  data-autofocus
                  placeholder="e.g. football-night"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setError("");
                  }}
                  maxLength={48}
                  aria-describedby={error ? "join-dialog-error" : undefined}
                />
              </div>
            </label>
            {error && (
              <p id="join-dialog-error" role="alert" className="field-error">
                {error}
              </p>
            )}
            <button type="submit" className="primary full">
              Continue to room <ArrowRight size={16} />
            </button>
          </form>
          <small>You can join with a nickname. No account needed.</small>
        </Modal>
      )}
    </div>
  );
}
