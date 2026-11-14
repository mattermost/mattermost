"""Generated content against what was published by hand for past releases.

Fixtures are the files before and after the hand-made change, with the real SHA-256 values
from the published ``.sha256`` files (the version archive is trimmed to the entries around
the change):

- version archive: v12.0.0 (mattermost #38573) and the v12.0.1, v11.11.3, v11.10.4,
  v11.7.14 ESR and v10.11.25 ESR dot releases (mattermost #39357)
- notices.json: v12.0 (mattermost/notices #502)
- env.example: v11.7.0 ESR (mattermost/docker #187)
- the v12.0.0 and v11.7.0 ESR GitHub release descriptions

Highlights are fixed to the ones that were published: which ones Claude picks can't be
replayed, but everything built from them can.
"""

import json
import unittest
from datetime import date

from release_docs import docker_env, github_release, notice, version_archive
from release_docs.changelog import Highlight
from release_docs.versions import Version

from .fakes import fixture, release_server

ESR = "v10.11,v11.7,v12.4"
DOCS = "https://docs.mattermost.com"
V12_HIGHLIGHTS = [
    Highlight("Attribute Management", f"{DOCS}/administration-guide/manage/admin/attribute-management", ""),
    Highlight("Ranked and Hierarchical Attributes", f"{DOCS}/administration-guide/manage/admin/attribute-management#create-an-attribute", ""),
    Highlight("Channel Attributes and Labels", f"{DOCS}/administration-guide/manage/admin/channel-attributes", ""),
    Highlight("Session Attributes", f"{DOCS}/administration-guide/manage/admin/session-attributes", ""),
    Highlight("Improved DM Calls Experience", f"{DOCS}/end-user-guide/collaborate/make-calls", ""),
]


def published_fetch():
    hashes = json.loads(fixture("published-sha256.json"))
    by_file = {}
    for tag, editions in hashes.items():
        v = Version.parse(tag)
        for edition, sha in editions.items():
            by_file[f"{'mattermost-team' if edition == 'team' else 'mattermost'}-{v.plain}-linux-amd64.tar.gz"] = sha
    return release_server(by_file)


class ReplayTest(unittest.TestCase):
    maxDiff = None

    def replay_archive(self, before: str, after: str, versions: list[str]):
        content = fixture(before)
        for tag in versions:
            version = Version.parse(tag)
            result = version_archive.build(version, content, ESR, version_archive.published_facts(version, published_fetch()))
            self.assertEqual(result.todos, [], tag)
            content = result.files[version_archive.ARCHIVE_PATH]
        self.assertEqual(content, fixture(after))

    def test_version_archive_v12_0_0(self):
        self.replay_archive("version-archive-before-v12.0.0.mdx", "version-archive-after-v12.0.0.mdx", ["v12.0.0"])

    def test_version_archive_dot_releases_including_the_v11_7_esr(self):
        self.replay_archive("version-archive-before-dots.mdx", "version-archive-after-dots.mdx",
                            ["v12.0.1", "v11.11.3", "v11.10.4", "v11.7.14", "v10.11.25"])

    def test_upgrade_notice_v12_0(self):
        result = notice.build(Version.parse("v12.0.0"), fixture("notices-before-v12.0.json"), date(2026, 10, 16), V12_HIGHLIGHTS)
        self.assertEqual(result.files[notice.PATH], fixture("notices-after-v12.0.json"))

    def test_docker_env_v11_7_0(self):
        result = docker_env.build(Version.parse("v11.7.0"), fixture("env.example-before-v11.7.0"), ESR)
        self.assertEqual(result.files[docker_env.PATH], fixture("env.example-after-v11.7.0"))

    def test_github_release_text_v12_0_0_and_v11_7_0_esr(self):
        self.assertEqual(github_release.build(Version.parse("v12.0.0"), ESR, V12_HIGHLIGHTS).text,
                         "Mattermost Platform Release 12.0.0 contains multiple new quality of life improvements, including "
                         "Attribute Management, Ranked and Hierarchical Attributes, Channel Attributes and Labels, "
                         "Session Attributes, and Improved DM Calls Experience.")
        names = ["ABAC for Team Admins", "ABAC File Permissions", "Agents v2.0", "Multi-Window Pop-outs for Channels",
                 "Streamlined Channel Sharing", "Elasticsearch 9.0 Support"]
        self.assertEqual(github_release.build(Version.parse("v11.7.0"), ESR, [Highlight(n, "", "") for n in names]).text,
                         "Mattermost Platform Extended Support Release 11.7.0 contains multiple new quality of life "
                         "improvements, including ABAC for Team Admins, ABAC File Permissions, Agents v2.0, Multi-Window "
                         "Pop-outs for Channels, Streamlined Channel Sharing, and Elasticsearch 9.0 Support.")


if __name__ == "__main__":
    unittest.main()
