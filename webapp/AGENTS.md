# Webapp Review Guidelines

When reviewing or writing code in the webapp, pay special attention to
dependency management and build tooling changes.

## Dependency Changes

Any PR that modifies `package.json` or `package-lock.json` needs extra
scrutiny:

- **No duplicate libraries.** Before adding a new dependency, check whether an
  existing one already covers the same use case. Multiple libraries for the same
  purpose (e.g., two different date pickers, or Bootstrap 3 and Bootstrap 4
  simultaneously) create long-term upgrade pain.
- **License check.** New dependencies must not use GPL or similarly restrictive
  licenses. Dependencies with no license at all should also be flagged.
- **Justify the addition.** A new dependency should solve a real problem that
  existing code or dependencies don't already address. Push back on adding
  packages for trivial functionality.
- **Version conflicts.** Check whether the new dependency introduces conflicting
  peer dependency versions. Cascading version conflicts are expensive to untangle
  later and have historically blocked upgrades for months.

## Build Tooling

Changes to `Makefile` or `webapp/scripts/` affect the entire webapp build
pipeline. Review these carefully:

- Verify the change doesn't break the existing build, dev-server, or test
  workflows.
- Check for unintended side effects on CI pipelines.

## Why This Matters

Dependency and build issues compound over time. A conflicting dependency added
today may not surface as a problem until someone tries to do a routine upgrade
months later, at which point the original author has moved on and the fix
requires deep archaeology. Catching these early is far cheaper than fixing them
after they've been baked in.
