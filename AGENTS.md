# AGENTS.md

## Git Workflow — CRITICAL, MANDATORY, NO EXCEPTIONS

> **THIS IS NOT OPTIONAL.** Every agent operating in this repository MUST follow this workflow after every change, no matter how small. There are ZERO exceptions to this rule. Skipping a commit is never acceptable. If you have made any change to any file, you MUST commit before moving on.

### Rules

1. **ALWAYS commit your changes immediately after completing a task or reaching any logical stopping point.** Do not defer. Do not batch. Do not skip.
2. **ALWAYS commit before ending your session.** The working directory MUST be clean (all changes committed) when you finish. Leaving uncommitted changes is a failure state.
3. **Use clear, descriptive commit messages** that explain what was done and why.
4. **If in doubt, commit.** It is always better to have one commit too many than one too few.

### To be absolutely clear

- "I'll commit later" — **No. Commit now.**
- "It's just a small change" — **Commit it.**
- "I'm about to make another change" — **Commit the current one first.**
- "The user didn't ask me to commit" — **Irrelevant. Commit anyway.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
