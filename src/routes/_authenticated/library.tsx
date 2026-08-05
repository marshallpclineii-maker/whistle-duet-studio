import { createFileRoute } from "@tanstack/react-router";
import { LibraryView } from "@/components/library/LibraryView";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({
    meta: [
      { title: "Whistle Library — WhistleDeck" },
      {
        name: "description",
        content: "Browse every whistle take you've recorded, grouped by the song it belongs to.",
      },
      { property: "og:title", content: "Whistle Library — WhistleDeck" },
      {
        property: "og:description",
        content: "Every whistle take you've recorded, grouped by song and ready to replay.",
      },
    ],
  }),
  component: LibraryView,
});
