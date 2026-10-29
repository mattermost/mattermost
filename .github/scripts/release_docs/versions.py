"""Versions and the dates calculated from them: support ends, the next ESR, ESR comms."""

import re
from dataclasses import dataclass
from datetime import date

from changelog_release import parse_version, release_type_for

DOCS_SITE = "https://docs.mattermost.com"
RELEASES_SITE = "https://releases.mattermost.com"
ESR_CADENCE_MONTHS = 9
ESR_SUPPORT_MONTHS = 12
REGULAR_SUPPORT_MONTHS = 3
SUPPORT_END_DAY = 15
PLANNED_RELEASE_DAY = 16
ESR_COMMS_LEAD_MONTHS = 3

ANCHOR_SUFFIX = {"major": "major-release", "feature": "feature-release", "esr": "extended-support-release"}


@dataclass(frozen=True, order=True)
class Version:
    major: int
    minor: int
    patch: int = 0

    @classmethod
    def parse(cls, text: str) -> "Version":
        return cls(*parse_version(text))

    @property
    def tag(self) -> str:
        return f"v{self.major}.{self.minor}.{self.patch}"

    @property
    def plain(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"

    @property
    def short(self) -> str:
        return f"v{self.major}.{self.minor}"

    @property
    def line(self) -> tuple[int, int]:
        return self.major, self.minor

    @property
    def is_dot(self) -> bool:
        return self.patch > 0

    def __str__(self) -> str:
        return self.tag


def esr_lines(esr_versions: str) -> list[Version]:
    """The ``X.Y`` lines in ``CHANGELOG_ESR_VERSIONS``, oldest first."""
    return sorted({Version(*parse_version(v)[:2]) for v in re.split(r"[\s,]+", esr_versions or "") if v.strip()})


def is_esr(version: Version, esr_versions: str) -> bool:
    """Whether ``version``'s ``X.Y`` is listed, decided by the changelog workflow's own helper."""
    return release_type_for(version.tag, "auto", esr_versions) == "esr"


def release_type(version: Version, esr_versions: str) -> str:
    return release_type_for(version.tag, "auto", esr_versions)


def changelog_page(version: Version) -> str:
    return f"mattermost-v{version.major}-changelog"


def changelog_anchor(version: Version, esr_versions: str) -> str:
    return f"release-v{version.major}-{version.minor}-{ANCHOR_SUFFIX[release_type(version, esr_versions)]}"


def changelog_url(version: Version, esr_versions: str) -> str:
    """The published changelog entry, in the ``.html`` form the version archive links."""
    return f"{DOCS_SITE}/product-overview/{changelog_page(version)}.html#{changelog_anchor(version, esr_versions)}"


def changelog_page_url(version: Version) -> str:
    return f"{DOCS_SITE}/product-overview/{changelog_page(version)}.html"


def add_months(day: date, months: int, on_day: int | None = None) -> date:
    """``day`` moved by whole months, on ``on_day`` if given, else the same day clamped to the month."""
    index = day.year * 12 + day.month - 1 + months
    year, month = divmod(index, 12)
    month += 1
    target = on_day or day.day
    while True:
        try:
            return date(year, month, target)
        except ValueError:
            target -= 1


def support_end(release_day: date, esr: bool) -> date:
    """The 15th of the month three months (regular) or twelve months (ESR) after release.

    Matches the server releases table: released 2026-10-16, ends 2027-01-15; the v11.7
    ESR, released 2026-05-15, ends 2027-05-15.
    """
    return add_months(release_day, ESR_SUPPORT_MONTHS if esr else REGULAR_SUPPORT_MONTHS, SUPPORT_END_DAY)


def planned_next_esr_day(current_esr_release_day: date) -> date:
    """Nine months after the current ESR, on the 16th (the release-day convention)."""
    return add_months(current_esr_release_day, ESR_CADENCE_MONTHS, PLANNED_RELEASE_DAY)


def next_esr_line(current: Version, esr_versions: str) -> tuple[Version | None, str | None]:
    """(the ESR after ``current`` from ``CHANGELOG_ESR_VERSIONS``, why it can't be trusted).

    Nine monthly releases after ``current`` is ``X.(Y+9)`` unless a major release comes
    between, which only people decide; within one major the listed line must match.
    """
    later = [line for line in esr_lines(esr_versions) if line.line > current.line]
    if not later:
        return None, f"CHANGELOG_ESR_VERSIONS lists no ESR after {current.short}"
    listed = later[0]
    if listed.major == current.major and listed.minor != current.minor + ESR_CADENCE_MONTHS:
        expected = f"v{current.major}.{current.minor + ESR_CADENCE_MONTHS}"
        return listed, (f"CHANGELOG_ESR_VERSIONS lists {listed.short} as the ESR after {current.short}, "
                        f"but nine months after {current.short} is {expected}")
    return listed, None


def esr_comms_dates(esr_end: date) -> tuple[date, date]:
    """The two ESR emails: three months before support ends, and the day it ends."""
    return add_months(esr_end, -ESR_COMMS_LEAD_MONTHS), esr_end


def long_date(day: date) -> str:
    """``May 15, 2027``, as the release policy page writes dates."""
    return f"{day.strftime('%B')} {day.day}, {day.year}"


def tarball_name(version: Version, edition: str) -> str:
    prefix = "mattermost-team" if edition == "team" else "mattermost"
    return f"{prefix}-{version.plain}-linux-amd64.tar.gz"


def download_url(version: Version, edition: str) -> str:
    return f"{RELEASES_SITE}/{version.plain}/{tarball_name(version, edition)}"


def sbom_url(version: Version, edition: str) -> str:
    """Enterprise SBOMs are on releases.mattermost.com; Team Edition's is a GitHub release asset."""
    if edition == "team":
        return f"https://github.com/mattermost/mattermost/releases/download/{version.tag}/sbom-mattermost-{version.tag}.json"
    return f"{RELEASES_SITE}/{version.plain}/sbom-enterprise-{version.tag}.json"
