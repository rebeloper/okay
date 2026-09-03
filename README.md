# okay

`okay` is a set of Claude Code skills for developers who type their own code. The AI explains a concept, teaches a resource step by step, quizzes you, and paces a rebuild by hand. The AI does not write your code. You type every line.

## The skills

| Skill | Invoke | What it does |
|---|---|---|
| `okay:explain` | `/okay:explain` | Explains one concept at a chosen level: `five`, `junior` (default), `non-dev`, `teammate`. |
| `okay:teach-me` | `/okay:teach-me` | Turns one resource into a paced, step-by-step learning journey. Same levels. |
| `okay:quiz-me` | `/okay:quiz-me` | Live multiple-choice quiz. Hint and retry on a wrong pick. Never the answer. |
| `okay:now-i-do-it` | `/okay:now-i-do-it` | Saves your current git diff as an answer-key, reverts it, then paces you to rebuild it by hand. |
| `okay:wait-what` | `/okay:wait-what` | A directive: re-pitch the last message with context, in Simplified Technical English. |

The `/okay:` prefix shown above is for the plugin-marketplace install. The other two install routes drop it — see [Install](#install).

## How they fit together

The skills form a chain. Use `okay:explain` to understand one concept. Use `okay:teach-me` to work through a whole resource. Use `okay:quiz-me` to test what you remember. Use `okay:now-i-do-it` to rebuild a change with your own hands.

Use `okay:wait-what` at any point. Run it when a message does not land. It makes the AI re-pitch the message with context, in plain words.

## Install

Pick one of three routes.

**Plugin marketplace** — keeps the `okay:` prefix; commands are `/okay:explain` and so on:

```
/plugin marketplace add rebeloper/okay
/plugin install okay@okay
```

**The `skills` CLI:**

```
npx skills@latest add rebeloper/okay
```

**Manual copy** — for all projects:

```
cp -R skills/* ~/.claude/skills/
```

...or for one project:

```
cp -R skills/* <project>/.claude/skills/
```

Restart Claude Code after any of the three routes.

The `skills` CLI and manual copy install the skills loose, without the
`okay:` prefix. On those two routes the commands are `/explain`,
`/teach-me`, `/quiz-me`, `/now-i-do-it`, `/wait-what`. Where this README
and the skills say `/okay:quiz-me`, read `/quiz-me`. Only the plugin
marketplace route gives the `okay:` prefix.

## Update and remove

Update or remove `okay` with the same route you installed it with.

**Plugin marketplace.**

- Update: run `/plugin marketplace update okay` to fetch the latest,
  then update `okay` from the `/plugin` menu. If the menu shows no
  update, run `/plugin uninstall okay@okay` then `/plugin install
  okay@okay` again.
- Remove: run `/plugin uninstall okay@okay`. To drop the marketplace
  entry as well, run `/plugin marketplace remove okay`.

**The `skills` CLI.**

- Update: run `npx skills@latest add rebeloper/okay` again. It
  overwrites the installed copy.
- Remove: delete the five skill folders, as in the manual route below.

**Manual copy.**

- Update: pull the latest repo, then run the same `cp -R skills/*`
  command again. It overwrites the old files.
- Remove: delete the five folders.

```
rm -rf ~/.claude/skills/{explain,teach-me,quiz-me,now-i-do-it,wait-what}
```

For a one-project install, use `<project>/.claude/skills/` in place of
`~/.claude/skills/`.

Restart Claude Code after any update or removal.

**Files `okay:now-i-do-it` leaves in a project.** In each project where
you ran it, delete the answer-key folder by hand:

```
rm -rf .okay/
```

Then remove the `.okay/` line from that project's `.gitignore` if you
do not want it.

## The no-write principle

1. `okay` never writes or edits your source code. It explains, teaches, quizzes, and paces. You type every line.
2. `okay:now-i-do-it` writes exactly two non-source things: its answer-key patch under `.okay/`, and a `.okay/` line in `.gitignore` if that line is missing. It runs git commands that reset the working tree. It never authors code.
3. No hook enforces this. `okay` ships no lock. Subagents, Bash, and MCP tools can bypass the rule. The developer can also override it with an explicit instruction. That is their call.
4. The rule is a promise kept by the skills' own behaviour. `okay` states this plainly. It does not pretend the rule is airtight.

## Output style

Every skill writes ASD-STE100 Simplified Technical English. Sentences stay short. Each sentence carries one idea. The voice is active. The words are plain. Each skill folder carries its own `reference-asd-ste100.md` copy, so each skill stays self-contained.
