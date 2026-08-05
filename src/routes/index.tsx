import { createFileRoute, Link } from "@tanstack/react-router";
import { AudioLines, Layers, Radio, Scissors, SlidersHorizontal, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WhistleDeck — Record and remix your whistling" },
      {
        name: "description",
        content:
          "An always-listening whistle studio: capture your whistling along to YouTube Music, tag it to the song, then overdub, splice and reshape it with a full effects rack.",
      },
      { property: "og:title", content: "WhistleDeck — Record and remix your whistling" },
      {
        property: "og:description",
        content:
          "Capture whistling along to your music, tag it to the song, then overdub and splice it in a multitrack studio.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Radio,
    title: "Always listening",
    body: "Arm the deck and it starts recording the moment it hears a whistle in the 480–4200 Hz band, then stops when you do.",
  },
  {
    icon: AudioLines,
    title: "Song-linked takes",
    body: "Play the song in the in-app YouTube Music player and every take is stamped with the track and the exact timestamp.",
  },
  {
    icon: Layers,
    title: "Overdubbing",
    body: "Stack take on take across unlimited tracks — harmonies, counter-melodies, whistled bass lines.",
  },
  {
    icon: Scissors,
    title: "Splicing",
    body: "Cut a clip at the playhead, slide the halves around, trim, fade in and out, and rebuild the phrase.",
  },
  {
    icon: SlidersHorizontal,
    title: "Rack of real gear",
    body: "EQ, sweepable filter, reverb, delay, chorus, drive, compressor and gate — all live, all on knobs.",
  },
  {
    icon: Waves,
    title: "Whistle to instrument",
    body: "Flip a whistle into a flute, synth lead, bell, sub bass or choir, then bounce the whole mix to WAV.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-panel">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
            <AudioLines className="h-4 w-4" />
          </span>
          <span className="text-sm font-bold uppercase tracking-[0.2em]">WhistleDeck</span>
          <Link to="/auth" className="ml-auto">
            <Button size="sm">Open the deck</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <p className="readout text-xs uppercase tracking-[0.35em] text-primary">
            whistle capture • multitrack • effects
          </p>
          <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
            Your whistling, recorded against the songs you're already listening to.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground">
            WhistleDeck listens in the background while your music plays, captures every whistled
            phrase, and files it under the track it belongs to. Later, open the studio and turn
            those takes into something finished.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth">
              <Button size="lg" className="uppercase tracking-widest">
                Start recording
              </Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <article key={f.title} className="panel brushed p-5">
                <f.icon className="h-5 w-5 text-primary" />
                <h2 className="mt-3 text-sm font-semibold uppercase tracking-wider">{f.title}</h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>

          <p className="mx-auto mt-10 max-w-2xl text-center text-[11px] leading-relaxed text-muted-foreground">
            Browsers can't tap another app's audio directly, so the deck listens through your
            microphone — your whistle and the song coming out of your speaker land on the same
            take, perfectly in sync.
          </p>
        </section>
      </main>
    </div>
  );
}
