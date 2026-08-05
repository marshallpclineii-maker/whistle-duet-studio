import { createFileRoute } from "@tanstack/react-router";
import { StudioView } from "@/components/studio/StudioView";

export const Route = createFileRoute("/_authenticated/studio/$projectId")({
  head: () => ({
    meta: [
      { title: "Session — WhistleDeck Studio" },
      {
        name: "description",
        content:
          "Overdub layers, splice clips, shape effects and bounce your whistle session to a mix.",
      },
      { property: "og:title", content: "Session — WhistleDeck Studio" },
      {
        property: "og:description",
        content: "Overdub, splice and mix your whistle takes into a finished track.",
      },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const { projectId } = Route.useParams();
  return <StudioView projectId={projectId} />;
}
