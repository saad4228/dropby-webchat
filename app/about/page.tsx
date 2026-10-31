import type { Metadata } from "next";
import CreatorPage from "../../components/creator-page";
export const metadata: Metadata = {
  title: "Mohammad Saad — The creator of DropBy",
  description:
    "Meet Mohammad Saad, the developer behind DropBy. Always curious, always building.",
};
export default function AboutPage() {
  return <CreatorPage />;
}
