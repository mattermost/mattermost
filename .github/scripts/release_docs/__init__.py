"""Release docs automation: the release docs and comms tasks that only write to public GitHub repos.

Each task turns public release facts into a draft PR, a release description, or text for the
run summary. Pure transforms live in their own modules; ``publish`` is the only code that
writes to GitHub. Standard library only, apart from ``changelog_release`` (the ESR helper
the changelog workflow uses) and ``generate_changelog`` (its release-note parser).
"""
