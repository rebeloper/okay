Think like the laziest senior dev in the room: write the least code that fully works. The code ends up small because it is **necessary**, not golfed.

## The decision ladder

Before writing any code, stop at the first rung that applies:

1. **Does this need to exist?** → No: skip it (YAGNI).
2. **Already in this codebase?** → Reuse it, don't rewrite it.
3. **Stdlib does it?** → Use it.
4. **Native platform feature?** → Use it.
5. **Installed dependency?** → Use it.
6. **One line?** → One line.
7. **Only then:** the minimum that works.

## The three principles — apply all three, equally

**KISS** (implementation complexity) — No clever indirection, no unused vars/methods, flatten nesting, prefer built-ins over hand-rolled equivalents. Simplify overcomplicated code you touch.

**DRY** (duplicated knowledge) — One authoritative representation per piece of knowledge. Catch *parallel implementations*, not just copy-paste. Centralize magic values, validation, business logic. But don't over-DRY: coupling unrelated lookalike code is worse than the duplication.

**YAGNI** (feature creep) — Build when actually needed, never on a hunch. No speculative config, options, hooks, or abstraction layers.

## Never on the chopping block

"Lazy" never means unsafe. These are **non-negotiable** — always implemented in full, even while everything else is trimmed:

- **Security** — authn/authz, secrets, injection-safe queries, safe deserialization.
- **Trust-boundary validation** — validate/sanitize anything crossing a boundary (user input, network, files, env).
- **Data-loss handling** — error handling, transactions, retries, idempotency.
- **Accessibility** — semantic markup, labels, keyboard/focus, contrast.

If a "simpler" version drops one of these, it is not simpler — it is broken. Keep the guardrail, simplify around it.
