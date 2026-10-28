"""What a task produces, and the TODO markers that stand in for inputs it could not get."""

from dataclasses import dataclass, field

TODO_MARKER = "TODO(release-agent)"
LABEL = "release-agent"


def branch_name(version: str, task: str) -> str:
    """Every PR's branch, so Phase 1 can find it by task: ``release-agent/v12.2.0/version-archive``."""
    return f"release-agent/{version}/{task}"


@dataclass
class Result:
    task: str
    version: str
    repo: str = ""
    title: str = ""
    body: str = ""
    files: dict = field(default_factory=dict)  # repo path -> new text, for PR tasks
    text: str = ""  # for tasks whose output is text: a release description, posts, drafts
    todos: list = field(default_factory=list)
    notes: list = field(default_factory=list)
    skipped: str = ""  # why the task does not apply to this version

    def todo(self, reason: str, bare: bool = False) -> str:
        """Record a missing input and return the visible marker to put where the value goes.

        ``bare`` leaves the reason out of the marker, for places that can't hold a colon or a
        sentence (a Mermaid task name); the reason is still listed in the PR body.
        """
        if reason not in self.todos:
            self.todos.append(reason)
        return TODO_MARKER if bare else f"{TODO_MARKER}: {reason}"

    @property
    def branch(self) -> str:
        return branch_name(self.version, self.task)

    @property
    def failed(self) -> bool:
        return bool(self.todos)

    def todo_section(self) -> str:
        if not self.todos:
            return ""
        lines = ["", "#### Missing inputs", "", "This PR is incomplete. Each item is also marked "
                 f"`{TODO_MARKER}` where the value belongs:", ""]
        lines += [f"- [ ] {reason}" for reason in self.todos]
        return "\n".join(lines) + "\n"
