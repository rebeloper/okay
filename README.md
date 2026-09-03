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
| `okay:less-code` | `/okay:less-code on\|off` | KISS/DRY/YAGNI discipline on every line written or reviewed. Ships **on**. |
| `okay:less-talk` | `/okay:less-talk on\|off` | Trim (lite) replies plus sandboxed large output. Ships **on**. |

## How they fit together

The skills form a chain. Use `okay:explain` to understand one concept. Use `okay:teach-me` to work through a whole resource. Use `okay:quiz-me` to test what you remember. Use `okay:now-i-do-it` to rebuild a change with your own hands.

Use `okay:wait-what` at any point. Run it when a message does not land. It makes the AI re-pitch the message with context, in plain words.

## Two always-on modes

`okay` ships two modes **on**. A `SessionStart` hook arms them, so they
come on in the **next** session — restart Claude Code after you install
the plugin. They stay on from then, every session.

- **`less-code`** — the AI applies KISS, DRY, and YAGNI to every line it
  writes or reviews. Security, input validation, data-loss handling, and
  accessibility are never traded away for brevity.
- **`less-talk`** — the AI writes compressed replies (real sentences, less
  filler) and routes large command or file output through a subprocess so
  it never floods the context window.

Turn either off with `/okay:less-code off` or `/okay:less-talk off`. The
choice persists across sessions. Turn back on the same way.

The status bar shows `💎` while `less-code` is on and `📈<tokens>` while
`less-talk` is on.

## Install

```
/plugin marketplace add rebeloper/okay
```

```
/plugin install okay@okay
```

Restart Claude Code afterward.

`okay` needs `jq` and `node` on your PATH: `jq` for the status bar and the
hook payloads, `node` for the sandbox runner and its PreToolUse gate.
Neither is fatal. Without `jq` the two always-on modes still re-arm each
session and the status bar simply does not render; it installs itself on
the first session after `jq` becomes available. Without `node` the sandbox
and its PreToolUse gate stay silent.

## Update and remove

- Update: run `/plugin marketplace update okay`, then update `okay` from the
  `/plugin` menu. If the menu shows no update, run `/plugin uninstall
  okay@okay` then `/plugin install okay@okay` again.
- Remove: follow the three steps below, **in order**.

Restart Claude Code after any update or removal.

**Removing `okay` cleanly.** The status-bar uninstaller lives inside the
plugin, so run it *before* the plugin directory is deleted:

1. While the plugin is still installed — removes okay's status bar and
   restores any `statusline.sh` that was there before:

```
bash <plugin-root>/scripts/statusline-install.sh uninstall
```

2. Then drop the plugin and the marketplace entry:

```
/plugin uninstall okay@okay
```

```
/plugin marketplace remove okay
```

3. Then delete okay's own state (toggle values, sandbox savings):

```
rm -rf ~/.okay/
```

`<plugin-root>` is the installed plugin directory. If you uninstalled the
plugin first, an orphaned `~/.claude/hooks/statusline.sh` is left behind —
delete it by hand, and remove the `statusLine` entry from
`~/.claude/settings.json` if it points at that file.

Running the uninstaller while keeping the plugin is supported: it records
the choice in `~/.okay/statusline-optout`, and the plugin will not
reinstall the bar on later sessions. Turning a mode back on with
`/okay:less-code on` or `/okay:less-talk on` clears that and restores the
bar.

**Files `okay:now-i-do-it` leaves in a project.** In each project where you
ran it, delete the answer-key folder by hand:

```
rm -rf .okay/
```

Then remove the `.okay/` line from that project's `.gitignore` if you do
not want it.

## The no-write principle

1. `okay` never writes or edits your source code. It explains, teaches, quizzes, and paces. You type every line.
2. `okay:now-i-do-it` writes exactly two non-source things: its answer-key patch under `.okay/`, and a `.okay/` line in `.gitignore` if that line is missing. It runs git commands that reset the working tree. It never authors code.
3. No hook enforces this. `okay`'s hooks re-arm the two always-on modes and
   gate large tool output — none of them lock your source. Subagents, Bash,
   and MCP tools can still bypass the no-write rule. The developer can also
   override it with an explicit instruction. That is their call.
4. The rule is a promise kept by the skills' own behaviour. `okay` states this plainly. It does not pretend the rule is airtight.

## Development

`node --test` — sandbox runner and PreToolUse gate:

```
npm test
```

`bats` — SessionStart hook, PreToolUse shim, status bar:

```
npm run test:bats
```

Both suites run on every push and pull request (`.github/workflows/test.yml`).
`node --test` is deliberately bare: passing it a directory breaks on Node v26.

## Output style

The five content skills (`explain`, `teach-me`, `quiz-me`, `now-i-do-it`, `wait-what`) write ASD-STE100 Simplified Technical English. Sentences stay short. Each sentence carries one idea. The voice is active. The words are plain. Each of those skill folders carries its own `reference-asd-ste100.md` copy, so each stays self-contained.
