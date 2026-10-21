---
name: sync-agent-symlinks
description: Analyze and synchronize agent skill exposure after ai-specs skill changes (additions, removals, renames). Use when skills are added/removed in ai-specs and .claude/skills and .cursor/skills must stay aligned through symlinks.
author: LIDR.co
version: 1.0.0
---

# sync-agent-symlinks Skill

Keep agent-facing skill structures synchronized with `ai-specs/skills` as the canonical source.

Use this skill after any change in `ai-specs/skills` (new skill, removed skill, renamed skill, moved skill), especially when you need to avoid stale or broken symlinks.

## Scope and Safety Rules

- Canonical source is `ai-specs/skills`.
- Mirror targets are:
  - `.claude/skills`
  - `.cursor/skills`
- Manage only entries that are symlinks to `../../ai-specs/skills/<skill-name>`.
- Do not delete non-symlink directories in mirror targets unless the user explicitly asks.
- Never overwrite a real directory automatically; report it as a conflict.

## Workflow

### Step 1 - Build inventories

Collect three inventories:

1. Canonical skills from `ai-specs/skills/*/SKILL.md`
2. Mirror entries in `.claude/skills`
3. Mirror entries in `.cursor/skills`

From mirror entries, classify:
- `linked`: valid symlink pointing to existing canonical skill
- `broken`: symlink target missing
- `orphan`: symlink points to canonical namespace but skill no longer exists
- `conflict`: non-symlink entry with same name as canonical skill
- `external`: entry not managed by canonical symlink policy (leave unchanged)

### Step 2 - Compute sync plan

For each mirror target:

- `to_add`: canonical skills missing in mirror target
- `to_fix`: broken canonical symlinks that should be recreated
- `to_remove`: orphan canonical symlinks with no canonical source
- `to_skip`: conflicts and external entries (report only)

### Step 3 - Apply sync safely

Apply changes in this order:

1. Add missing symlinks:
   - `<mirror>/<skill-name> -> ../../ai-specs/skills/<skill-name>`
2. Fix broken canonical symlinks:
   - Remove broken link and recreate the same canonical link
3. Remove orphan canonical symlinks:
   - Remove symlink only if it points to canonical namespace and skill is gone

Never remove:
- non-symlink directories
- files not under canonical symlink policy

### Step 4 - Verify integrity

After changes:

- Confirm every canonical skill exists in both mirrors as a valid symlink, or is explicitly listed as conflict.
- Confirm no broken canonical symlinks remain.
- Confirm external entries remain untouched.

### Step 5 - Report results

Return a concise sync report:

- Canonical skills count
- Per mirror target:
  - added
  - fixed
  - removed
  - conflicts
  - skipped external entries
- Remaining blockers (if any)

## Add/Remove Scenarios

### Scenario A - New skill added in ai-specs

Expected behavior:
- Add missing symlink in `.claude/skills`
- Add missing symlink in `.cursor/skills`
- Verify both links resolve to canonical folder

### Scenario B - Skill removed from ai-specs

Expected behavior:
- Remove orphan canonical symlink from `.claude/skills`
- Remove orphan canonical symlink from `.cursor/skills`
- Keep non-canonical directories untouched and report them

## Command Patterns (Reference)

Use equivalent commands for your environment:

```bash
# list canonical skill directories (names with SKILL.md)
ls ai-specs/skills

# inspect mirror entries with link metadata
ls -la .claude/skills
ls -la .cursor/skills

# add canonical link
ln -s ../../ai-specs/skills/<skill-name> .claude/skills/<skill-name>
ln -s ../../ai-specs/skills/<skill-name> .cursor/skills/<skill-name>

# remove orphan canonical link
rm .claude/skills/<skill-name>
rm .cursor/skills/<skill-name>
```

## Red Flags

Never:
- treat `ai-specs` as non-canonical
- auto-delete real directories in mirror targets
- leave broken canonical symlinks after sync
- silently skip conflicts without reporting

Always:
- analyze before changing
- apply minimal safe changes
- preserve non-canonical entries
- provide a final sync report with blockers
