"use client";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Code2,
  Heart,
  Camera,
  BriefcaseBusiness,
  Mail,
  MessageCircle,
  Moon,
  Sun,
} from "lucide-react";
import { Brand } from "./brand";
import { creator } from "../lib/creator";
export default function CreatorPage() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.dataset.ready = "true";
    try {
      setDark(localStorage.getItem("dropby-dark") === "true");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.dataset.mode = dark ? "dark" : "light";
    try {
      localStorage.setItem("dropby-dark", String(dark));
    } catch {}
  }, [dark]);
  return (
    <div className="creator-page">
      <div className="creator-scenery" />
      <nav className="creator-nav">
        <Brand onClick={() => location.assign("/")} />
        <div>
          <a href="/" className="creator-home-link">
            <ArrowLeft size={15} />
            Back to DropBy
          </a>
          <button
            className="icon-button"
            aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <Sun size={19} /> : <Moon size={18} />}
          </button>
        </div>
      </nav>
      <main>
        <section className="creator-hero">
          <div className="creator-story">
            <span className="section-label">
              <span className="live-dot" /> THE PERSON BEHIND THE LITTLE BLUE
              BUBBLE
            </span>
            <p className="creator-hello">Mohammad Saad</p>
            <h1>
              Curious by nature.
              <br />
              <span>Always building.</span>
            </h1>
            <p className="creator-full-name">
              {creator.name} <span>·</span> Developer & creator of DropBy
            </p>
            <p className="creator-bio">{creator.bio}</p>
            <a
              className="creator-email-action"
              href={"mailto:" + creator.email}
            >
              <Mail size={17} />
              Say hello
              <ArrowUpRight size={17} />
            </a>
          </div>
          <aside className="creator-profile-card">
            <div
              className="creator-monogram"
              aria-label="Mohammad Saad initials"
            >
              <span>MS</span>
              <i>
                <Code2 size={19} />
              </i>
            </div>
            <h2>{creator.name}</h2>
            <p>
              A developer who enjoys turning ideas
              <br />
              into meaningful digital experiences.
            </p>
            <div className="creator-socials">
              <a
                href={creator.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Saad on Instagram"
              >
                <Camera size={19} />
                <span>
                  Instagram<small>{creator.instagramHandle}</small>
                </span>
                <ArrowUpRight size={16} />
              </a>
              <a
                href={creator.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Saad on LinkedIn"
              >
                <BriefcaseBusiness size={19} />
                <span>
                  LinkedIn<small>Let’s connect</small>
                </span>
                <ArrowUpRight size={16} />
              </a>
            </div>
            <span className="creator-signature">
              <Heart size={13} /> Always curious, always building.
            </span>
          </aside>
        </section>
        <section className="creator-project">
          <div className="creator-project-icon">
            <MessageCircle size={32} />
          </div>
          <div>
            <span className="section-label">
              THE IDEA THAT BROUGHT YOU HERE
            </span>
            <h2>
              A little less setup.
              <br />A lot more connection.
            </h2>
            <p>
              I created DropBy with a simple goal: make connecting with people
              online feel effortless, natural and enjoyable. One room, one link,
              and a space that feels like you.
            </p>
            <a href="/">
              Take a look at DropBy
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="creator-project-note">
            <span>👋</span>
            <p>
              “Good conversations.
              <br />
              Just a link away.”
            </p>
            <small>DropBy, built by Saad.</small>
          </div>
        </section>
        <section className="creator-contact" id="contact">
          <span className="section-label">
            A GOOD CONVERSATION STARTS SOMEWHERE
          </span>
          <h2>Have an idea? Just say hello.</h2>
          <a href={"mailto:" + creator.email}>
            {creator.email}
            <ArrowUpRight size={21} />
          </a>
          <p>
            You can also find me on{" "}
            <a
              href={creator.instagram}
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram
            </a>{" "}
            and{" "}
            <a
              href={creator.linkedin}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            .
          </p>
        </section>
      </main>
      <footer className="creator-footer">
        <a href="/">← Back to DropBy</a>
        <span>Made by {creator.name}.</span>
        <a href={"mailto:" + creator.email}>
          Get in touch
          <ArrowUpRight size={12} />
        </a>
      </footer>
    </div>
  );
}
