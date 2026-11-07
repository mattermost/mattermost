"""Release docs and comms (Phase 3 of the release automation) that need no release agent.

Each task turns release facts into a draft PR, a release description, or text for the run
summary. Pure transforms live in their own modules; ``publish`` is the only code that
writes to GitHub. Standard library only, apart from ``changelog_release`` (the ESR helper
the changelog workflow uses) and, for the breaking-change drafts, ``generate_changelog``.
"""
