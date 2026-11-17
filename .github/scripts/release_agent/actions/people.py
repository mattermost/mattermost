"""RELEASE_AGENT_PEOPLE: Hub usernames by role, so names stay out of this public repo.

A JSON object such as {"release_manager": ["amy.blais"], "release_backup": ["eva.sarafianou"],
"qa": ["yasser.khan"]}. A role may be one username or a list. Mentions are only ever made
through a role; a role that isn't set sends with no mention and is flagged.
"""

import json
import re

USERNAME = re.compile(r"^[a-z0-9][a-z0-9._-]*$")


class People:
    def __init__(self, roles: dict | None = None, problem: str = ""):
        self.roles, self.problem = roles or {}, problem
        self.missing = set()  # roles asked for but not set, flagged once each

    @classmethod
    def parse(cls, raw: str) -> "People":
        raw = (raw or "").strip()
        if not raw:
            return cls()
        try:
            data = json.loads(raw)
        except ValueError:
            return cls(problem="RELEASE_AGENT_PEOPLE isn't valid JSON, so nobody is mentioned.")
        if not isinstance(data, dict):
            return cls(problem="RELEASE_AGENT_PEOPLE must be a JSON object of roles, so nobody is mentioned.")
        roles, bad = {}, 0
        for role, value in data.items():
            names = [value] if isinstance(value, str) else value if isinstance(value, list) else []
            valid = [n.strip().lstrip("@").lower() for n in names if isinstance(n, str) and USERNAME.match(n.strip().lstrip("@").lower())]
            bad += len(names) - len(valid) if isinstance(names, list) else 1
            roles[role] = valid
        return cls(roles, f"RELEASE_AGENT_PEOPLE has {bad} unusable entr{'y' if bad == 1 else 'ies'}, which are ignored." if bad else "")

    def usernames(self, role: str) -> list[str]:
        names = self.roles.get(role) or []
        if not names:
            self.missing.add(role)
        return list(names)

    def mention(self, role: str) -> str:
        """``@a @b`` for the role, or "" (and the role is flagged) when it isn't set."""
        return " ".join(f"@{name}" for name in self.usernames(role))

    def flags(self) -> list[str]:
        found = [self.problem] if self.problem else []
        return found + [f"Set RELEASE_AGENT_PEOPLE.{role}: a message went out with no mention for it."
                        for role in sorted(self.missing)]
