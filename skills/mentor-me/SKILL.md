---
name: mentor-me
description: "Runs a long-haul learning workspace in plain markdown, across many sessions. Sets a mission, curates trusted sources, writes short lessons, drills you in chat, and records what you learned. Use it for a skill you build over weeks, not one resource in one sitting. Slash-command only, via /okay:mentor-me."
argument-hint: "<topic>"
disable-model-invocation: true
---

Goal: teach one skill over many sessions. The current directory IS the workspace. Every file is plain markdown.

Use `okay:teach-me` for one resource in one sitting. Use this skill for a skill the user builds over weeks.

## Hard rules
- **Plain markdown only.** No HTML. No CSS. No quiz widgets. No simulators. Lessons and notes are `.md` files. Practice happens in the chat, not in a file.
- **Teach the next thing only.** Pick the step that is just hard enough. Never dump the whole field.
- **Default every check to multiple choice.** Use one `AskUserQuestion` call with 3 options and one correct answer — the same width as `okay:quiz-me`, which this skill hands off to. `AskUserQuestion` caps options at 4 and adds "Other" itself, so 3 keeps the interaction clean. This covers "what does this code print" checks too. Fall back to free recall only when the task is open-ended, such as writing real code.
- **Never overwrite a mission.** One workspace holds one mission.
- **Write every message in ASD-STE100 Simplified Technical English** — see `reference-asd-ste100.md` in this folder. Short sentences. One idea per sentence. Active voice. Plain words.
- These rules are unconditional. Trim or brief communication modes compress prose, never pacing or interaction gates.

## Philosophy

- **Three pillars.** Knowledge comes from trusted sources. Skills come from effortful practice. Wisdom comes from a real community.
- **Storage beats fluency.** Re-reading feels productive. It fades. Retention comes from difficulty the user wants: retrieval, spacing, and mixed topics. Make the user recall. Do not make the user review.
- **Zone of proximal development.** Read `MISSION.md` and `learning-records/` to find the next step. Teach that step.

## Workspace files

Create each file only when you first need it. See `FORMATS.md` in this folder for each format.

- `MISSION.md` — why the user learns this. It is the compass for every decision.
- `RESOURCES.md` — trusted sources (Knowledge) and communities (Wisdom).
- `GLOSSARY.md` — the canonical vocabulary. Add a term only after the user understands it.
- `lessons/NNNN-slug.md` — self-contained teaching units, numbered in order.
- `learning-records/NNNN-slug.md` — short notes that record evidence of understanding, prior knowledge, and corrected mistakes.
- `NOTES.md` — user preferences and working notes.

## Step 1 — Pick the flow

Look at the current directory:

Test the branches in this order and take the first that matches. They are not exclusive on their own.

1. **`MISSION.md` exists, and the user named a topic that `MISSION.md` does not cover** → stop. Compare the named topic against the mission statement inside `MISSION.md`, not against the folder name. This folder holds another mission. Ask the user to continue the existing mission, or to start the new topic in a new directory. Never overwrite `MISSION.md`.
2. **`MISSION.md` exists** → run **Each session**.
3. **No `MISSION.md`, but `lessons/` or `learning-records/` holds files** → stop. The workspace is half-built, or it belongs to a mission whose `MISSION.md` was deleted. Starting a First session here would number new lessons on top of the old ones. Say what you found. Ask the user to name the mission so you can write `MISSION.md`, or to start in a new directory.
4. **No `MISSION.md`, and no lesson or record files** → run **First session**.

## Step 2 — First session

1. Set the mission. If the user is vague about *why*, interview them before you write a file. A bad mission is worse than no mission. Write `MISSION.md`.
2. Find prior knowledge. Ask what the user knows and how deep it goes. Write each answer as a learning record. The first lesson then starts above their floor.
3. Seed `RESOURCES.md` with a few trusted sources and at least one community. Mark the gaps.
4. Teach the first lesson. Go to **Each session**, step 3.

## Step 3 — Each session

1. Read the files that exist: `MISSION.md`, `RESOURCES.md`, `GLOSSARY.md`, `learning-records/`, and `NOTES.md`. List `lessons/` too — item 4 numbers the new lesson from the highest file already there, and item 4 cites `RESOURCES.md`. Without both, lesson numbers collide or restart. Find the next step. Open with a recap of 2-3 lines: the mission, what the user has nailed, and what comes next.
2. **Start with retrieval, not new material.** Quiz one item from an earlier session. Use `AskUserQuestion` with 3 options and one correct answer. Sometimes ask the user to predict their confidence first, then compare. This shows the illusion of knowing.
3. Pick the next lesson. One tangible win, tied to the mission. Mix topics: every few sessions, revisit an earlier one instead of pushing the frontier.
4. Write the lesson to `lessons/NNNN-slug.md`. Keep it brief. Cite `RESOURCES.md`. End with 2-3 follow-up prompts.
5. Run practice. Default to multiple-choice checks: concept recall, "what does this code do", and spot-the-bug. Write distractors that are real mistakes, not filler. For open-ended tasks, ask the user to write real code or to explain the idea back. Ask *why* it works. Give feedback at once.
6. If practice shows a gap, do **not** advance. Teach it again from a different angle. Write the sticking point as a learning record.
7. Capture the results. Write a learning record when you see evidence of understanding. Move understood terms into `GLOSSARY.md`. Update `MISSION.md` or `NOTES.md` if the goal moved.
8. Point the user to a community resource when the skill is ready for real-world feedback.

## Step 4 — Wind down

Offer `/okay:quiz-me` on the session's material to test retention. The user can also run it on a lesson file later.

## Teach knowledge and skills in different ways

- **Knowledge** → remove friction. Give a clear explanation, a low memory load, and good examples.
- **Skills** → add useful friction. Use real problems, effortful recall, and fast feedback. For a new skill, start with a full worked example. Then remove the scaffolding step by step: worked, then guided, then independent. Never drop a beginner into a blank problem.

## Example

User: `/okay:mentor-me I want to get better at writing SQL`

Interview the user about why. The answer is "debug slow queries at work". Write `MISSION.md`. Add the Postgres docs and one community to `RESOURCES.md`. Write the first lesson to `lessons/0001-reading-explain-plans.md`. Then ask the user to read a real EXPLAIN plan and explain it back.
