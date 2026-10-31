import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import "./refinements.css";
import "./polish.css";
import "./readability.css";
import "./expressive.css";
import "./emoji-expressions.css";
import "./creator.css";
import "./harmony.css";
import "./music.css";
import "./studio.css";
import "./love.css";
import "./football.css";
import "./arcade.css";
import "./cosmic.css";
import "./retreats.css";
import "./message-deletion.css";
import "./media.css";

export const metadata: Metadata = {
  title: "DropBy — Good conversations. Just a link away.",
  description:
    "A little space for your people. Create a room, share a link and make yourself at home. Chat, share and call from your browser.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          id="dropby-color-mode"
          dangerouslySetInnerHTML={{
            __html: `(function(){var dark=false;try{dark=localStorage.getItem("dropby-dark")==="true"}catch(e){}var root=document.documentElement;root.dataset.mode=dark?"dark":"light";root.style.colorScheme=dark?"dark":"light"})()`,
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
