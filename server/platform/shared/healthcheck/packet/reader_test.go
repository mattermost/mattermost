// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package packet

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io/fs"
	"maps"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	_ "github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules"
)

const (
	pushSubject    = "EmailSettings.PushNotificationServer"
	siteURLSubject = "ServiceSettings.SiteURL"
)

type finding struct {
	Code    string
	State   healthcheck.State
	Subject string
	Scope   string
}

func fixtureFiles(t *testing.T, name string) map[string][]byte {
	t.Helper()

	dir := filepath.Join("testdata", name)
	files := map[string][]byte{}
	err := filepath.WalkDir(dir, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil || entry.IsDir() {
			return walkErr
		}

		rel, err := filepath.Rel(dir, path)
		if err != nil {
			return err
		}
		files[filepath.ToSlash(rel)], err = os.ReadFile(path)
		return err
	})
	require.NoError(t, err)
	require.NotEmpty(t, files)

	return files
}

func zipFiles(t *testing.T, files map[string][]byte) []byte {
	t.Helper()

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for _, name := range slices.Sorted(maps.Keys(files)) {
		w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		require.NoError(t, err)
		_, err = w.Write(files[name])
		require.NoError(t, err)
	}
	require.NoError(t, zw.Close())

	return buf.Bytes()
}

func readFiles(t *testing.T, files map[string][]byte) *Packet {
	t.Helper()

	data := zipFiles(t, files)
	p, err := Read(bytes.NewReader(data), int64(len(data)))
	require.NoError(t, err)
	require.NotNil(t, p)

	return p
}

func evaluate(t *testing.T, snapshot *healthcheck.Snapshot) []finding {
	t.Helper()

	collectedAt := snapshot.CollectedAt
	if collectedAt.IsZero() {
		collectedAt = time.Date(2026, time.September, 25, 10, 0, 0, 0, time.UTC)
	}
	now := func() time.Time { return collectedAt }

	registry := healthcheck.Builtin()
	store := healthcheck.NewMemoryStore()
	engine := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry, Now: now})
	reconciler := healthcheck.NewReconciler(healthcheck.ReconcilerOpts{Store: store, Registry: registry, Now: now})

	_, err := reconciler.Reconcile(engine.Evaluate(snapshot))
	require.NoError(t, err)

	stored, err := store.List(model.HealthFindingFilter{Muted: model.MutedIncluded})
	require.NoError(t, err)

	findings := make([]finding, 0, len(stored))
	for _, f := range stored {
		findings = append(findings, finding{Code: f.Code, State: healthcheck.State(f.State), Subject: f.Subject, Scope: f.Scope})
	}
	return findings
}

func TestReadGoldenPackets(t *testing.T) {
	cases := []struct {
		name     string
		expected []finding
	}{
		{
			name: "standalone",
			expected: []finding{
				{Code: "PUSH_EMPTY_URL", State: healthcheck.StateResolved, Subject: pushSubject},
				{Code: "PUSH_BAD_SCHEME", State: healthcheck.StateResolved, Subject: pushSubject},
				{Code: "PUSH_TEST_PROXY", State: healthcheck.StateFiring, Subject: pushSubject},
				{Code: "SITE_URL_EMPTY", State: healthcheck.StateResolved, Subject: siteURLSubject},
				{Code: "SITE_URL_HTTP", State: healthcheck.StateFiring, Subject: siteURLSubject},
				{Code: "ES_LOCALHOST_URL", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "ES_SERVER_ERROR", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "SCALE_ES_REQUIRED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.EnableSearching"},
				{Code: "SCALE_ES_RECOMMENDED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.EnableSearching"},
				{Code: "ES_LIVE_BATCH_SYNC", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.LiveIndexingBatchSize"},
				{Code: "ES_LIVE_BATCH_TOO_HIGH", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.LiveIndexingBatchSize"},
				{Code: "ES_VERSION_UNSUPPORTED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.Backend"},
				{Code: "ES_MISSING_ICU", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "ES_SKIP_TLS_VERIFY", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.SkipTLSVerification"},
			},
		},
		{
			name: "ha",
			expected: []finding{
				{Code: "PUSH_EMPTY_URL", State: healthcheck.StateResolved, Subject: pushSubject},
				{Code: "PUSH_BAD_SCHEME", State: healthcheck.StateFiring, Subject: pushSubject},
				{Code: "PUSH_TEST_PROXY", State: healthcheck.StateResolved, Subject: pushSubject},
				{Code: "SITE_URL_EMPTY", State: healthcheck.StateResolved, Subject: siteURLSubject},
				{Code: "SITE_URL_HTTP", State: healthcheck.StateResolved, Subject: siteURLSubject},
				{Code: "ES_LOCALHOST_URL", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "ES_SERVER_ERROR", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "SCALE_ES_REQUIRED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.EnableSearching"},
				{Code: "SCALE_ES_RECOMMENDED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.EnableSearching"},
				{Code: "ES_LIVE_BATCH_SYNC", State: healthcheck.StateFiring, Subject: "ElasticsearchSettings.LiveIndexingBatchSize"},
				{Code: "ES_LIVE_BATCH_TOO_HIGH", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.LiveIndexingBatchSize"},
				{Code: "ES_VERSION_UNSUPPORTED", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.Backend"},
				{Code: "ES_MISSING_ICU", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.ConnectionURL"},
				{Code: "ES_SKIP_TLS_VERIFY", State: healthcheck.StateResolved, Subject: "ElasticsearchSettings.SkipTLSVerification"},
			},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			p := readFiles(t, fixtureFiles(t, tc.name))

			assert.Empty(t, p.Warnings)
			assert.ElementsMatch(t, tc.expected, evaluate(t, p.Snapshot))
		})
	}
}

func TestReadSnapshotFields(t *testing.T) {
	p := readFiles(t, fixtureFiles(t, "standalone"))
	s := p.Snapshot

	assert.Empty(t, p.Warnings)
	assert.Equal(t, time.Date(2026, time.September, 25, 10, 0, 0, 0, time.UTC), s.CollectedAt)
	assert.Equal(t, "11.0.4", s.Version.Current)
	assert.Empty(t, s.Version.Latest)
	assert.Nil(t, s.License)
	assert.False(t, s.Deployment.IsCloud)

	for _, section := range []model.WorkspaceSection{model.SectionConfig, model.SectionStats, model.SectionJobs, model.SectionPlugins} {
		assert.True(t, s.Has(section), "section %q", section)
	}
	present, _ := s.SectionErr(model.SectionVersion)
	assert.False(t, present)

	dsn, ok := s.DataSource()
	require.True(t, ok)
	assert.True(t, strings.HasPrefix(dsn, "postgres://****:****@db.example.com"))

	users, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
	require.True(t, ok)
	assert.Equal(t, int64(312), users)

	enabled, ok := s.PluginEnabled("com.mattermost.calls")
	require.True(t, ok)
	assert.True(t, enabled)

	jobs, ok := s.JobsFor(model.JobTypeDataRetention)
	require.True(t, ok)
	assert.Empty(t, jobs)

	nodes := s.Nodes()
	require.Len(t, nodes, 1)
	assert.Equal(t, "mm.example.com", nodes[0].Hostname)
	assert.True(t, nodes[0].IsLeader)
	assert.Nil(t, nodes[0].ClusterInfo)
	for _, section := range model.AllNodeSections() {
		assert.True(t, nodes[0].Has(section), "section %q", section)
	}
	version, ok := nodes[0].NodeVersion()
	require.True(t, ok)
	assert.Equal(t, "11.0.4", version)
}

func TestReadHALayout(t *testing.T) {
	files := fixtureFiles(t, "ha")
	for name := range files {
		base := filepath.Base(name)
		if !strings.Contains(name, "/") {
			require.NotEqual(t, model.SupportPacketDiagnosticsFileName, base)
			require.NotEqual(t, model.SupportPacketConfigFileName, base)
		}
	}

	s := readFiles(t, files).Snapshot

	nodes := s.Nodes()
	require.Len(t, nodes, 3)
	for _, node := range nodes {
		require.NotNil(t, node.Diagnostics, node.Hostname)
		for _, section := range model.AllNodeSections() {
			assert.True(t, node.Has(section), "node %q section %q", node.Hostname, section)
		}
	}

	require.True(t, s.Has(model.SectionConfig))
	siteURL, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ServiceSettings.SiteURL })
	require.True(t, ok)
	assert.Equal(t, "https://chat.example.com", siteURL)
	assert.True(t, s.Has(model.SectionStats))
}

func TestReadLeader(t *testing.T) {
	leaderOf := func(t *testing.T, files map[string][]byte) string {
		t.Helper()

		s := readFiles(t, files).Snapshot
		leader, ok := s.Leader()
		require.True(t, ok)

		leaders := 0
		for _, node := range s.Nodes() {
			if node.IsLeader {
				leaders++
			}
		}
		assert.Equal(t, 1, leaders)

		return leader.Hostname
	}

	t.Run("the node that reports is_leader leads", func(t *testing.T) {
		assert.Equal(t, "app-2.example.com", leaderOf(t, fixtureFiles(t, "ha")))
	})

	t.Run("an older packet without is_leader falls back to the first hostname", func(t *testing.T) {
		files := fixtureFiles(t, "ha")
		name := "app-2.example.com/" + model.SupportPacketDiagnosticsFileName
		require.Contains(t, string(files[name]), "  is_leader: true\n")
		files[name] = bytes.Replace(files[name], []byte("  is_leader: true\n"), nil, 1)

		assert.Equal(t, "app-1.example.com", leaderOf(t, files))
	})

	t.Run("a standalone packet's only node leads", func(t *testing.T) {
		assert.Equal(t, "mm.example.com", leaderOf(t, fixtureFiles(t, "standalone")))
	})
}

func TestReadMissingMetadata(t *testing.T) {
	files := fixtureFiles(t, "standalone")
	delete(files, model.PacketMetadataFileName)

	p := readFiles(t, files)
	assert.Len(t, p.Warnings, 1)
	assert.True(t, p.Snapshot.CollectedAt.IsZero())
	assert.Empty(t, p.Snapshot.Version.Current)
}

func TestReadCloud(t *testing.T) {
	files := fixtureFiles(t, "standalone")
	files[model.SupportPacketDiagnosticsFileName] = bytes.Replace(files[model.SupportPacketDiagnosticsFileName], []byte("license:\n"), []byte("license:\n  is_cloud: true\n"), 1)

	assert.True(t, readFiles(t, files).Snapshot.Deployment.IsCloud)
}

func TestReadMissingStats(t *testing.T) {
	files := fixtureFiles(t, "standalone")
	delete(files, model.SupportPacketStatsFileName)

	s := readFiles(t, files).Snapshot

	present, err := s.SectionErr(model.SectionStats)
	assert.False(t, present)
	assert.NoError(t, err)
	_, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
	assert.False(t, ok)

	findings := evaluate(t, s)
	assert.Contains(t, findings, finding{Code: "SITE_URL_HTTP", State: healthcheck.StateFiring, Subject: siteURLSubject})
	assert.Contains(t, findings, finding{Code: "PUSH_TEST_PROXY", State: healthcheck.StateFiring, Subject: pushSubject})
}

func TestReadUnparsableStats(t *testing.T) {
	files := fixtureFiles(t, "standalone")
	files[model.SupportPacketStatsFileName] = []byte("registered_users: [not a number\n")

	s := readFiles(t, files).Snapshot

	present, err := s.SectionErr(model.SectionStats)
	assert.True(t, present)
	require.Error(t, err)
	assert.ErrorContains(t, err, "failed to parse stats.yaml")
	assert.Nil(t, s.Stats)
	assert.True(t, s.Has(model.SectionConfig))
}

func TestReadNewerDiagnosticsVersion(t *testing.T) {
	files := fixtureFiles(t, "ha")
	name := "app-2.example.com/" + model.SupportPacketDiagnosticsFileName
	files[name] = bytes.Replace(files[name], []byte("version: 2\n"), []byte("version: 3\nfuture_section:\n  value: 1\n"), 1)

	p := readFiles(t, files)

	require.Len(t, p.Warnings, 1)
	assert.Contains(t, p.Warnings[0], "newer server")
	assert.Contains(t, evaluate(t, p.Snapshot), finding{Code: "PUSH_BAD_SCHEME", State: healthcheck.StateFiring, Subject: pushSubject})
}

func TestReadUnparsableNodeDiagnostics(t *testing.T) {
	files := fixtureFiles(t, "ha")
	files["app-3.example.com/"+model.SupportPacketDiagnosticsFileName] = []byte("server: [unclosed\n")

	p := readFiles(t, files)

	require.Len(t, p.Warnings, 1)
	assert.Contains(t, p.Warnings[0], "app-3.example.com/diagnostics.yaml")

	nodes := p.Snapshot.Nodes()
	require.Len(t, nodes, 3)
	for _, node := range nodes {
		if node.Hostname == "app-3.example.com" {
			assert.Nil(t, node.Diagnostics)
		} else {
			assert.NotNil(t, node.Diagnostics, node.Hostname)
		}
	}

	leader, ok := p.Snapshot.Leader()
	require.True(t, ok)
	assert.Equal(t, "app-2.example.com", leader.Hostname)
	assert.Contains(t, evaluate(t, p.Snapshot), finding{Code: "PUSH_BAD_SCHEME", State: healthcheck.StateFiring, Subject: pushSubject})
}

func TestReadGenerationErrors(t *testing.T) {
	files := fixtureFiles(t, "standalone")
	files[model.SupportPacketErrorFile] = []byte("1 error occurred:\n\t* failed to get plugin list for Support Packet\n\n")

	p := readFiles(t, files)

	require.Len(t, p.Warnings, 1)
	assert.Equal(t, "The server reported errors while generating the packet, so some data may be missing: 1 error occurred:\n\t* failed to get plugin list for Support Packet", p.Warnings[0])
	assert.True(t, p.Snapshot.Has(model.SectionPlugins))
}

func TestReadInvalidPackets(t *testing.T) {
	t.Run("not a zip", func(t *testing.T) {
		data := []byte("definitely not a zip")
		_, err := Read(bytes.NewReader(data), int64(len(data)))
		require.Error(t, err)
		assert.ErrorContains(t, err, "failed to open the Support Packet")
	})

	t.Run("zip without diagnostics.yaml", func(t *testing.T) {
		files := fixtureFiles(t, "standalone")
		delete(files, model.SupportPacketDiagnosticsFileName)
		data := zipFiles(t, files)

		_, err := Read(bytes.NewReader(data), int64(len(data)))
		require.Error(t, err)
		assert.ErrorContains(t, err, "no diagnostics.yaml found")
	})

	t.Run("truncated zip never panics", func(t *testing.T) {
		data := zipFiles(t, fixtureFiles(t, "ha"))

		for size := range data {
			require.NotPanics(t, func() {
				p, err := Read(bytes.NewReader(data[:size]), int64(size))
				if err == nil {
					require.NotNil(t, p)
				}
			}, "size %d", size)
		}
	})

	t.Run("corrupt member data is a section error", func(t *testing.T) {
		data := zipFiles(t, fixtureFiles(t, "standalone"))
		offset := bytes.Index(data, []byte("registered_users"))
		require.Positive(t, offset)
		data[offset] ^= 0xff

		p, err := Read(bytes.NewReader(data), int64(len(data)))
		require.NoError(t, err)
		present, sectionErr := p.Snapshot.SectionErr(model.SectionStats)
		assert.True(t, present)
		assert.Error(t, sectionErr)
	})

	t.Run("oversized member is a section error", func(t *testing.T) {
		files := fixtureFiles(t, "standalone")
		files[model.SupportPacketStatsFileName] = make([]byte, maxMemberSize+1)

		s := readFiles(t, files).Snapshot
		present, err := s.SectionErr(model.SectionStats)
		assert.True(t, present)
		assert.ErrorContains(t, err, "stats.yaml: larger than 64 MiB")
		assert.Nil(t, s.Stats)
	})

	t.Run("missing file", func(t *testing.T) {
		_, err := ReadFile(filepath.Join(t.TempDir(), "missing.zip"))
		require.Error(t, err)
	})
}

func TestReadFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "packet.zip")
	require.NoError(t, os.WriteFile(path, zipFiles(t, fixtureFiles(t, "standalone")), 0o600))

	p, err := ReadFile(path)
	require.NoError(t, err)
	assert.Len(t, p.Snapshot.Nodes(), 1)
}

func TestSplitNodeFiles(t *testing.T) {
	root, byNode := splitNodeFiles([]string{
		"metadata.yaml",
		"stats.yaml",
		"app-1/diagnostics.yaml",
		"app-1/sanitized_config.json",
		"app-1/advancedLogs/audit.log",
		"app-2/diagnostics.yaml",
		"app-2/sanitized_config.json",
		"com.mattermost.calls/diagnostics.yaml",
	})

	assert.ElementsMatch(t, []string{"metadata.yaml", "stats.yaml", "com.mattermost.calls/diagnostics.yaml"}, root)
	assert.Equal(t, map[string][]string{
		"app-1": {"diagnostics.yaml", "sanitized_config.json", "advancedLogs/audit.log"},
		"app-2": {"diagnostics.yaml", "sanitized_config.json"},
	}, byNode)
}

// The reader ignores unknown keys, so a fixture key the writer renamed or dropped would
// silently decode to its zero value.
func TestFixturesMatchTheModel(t *testing.T) {
	strictYAML := func(data []byte, v any) error {
		return yaml.UnmarshalWithOptions(data, v, yaml.Strict())
	}
	strictJSON := func(data []byte, v any) error {
		decoder := json.NewDecoder(bytes.NewReader(data))
		decoder.DisallowUnknownFields()
		return decoder.Decode(v)
	}

	decoders := map[string]func([]byte) error{
		model.SupportPacketDiagnosticsFileName: func(data []byte) error {
			return strictYAML(data, &model.SupportPacketDiagnostics{})
		},
		model.SupportPacketConfigFileName: func(data []byte) error {
			return strictJSON(data, &model.SupportPacketConfig{})
		},
		model.SupportPacketStatsFileName: func(data []byte) error {
			return strictYAML(data, &model.SupportPacketStats{})
		},
		model.SupportPacketJobsFileName: func(data []byte) error {
			return strictYAML(data, &model.SupportPacketJobList{})
		},
		model.SupportPacketPluginsFileName: func(data []byte) error {
			return strictJSON(data, &model.SupportPacketPluginList{})
		},
		model.PacketMetadataFileName: func(data []byte) error {
			return strictYAML(data, &model.PacketMetadata{})
		},
	}

	for _, fixture := range []string{"standalone", "ha"} {
		files := fixtureFiles(t, fixture)
		root, byNode := splitNodeFiles(slices.Collect(maps.Keys(files)))

		members := map[string]string{}
		for _, name := range root {
			members[name] = name
		}
		for node, names := range byNode {
			for _, name := range names {
				members[path.Join(node, name)] = name
			}
		}

		for member, name := range members {
			decode, ok := decoders[name]
			if !ok {
				// Plugin diagnostics are free-form, so there is no model to check them against.
				continue
			}
			t.Run(fixture+"/"+member, func(t *testing.T) {
				assert.NoError(t, decode(files[member]))
			})
		}
	}
}

// The reader runs inside mmctl, so it must not pull in the server.
func TestImportsStayOutOfTheServer(t *testing.T) {
	out, err := exec.Command("go", "list", "-deps", "-f", "{{.ImportPath}}", ".").Output()
	require.NoError(t, err)

	allowed := []string{
		"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck",
		"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/packet",
	}
	deps := strings.Fields(string(out))
	require.Contains(t, deps, allowed[0])
	for _, dep := range deps {
		if strings.HasPrefix(dep, "github.com/mattermost/mattermost/server/v8") {
			assert.Contains(t, allowed, dep)
		}
	}
}
