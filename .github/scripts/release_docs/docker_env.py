"""The ESR version in mattermost/docker's env.example (playbook T-5, ESRs only)."""

import re

from .result import Result
from .versions import Version, esr_lines, is_esr

TASK = "docker-env"
REPO = "mattermost/docker"
PATH = "env.example"
TAG_LINE = re.compile(r"(?m)^MATTERMOST_IMAGE_TAG=(\S*)[ \t]*$")


def build(version: Version, env_example: str, esr_versions: str) -> Result:
    result = Result(TASK, version.tag, repo=REPO)
    if not esr_lines(esr_versions):
        result.todo("CHANGELOG_ESR_VERSIONS is empty, so it is unknown whether this is an ESR")
        return result
    if not is_esr(version, esr_versions):
        result.skipped = f"{version.short} is not an ESR line in CHANGELOG_ESR_VERSIONS"
        return result
    match = TAG_LINE.search(env_example)
    if not match:
        result.todo(f"{PATH} has no MATTERMOST_IMAGE_TAG line")
        return result
    try:
        current = Version.parse(match.group(1))
    except ValueError:
        result.todo(f"{PATH} has MATTERMOST_IMAGE_TAG={match.group(1)}, which is not a version")
        return result
    if current >= version:
        result.skipped = f"{PATH} already has {current.plain}; the version is never lowered"
        return result
    result.files[PATH] = env_example[:match.start(1)] + version.plain + env_example[match.end(1):]
    result.title = f"Update env.example to Mattermost {version.plain} ESR"
    result.body = (
        f"Updates `MATTERMOST_IMAGE_TAG` in `{PATH}` from `{current.plain}` to `{version.plain}`, "
        f"the latest {version.short} Extended Support Release.\n\n"
        "Playbook (T-5): For ESRs, update the Docker file env.example.\n"
    )
    return result
