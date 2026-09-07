# Workspace file formats

Formats for every file the `mentor-me` workspace manages. Every file is plain markdown.

---

## MISSION.md

Lives at the workspace root. It records *why* the user learns this. Every teaching decision traces back to it.

```md
# Mission: {Topic}

## Why
{1-3 sentences. The real-world goal. What changes in their work or life when they have this skill? Push past "to understand X" to the outcome below it.}

## Success looks like
- {One specific thing the user will be able to do}
- {…}

## Constraints
- {Time, budget, other commitments, learning preferences}

## Out of scope
- {Nearby topics the user does not want now. This protects the next step.}
```

Rules: one mission per workspace. Prefer the concrete goal ("ship a Rust CLI to my team") over the abstract one ("learn Rust"). Push back when the user is vague. Revise the file when the goal moves. Keep it under one screen.

---

## RESOURCES.md

The trusted sources. Lessons draw from here, not from guesses.

```md
# {Topic} Resources

## Knowledge
- [Type: Title — Author/Source](url)
  One line: what it covers, and when to use it.

## Wisdom (Communities)
- [r/example](url)
  What it is good for: critique, help, feedback.
```

Rules: use trusted sources only — primary sources, known experts, and moderated communities. Annotate every entry. Keep Knowledge and Wisdom apart. Add a `## Gaps` section when an area has no good source. Prune hard. Record it when the user does not want communities.

---

## GLOSSARY.md

The canonical vocabulary. Building it IS part of the learning. A tight definition is evidence of understanding.

```md
# {Topic} Glossary

{One sentence on what this glossary covers.}

## Terms

**Term**:
One or two sentences that define what it IS.
_Avoid_: loose aliases, weaker synonyms
```

Rules: add a term only after the user understands it. Do not add it on first contact. Be opinionated: pick the best word, and list the others as aliases to avoid. Keep each definition tight. Use glossary terms inside other definitions. Group terms under subheadings when clusters appear. Revise a definition in place as understanding deepens.

---

## lessons/NNNN-slug.md

Self-contained teaching units, numbered in order (`0001-slug.md`). The next number is the highest file in `lessons/` plus 1. One lesson gives one win.

```md
# {Lesson title}

> Win: {the one thing the user can do after this lesson}

{Brief explanation. Respect working memory. Use examples. Cite RESOURCES.md inline.}

## Try it
{One concrete task, problem, or thing to recall.}

## Next
- {Follow-up question or direction}
- {…}
```

Rules: prefer brief over complete. One win per lesson. Tie it to the mission. Cite primary sources. Use at least two different examples, so the idea transfers past one context. For a new skill, show a worked example before `## Try it`. End with follow-up prompts. Run the practice in the chat.

---

## learning-records/NNNN-slug.md

Short notes in the style of an architecture decision record. Numbered in order — the next number is the highest file in `learning-records/` plus 1. Record insight, not activity. Create the directory only when you need it.

```md
# {Short title of what the user learned}

{1-3 sentences: what the user learned, or what prior knowledge you established. Say why it changes what to teach next.}
```

Write one when the user shows real understanding of something non-trivial, discloses prior knowledge, corrects a mistaken belief, or when the mission moves. Do NOT write one for material you merely covered. Coverage is not learning. Do NOT write one for a term that is already in the glossary.

Optional sections, only when they add value: **Evidence** (how the user showed understanding), **Implications** (what it opens up or rules out), and a `Status: superseded by LR-NNNN` line when a later record corrects an earlier one. Supersede a record. Do not delete it.

---

## NOTES.md

Free-form. User preferences, schedule, learning style, and anything else that shapes how you teach but is not a mission constraint.
