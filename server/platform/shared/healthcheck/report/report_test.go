// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package report

import (
	"bytes"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	serveri18n "github.com/mattermost/mattermost/server/v8/i18n"
)

var update = flag.Bool("update", false, "rewrite the golden files in testdata")

var (
	evaluatedAt = time.Date(2026, time.November, 18, 9, 30, 0, 0, time.UTC)
	generatedAt = evaluatedAt.Add(20 * time.Minute)
)

func TestMain(m *testing.M) {
	if err := i18n.TranslationsPreInitFromFileBytes("en.json", serveri18n.English); err != nil {
		panic(err)
	}
	os.Exit(m.Run())
}

func testOptions() Options {
	return Options{
		T:             i18n.T,
		Location:      time.UTC,
		GeneratedAt:   generatedAt,
		SiteURL:       "https://chat.example.com",
		ServerVersion: "12.3.0",
		License:       "Enterprise",
		Company:       "Example Corp",
	}
}

func finding(code, severity, state string, area model.HealthArea, title string) *model.HealthFinding {
	return &model.HealthFinding{
		Fingerprint: code,
		Code:        code,
		Severity:    severity,
		State:       state,
		Area:        area,
		Title:       title,
	}
}

func everySectionFindings() []*model.HealthFinding {
	push := finding("PUSH_BAD_SCHEME", "critical", "firing", model.AreaNotifications, "PushNotificationServer does not use https://")
	push.Message = "PushNotificationServer http://push.example.com uses http://, so push notifications are sent in cleartext."
	push.Remediation = "Prefix PushNotificationServer with https:// and verify reachability from the app node."
	push.DocsURL = "https://docs.mattermost.com/configure/environment-configuration-settings.html#push-notification-server"
	push.ConsolePath = "/admin_console/environment/push_notification_server"
	push.Details = map[string]string{"push_server": "http://push.example.com", "config_key": "EmailSettings.PushNotificationServer"}

	eol := finding("VERSION_EOL", "critical", "firing", model.AreaVersion, "Mattermost version is past end-of-life")
	eol.Message = "Running Mattermost 11.0.4. Support for this release line ended on 2026-01-15."
	eol.Remediation = "Plan a staged upgrade to a supported release."

	disk := finding("FILESTORE_DISK_LOW", "warning", "firing", model.AreaPlatform, "File storage disk space is low")
	disk.Scope = "app-1.example.com"
	disk.Message = "The volume containing FileSettings.Directory has 9.0 GiB (9.00%) available of 100.0 GiB."
	disk.Remediation = "Expand the volume."
	disk.ConsolePath = "/admin_console/environment/file_storage"

	ldap := finding("LDAP_SYNC_OLD", "warning", "firing", model.AreaAuth, "AD/LDAP synchronization has not run recently")

	custom := finding("CUSTOM", "info", "firing", model.HealthArea("experimental"), "A rule in an area this build does not know")
	custom.Message = "Shown under its raw area name. Pasting @channel stays inert, and https://example.com/a_b stays linked."

	load := finding("NODE_HOST_LOAD_HIGH", "info", "unknown", model.AreaPlatform, "Host load is high")
	load.Scope = "app-2.example.com"
	load.Message = "Server diagnostics unavailable."

	muted := finding("SITE_URL_HTTP", "warning", "firing", model.AreaCluster, "Site URL is not HTTPS")
	muted.Message = "SiteURL http://chat.example.com does not use https://."
	muted.Remediation = "Serve Mattermost over HTTPS and update SiteURL."
	muted.MutedAt = evaluatedAt.UnixMilli()
	muted.MutedBy = "muting-admin-user-id"

	mutedUnknown := finding("GOMAXPROCS", "warning", "unknown", model.AreaPlatform, "GOMAXPROCS exceeds the container CPU limit")
	mutedUnknown.Message = "GOMAXPROCS is 16 and the container CPU limit is 4."
	mutedUnknown.Remediation = "Unset GOMAXPROCS."
	mutedUnknown.MutedAt = evaluatedAt.UnixMilli()
	mutedUnknown.MutedBy = "muting-admin-user-id"

	resolved := finding("SITE_URL_EMPTY", "critical", "resolved", model.AreaCluster, "Site URL is empty")

	return []*model.HealthFinding{resolved, mutedUnknown, muted, load, custom, ldap, disk, eol, push}
}

func mutedAndResolvedFindings() []*model.HealthFinding {
	open := finding("PUSH_BAD_SCHEME", "critical", "firing", model.AreaNotifications, "PushNotificationServer does not use https://")

	mutedResolved := finding("SITE_URL_HTTP", "warning", "resolved", model.AreaCluster, "Site URL is not HTTPS")
	mutedResolved.Message = "SiteURL http://chat.example.com does not use https://."
	mutedResolved.MutedAt = evaluatedAt.UnixMilli()
	mutedResolved.MutedBy = "muting-admin-user-id"

	muted := finding("AUDIT_LOG_OFF", "info", "firing", model.AreaCompliance, "Audit logging is off")
	muted.Message = "No audit log target is configured."
	muted.MutedAt = evaluatedAt.UnixMilli()
	muted.MutedBy = "muting-admin-user-id"

	return []*model.HealthFinding{mutedResolved, muted, open}
}

func TestGolden(t *testing.T) {
	packetOptions := testOptions()
	packetOptions.SiteURL, packetOptions.License, packetOptions.Company = "", "", ""
	packetOptions.PointInTime = true
	packetOptions.Notes = []string{
		"Evaluated offline from a Support Packet. The packet is a point-in-time snapshot: findings describe the server when the packet was generated, not its current state.",
		"The packet has no metadata.yaml.",
	}
	packetOptions.GeneratedAt = evaluatedAt.Add(30 * 24 * time.Hour)

	staleOptions := testOptions()
	staleOptions.GeneratedAt = evaluatedAt.Add(staleAfter + time.Minute)
	staleOptions.Location = time.FixedZone("CET", 60*60)

	for _, tc := range []struct {
		name string
		list *model.HealthFindingList
		opts Options
	}{
		{"every_section", &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: everySectionFindings()}, testOptions()},
		{"empty", &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli()}, Options{T: i18n.T, Location: time.UTC, GeneratedAt: generatedAt}},
		{"not_evaluated", &model.HealthFindingList{}, testOptions()},
		{"stale", &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: mutedAndResolvedFindings()[2:]}, staleOptions},
		{"packet", &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: everySectionFindings()[3:]}, packetOptions},
		{"muted_and_resolved", &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: mutedAndResolvedFindings()}, testOptions()},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := Build(tc.list, tc.opts)

			var html, markdown bytes.Buffer
			require.NoError(t, r.WriteHTML(&html))
			require.NoError(t, r.WriteMarkdown(&markdown))

			assertGolden(t, tc.name+".html", html.String())
			assertGolden(t, tc.name+".md", markdown.String())
		})
	}
}

func assertGolden(t *testing.T, name, got string) {
	t.Helper()
	path := filepath.Join("testdata", name)
	if *update {
		require.NoError(t, os.WriteFile(path, []byte(got), 0o644))
		return
	}
	want, err := os.ReadFile(path)
	require.NoError(t, err, "run go test -update to create the golden file")
	assert.Equal(t, string(want), got)
}

func TestBuild(t *testing.T) {
	list := &model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: everySectionFindings()}

	t.Run("places each finding in exactly one section", func(t *testing.T) {
		r := Build(list, testOptions())

		titles := map[SectionKind][]string{}
		for _, section := range r.Sections {
			for _, f := range section.Findings {
				titles[section.Kind] = append(titles[section.Kind], f.Title)
			}
		}
		assert.Equal(t, map[SectionKind][]string{
			SectionCritical: {"PushNotificationServer does not use https://", "Mattermost version is past end-of-life"},
			SectionWarning:  {"AD/LDAP synchronization has not run recently", "File storage disk space is low on app-1.example.com"},
			SectionInfo:     {"A rule in an area this build does not know"},
			SectionUnknown:  {"Host load is high on app-2.example.com"},
			SectionMuted:    {"Site URL is not HTTPS", "GOMAXPROCS exceeds the container CPU limit"},
			SectionResolved: {"Site URL is empty"},
		}, titles)
		assert.Equal(t, "2 critical, 2 warnings, 1 info, 1 could not be evaluated", r.Summary)
	})

	t.Run("does not reorder the caller's findings", func(t *testing.T) {
		findings := everySectionFindings()
		Build(&model.HealthFindingList{Findings: findings}, testOptions())
		assert.Equal(t, everySectionFindings(), findings)
	})

	t.Run("an evaluation exactly staleAfter old is not stale", func(t *testing.T) {
		opts := testOptions()
		opts.GeneratedAt = evaluatedAt.Add(staleAfter)
		assert.Empty(t, Build(list, opts).Stale)

		opts.GeneratedAt = opts.GeneratedAt.Add(time.Millisecond)
		assert.Equal(t, "Evaluation appears to have stopped.", Build(list, opts).Stale)
	})

	t.Run("a server clock ahead of the generating host gives no age", func(t *testing.T) {
		opts := testOptions()
		opts.GeneratedAt = evaluatedAt.Add(-2 * time.Minute)
		r := Build(list, opts)
		assert.Zero(t, r.Age)
		assert.Empty(t, r.Stale)
	})

	t.Run("counts the findings when no evaluation has completed", func(t *testing.T) {
		r := Build(&model.HealthFindingList{Findings: everySectionFindings()}, testOptions())
		assert.Equal(t, "2 critical, 2 warnings, 1 info, 1 could not be evaluated", r.Summary)
		assert.Equal(t, "Not evaluated yet", r.EvaluatedAt.Value)
	})

	t.Run("leaves out the remediation of a check that could not run", func(t *testing.T) {
		muted := Build(list, testOptions()).Sections[4]
		require.Equal(t, SectionMuted, muted.Kind)
		assert.False(t, muted.Findings[0].Unknown)
		assert.Equal(t, "Serve Mattermost over HTTPS and update SiteURL.", muted.Findings[0].Remediation)
		assert.True(t, muted.Findings[1].Unknown)
		assert.Empty(t, muted.Findings[1].Remediation)
	})

	t.Run("a nil Location shows times in UTC", func(t *testing.T) {
		opts := testOptions()
		opts.Location = nil
		assert.Equal(t, "2026-11-18 09:30 UTC", Build(list, opts).EvaluatedAt.Value)
	})

	t.Run("muted and resolved findings are not counted as open", func(t *testing.T) {
		r := Build(&model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: everySectionFindings()[:1]}, testOptions())
		assert.Equal(t, "No open findings.", r.Summary)
	})

	t.Run("a point-in-time evaluation is never stale", func(t *testing.T) {
		opts := testOptions()
		opts.GeneratedAt = evaluatedAt.Add(365 * 24 * time.Hour)
		opts.PointInTime = true
		assert.Empty(t, Build(list, opts).Stale)
	})

	t.Run("a point-in-time evaluation without a collection time shows it as unknown", func(t *testing.T) {
		opts := testOptions()
		opts.PointInTime = true
		r := Build(&model.HealthFindingList{}, opts)
		assert.Equal(t, Field{"Data collected", "Unknown"}, r.EvaluatedAt)
		assert.Equal(t, "No open findings.", r.Summary)
	})

	t.Run("links a finding's setting into the System Console under the site URL", func(t *testing.T) {
		for siteURL, want := range map[string]string{
			"https://chat.example.com":       "https://chat.example.com/admin_console/environment/file_storage",
			"https://example.com/chat/":      "https://example.com/chat/admin_console/environment/file_storage",
			"":                               "",
			"https://chat.example.com/%zz/x": "",
		} {
			opts := testOptions()
			opts.SiteURL = siteURL
			r := Build(&model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: everySectionFindings()[6:7]}, opts)
			assert.Equal(t, want, r.Sections[0].Findings[0].ConsoleURL, siteURL)
		}
	})

	t.Run("names the file after the license customer and the time generated, in Location", func(t *testing.T) {
		for _, tc := range []struct {
			company  string
			location *time.Location
			want     string
		}{
			{"Acme Corp.", time.UTC, "mm_site_health_Acme_Corp_2026-11-18T09-50"},
			{"Acme Corp.", time.FixedZone("HST", -10*60*60), "mm_site_health_Acme_Corp_2026-11-17T23-50"},
			{"", time.UTC, "mm_site_health_mattermost_2026-11-18T09-50"},
			{"...", time.UTC, "mm_site_health_mattermost_2026-11-18T09-50"},
		} {
			opts := testOptions()
			opts.Company, opts.Location = tc.company, tc.location
			assert.Equal(t, tc.want, Build(list, opts).FileName, tc.company)
		}
	})

	t.Run("never exports who muted a finding", func(t *testing.T) {
		var html, markdown bytes.Buffer
		r := Build(list, testOptions())
		require.NoError(t, r.WriteHTML(&html))
		require.NoError(t, r.WriteMarkdown(&markdown))
		assert.NotContains(t, html.String(), "muting-admin-user-id")
		assert.NotContains(t, markdown.String(), "muting-admin-user-id")
	})
}

func TestEscaping(t *testing.T) {
	const hostile = "<script>alert(1)</script> **bold** [link](javascript:alert(1)) `code` # | ~ _x_ &amp;\n- item"

	evil := finding("EVIL", "critical", "firing", model.HealthArea("<i>area</i>"), "Title "+hostile)
	evil.Subject = hostile
	evil.Scope = "<img src=x onerror=alert(1)>"
	evil.Message = hostile
	evil.Remediation = hostile
	evil.DocsURL = "javascript:alert(1)"
	evil.Details = map[string]string{"<b>key</b>": hostile}

	unknown := finding("EVIL_UNKNOWN", "warning", "unknown", model.AreaAuth, "1. "+hostile)
	unknown.Message = "+ " + hostile
	unknown.Code = "EVIL`CODE"

	opts := testOptions()
	opts.Company = hostile
	opts.Notes = []string{hostile}
	r := Build(&model.HealthFindingList{EvaluatedAt: evaluatedAt.UnixMilli(), Findings: []*model.HealthFinding{evil, unknown}}, opts)

	t.Run("html", func(t *testing.T) {
		var b bytes.Buffer
		require.NoError(t, r.WriteHTML(&b))
		out := b.String()

		for _, raw := range []string{"<script", "<img", "<b>", "<i>", `href="javascript:`} {
			assert.NotContains(t, out, raw)
		}
		assert.Contains(t, out, "&lt;script&gt;alert(1)&lt;/script&gt;")
		assert.Contains(t, out, "&amp;amp;")
		assert.Contains(t, out, `<a href="#ZgotmplZ">`)
	})

	t.Run("markdown", func(t *testing.T) {
		var b bytes.Buffer
		require.NoError(t, r.WriteMarkdown(&b))
		out := b.String()

		escaped := `\<script\>alert(1)\</script\> \*\*bold\*\* \[link\](javascript:alert(1)) \` + "`" + `code\` + "`" + ` \# \| \~ \_x\_ \&amp; - item`
		assert.Equal(t, 7, strings.Count(out, escaped), "every hostile value renders escaped")
		assert.Contains(t, out, `on \<img src=x onerror=alert(1)\>`)
		assert.Contains(t, out, `- **1\. `+escaped)
		assert.Contains(t, out, "** EVIL\\`CODE (Warning): \\+ "+escaped, "a backtick in a rule code cannot open a code span")
		assert.Contains(t, out, `\[\<i\>area\</i\>\]`)
		assert.Contains(t, out, "\nRead the documentation: javascript:alert(1)\n")

		for line := range strings.Lines(out) {
			assert.False(t, strings.HasPrefix(line, "- item"), "a value broke out onto its own line: %q", line)
		}
	})
}

func TestEscapeMarkdown(t *testing.T) {
	for in, want := range map[string]string{
		"plain text":     "plain text",
		"- not a list":   `\- not a list`,
		"+ not a list":   `\+ not a list`,
		"12.3.0":         "12.3.0",
		"12. not a list": `12\. not a list`,
		"3) not a list":  `3\) not a list`,
		"2026-11-18":     "2026-11-18",
		"  indented":     "indented",
		"a\nb\r\nc":      "a b c",
		"":               "",

		"notify @channel, @all and @here.":               "notify `@channel`, `@all` and `@here`.",
		"mail admin@example.com":                         "mail admin@example.com",
		"see https://chat.example.com/my_team#x_y.":      "see https://chat.example.com/my_team#x_y.",
		"https://example.com/@support":                   "`https://example.com/@support`",
		"see https://host.example.com/@all.":             "see `https://host.example.com/@all.`",
		"_@here_ and __@all":                             "`_@here_` and `__@all`",
		"@all@here and @user@example.com":                "`@all@here` and `@user@example.com`",
		"mail first_last@example.com":                    `mail first\_last@example.com`,
		"https://x.example.com/a_b <b>":                  `https://x.example.com/a_b \<b\>`,
		"https://x.example.com/[x](javascript:alert(1))": `https://x.example.com/\[x\](javascript:alert(1))`,
	} {
		assert.Equal(t, want, escapeMarkdown(in), in)
	}
}
