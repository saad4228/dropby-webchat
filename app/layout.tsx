import type { Metadata } from "next";
import "./globals.css";
import "./fonts.css";
import "./refinements.css";
import "./polish.css";

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
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
