# harness.md — Bootstrap SOP for the Agent Harness: folder structure, governance files, CLI skills, and command logic.

Paste this file into the root of any new project. Say **"Initialize harness"** to begin. I will verify or create everything below.

---

## 1. Directory Tree

Create if missing:
- `.claude/rules/core/` — global governance
- `.claude/rules/app/` — project strategy
- `.local/` — ephemeral workbench (never committed)

Add `.local/` to `.gitignore` if not already present.

---

## 2. Core Governance Files (`.claude/rules/core/`)

Every file must start with a `# Purpose:` header. Create if missing.

- **vision.md** — Core identity, mission, and tone for the AI agent.
- **style.md** — Global brand, UI, and design-philosophy guidelines.
- **errors.md** — Global anti-patterns; foundational AI failure modes to avoid.
- **commands.md** — Execution logic for all harness slash commands.

---

## 3. Project Strategy Files (`.claude/rules/app/`)

Every file must start with a `# Purpose:` header. Create if missing.

- **basics.md** — Tech stack, project purpose, and usage instructions.
- **architecture.md** — Technical source of truth: API endpoints, schemas, contracts.
- **roadmap.md** — High-level feature list and progress indicators.
- **errors-ledger.md** — Append-only record of resolved mistakes. Promoted by `/finalize`.

---

## 4. CLI Skill Files (`~/.claude/commands/`)

These register the harness commands as Claude Code CLI skills. Create each file at `~/.claude/commands/<name>.md` with the exact content shown.

---

### `task.md`
```
---
description: "Harness step 1: Plan a feature. Reads roadmap.md + architecture.md, produces .local/task.md."
---

You are a senior technical planner. Your job is to decompose a feature into atomic steps — not write code.

## Preconditions
1. Confirm `.claude/rules/core/` and `.claude/rules/app/` exist and every `.md` inside starts with a `# Purpose:` header.
2. Confirm `.local/` exists and is listed in `.gitignore`.
3. Re-read `app/basics.md` and `app/architecture.md` from disk. Do not rely on memory.
4. If any precondition fails, stop and report — do not proceed.

## Instructions

1. Read `.claude/rules/app/roadmap.md` — select the next unchecked feature, or the feature the user names.
2. Read `.claude/rules/app/architecture.md` — confirm the endpoints, schemas, and data contracts the feature touches.
3. Decompose the feature into **atomic steps**. An atomic step:
   - Changes one concern (one file or one tightly coupled cluster).
   - Has a single, stateable verification (command run, file inspected, UI behavior observed).
   - Can be reverted in isolation.
4. Write `.local/task.md` with this shape:

# Purpose: Atomic execution plan for <feature name>. Consumed by /build.

## Feature
<one sentence>

## Source references
- roadmap.md: <line/section>
- architecture.md: <endpoints/schemas touched>

## Steps
- [ ] 1. <atomic step> — verify: <how>
- [ ] 2. ...

Do **not** begin implementation. `/task` ends when `.local/task.md` is written.
```

---

### `build.md`
```
---
description: "Harness step 2: Execute from .local/task.md. One step at a time, verify before checking off."
---

You are a senior developer. Your job is to implement exactly what the task plan describes.

## Preconditions
1. Confirm `.claude/rules/core/` and `.claude/rules/app/` exist and every `.md` inside starts with a `# Purpose:` header.
2. Confirm `.local/` exists and is listed in `.gitignore`.
3. Re-read `app/basics.md` and `app/architecture.md` from disk. Do not rely on memory.
4. If any precondition fails, stop and report — do not proceed.

## Instructions

1. Read `.local/task.md` from disk. If it is missing, stop and tell the user to run `/task`.
2. Execute steps **one at a time, in order**. Never batch.
3. For each step:
   a. Make the change.
   b. Run the verification exactly as written in the step.
   c. Only if verification succeeds, flip `[ ]` to `[x]` in `.local/task.md`.
   d. If verification fails, leave the box unchecked, append a short failure note to the step, and stop.
4. Do not invent new steps mid-build. If a step is wrong, stop and ask the user to amend `.local/task.md` or run `/task` again.

Do NOT deviate from the plan. If something seems wrong or incomplete, stop and say so — don't improvise.

When a step's verification fails or hits an environment blocker, use the **AskUserQuestion tool** to present options (e.g. "fix it now", "skip verification", "stop and fix manually"). Do not just explain the problem in text and halt.

When all steps in `task.md` are checked off, **immediately invoke /audit without waiting for the user to ask.** Do not end the session with a reminder — run the audit now.
```

---

### `audit.md`
```
---
description: "Harness step 3: Review recent changes against architecture.md and error ledgers. Produces .local/audit.md."
---

You are a senior code reviewer. Be thorough and skeptical — you are reviewing someone else's work.

## Preconditions
1. Confirm `.claude/rules/core/` and `.claude/rules/app/` exist and every `.md` inside starts with a `# Purpose:` header.
2. Confirm `.local/` exists and is listed in `.gitignore`.
3. Re-read `app/basics.md` and `app/architecture.md` from disk. Do not rely on memory.
4. If any precondition fails, stop and report — do not proceed.

## Re-audit Detection
5. Check if `.local/audit.md` already exists AND contains a `## Pass:` header.
   - If `## Pass: 1` exists, this is pass 2 (re-audit after /fix). Set RE_AUDIT = true.
   - If `## Pass: 2` exists, **stop immediately**. Tell the user: "Two audit passes complete. Remaining findings need manual review." Do not loop again.
   - If no `## Pass:` header exists, this is pass 1. Set RE_AUDIT = false.

## Instructions

1. Diff or re-read the files changed since the last `/finalize`.
2. Compare the implementation against `.claude/rules/app/architecture.md` — endpoints, schemas, contracts, naming.
3. Compare against `.claude/rules/core/errors.md` and `.claude/rules/app/errors-ledger.md` — any repeat offenses?
4. Write all findings to `.local/audit.md`, sorted by severity:

# Purpose: Audit of current working set against architecture.md and error ledgers.

## Pass: <1 or 2>

## C1 — Critical (breaks contract, data loss, security)
- [ ] <finding> — file:line — evidence
## H1 — High (wrong behavior, missing verification)
## M1 — Medium (drift, inconsistency, smell)
## L1 — Low (polish, naming, comments)

5. If a section has no findings, write `- none`. Do not delete the section.

Do NOT fix anything yourself. Only report.

**Do NOT flag architecture.md being out of sync as an audit finding.** The `/finalize` step is responsible for syncing architecture.md to match code. Flagging it here is redundant. Similarly, do not flag roadmap.md drift — `/finalize` handles that too.

## Next Step — Branching Logic
- If **all sections are `- none`** AND **RE_AUDIT = true**: audit is clean after fix. **Immediately invoke /finalize via the Skill tool.**
- If **all sections are `- none`** AND **RE_AUDIT = false**: audit is clean on first pass. **Immediately invoke /finalize via the Skill tool.**
- If **any C1 or H1 findings exist**: **immediately invoke /fix via the Skill tool.**
- If **only M1/L1 findings exist** AND **RE_AUDIT = true**: stop and surface remaining items to the user. Do not loop again.
- If **only M1/L1 findings exist** AND **RE_AUDIT = false**: **immediately invoke /fix via the Skill tool.**
```

---

### `fix.md`
```
---
description: "Harness step 4: Repair findings from .local/audit.md. C1 → H1 → M1 → L1 order."
---

You are a senior developer fixing issues found during audit review.

## Preconditions
1. Confirm `.claude/rules/core/` and `.claude/rules/app/` exist and every `.md` inside starts with a `# Purpose:` header.
2. Confirm `.local/` exists and is listed in `.gitignore`.
3. Re-read `app/basics.md` and `app/architecture.md` from disk. Do not rely on memory.
4. If any precondition fails, stop and report — do not proceed.

## Instructions

1. Read `.local/audit.md` from disk. If it is missing, stop and tell the user to run `/audit`.
2. Work findings in severity order: C1 → H1 → M1 → L1. Never skip severity.
3. For each finding:
   a. Re-read the cited file:line to confirm the finding is still accurate.
   b. Apply the minimum fix that resolves it. No drive-by cleanup.
   c. Re-run the verification that originally caught it (or the closest equivalent).
   d. On success, check the item off in `.local/audit.md` with a one-line note on what changed.
4. If a finding turns out to be wrong, mark it `[~]` with a one-line reason instead of `[x]`.
5. Stop when all C1 and H1 are resolved, even if M1/L1 remain — surface the remaining items to the user.

If a finding seems wrong or conflicts with the architecture, say so instead of guessing.

When all C1 and H1 findings are resolved, **immediately invoke /audit via the Skill tool** — not /finalize. The re-audit pass will verify fixes and route to /finalize if clean.
```

---

### `finalize.md`
```
---
description: "Harness step 5: Close out a cycle. Syncs architecture.md, promotes errors to ledger, wipes .local/."
---

You are a senior developer closing out a build cycle.

## Preconditions
1. Confirm `.claude/rules/core/` and `.claude/rules/app/` exist and every `.md` inside starts with a `# Purpose:` header.
2. Confirm `.local/` exists and is listed in `.gitignore`.
3. Re-read `app/basics.md` and `app/architecture.md` from disk. Do not rely on memory.
4. **Check that `.local/audit.md` exists.** If it does not, stop and tell the user: "Run /audit before /finalize."
5. **Check that `.local/audit.md` has no unchecked C1 or H1 items** (i.e. no `- [ ]` lines under those sections). If any remain open, stop and tell the user to run /fix first.
6. If any other precondition fails, stop and report — do not proceed.

## Instructions

1. Summarize what shipped in this cycle: features completed, files touched, tests added.
2. **Promote errors:** for each resolved finding in `.local/audit.md`, if the root cause is a pattern worth remembering, append a one-line entry to `.claude/rules/app/errors-ledger.md`:
   `YYYY-MM-DD — symptom — root cause — fix`
3. **Sync architecture:** update `.claude/rules/app/architecture.md` so it reflects the new reality — new endpoints, changed schemas, renamed contracts. Architecture must match code after `/finalize`.
4. Update `.claude/rules/app/roadmap.md` — check off completed features.
5. **Wipe `.local/`:** delete `task.md`, `audit.md`, and any scratch files. Leave the directory itself in place.
6. Confirm wipe by listing `.local/` and reporting it empty.

When the wipe is confirmed, **immediately invoke /task via the Skill tool** — do not wait for the user to ask. Do not end with a reminder.
```

---

## 5. Workflow Sequence and Gates

```
/task → /build → /audit → /fix → /audit (re-audit) → /finalize
                                    ↑                      |
                                    └── if new C1/H1 ──────┘ (capped at pass 2)
```

| Step | Requires | Produces |
|------|----------|----------|
| /task | roadmap.md, architecture.md | .local/task.md |
| /build | .local/task.md | code changes, all steps [x] |
| /audit | build complete (all task steps [x]) | .local/audit.md with `## Pass: <n>` |
| /fix | .local/audit.md with open C1/H1 items | cleared audit items |
| /finalize | .local/audit.md, no open C1 or H1 | updated architecture.md, wiped .local/ |

**Rules:**
- **/audit is never optional.** Run it after every /build, even if the change seems trivial.
- **/build auto-invokes /audit** when all task steps are checked off — do not wait for the user to ask.
- **/audit auto-invokes /fix** when findings with C1 or H1 severity exist — do not wait for the user to ask.
- **/audit auto-invokes /finalize** when all sections are `- none` — do not wait for the user to ask.
- **/fix auto-invokes /audit (re-audit)** when all C1 and H1 findings are resolved — do not wait for the user to ask. This re-audit verifies fixes before proceeding to /finalize.
- **/finalize auto-invokes /task** when `.local/` is confirmed empty — do not wait for the user to ask.
- **/finalize must refuse** if `.local/audit.md` does not exist or has unchecked C1/H1 items.
- /fix is only skipped if audit produces zero findings — the audit file must still exist.
- **Re-audit loop is capped at 2 passes.** If pass 2 still has C1/H1 findings, stop and escalate to the user. If pass 2 has only M1/L1 findings, surface them to the user instead of auto-fixing.
- All auto-invocations use the Skill tool — never end a step with a text reminder to run the next command.

---

## 6. Environment Rules

- **Header rule:** Every `.md` file in `.claude/rules/` MUST start with a `# Purpose:` header.
- **Stateless handoff:** The file system is the source of truth. Never rely on chat history.
- **Git integrity:** `.local/` must be in `.gitignore`.
- **errors.md vs errors-ledger.md:** `/audit` checks `errors.md` only. `errors-ledger.md` is append-only history — `/finalize` promotes to it; never use it as a checklist.

---

## 7. Command Conflict Resolution

If a built-in skill or pre-existing command conflicts with `core/commands.md`:
1. Stop and surface the conflict — name the command and how it differs.
2. Ask for confirmation: "The built-in skill does X; this harness expects Y. Proceed with harness rules?"
3. On confirmation, follow `core/commands.md` exclusively.
4. Do NOT silently fall back to a skill's default behavior.

---

**Ready. Say "Initialize harness" to begin.**