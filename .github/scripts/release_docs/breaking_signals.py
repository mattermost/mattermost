"""Whether a PR may be a breaking change, from its labels and its release note alone.

Used by the dot release docs for the changelog's **Breaking Changes** callout. Strong: a
breaking-change or deprecation label on the PR, or a removal config-change-checker wrote into
the release note; those get the callout. Weak: wording in the release note ("breaking",
"removed", "deprecated", "no longer", "must now"); a person decides, and no callout is added.
"""

import re

# The lines config-change-checker (check_config_changes_ci._format_lines) writes into a release
# note. The checker no longer exports a pattern for them (it records its lines in a hidden ledger
# in the PR description); this one is defined here, and test_signals_and_reviewers checks it against
# every line shape _format_lines writes, so a change of wording there fails a test here.
CHECKER_LINE = re.compile(
    r"^(Added|Removed) `{1,2}[^`]+`{1,2}.*(configuration setting|API endpoint|audit log event)\."
    r"|^Go runtime updated from \S+ to \S+\."
    r"|^Go runtime set to `{1,2}[^`]+`{1,2}\."
    r"|^🆕 New API file:"
    r"|^🗑️\s+Removed API file:"
)

LABEL_SIGNAL = re.compile(r"(?i)breaking|deprecat")
NEGATED_LABEL = re.compile(r"(?i)\b(?:non|no|not|without)[-_\s]*(?:breaking|deprecat)")
NOTE_WORDS = re.compile(r"(?i)\b(?:breaking|removed|deprecated|no longer|must now)\b")
CHECKER_REMOVAL = re.compile(r"^Removed `{1,2}[^`]+`{1,2}.*(?:configuration setting|API endpoint)\.|^🗑️\s+Removed API file:")
EXCERPT = 160


def is_signal(label: str) -> bool:
    """A breaking-change or deprecation label, not "Non-breaking" or "No deprecation"."""
    return bool(LABEL_SIGNAL.search(label)) and not NEGATED_LABEL.search(label)


def _excerpt(text: str) -> str:
    return text if len(text) <= EXCERPT else text[:EXCERPT - 1] + "…"


def signals(labels, body: str) -> list[tuple[str, bool]]:
    """(why a PR may be a breaking change, whether that is strong evidence) for each signal."""
    from generate_changelog import extract_release_notes  # needs requests; imported where used

    found = [(f"PR label `{label}`", True) for label in sorted(labels) if is_signal(label)]
    for note in extract_release_notes(body or "") or []:
        for line in (part.strip() for part in note.splitlines()):
            if CHECKER_REMOVAL.match(line):
                found.append((f"config-change-checker: {line}", True))
            elif line and not CHECKER_LINE.match(line):
                match = NOTE_WORDS.search(line)
                if match:
                    found.append((f"release note says \"{match.group(0).lower()}\": {_excerpt(line)}", False))
    return found
