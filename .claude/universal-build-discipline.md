# Universal Build Discipline
# Extracted from 49 sessions of PageForge development (2026-01 to 2026-03)
# Project-agnostic — drop into any .claude/ directory

---

## 1. The Loophole Scanner (6 Audit Dimensions)

Every enforcement mechanism (test, hook, CI check, linter rule, gate script) must pass all 6:

| Dimension | Question | How to Test |
|-----------|----------|------------|
| **D1 Activation** | Does it actually fire? | Trigger the condition. Check logs. "It's configured" ≠ "it runs." |
| **D2 Logic** | Does it check the right thing? | Read the code. Is it checking a stale condition? A renamed field? |
| **D3 Bypass** | Can it be skipped? | Try: empty input, wrong format, renamed file, --no-verify flag |
| **D4 Dependency** | Does it depend on something that might not exist? | Check file creation order. Does gate X require file Y that's created in step Z — which runs AFTER gate X? |
| **D5 Adversarial** | Does it handle edge cases? | Feed: null, undefined, empty string, valid-looking-but-wrong data |
| **D6 Durability** | Will it survive refactors? | Will a dependency update, file rename, or new team member break it silently? |

**5-Failure Taxonomy:**
- **F1 Absent** — enforcement doesn't exist at all
- **F2 Unwired** — exists but never called (dead code)
- **F3 Bypassable** — fires but can be skipped without consequence
- **F4 Wrong logic** — fires, can't skip, but checks the wrong condition
- **F5 Unmonitored** — works today but nobody will notice when it breaks

**When to run:** After implementing any enforcement mechanism. After any refactor that touches hooks/tests/CI. Quarterly on the full system.

---

## 2. The Quality Ratchet

**Principle:** The floor never drops. Every build must meet or exceed the previous best.

**How it works:**
1. Maintain a living benchmark document per deliverable type
2. Before starting work, write a **Pre-Build Declaration**: name the benchmark to beat and HOW you'll beat it
3. "I'll do my best" is not a declaration. Be specific.
4. After shipping, update the benchmark with what you learned
5. Mistakes become new gates. Wins raise the floor.

**Applies to:** Features, pages, APIs, components, documentation — anything you ship repeatedly.

---

## 3. Pre-Build Declaration

Before writing any code for a non-trivial feature:

1. **Name the benchmark** — what's the best existing version of this? (Internal or external)
2. **Articulate the delta** — what specifically will make this build better?
3. **Identify risks** — what's most likely to go wrong?
4. **Define "done"** — what does success look like? Not "it works" — what SPECIFICALLY works?

If you can't articulate these, you're not ready to build. Research more.

---

## 4. Self-Review During Build (Not After)

**The old way:** Build everything → review at the end → find 12 problems → fix reactively.

**The discipline:** After each significant unit of work, stop and ask:
- Does this actually work? (Run it, don't assume)
- Would I be embarrassed showing this to someone? (Honest answer)
- Is this the approach I'd use if I had to maintain this for 2 years?
- Did I take a shortcut that I'm hoping nobody notices?

**When to stop:** If any answer is "no" or "maybe," fix it before moving on. The cost of fixing now is 1x. The cost of fixing after 10 more units of work are built on top is 10x.

---

## 5. Mandatory Context Loading (Step 0)

Before starting ANY task:
- Read the relevant files first. Don't assume you know what's in them.
- Load project conventions (CLAUDE.md, style guides, existing patterns)
- Check what already exists. Don't rebuild what's already built.
- Read the error/defect history. Don't repeat known mistakes.

**The rule:** "I already know how to do this" is the most expensive assumption in software. Verify, then build.

---

## 6. Start From Best Existing, Not From Scratch

**The pattern that fails:** "Let me write this from scratch, it'll be cleaner."
**The pattern that works:** "What's the best existing version? Copy it, then adapt."

This applies to:
- UI components (copy the best existing one, modify)
- API endpoints (copy a working one, change the business logic)
- Config files (copy from a working project, adapt)
- Tests (copy the test structure from a passing suite, change assertions)
- Documentation (copy the best-structured doc, rewrite content)

Starting from scratch introduces bugs that the existing version already solved.

---

## 7. Use What You Have

Before writing ANY code, check:
- Does a library/package already do this? (Don't reinvent)
- Does the project already have a pattern for this? (Don't diverge)
- Does a component/utility already exist? (Don't duplicate)
- Has someone on the team already solved this? (Don't re-solve)

**The 49-session lesson:** We built 351 reusable elements, 600 SVGs, 1400+ components — then wrote 1500 lines of CSS from scratch instead of using them. The most expensive code is code that ignores existing assets.

---

## 8. Meta-Validation

Documentation and configuration drift silently. Check regularly:
- Do documented counts match actual counts? (agents, routes, tables, endpoints)
- Are there orphans? (code referenced in docs but deleted from codebase)
- Are there ghosts? (code in codebase but missing from docs)
- Do file paths in documentation still resolve?
- Do environment variable names in docs match actual .env files?

**Automate this.** A script that runs in 2 seconds and catches drift is worth more than a manual audit that runs never.

---

## 9. Real Consequences Force Quality

The only honest quality test: **"Would I be embarrassed if a paying client saw this right now?"**

Not "does it pass the linter." Not "does it match the spec." Not "is it technically correct."

Would. You. Be. Embarrassed.

If yes, it's not done. No amount of gate-passing changes that.

---

## 10. Code Review After Every Major Step

Not at the end. Not "when it's ready." After EVERY significant implementation step:
- Does this match the plan?
- Does it follow existing patterns?
- Are there obvious bugs I'm blind to because I just wrote it?
- Would a fresh pair of eyes catch something I missed?

In Claude Code: dispatch the code-reviewer agent after each major step. It's not optional.

---

## 11. Hook/Gate Pattern

For any workflow where quality matters, insert gates:

```
[prerequisite check] → GATE → [work] → GATE → [more work] → GATE → [ship]
```

Gates are:
- **Machine-enforced** (script exits non-zero = blocked)
- **Specific** (checks one thing clearly, not "general quality")
- **Fast** (< 2 seconds, so nobody skips them)
- **Honest** (fails loudly, not silently)

The honor system doesn't work. "Remember to check X" becomes "forgot to check X" within 3 sessions. Machines don't forget.

---

## 12. The Failure Patterns (What Goes Wrong)

From 49 sessions of building with AI assistance:

| Pattern | What Happens | Fix |
|---------|-------------|-----|
| **The Dump** | AI writes 2000 lines in one shot, no review between sections | Build incrementally, review each unit |
| **The Invisible Effect** | Effects/features are technically present but imperceptible to users | Set minimum visibility/impact thresholds |
| **The Shortcut** | "Let me skip the pipeline and just write the code directly" | Pipeline exists because shortcuts produce garbage. Follow it. |
| **The Assumption** | "I know what's in that file" (you don't, it changed 3 sessions ago) | Read it. Every time. |
| **The Drift** | Documentation says X, code does Y, neither notices | Automated meta-validation scripts |
| **The Dead Enforcement** | Hook/test/gate exists in config but never fires | D1 activation audit after every change |
| **The Wrong Check** | Gate fires but validates a stale condition | D2 logic audit — read the check code |
| **The Honor System** | "Remember to run the linter" → nobody remembers | Machine-enforce it. Hook, CI step, pre-commit. |
| **The Fake Pass** | Gate passes but output is still bad | D3 bypass audit — is the gate checking the right thing at the right threshold? |
| **The Rebuild Trap** | Writing from scratch instead of composing from existing assets | Check what exists FIRST. Copy best → adapt. |

---

## 13. Project Structure Standard

Every new project MUST start with proper structure. Don't scatter files — organize from day one.

```
project-name/
├── .claude/                    # Claude Code config (auto-created by claude)
│   ├── settings.json           # Hooks, permissions, model config
│   ├── settings.local.json     # Local overrides (gitignored)
│   └── agents/                 # Custom subagents (if needed)
│
├── src/                        # Application source code
│   ├── app/                    # Routes / pages (Next.js App Router, etc.)
│   ├── components/             # Reusable UI components
│   │   ├── ui/                 # Base primitives (buttons, inputs, cards)
│   │   └── [feature]/          # Feature-specific components
│   ├── lib/                    # Shared utilities, API clients, helpers
│   │   ├── api/                # External API wrappers (never in components)
│   │   ├── utils/              # Pure utility functions
│   │   └── config/             # Environment, constants, feature flags
│   ├── features/               # Feature-based modules (domain logic)
│   │   └── [feature-name]/     # Each feature is self-contained
│   │       ├── components/     # Feature-specific components
│   │       ├── hooks/          # Feature-specific hooks
│   │       ├── actions/        # Server actions / mutations
│   │       └── types.ts        # Feature-specific types
│   ├── types/                  # Shared type definitions
│   └── styles/                 # Global styles, CSS variables, themes
│
├── public/                     # Static assets (images, fonts, favicons)
├── docs/                       # Project documentation
│   ├── DEVELOPMENT_WORKFLOW.md # How to develop in this project
│   └── decisions/              # Architecture Decision Records (ADRs)
│
├── scripts/                    # Build scripts, automation, utilities
├── tests/                      # Test files (mirror src/ structure)
│
├── CLAUDE.md                   # Project instructions for Claude Code
├── .env.example                # Template for environment variables
├── .gitignore                  # Must include .env*.local, node_modules, .next
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript config (strict: true)
└── README.md                   # Project overview (for humans)
```

### Structure Rules

1. **Feature-based, not type-based.** Group by domain (`features/auth/`, `features/billing/`) not by file type (`controllers/`, `models/`, `services/`). When a feature is deleted, one folder goes — not 6 scattered files.

2. **API logic NEVER in components.** Components render. `lib/api/` talks to external services. Components call hooks that call lib functions.

3. **Types mirror API responses.** Don't invent types — derive them from what the API actually returns. Suffix with purpose: `UserResponse`, `CreateProjectPayload`.

4. **No `process.env` outside `lib/config/`.** One file reads environment variables, validates them, and exports typed constants. Everything else imports from config.

5. **Each feature is self-contained.** A feature folder has its own components, hooks, actions, and types. Shared code lives in `lib/` or `components/ui/`. If two features share a component, move it to `components/`.

6. **Naming conventions:**
   - Files: `kebab-case.ts` (not camelCase, not PascalCase)
   - Components: `PascalCase` (the export, not the file)
   - Functions: `camelCase`
   - Constants: `SCREAMING_SNAKE`
   - Types: `PascalCase` with suffix (`Response`, `Payload`, `Config`)

7. **CLAUDE.md is mandatory.** Every project gets one. It tells Claude Code the project's conventions, commands, architecture rules, and what NOT to do. Without it, every session starts from zero.

---

## 14. How to Build Properly (The Superpowers Sequence)

Don't just start coding. Follow this sequence — it uses Claude Code's built-in superpowers skills to enforce quality at every step.

### Phase 1: Think Before You Code

```
/brainstorming  →  Explore intent, requirements, edge cases, design options
                   BEFORE any implementation. Mandatory for any creative work.
```

- What are we building? Why?
- What are the constraints?
- What already exists that we can use?
- What are 2-3 approaches? Trade-offs of each?

### Phase 2: Plan

```
/writing-plans  →  Write a step-by-step implementation plan
                   with dependencies, risks, and review checkpoints.
```

- Break the work into discrete steps
- Identify which steps can run in parallel
- Mark review checkpoints (where you stop and verify)
- Name the files you'll create/modify

### Phase 3: Execute

```
/executing-plans  →  Execute the plan step by step
                     with review checkpoints between phases.
```

- Follow the plan. Don't deviate without updating it.
- At each checkpoint: does this match the plan? Does it work?
- Use `/dispatching-parallel-agents` for independent tasks
- Use `/subagent-driven-development` for multi-step implementation

### Phase 4: Review

```
/requesting-code-review  →  Review the implementation against
                            the plan, coding standards, and requirements.
```

- Does it match the plan?
- Does it follow existing patterns?
- Are there obvious bugs?
- Would a fresh pair of eyes catch something?

### Phase 5: Verify

```
/verification-before-completion  →  Run verification commands,
                                    confirm output BEFORE claiming done.
```

- Run the tests. Don't assume they pass.
- Check the output visually if applicable.
- Evidence before assertions. Always.

### Phase 6: Debug (When Needed)

```
/systematic-debugging  →  When something breaks, diagnose systematically.
                          Don't guess. Don't retry blindly.
```

- Read the error. What does it actually say?
- Reproduce it. Can you trigger it consistently?
- Isolate it. What's the smallest change that causes it?
- Fix the root cause, not the symptom.

### The Rule

**Never skip Phase 1 and 2.** The #1 failure pattern across 49 sessions: jumping straight to code without thinking or planning. Every time this happened, the output was mediocre and needed rework. Every time the sequence was followed, the output shipped.

---

---

## 15. First-Time Project Setup (Do This ONCE Per Project)

Before writing any code in a new project, run these commands in order:

### Step 1: Install Superpowers Plugin (REQUIRED)

The build sequence in Section 14 depends on the obra/superpowers plugin. Without it, the `/brainstorming`, `/writing-plans`, `/executing-plans`, `/requesting-code-review`, and `/verification-before-completion` commands don't exist.

```bash
claude install obra/superpowers
```

This installs: brainstorming, writing-plans, executing-plans, requesting-code-review, receiving-code-review, verification-before-completion, systematic-debugging, dispatching-parallel-agents, subagent-driven-development, using-git-worktrees, finishing-a-development-branch, test-driven-development, writing-skills.

### Step 2: Create CLAUDE.md

Every project needs a CLAUDE.md at the root. At minimum:

```markdown
# Project Name

## What This Is
[One sentence]

## Tech Stack
[Framework, language, database, deployment]

## Commands
npm run dev / npm run build / npm run test / npm run lint

## Architecture Rules
- Feature-based folders: /features/[domain]/
- API logic in /lib/api/ — never in components
- No process.env outside /lib/config/
- Types mirror API responses

## What Claude Should Never Do
- [Project-specific anti-patterns]

Read `universal-build-discipline.md` before any non-trivial build.
```

### Step 3: Create Folder Structure

Follow Section 13. Create the skeleton before writing any feature code:

```bash
mkdir -p src/{app,components/ui,lib/{api,utils,config},features,types,styles} docs/decisions scripts tests
touch CLAUDE.md .env.example
```

### Step 4: First Commit

Commit the skeleton before adding features. This is your baseline.

---

## How to Apply

1. Run first-time setup (Section 15) on every new project
2. Reference this file in your project's `CLAUDE.md`
3. Create proper folder structure from day one (Section 13)
4. Follow the superpowers build sequence (Section 14) for every feature
5. Implement gates as scripts (fast, specific, machine-enforced)
6. Run loophole scanner (D1-D6) on every gate after implementation
7. Maintain a quality ratchet document per deliverable type
8. Pre-Build Declaration before any non-trivial work
9. Self-review during build, not after
10. Code review after every major step
11. Meta-validation script for documentation drift

The discipline is the product. The code is just the output.
