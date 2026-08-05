import { createFileRoute } from "@tanstack/react-router";
import { LiveDeck } from "@/components/deck/LiveDeck";

export const Route = createFileRoute("/_authenticated/deck")({
  head: () => ({
    meta: [
      { title: "Live Deck — WhistleDeck" },
      {
        name: "description",
        content:
          "Always-listening whistle deck that records your whistling and tags it to the song playing on YouTube Music.",
      },
      { property: "og:title", content: "Live Deck — WhistleDeck" },
      {
        property: "og:description",
        content: "Record and tag your whistling in real time against the song you're playing.",
      },
    ],
  }),
  component: LiveDeck,
});
