---
name: quiz-me
description: Quizzes the user with multiple-choice questions drawn from anything — a GitHub URL, local path, web page, the current chat session, or a concept the user describes. Runs the quiz live in chat with hints and retries on wrong answers. Use when the user wants to be quizzed or to test their knowledge, says "quiz me", "quiz me on X", "test me on this", or "/okay:quiz-me". A bare "quiz me" with no topic quizzes on the current chat session.
argument-hint: "<github-url | local-path | url | chat | topic> (default: current chat session)"
disable-model-invocation: true
---

Goal: quiz the user on ONE focused topic with 5-15 multiple-choice questions, one at a time, live in chat. Wrong answers get a hint and a retry, not the answer.

Keep scope small. A single concept, module, or article makes a good quiz; a whole repo does not — pick one subsystem.

## Hard rules
- **Every question is its own AskUserQuestion call.** Never print the question list in chat — not before the quiz, not during, not instead of asking. The user sees each question for the first time inside its own AskUserQuestion call, with no marker on the correct choice.
- **Wrong pick → hint, not answer.** The explanation is revealed only once the question is resolved.
- **Write every question, option, hint, and explanation in ASD-STE100 Simplified Technical English** — see `reference-asd-ste100.md` in this folder. Short sentences. One idea per sentence. Active voice. Plain words.
- These rules are unconditional. Trim/brief communication modes compress prose, never interaction gates.

## Step 1 — Resolve the source
- **GitHub URL** → shallow clone (`git clone --depth 1`) or `gh api` to read the files.
- **Local path** → read directly.
- **Web page / article** → WebFetch it.
- **Current chat session** (`chat`, "this conversation", or **no argument at all — this is the default**) → use the conversation so far as the source. If the session has no substantive content yet, say so and ask for a topic instead.
- **A concept the user describes** → use what they gave you (ask only if a load-bearing detail is missing).

## Step 2 — Draft the quiz (silently)
Draft 5-15 questions internally — do not print them. Quality rules:
- **Atomic:** one fact per question.
- **Exactly one unambiguously correct answer.** No yes/no questions.
- **Exactly 3 choices total, including the correct one.** AskUserQuestion caps options at 4 and auto-adds "Other"; 3 choices keeps the interaction clean.
- **Distractors are real misconceptions,** not filler. No "all/none of the above". **Randomize the correct choice's position (1st, 2nd, or 3rd) independently per question** — pick the slot before writing the options list; never default to placing it first.
- For each question also draft a short **hint** (nudges without revealing the answer) and a one-line **explanation** (shown when the question is resolved).
- Skip trivia the user would never need to recall; fewer good questions beat many mediocre ones.

## Step 3 — Quiz loop
One AskUserQuestion call per question, in order:
- **question:** `Q 3/10 — <question text>`
- **options:** the choices, correct one unmarked, no "(Recommended)" labels.
- **Correct pick** → confirm in one line with the explanation, move to the next question.
- **Wrong pick** → give the hint (one line, no answer), re-ask the same question with the eliminated choice removed. If only one choice would remain, reveal the answer with the explanation instead of re-asking, and move on.
- **Free-text reply via Other** → judge it as an answer attempt: correct → treat as a correct pick; wrong or off-topic → give the hint and re-ask with all choices intact.
- Track for each question whether the first pick was correct.

## Step 4 — Summary
A short plain-text recap: score as first-try-correct / total, and which questions needed retries (number + a few words each). No question dump.

## Step 5 — Next steps
Plain chat, no AskUserQuestion. Offer: `/okay:explain` on the topics that needed retries.
