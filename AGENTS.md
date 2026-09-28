# BDV Travel OS — Codex guide

`main` is production. Never push or merge to it. One task per branch, named `codex/<slug>`. A merge needs one approving review from someone other than the author.

## Pull request diagrams (PR Lens)

Every pull request carries a PR Lens diagram. Before opening or updating a PR, follow `.agents/skills/pr-lens/SKILL.md`.

- Diff against the merge base, not the tip of `main`.
- Write `.pr-lens/graph.json`, validate it, and render it with the light theme.
- Put the architecture diagram at the top of the PR body. Add a data-flow diagram only when the change has a sequence.
- Show the diagrams and how they match the plan, and wait for a person before you open or update the PR.
- Do not commit `.pr-lens/`. Corrections go in `.github/pr-lens.yml`.

The same skill is installed for the other agents. Keep all three copies identical:

- Codex: `.agents/skills/pr-lens/`
- Claude Code: `.claude/skills/pr-lens/`
- Cursor: `.cursor/skills/pr-lens/`
