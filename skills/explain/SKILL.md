---
name: explain
description: "Explains one concept at a chosen depth: five (a five-year-old), junior (a junior dev, the default), non-dev (a smart non-engineer), or teammate (an experienced dev new to this codebase). Slash-command only, via /okay:explain."
argument-hint: "[five | junior (default) | non-dev | teammate] <topic>"
disable-model-invocation: true
---

Explain the topic at hand at the requested level. The argument picks the listener; default to `junior` if no level is given. Each level changes WHO you're talking to — match their vocabulary, what they already know, and what they need.

Write every message in ASD-STE100 Simplified Technical English — see `reference-asd-ste100.md` in this folder. Short sentences. One idea per sentence. Active voice. Plain words. The level voice below sets vocabulary depth, analogy use, and code-or-no-code; these sentence and word rules apply on top of it.

## Levels

### `five` — a curious, bright five-year-old
They are smart — they just haven't learned the big words yet.

- **Simple words only.** Use the simpler version of every word. "Start" not "initialise". "Broken" not "corrupted". Explain any technical term in one plain sentence.
- **Analogies are the main tool.** Every concept has a real-world twin a child knows. Use it. Don't explain how it breaks down.
- **Emojis illustrate, not decorate.** One per idea, next to the thing it represents.
- **Short sentences.** One idea each, ≤15 words.
- **Warm and curious.** This isn't dumbing down — it's the clearest path to understanding.

#### Analogy bank (starting points)

| Concept | Analogy |
|---------|---------|
| An API | A restaurant menu 🍔 — you pick what you want, the kitchen makes it |
| A database | A big filing cabinet 🗂️ — every drawer is labelled so you find things fast |
| A bug | A spelling mistake in a recipe 🍰 — wrong steps, wrong cake |
| Memory (RAM) | Your desk 🖥️ — stuff you use right now; gone when you go home |
| A hard drive | Your backpack 🎒 — stuff you keep even when the laptop's closed |
| An app crashing | A toy that quits when you press too many buttons at once 🧸 |
| Encryption | A secret language 🔐 — only people with the decoder ring can read it |
| A protocol | Rules for a game 🎲 — everyone follows them or the game breaks |
| Async/await | Ordering pizza 🍕 — place the order, do other things, come back when ready |
| A loop | A song on repeat 🎵 — the same part plays until you say stop |

### `junior` — a junior dev or intern (DEFAULT)
They code a little and know the basics: variable, function, API, request. Treat them as capable, not as a child.

- **Real terms, defined once.** Use proper names (cache, race condition, idempotent) and give a one-line definition the first time.
- **One analogy if it helps**, then drop it and talk about the real thing.
- **Show the "why," not just the "what."** Explain the problem the concept solves and the tradeoff it makes.
- **A short code or pseudo-code snippet is welcome** when it makes the point faster than prose.
- **No deep architecture or theory** unless asked. Keep it to what they'd use this week.

### `non-dev` — a sharp adult who doesn't code
Plain English, no coding background, full intelligence. Think product manager, designer, or curious friend.

- **No jargon.** If a technical term is unavoidable, translate it immediately into business or everyday terms.
- **Frame around impact:** what it does, why it matters, what happens if it goes wrong.
- **Light analogies are fine**, but lead with the real-world consequence, not the metaphor.
- **No code.** Diagrams-in-words and concrete examples instead.
- **Respect their intelligence** — they grasp complex ideas, they just don't speak the tech dialect.

### `teammate` — an experienced dev new to THIS codebase or domain
They know software cold. They do NOT know our specific code, conventions, history, or domain.

- **Skip the fundamentals.** Don't explain what a queue or a migration is.
- **Explain the specifics:** how WE do it here, why it's set up this way, what's load-bearing, what's a landmine.
- **Name the files, modules, and conventions** involved. Point to where things live.
- **Surface the non-obvious:** gotchas, past decisions, things that look wrong but aren't.
- **Be direct and dense.** They want the map, not a lecture.

## Format

Give the explanation first — no preamble, no "great question!". Match the level's voice throughout. At the end, offer to adjust: for `five`, "Want me to go deeper on any part? 🙂"; for the others, "Want this at a different level, or deeper on any part?"
