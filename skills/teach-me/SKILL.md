---
name: teach-me
description: "Turns one resource — a GitHub URL, local path, web page, the current chat, or a topic — into a paced, step-by-step learning journey, taught one step at a time with a pacing check before each advance. Takes the same level argument as okay:explain (five, junior, non-dev, teammate). Slash-command only, via /okay:teach-me."
argument-hint: "[five | junior (default) | non-dev | teammate] <github-url | local-path | url | chat | topic>"
disable-model-invocation: true
---

Goal: turn ONE resource into a guided, paced learning journey — not a single wall-of-text explanation. Reuse `explain`'s level voices (`../explain/SKILL.md`) for HOW to talk; this skill's job is the chunking and pacing.

## Hard rules
- **Teach one step (or sub-step) at a time.** Never dump the whole curriculum's content in one message, even if the user asks to skip ahead — jumping to a step is fine, dumping all of them is not.
- **Chunk by concept, not by file/line count or word count.** A step is "how caching works here," not "lines 1-50."
- **Match the chosen level's voice throughout**, per `explain`'s Levels section — vocabulary, analogies, code-or-no-code, depth.
- **Write every message in ASD-STE100 Simplified Technical English** — see `reference-asd-ste100.md` in this folder. Short sentences. One idea per sentence. Active voice. Plain words. The level voice sets depth; these rules apply on top.
- These rules are unconditional. Trim/brief communication modes compress prose, never pacing or chunking.

## Step 1 — Resolve level and source
Resolve the source, plus a level pulled from the argument (`five` / `junior` / `non-dev` / `teammate`), defaulting to `junior`:
- **GitHub URL** → shallow clone (`git clone --depth 1`) or `gh api` to read the files.
- **Local path** → read directly.
- **Web page / article** → WebFetch it.
- **`chat` / no argument** → the conversation so far; if it has no substantive content yet, ask for a resource instead.
- **A concept the user names** → use what they gave you.

Keep scope small: one module, article, or focused topic. A whole repo is too much — pick the subsystem the user actually means, or ask which one.

## Step 2 — Draft the curriculum (silently)
Break the material into 3-8 ordered steps, each with sub-steps only when a step bundles more than one distinct idea. Order steps so each builds on the last (foundational concept → how it's built → edge cases/gotchas, or similar). Don't print step content yet — titles only, decided next.

## Step 3 — Show the journey map, then confirm start
Print the plan as a short numbered outline — step titles (and sub-step titles, indented) only, one line each, no content. Then ask with AskUserQuestion:
- **Start from step 1** (Recommended)
- **Jump to a specific step**
- **Adjust the plan** — user reshapes the outline before teaching begins

## Step 4 — Teach loop
For the current step (or sub-step, if the step has any):
1. Start the message with a one-line progress marker: `Step X/N` (N = total top-level steps from the plan), or `Step X/N · sub-step a` when teaching a sub-step. Then explain it at the chosen level — voice rules from `explain`, this step's content only.
2. Check pacing with AskUserQuestion:
   - **Next** (Recommended)
   - **Go deeper on this**
   - **Explain it differently** — different analogy/angle, same level
   - Free-text reply via Other → answer their question, then re-offer this same check before advancing.
3. On **Next**: if the current step has unfinished sub-steps, move to the next sub-step; otherwise move to the next top-level step. Repeat Step 4 for it.

## Step 5 — Recap and next steps
When the last step is done, give a short plain-text recap: the steps covered, in order, one line each — no re-teaching. Then offer, in plain chat (no AskUserQuestion needed): `/okay:quiz-me` on this material to test retention.
