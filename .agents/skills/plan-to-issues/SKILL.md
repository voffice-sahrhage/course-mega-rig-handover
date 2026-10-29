---
name: plan-to-issues
description: Split this repo's plan.md into GitHub issues with gh, one per unit of work, after a human has reviewed the split. Use when a plan is ready and has no issues yet.
---

# plan-to-issues

Turns `plan.md` into GitHub issues that workers can pick up cold. Easiest with `gh`, authenticated,
in a shell this agent can run.

## Steps

1. Read `plan.md`, `AGENTS.md` and `docs/adr/`.
2. Draft the split as a table: title · plan section · scope · done when · blocked by.
   One issue per unit of work.
3. **Stop and show the table to the human.** Publish nothing until they approve it.
4. Every issue carries the shape in "Issue shape" below. Ask the human only if they want to
   change it for this plan, then update that section.
5. Create each issue in dependency order, so blocked-by can cite real numbers:

   ```sh
   gh issue create --title "<title>" --label plan:<plan> --body-file <tmp.md>
   ```

6. Record every issue URL from gh's output (not from memory) and reply with the list.

Closing one, with the closing comment from AGENTS.md:

```sh
gh issue close <n> -c "<closing comment>"
```

A commit with `closes #<n>` closes the issue when it lands on the default branch. Then post the
closing comment with `gh issue comment <n> --body "<closing comment>"`; `gh issue close -c`
fails on an issue that is already closed.

## Issue shape

Agreed with the human on 2026-10-29 for plan morning-digest. Every issue body is exactly this, and
every issue gets the label `plan:<plan>` (the `plan:` value from the plan's frontmatter), which is
how the reviewer sorts them:

```
Source: plan.md § <n>
Scope: <what to change, which files, what not to touch>
Done when: <the plan's condition for this section>
Blocked by: #<n>, or —
Model: <stronger model for logic, cheaper one for views and tests, and why>
```

- `Source:` is the first line, so the reviewer can sort by section.
- A section may become more than one issue (both cite the same section) when part of it unblocks
  others, e.g. a shared types file before the code that uses it.
- When "done" depends on someone outside the lane (a reviewer looks, a person answers), write
  "Done when" as that event, not as "sent". The issue stays open until it happens, and any
  clean-up issue is blocked by it.

## No `gh`

Steps 1–4 hold either way. GitHub reachable another way (a connector, the REST API, the web UI):
the same issues, made that way. GitHub issues out of reach altogether: write them as files in
`docs/issues/`, format in ADR 0004, then commit and push.

## Don'ts

- Don't paste the whole plan into one issue, and don't keep issues only in chat.
- Don't invent sections the plan doesn't have. If the plan is unclear, ask.
