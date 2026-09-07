---
name: audit
description: "Audits code with the review engine you choose, then leads you to each finding yourself through targeted questions. The target is anything: a PR, a branch, your uncommitted diff, a file, a folder, a repo URL, or a pasted diff. Slash-command only, via /okay:audit."
argument-hint: "<pr | branch | path | url | diff | description> [--engine <name>]"
disable-model-invocation: true
---

Goal: find the problems in a body of code, then make the user find them too. You run the review in silence. You do not name a finding. You ask a question that points at the area, and you let the user say what is wrong.

The user picks the review engine. You pick nothing for them.

## Hard rules
- **Never name a finding before the user gets a chance at it.** Not in the orientation, not in a hint, not in a question, not in an option label of a different question.
- **One AskUserQuestion call per finding.** Never print the finding list.
- **Write every question, option, hint, and finding in ASD-STE100 Simplified Technical English** — see `reference-asd-ste100.md` in this folder. Short sentences. One idea per sentence. Active voice. Plain words.
- If the user says "stop" or "I'm done": show the partial tally, then list every finding that is still hidden, in full.
- These rules are unconditional. Trim/brief communication modes compress prose, never interaction gates.

## Step 1 — Resolve the target

Read the argument and decide what it is. Do not assume a PR.

| The argument looks like | Do this |
|---|---|
| `123`, `#123`, or a GitHub PR URL | `gh pr view <n> --json title,body,headRefName` and `gh pr diff <n>` |
| A branch name | `git diff main...<branch>`. If there is no obvious base, use `git diff @{upstream}...HEAD` |
| `diff`, or **no argument at all** | The working-tree diff: `git diff HEAD`. If the tree is clean, use `git diff @{upstream}...HEAD` |
| A local file or folder path | Read the code as it is. There is no diff. Audit the whole thing |
| A GitHub repo or folder URL | `git clone --depth 1`, then audit the named subtree |
| A diff or a code block already in the chat | Use it as it is |
| Anything else (a described scope) | Ask one plain-text question to pin down the files, then continue |

Two target shapes exist, and they change Step 4:
- **A change** (PR, branch, diff) — you audit what the change does to the code.
- **A body of code** (path, URL, clone) — you audit the code as it stands.

If the target is a folder or a repo and it is large, say so and ask the user to name one subsystem. A whole repo makes a bad audit.

## Step 2 — Pick the engine

If the user passed `--engine <name>`, use it. Skip this step, and say one line: `Engine: <name>.`

Otherwise find out what this machine has. Check, in one pass:
- `/code-review` — the built-in review skill. Almost always present.
- `/security-review` — the built-in security review skill.
- `superpowers:requesting-code-review` — present only if the superpowers plugin is installed.
- Any project review skill — look in `.claude/skills/` and in the plugin skill list for a skill whose description is about review or audit.
- **Subagent finder passes** — always available. You run independent Agent passes yourself: line-by-line scan, removed-behavior audit, cross-file tracer, reuse, simplification, efficiency, altitude.

Then ask with `AskUserQuestion`, header `Engine`, listing **only what you found**, plus one option that is always there:
- **`/code-review ultra`** — the cloud multi-agent review. A skill cannot start it. If the user picks it, print the exact command for them to type (`/code-review ultra` for the current branch, or `/code-review ultra <PR#>`), stop, and wait. When the review lands in the session, read its findings and go to Step 3.

Put the engine you judge best for this target first, and mark it `(Recommended)`.

## Step 3 — Run the review in silence

Run the chosen engine over the target from Step 1.

Then normalize whatever it gives back into one ranked list:
- One entry per finding: file, line, one sentence for the defect, one sentence for how it fails.
- Drop duplicates. Two engines describe the same defect in two ways; that is still one finding.
- Drop anything the code proves impossible. Keep the rest.
- Rank most severe first.

**Output nothing about the findings.** Not a count of the severe ones, not a hint of the area.

If the list is empty: say `No findings.` and stop.

## Step 4 — Orientation

Give the user two short things before the first question.

1. **What this code is for.** For a change, this is the acceptance criteria: what problem it solves, and what must be true when it is done. Use the PR title and body when you have them. Otherwise use the commit messages, the branch name, and the shape of the change. For a body of code, describe instead what the code is responsible for. Three to five bullets, no more.

2. **How it works.** Two to four sentences on the approach: what was added or changed, which parts are involved. This is a map, not a critique. Do not hint at a problem or an omission.

Then say: `Found N findings. Let's see how many you can spot.`

## Step 5 — Probe, one finding at a time

Most severe first. For each finding:

**Ask.** One `AskUserQuestion`, four options, one correct.
- Name the place: `Look at fetchUser in api/users.js —`
- Ask about behavior, an assumption, or an edge case: `— what does it assume about the response?`
- One option states the insight that names the defect. The other three are wrong guesses a developer really makes. Mark nothing.
- Never name the error type, the line number, or the fix.
- If the check cannot become options — "walk me through what you would change" — ask it in plain text instead.

**Then react.**
- **Correct pick, or free text that names the defect** → confirm in one sentence, restate the defect, move on.
- **Free text in the right area but not precise** → narrow it, reveal nothing: `Right area. What happens when the response is empty?`
- **A wrong option, or an off-track answer** → redirect, reveal nothing: `Look again at what that call returns when the list is empty.`
- **Stuck** — a very short answer, "I don't know", "skip", "next" → `AskUserQuestion`, header `Stuck?`:
  - **Hint** — one nudge, no answer
  - **Just tell me** — reveal this finding
  - **Skip** — move on, count as revealed

  On **Hint**: one sentence that narrows the search. Then ask the same question again. After two hints with no progress, offer **Just tell me** instead of a third hint.
  On **Just tell me** or **Skip**: state the finding in one or two sentences, mark it revealed, move on.

**Track** each finding as caught, caught after a hint, or revealed.

## Step 6 — Tally

Say: `Done. You caught X/N.`

Then up to three lists, one line each, and drop any list that is empty:
- **✓ Caught** — found with no help
- **✓ Caught (hinted)** — found after a hint
- **→ Revealed** — told

If the user caught them all, add `Clean sweep.`

## Step 7 — Next steps

Plain chat, no AskUserQuestion. Offer `/okay:explain` on whatever the user missed, and `/okay:now-i-do-it` if the fixes are theirs to write.
