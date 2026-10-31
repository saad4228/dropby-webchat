"use client";
import { useEffect, useState } from "react";
import Home from "./home";
import Chat from "./chat";
import Onboarding from "./onboarding";
import { Modal } from "./modal";
import { api, Identity, colors } from "../lib/client";
import { ArrowRight, Heart, ShieldCheck } from "lucide-react";
import { creator } from "../lib/creator";
export default function App() {
  const [user, setUser] = useState<Identity | null>(null),
    [room, setRoom] = useState(""),
    [demo, setDemo] = useState(false),
    [dark, setDark] = useState(false),
    [onboard, setOnboard] = useState<{ slug: string; create: boolean } | null>(
      null,
    ),
    [info, setInfo] = useState("");
  useEffect(() => {
    document.documentElement.dataset.ready = "true";
    try {
      setDark(localStorage.getItem("dropby-dark") === "true");
    } catch {}
    api("session")
      .then(async ({ user }) => {
        setUser(user);
        const slug = new URLSearchParams(location.search).get("room");
        if (slug) {
          if (user) {
            try {
              await api("rooms/" + encodeURIComponent(slug));
              setRoom(slug);
            } catch {
              setOnboard({ slug, create: false });
            }
          } else setOnboard({ slug, create: false });
        }
      })
      .catch(() => {});
    const pop = () => {
      const slug = new URLSearchParams(location.search).get("room");
      setRoom("");
      setDemo(false);
      if (slug) setOnboard({ slug, create: false });
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    try {
      localStorage.setItem("dropby-dark", String(dark));
    } catch {}
  }, [dark]);
  function joined(slug: string, identity: Identity) {
    setUser(identity);
    setDemo(false);
    setRoom(slug);
    setOnboard(null);
    history.pushState({}, "", "/?room=" + encodeURIComponent(slug));
  }
  const identity = user || {
    id: "demo-you",
    name: "You",
    avatar: "🏔️",
    color: colors[0],
  };
  return (
    <>
      {room || demo ? (
        <Chat
          key={(demo ? "demo:" : "") + room + identity.id}
          slug={demo ? "football-night" : room}
          user={identity}
          dark={dark}
          onDark={() => setDark((d) => !d)}
          onLeave={() => {
            setRoom("");
            setDemo(false);
            history.pushState({}, "", "/");
          }}
          onIdentity={() => setOnboard({ slug: room, create: false })}
          demo={demo}
          onCreate={() => setOnboard({ slug: "", create: true })}
        />
      ) : (
        <Home
          onJoin={(slug) => setOnboard({ slug, create: false })}
          onCreate={() => setOnboard({ slug: "", create: true })}
          onDemo={() => setDemo(true)}
          dark={dark}
          onDark={() => setDark((d) => !d)}
          onInfo={setInfo}
        />
      )}
      {onboard && (
        <Onboarding
          slug={onboard.slug}
          create={onboard.create}
          user={user}
          onClose={() => setOnboard(null)}
          onJoined={joined}
        />
      )}
      {info && (
        <Modal onClose={() => setInfo("")} className="info-modal">
          <span className="info-icon">
            {info === "Privacy" ? (
              <ShieldCheck size={28} />
            ) : (
              <Heart size={28} />
            )}
          </span>
          <h2>{info}</h2>
          {info === "Privacy" ? (
            <>
              <p>
                Your conversations are stored on our server and visible to
                authorized room members. DropBy does not provide end-to-end
                encryption.
              </p>
              <p>
                Guest sessions use an HttpOnly cookie that expires after 30
                days. Your appearance preferences stay on your device. Clearing
                browser data may lose your guest identity.
              </p>
              <p>
                Messages remain until deleted by you or a room moderator.
                Deleted attachments are removed from file storage. Private rooms
                require a password; share it only with people you trust.
              </p>
            </>
          ) : info === "Terms" ? (
            <>
              <p>
                Keep it kind. Don’t share illegal content, impersonate others,
                or upload files you don’t have permission to share.
              </p>
              <p>
                Room owners and moderators can remove messages, restrict
                messaging, and ban disruptive identities. Use the report action
                to bring a message to their attention.
              </p>
              <p>
                DropBy is an early release. Avoid using it for sensitive or
                emergency communication. Small-group calls support up to four
                participants and depend on your network and browser.
              </p>
            </>
          ) : info === "Contact" ? (
            <>
              <p>
                Have a question or an idea for DropBy? Get in touch with{" "}
                {creator.name}.
              </p>
              <a className="contact-email" href={"mailto:" + creator.email}>
                {creator.email}
                <ArrowRight size={16} />
              </a>
              <p>
                For issues inside a room, use Report on a message to contact
                that room’s moderators.
              </p>
              <a className="creator-contact-link" href="/about#contact">
                More about Saad & ways to connect <ArrowRight size={14} />
              </a>
            </>
          ) : (
            <>
              <p>
                DropBy is built around a simple idea: it should be easy to spend
                time with your people.
              </p>
              <p>
                No downloads or mandatory sign-up. Just a room, a link, and a
                little time together.
              </p>
              <span className="placeholder-label">
                Creator biography, GitHub, LinkedIn and portfolio: to be
                provided.
              </span>
            </>
          )}
          <button className="primary full" onClick={() => setInfo("")}>
            Sounds good <ArrowRight size={16} />
          </button>
        </Modal>
      )}
    </>
  );
}
