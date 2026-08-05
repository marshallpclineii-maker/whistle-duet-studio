# WhistleDeck — whistle recording studio synced to your music

A web app (works in the phone browser too) that listens for your whistling, records it, tags it to the song you were playing, and gives you a full multitrack studio to overdub, splice, and effect those whistle takes.

## One honest technical note first

YouTube Music and YouTube do not offer any public way for an outside app to read "what is playing right now" on your phone, and a browser cannot capture another app's audio output. So a true silent background hook into the YouTube Music app is not buildable. What is buildable — and what this plan does:

1. **Ambient listening.** The app's mic hears both your whistling *and* the music coming out of your phone speaker. That single capture keeps them naturally in sync.
2. **Track identification.** When a whistle session starts, the app prompts on screen: "Recording — what are you listening to?" You confirm/enter the track, or paste the YouTube / YouTube Music link. Recent tracks are one tap.
3. **In-app YouTube player (auto-tag path).** If you play the song through the app's built-in YouTube player instead, the app knows the exact title, video ID, and playback timestamp automatically and stamps every take with them — zero typing.

So: manual-confirm prompt for anything playing anywhere, and true automatic tagging when you play through the app. Pandora / Spotify / Apple Music slots are designed into the data model as future sources.

## Screens

**1. Live Deck (home)**
- Big arm/disarm mic control plus a manual Record button.
- Always-listening mode: continuous pitch analysis; a sustained clear tone in the whistle range (roughly 500–4000 Hz with stable pitch) arms and starts a take, and silence for a few seconds ends it. Sensitivity and silence-timeout sliders.
- Live waveform + spectrum + pitch trace while recording.
- "Now listening to" panel: embedded YouTube player, or the confirm-track prompt with recent tracks.
- Input meter, gain, monitor toggle.

**2. Library**
- All takes grouped by song, with cover art, date, duration, waveform thumbnail.
- Per song: every time you whistled along to it, so you can compare takes over time and see your pitch line against the track.
- Play a take with the YouTube track running underneath, aligned to the timestamp it was recorded at.

**3. Studio (multitrack)**
- Timeline with unlimited tracks, drag-positioned clips, snap, zoom, playhead, ruler.
- **Overdubbing**: record a new layer while the existing mix plays back, punch-in/punch-out.
- **Splicing**: split at playhead, trim handles, cut/copy/paste/duplicate, join, fades, crossfades, move clips between tracks.
- **Mixer**: per-track fader, pan, mute, solo, arm; master fader with output meters.
- **Effects rack** (per track + master): reverb, delay/echo, pitch shift, time stretch, EQ (low/mid/high), lo/hi-pass filter, distortion, chorus, compressor, gate, and whistle-to-instrument transforms (turn a whistle into synth lead, flute, bell, bass, choir via pitch tracking).
- **DJ deck**: two decks with crossfader, tempo/pitch slider, cue points, loop in/out, filter knob — for blending whistle takes with each other or the track.
- Export mixdown to WAV/MP3, save project state.

**4. Auth + account**
- Email/password and Google sign-in. Recordings, projects, and effect presets stored in your account so they follow you across phone and desktop.

## Look and feel

Dark studio console: matte charcoal panels, brushed-metal knob edges, amber/green VU-style meters, tactile faders, monospace numeric readouts. Physical hardware energy, not flat SaaS.

## Technical section

- **Capture**: Web Audio API `getUserMedia` + `MediaRecorder`; `AnalyserNode` + autocorrelation/YIN pitch detection on a worklet for whistle onset detection.
- **Editing/effects**: Web Audio graph — `AudioBufferSourceNode` per clip, `GainNode`, `StereoPannerNode`, `BiquadFilterNode`, `ConvolverNode` (reverb), `DelayNode`, `DynamicsCompressorNode`, `WaveShaperNode`; pitch shift and time stretch via a phase-vocoder AudioWorklet. Offline render for mixdown via `OfflineAudioContext`.
- **YouTube**: IFrame Player API for the in-app player (gives title, video ID, current time); oEmbed for metadata from a pasted link.
- **Backend (Lovable Cloud)**: auth; `recordings`, `takes`, `tracks`, `projects`, `project_clips`, `presets` tables, all RLS-scoped to the owner; audio files in a private storage bucket with signed URLs.
- **Stack**: TanStack Start routes — `/` Live Deck, `/library`, `/studio/$projectId`, `/auth`; studio routes under the authenticated layout.

## Build order

1. Cloud auth + schema + storage bucket.
2. Live Deck: mic capture, manual record, whistle auto-detect, track prompt + YouTube embed, save to cloud.
3. Library with per-song grouping and synced playback.
4. Studio: timeline, clips, overdub, splice, mixer.
5. Effects rack, whistle-to-instrument, DJ deck, export.
