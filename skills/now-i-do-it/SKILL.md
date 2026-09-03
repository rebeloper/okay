---
name: now-i-do-it
description: "Replay your own uncommitted change. Reads the current git diff, saves it as an answer-key, reverts it from the working tree, then paces you to rebuild it by hand. Each chunk is three versions — one correct, two with a named trap; you pick, then type it yourself, and the skill checks every chunk against the answer-key. Takes an optional level: junior (the default) or teammate. Slash-command only, via /okay:now-i-do-it."
argument-hint: "[junior (default) | teammate]"
disable-model-invocation: true
---

# now-i-do-it

Goal: replay YOUR own uncommitted change. You just wrote some code. The
skill saves that change, removes it from the working tree, then paces you
to write it again by hand. For each chunk the skill shows three versions.
Two versions carry a trap. You pick the correct version and type it by
hand. The skill checks each typed chunk against the saved answer-key. At
the end the skill checks the whole rebuild and explains the finished
solution.

All output to the developer follows ASD-STE100 Simplified Technical
English. See `reference-asd-ste100.md` in this folder. Short sentences.
One idea per sentence. Plain approved words. Active voice. This applies to
every step, every option, and every line.

## Hard rules (unconditional)

1. **Never write or edit the developer's source code.** Not into a
   file. Not as a paste-ready snippet in chat. The developer types
   every line. This holds when write access is on. It holds when the
   developer asks. The developer can still override with an explicit
   instruction. That is their call, on their judgement. The skill
   states the risk one time, then defers.
2. The skill DOES write two non-source things: the answer-key patch
   file under `.okay/`, and one `.okay/` line in `.gitignore` if it is
   missing. The skill DOES run tree-changing git commands:
   `git add -N` and path-scoped `git add`, `git diff`, `git reset`,
   `git apply --check`, plus `git checkout --` and `rm` of captured new
   files. These are reference and reset actions. They are never code
   authoring.
3. Every destructive change to the working tree needs the developer's
   explicit nod first. This covers the Step 2 revert and each new-file
   delete.
4. No hook enforces rule 1. Subagents, Bash, and MCP tools can bypass
   it. The skill does not pretend the rule is airtight. The rule is a
   promise kept by the skill's own behaviour. The skill states this
   plainly.
5. **Show the code as a 3-way choice.** Every chunk reveal is gated
   behind a pick: three versions, one correct, two with a named trap.
6. **One chunk at a time.** Never show the whole build in one message.
7. **Check every chunk against the real git diff before the next
   chunk.** Never assess code pasted into the chat.
8. **Chunks follow authoring order.** Not file order.
9. **All output in ASD-STE100.** See `reference-asd-ste100.md` in this
   folder. Every step. Every option. Every recap line.

Trim or brief communication modes compress prose only. They never skip a
phase, a gate, or a check.

## Step 1 — Resolve level, check the repo, capture the change

1. Read the level from the argument. Use `junior` (the default) or
   `teammate`. If the argument passes `five` or `non-dev`, map it to
   `junior` and tell the developer.
2. Confirm the project is a git repository. If it is not, stop. There
   is no baseline to diff against.
3. Confirm the repository has at least one commit
   (`git rev-parse HEAD` succeeds). If it has none, stop. Tell the
   developer to make one commit, then run the skill again.
4. Confirm the working tree is dirty. Run `git status --porcelain`. If
   it shows no change and no untracked file, stop. Tell the developer:
   "Write the code first. Then run me."
5. Record which files the change touches. Run `git status --porcelain`.
   List the new (untracked) files separately with
   `git ls-files --others --exclude-standard`.
6. Print the captured file list. Show line counts. Ask with
   `AskUserQuestion`:
   - Capture **all** of these files (Recommended).
   - Capture a **subset** — the developer names the files. Only the
     named files go into the answer-key and only they are reverted in
     Step 2.
   The files chosen here are *the captured paths*. Every later git
   command in this skill is scoped to them.
7. Build the answer-key patch, scoped to the captured paths:
   `git add -A -- <captured paths>`, then
   `git diff --staged --binary -- <captured paths>` for the patch text,
   then `git reset -- <captured paths>` to unstage. Use `--binary`. Without
   it a patch that touches a binary file cannot apply back, and the Step 2
   check stops the run. The tree keeps the developer's work for now.
8. This step discards the index for the captured paths. Say so before you
   run it. `git add -A` overwrites what the developer had staged, and
   `git reset` then unstages everything. A path staged at one version
   while the working tree holds another loses that staged version. The
   file content on disk is safe. Only the staging choice goes. Ask for an
   explicit nod if `git status --porcelain` shows any captured path with a
   staged change (an index status other than a space or `?`).
9. If the diff is large (many files, or hundreds of lines), warn the
   developer. The skill works best on one focused change. Offer to
   narrow to a subset.

## Step 2 — Save the answer-key, then revert

1. Write the patch to `.okay/answer-key-<timestamp>.patch` at the
   repository root. `<timestamp>` is `YYYYMMDD-HHMMSS`. The patch text
   is the scoped `git diff --staged --binary -- <captured paths>` output
   from Step 1.
2. Check the patch is restorable BEFORE any revert. Confirm the file
   is not empty. Then run
   `git apply --check --reverse .okay/answer-key-<timestamp>.patch`
   from the repository root. It must pass. A pass proves the patch
   matches the current change and applies back cleanly later. If the
   file is empty or the check fails, stop. Do not revert. Tell the
   developer the capture failed and their work is untouched.
3. If `.gitignore` at the repository root does not already ignore
   `.okay/`, append a `.okay/` line to it.
4. Record in working notes: the absolute patch path, the `HEAD` sha
   (`git rev-parse HEAD`), and the captured file list.
5. Tell the developer where the patch is saved. State that it is their
   reference and it stays until they delete it.
6. Ask for an explicit nod before the revert.
7. Revert only the captured paths:
   - Tracked captured files: `git checkout -- <path>` for each.
   - New captured files: `rm <path>` for each, after confirming each
     path with the developer.
   - Never run a blanket `git clean`.
8. To restore your work at any time, run
   `git apply .okay/answer-key-<timestamp>.patch` from the repository
   root.
9. Verify. Run `git status --porcelain` for the captured paths. It must
   show nothing. If a captured path still shows a change, stop and tell
   the developer.

## Step 3 — Explain the problem

Explain what this code solves. Say who needs it. Say what breaks without
it. Use plain language. Use the chosen level's voice. Reuse the level
voices from `../explain/SKILL.md`, Levels section. Keep the explanation to
3 to 6 sentences. Do not walk through any code in this step. Cover the
problem and why it matters only.

## Step 4 — Recap the target

The answer-key IS the target. The developer wrote it minutes ago.

- Show the target back as a short recap, drawn from the patch. This is
  not a reveal. It sets the endpoint.
- The 3-way picks in Step 9 then test attention and authoring order,
  not recall.
- The developer still types every chosen version by hand.

## Step 5 — Explain the approach

- State the strategy. Give the shape of the solution. Say why this shape.
- Name one or two approaches you considered and rejected. Give the reason
  for each. Example: "A regex pass would be shorter. It cannot handle
  nested input. We reject it."
- Map the approach to the chunks ahead at a high level. Example: "First
  we scaffold the parser. Then we build the core loop. Then we add the
  edge cases." Use no code here.
- Scale to complexity. A simple task gets 3 to 4 sentences. A non-obvious
  design gets the full treatment.

## Step 6 — Understanding check (calibration)

Run this after the problem and the approach. Run it before the build. The
goal is to find where the developer is. Then the build starts at the
right depth.

Ask 2 to 3 questions with the `AskUserQuestion` tool. Probe:

- Prior exposure: has the developer solved this kind of problem before?
  (never / once or twice / often)
- Concept naming: can the developer name the key concept the code needs?
  Offer options. Exactly one is correct. Set the correct option's slot
  with the Answer-slot rotation rule section below. Do not always use
  slot 1.
- One diagnostic question that only someone who understands this area
  answers right.

Map the answers to a starting depth. Pitch each chunk's reasoning one
step above what the answers show the developer already knows. Re-adjust
as the loop runs. Do not show the developer a "level" label.

## Step 7 — Draft the build sequence (silently)

- Break the answer-key into 3 to 8 chunks in authoring order. Authoring
  order is the order a developer actually writes code. The usual order
  is: the scaffold, the signature, or the types first. Then the
  happy-path core. Then the edge cases and the guards. Then the wiring
  and the cleanup. This order is typical, not fixed.
- Each chunk is decision-sized. It holds one coherent idea.
  It spans a few lines. It is not "lines 1 to 10". It is not one line,
  unless that line carries a real decision.
- Chunk by intent, not by file position. A guard clause can sit at the
  top of the file. A developer can still think of it last. That guard
  clause is its own chunk. Narrate it when a developer would reach for
  it.
- Each chunk must be small enough that three full versions of it read
  cleanly inside one `AskUserQuestion`. If a chunk is too big for that,
  split it.
- Titles only for now. Do not print chunk content in this step.

## Step 8 — Show the build map, confirm start

Print a short numbered outline. Show the chunk titles only. Give one line
each. Use no code.

Then ask with `AskUserQuestion`:

- Start from chunk 1 (Recommended).
- Jump to a specific chunk.
- Adjust the sequence. The developer reshapes the outline before the
  build begins.

## Step 9 — Type-along loop (per chunk)

For the current chunk:

1. Print a progress marker. Use the form `Chunk X/N — <title>`. `X` is
   the current chunk number. `N` is the total chunk count. `<title>` is
   the chunk title from Step 7.
2. Narrate the chunk at the level set by the Step 6 calibration. Cover
   four things:
   - What these lines do.
   - Why now. Say why this chunk comes at this point in the sequence.
   - Why this way. Name the choice made here. Name the near-miss you
     would try first. Say why you discard it.
   - What you would be thinking as you type these lines.
3. Present three versions of the chunk. Use one `AskUserQuestion` call.
   - Each option carries the actual code for that version. The developer
     compares the real implementations.
   - Exactly one version is correct. It matches the answer-key's lines
     for this chunk.
   - The other two versions each carry one trap. A trap is one specific,
     named error. It is a plausible wrong build of this chunk. Examples:
     wrong guard order, an off-by-one count, code that mutates the
     input, a wrong default value, a missing `await`.
   - A trap is never filler. A trap is never a cosmetic typo.
   - Set the slot of the correct version with the "Answer-slot rotation
     rule" section.
   - The MCQ count carries over from Step 6. Step 6 and every Step 9
     pick share one running count.
   - If the three versions do not fit legibly in the `AskUserQuestion`
     options, print them in the message as three labelled code blocks.
     Then use the options as the labels A, B, and C.
4. A correct pick makes that version the chunk. Go to item 7.
5. A wrong pick starts a repair loop. A free-text "Other" answer counts
   as a wrong pick.
   - Give a short hint. The hint targets the trap that the pick shows.
   - Then ask a smaller follow-up. Use a 2-version pick between the
     correct version and the developer's pick. Or ask one narrow
     question about the single line that differs.
   - Never re-show the same three versions.
   - Repeat until the developer picks the correct version.
6. A skip try starts a redirect. "Just tell me which one" is a skip try.
   Any other bypass try counts too.
   - Give one short sentence that redirects.
   - Then ask a smaller question.
   - No phrase skips the gate.
7. On the confirmed version, hand the typing to the developer. Tell the
   developer to type those exact lines into the file by hand. Tell the
   developer to save the file. The skill does not write the lines.
8. When the developer says the chunk is typed, check the change on disk.
   Run `git add -N -- <captured paths>` first so new files show. Then
   run `git diff HEAD -- <captured paths>`. Add
   `git diff --staged -- <captured paths>` if the developer staged the
   work. `git add -N` leaves the files unstaged. It does not disturb
   staging state and needs no `git reset`. Check this chunk's lines
   against the answer-key. The lines must be present. The lines must
   match.
   - Never read a chat paste. If the developer pastes code, reply with
     this exact sentence:
     `Save it to the file. I review the change on disk.`
   - Then handle one of three outcomes.
   - Nothing new appears since the last chunk. Ask the developer to type
     the chunk first.
   - This chunk's lines are present. They match the answer-key. Say so.
     Go to the next chunk.
   - The lines are wrong or drifted. Name the gap as a question.
     Example: `What happens here when the input is empty?`. Give one
     targeted hint. Let the developer fix the code. Let the developer
     re-save the file. Re-check the diff. Repeat until this chunk is
     correct. There is no attempt cap. A behavioural gap always
     re-enters this loop. A missing guard is a behavioural gap. A wrong
     edge case is a behavioural gap. A behavioural gap is never a polish
     note.

## Step 10 — Verify the rebuild

1. Stage and diff, scoped to the captured paths:
   `git add -A -- <captured paths>` then
   `git diff --staged -- <captured paths>`. Then
   `git reset -- <captured paths>`.
2. Compare that patch to the saved answer-key patch. They must
   describe the same change. Ignore ordering noise and context-line
   differences; the added and removed lines must match.
3. If they match, say so. If they do not, name the gap and re-enter the
   Step 9 loop for the affected chunk.
4. Walk the finished code as a whole. Show how the chunks connect.
   Trace the data flow. Say why it works. State the tradeoffs. Add one
   or two idiomatic polish notes as suggestions only. Do not apply
   them.

## Step 11 — Clean up and recap

1. The rebuild matches the answer-key. Offer, with `AskUserQuestion`:
   - Keep the patch file (Recommended).
   - Delete it now.
2. Give a short plain-text recap. List the chunks in order, one line
   each. No re-teach.
3. Offer, in plain chat (no `AskUserQuestion`): `/okay:quiz-me` on this
   material for retention, or `/okay:explain` on the rough parts.

## Answer-slot rotation rule (all MCQs — Step 6 and every Step 9 pick)

The correct option must not sit in the same slot every time. Models drift
to slot 1. Stop that with a fixed rule.

1. Keep one running count of every MCQ you ask this session. Start at 0
   for the first one. This count spans the Step 6 concept question and
   every Step 9 chunk pick.
2. For an MCQ with N options, put the correct option at index
   `count mod N` (0-based). So question 0 → slot 1, question 1 → slot 2,
   question 2 → slot 3, question 3 → slot 1, and so on.
3. The correct option never lands in slot 1 on two questions in a row. If
   the rule would do that, shift it one slot down.
4. Order the two wrong options by chance in the slots that are left.

Red flag: you are about to place the correct version first "because it
reads best there". Stop. Apply the rule.

## What this skill does not do

- Write or edit the developer's source code. It respects this when
  write access is on.
- Skip the reveal. It always shows the code — as a gated 3-way choice.
- Review code pasted into the chat. Only the git diff.
- Persist between sessions. One rebuild, then done. The answer-key
  patch file is the only thing left on disk, and only until the
  developer deletes it.
- Design large multi-file systems. One focused change per run.

## Relationship to the family

- `okay:explain` gives one explanation. This skill is a paced
  code-along.
- `okay:teach-me` explains a resource step by step. This skill replays
  the authoring order and the developer rebuilds it.
- `okay:quiz-me` tests recall. This skill tests the hands.
- `okay:wait-what` is a directive for when a message does not land.
- This skill reuses `okay:explain`'s level voices. It has no runtime
  dependency on any other skill. It works on its own.
