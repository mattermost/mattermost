// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package search

import (
	"errors"
	"strconv"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type searchWant struct {
	state     healthcheck.State
	messageID string
	details   map[string]string
	value     *float64
}

var (
	resolvedWant      = searchWant{state: healthcheck.StateResolved}
	unknownConfigWant = searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	unknownDiagWant   = searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
)

// searchSnapshot builds a snapshot from the default config with indexing on, the given
// leader diagnostics (nil for none) and post count (nil for no stats).
func searchSnapshot(mutate func(*model.Config), diag *model.SupportPacketDiagnostics, posts *int64) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.EnableIndexing = new(true)
	if mutate != nil {
		mutate(cfg)
	}

	leader := &healthcheck.NodeSnapshot{Hostname: "app-1", IsLeader: true}
	if diag != nil {
		leader.Diagnostics = &model.NodeDiagnostics{Diagnostics: diag}
	}

	s := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{leader})
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	if posts != nil {
		s.Stats = &model.SupportPacketStats{Posts: posts}
		s.Sections[model.SectionStats] = nil
	}

	return s
}

func esDiag(status, backend, version string, plugins ...string) *model.SupportPacketDiagnostics {
	diag := &model.SupportPacketDiagnostics{}
	diag.ElasticSearch.Status = status
	diag.ElasticSearch.Backend = backend
	diag.ElasticSearch.ServerVersion = version
	diag.ElasticSearch.ServerPlugins = plugins
	return diag
}

func assertResult(t *testing.T, rule healthcheck.Rule, s *healthcheck.Snapshot, want searchWant) {
	t.Helper()

	results := rule.Eval(s)
	require.Len(t, results, 1, rule.Code)
	assert.Equal(t, want.state, results[0].State, rule.Code)
	assert.Equal(t, want.messageID, results[0].MessageID, rule.Code)
	assert.Equal(t, want.details, results[0].Details, rule.Code)
	assert.Equal(t, want.value, results[0].Value, rule.Code)
}

func TestConfigAbsentIsUnknown(t *testing.T) {
	t.Parallel()

	configRules := []healthcheck.Rule{esLocalhostURL, scaleESRequired, scaleESRecommended, esLiveBatchSync, esLiveBatchTooHigh, esVersionUnsupported, esMissingICU, esSkipTLSVerify}
	failed := searchSnapshot(nil, nil, nil)
	failed.Sections[model.SectionConfig] = errors.New("boom")

	for name, s := range map[string]*healthcheck.Snapshot{"absent": {}, "failed": failed} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range configRules {
				assertResult(t, rule, s, unknownConfigWant)
			}
		})
	}
}

func TestIndexingGateClosed(t *testing.T) {
	t.Parallel()

	s := searchSnapshot(func(cfg *model.Config) {
		cfg.ElasticsearchSettings.EnableIndexing = new(false)
		cfg.ElasticsearchSettings.ConnectionURL = new("https://localhost:9200")
		cfg.ElasticsearchSettings.LiveIndexingBatchSize = new(1)
		cfg.ElasticsearchSettings.SkipTLSVerification = new(true)
		cfg.ClusterSettings.Enable = new(true)
	}, esDiag(model.StatusDisabled, model.ElasticsearchSettingsESBackend, "7.17.0"), nil)

	for _, rule := range []healthcheck.Rule{esLocalhostURL, esLiveBatchSync, esLiveBatchTooHigh, esVersionUnsupported, esMissingICU, esSkipTLSVerify} {
		assertResult(t, rule, s, resolvedWant)
	}

	s.Config.Config.ElasticsearchSettings.LiveIndexingBatchSize = new(500)
	assertResult(t, esLiveBatchTooHigh, s, resolvedWant)
}

func TestESLocalhostURL(t *testing.T) {
	t.Parallel()

	firing := func(host string) searchWant {
		return searchWant{state: healthcheck.StateFiring, messageID: "health.rule.es_localhost_url.message", details: map[string]string{"host": host}}
	}

	testCases := []struct {
		name      string
		url       string
		clustered *bool
		want      searchWant
	}{
		{name: "localhost standalone", url: "http://localhost:9200", clustered: new(false), want: resolvedWant},
		{name: "localhost clustered", url: "http://localhost:9200", clustered: new(true), want: firing("localhost")},
		{name: "uppercase localhost clustered", url: "http://LOCALHOST:9200", clustered: new(true), want: firing("LOCALHOST")},
		{name: "loopback ipv4 clustered", url: "https://127.0.0.2:9200", clustered: new(true), want: firing("127.0.0.2")},
		{name: "loopback ipv6 clustered", url: "http://[::1]:9200", clustered: new(true), want: firing("::1")},
		{name: "unspecified address clustered", url: "http://0.0.0.0:9200", clustered: new(true), want: firing("0.0.0.0")},
		{name: "credentials are not reported", url: "http://user:secret@localhost:9200", clustered: new(true), want: firing("localhost")},
		{name: "lookalike host clustered", url: "http://notlocalhost.example.com", clustered: new(true), want: resolvedWant},
		{name: "localhost only in path", url: "http://search.example.com/localhost", clustered: new(true), want: resolvedWant},
		{name: "cluster setting absent", url: "http://localhost:9200", clustered: nil, want: unknownConfigWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.ConnectionURL = new(tc.url)
				cfg.ClusterSettings.Enable = tc.clustered
			}, nil, nil)
			assertResult(t, esLocalhostURL, s, tc.want)
		})
	}
}

func TestESServerError(t *testing.T) {
	t.Parallel()

	failed := esDiag(model.StatusFail, "", "")
	failed.ElasticSearch.Error = `Get "https://admin:hunter2@search.example.com:9200/": dial tcp: connection refused`

	sectionFailed := searchSnapshot(nil, esDiag(model.StatusFail, "", ""), nil)
	leader, ok := sectionFailed.Leader()
	require.True(t, ok)
	leader.Diagnostics.Errors = model.SectionErrors{model.SectionSearchProbe: errors.New("boom")}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     searchWant
	}{
		{name: "disabled", snapshot: searchSnapshot(nil, esDiag(model.StatusDisabled, "", ""), nil), want: resolvedWant},
		{name: "ok", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "", ""), nil), want: resolvedWant},
		{
			name:     "fail masks credentials",
			snapshot: searchSnapshot(nil, failed, nil),
			want: searchWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.es_server_error.message",
				details:   map[string]string{"error": `Get "https://****@search.example.com:9200/": dial tcp: connection refused`},
			},
		},
		{name: "empty status", snapshot: searchSnapshot(nil, esDiag("", "", ""), nil), want: unknownDiagWant},
		{name: "leader without diagnostics", snapshot: searchSnapshot(nil, nil, nil), want: unknownDiagWant},
		{name: "no leader", snapshot: &healthcheck.Snapshot{}, want: unknownDiagWant},
		{name: "probe section failed", snapshot: sectionFailed, want: unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, esServerError, tc.snapshot, tc.want)
		})
	}
}

func TestScaleES(t *testing.T) {
	t.Parallel()

	searchingOff := func(cfg *model.Config) { cfg.ElasticsearchSettings.EnableSearching = new(false) }
	searchingOn := func(cfg *model.Config) { cfg.ElasticsearchSettings.EnableSearching = new(true) }
	firing := func(code string, posts int64) searchWant {
		return searchWant{
			state:     healthcheck.StateFiring,
			messageID: "health.rule." + code + ".message",
			details:   map[string]string{"posts": strconv.FormatInt(posts, 10)},
			value:     new(float64(posts)),
		}
	}
	resolvedAt := func(posts int64) searchWant {
		return searchWant{state: healthcheck.StateResolved, value: new(float64(posts))}
	}

	testCases := []struct {
		name        string
		snapshot    *healthcheck.Snapshot
		required    searchWant
		recommended searchWant
	}{
		{
			name:        "indexing without searching at 6M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(6_000_000))),
			required:    firing("scale_es_required", 6_000_000),
			recommended: resolvedAt(6_000_000),
		},
		{
			name:        "exactly 5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(5_000_000))),
			required:    firing("scale_es_required", 5_000_000),
			recommended: resolvedAt(5_000_000),
		},
		{
			name:        "just below 5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(4_999_999))),
			required:    resolvedAt(4_999_999),
			recommended: firing("scale_es_recommended", 4_999_999),
		},
		{
			name:        "exactly 2.5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(2_500_000))),
			required:    resolvedAt(2_500_000),
			recommended: firing("scale_es_recommended", 2_500_000),
		},
		{
			name:        "just below 2.5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(2_499_999))),
			required:    resolvedAt(2_499_999),
			recommended: resolvedAt(2_499_999),
		},
		{
			name:        "searching on at 6M",
			snapshot:    searchSnapshot(searchingOn, nil, new(int64(6_000_000))),
			required:    resolvedWant,
			recommended: resolvedWant,
		},
		{
			name:        "searching on without stats",
			snapshot:    searchSnapshot(searchingOn, nil, nil),
			required:    resolvedWant,
			recommended: resolvedWant,
		},
		{
			name:        "searching off without stats",
			snapshot:    searchSnapshot(searchingOff, nil, nil),
			required:    searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable},
			recommended: searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonStatsUnavailable},
		},
		{
			name: "searching off with indexing off",
			snapshot: searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.EnableIndexing = new(false)
				cfg.ElasticsearchSettings.EnableSearching = new(false)
			}, nil, new(int64(6_000_000))),
			required:    firing("scale_es_required", 6_000_000),
			recommended: resolvedAt(6_000_000),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, scaleESRequired, tc.snapshot, tc.required)
			assertResult(t, scaleESRecommended, tc.snapshot, tc.recommended)
		})
	}
}

func TestESLiveBatch(t *testing.T) {
	t.Parallel()

	syncFiring := searchWant{state: healthcheck.StateFiring, messageID: "health.rule.es_live_batch_sync.message"}
	tooHigh := func(size string) searchWant {
		return searchWant{state: healthcheck.StateFiring, messageID: "health.rule.es_live_batch_too_high.message", details: map[string]string{"size": size}}
	}

	testCases := []struct {
		name    string
		size    *int
		sync    searchWant
		tooHigh searchWant
	}{
		{name: "one", size: new(1), sync: syncFiring, tooHigh: resolvedWant},
		{name: "default", size: new(10), sync: resolvedWant, tooHigh: resolvedWant},
		{name: "at the limit", size: new(100), sync: resolvedWant, tooHigh: resolvedWant},
		{name: "above the limit", size: new(101), sync: resolvedWant, tooHigh: tooHigh("101")},
		{name: "absent", size: nil, sync: unknownConfigWant, tooHigh: unknownConfigWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(func(cfg *model.Config) { cfg.ElasticsearchSettings.LiveIndexingBatchSize = tc.size }, nil, nil)
			assertResult(t, esLiveBatchSync, s, tc.sync)
			assertResult(t, esLiveBatchTooHigh, s, tc.tooHigh)
		})
	}
}

func TestESVersionUnsupported(t *testing.T) {
	t.Parallel()

	unrecognized := searchWant{state: healthcheck.StateUnknown, messageID: "health.rule.es_version_unsupported.message.unrecognized"}
	unavailable := searchWant{state: healthcheck.StateUnknown, messageID: "health.rule.es_version_unsupported.message.unavailable"}
	firing := func(backend, version, minMajor, maxMajor string) searchWant {
		return searchWant{
			state:     healthcheck.StateFiring,
			messageID: "health.rule.es_version_unsupported.message",
			details:   map[string]string{"backend": backend, "version": version, "min": minMajor, "max": maxMajor},
		}
	}

	testCases := []struct {
		name    string
		backend string
		version string
		want    searchWant
	}{
		{name: "opensearch 2", backend: model.ElasticsearchSettingsOSBackend, version: "2.19.0", want: resolvedWant},
		{name: "opensearch 3", backend: model.ElasticsearchSettingsOSBackend, version: "3.1.0", want: resolvedWant},
		{name: "opensearch 1", backend: model.ElasticsearchSettingsOSBackend, version: "1.3.20", want: firing("opensearch", "1.3.20", "2", "3")},
		{name: "elasticsearch 7", backend: model.ElasticsearchSettingsESBackend, version: "7.17.0", want: firing("elasticsearch", "7.17.0", "8", "9")},
		{name: "elasticsearch 8", backend: model.ElasticsearchSettingsESBackend, version: "8.15.3", want: resolvedWant},
		{name: "elasticsearch 9", backend: model.ElasticsearchSettingsESBackend, version: "9.0.0", want: resolvedWant},
		{name: "elasticsearch 10", backend: model.ElasticsearchSettingsESBackend, version: "10.0.0", want: firing("elasticsearch", "10.0.0", "8", "9")},
		{name: "empty version", backend: model.ElasticsearchSettingsESBackend, version: "", want: unavailable},
		{name: "unparsable version", backend: model.ElasticsearchSettingsESBackend, version: "latest", want: unrecognized},
		{name: "unknown backend", backend: "solr", version: "9.0.0", want: unrecognized},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(nil, esDiag(model.StatusOk, tc.backend, tc.version), nil)
			assertResult(t, esVersionUnsupported, s, tc.want)
		})
	}

	t.Run("leader without diagnostics", func(t *testing.T) {
		t.Parallel()
		assertResult(t, esVersionUnsupported, searchSnapshot(nil, nil, nil), unknownDiagWant)
	})
}

func TestESMissingICU(t *testing.T) {
	t.Parallel()

	unavailable := searchWant{state: healthcheck.StateUnknown, messageID: "health.rule.es_missing_icu.message.unavailable"}
	firing := searchWant{state: healthcheck.StateFiring, messageID: "health.rule.es_missing_icu.message"}

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     searchWant
	}{
		{name: "opensearch prefixed plugin", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "opensearch", "2.19.0", "opensearch-analysis-icu"), nil), want: resolvedWant},
		{name: "bundled plugin", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "elasticsearch", "8.15.3", "analysis-nori", "analysis-icu"), nil), want: resolvedWant},
		{name: "other plugins only", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "elasticsearch", "8.15.3", "analysis-nori"), nil), want: firing},
		{name: "name must match exactly", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "elasticsearch", "8.15.3", "analysis-icu-custom"), nil), want: firing},
		{name: "empty plugins with a version", snapshot: searchSnapshot(nil, esDiag(model.StatusOk, "elasticsearch", "8.15.3"), nil), want: firing},
		{name: "empty plugins and empty version", snapshot: searchSnapshot(nil, esDiag(model.StatusFail, "elasticsearch", ""), nil), want: unavailable},
		{name: "leader without diagnostics", snapshot: searchSnapshot(nil, nil, nil), want: unknownDiagWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, esMissingICU, tc.snapshot, tc.want)
		})
	}
}

func TestESSkipTLSVerify(t *testing.T) {
	t.Parallel()

	firing := searchWant{state: healthcheck.StateFiring, messageID: "health.rule.es_skip_tls_verify.message"}

	testCases := []struct {
		name string
		url  string
		skip *bool
		want searchWant
	}{
		{name: "https with skip", url: "https://search.example.com:9200", skip: new(true), want: firing},
		{name: "uppercase https with skip", url: "HTTPS://search.example.com:9200", skip: new(true), want: firing},
		{name: "http with skip", url: "http://search.example.com:9200", skip: new(true), want: resolvedWant},
		{name: "https without skip", url: "https://search.example.com:9200", skip: new(false), want: resolvedWant},
		{name: "skip absent", url: "https://search.example.com:9200", skip: nil, want: unknownConfigWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.ConnectionURL = new(tc.url)
				cfg.ElasticsearchSettings.SkipTLSVerification = tc.skip
			}, nil, nil)
			assertResult(t, esSkipTLSVerify, s, tc.want)
		})
	}
}

func TestMaskURLCredentials(t *testing.T) {
	t.Parallel()

	for in, want := range map[string]string{
		"http://search.example.com:9200":             "http://search.example.com:9200",
		"http://user:pass@search.example.com:9200":   "http://****@search.example.com:9200",
		"https://token@search.example.com":           "https://****@search.example.com",
		"https://user:p@ss@search.example.com/x@y":   "https://****@search.example.com/x@y",
		"a http://u:p@one.example.com b ftp://x@two": "a http://****@one.example.com b ftp://****@two",
		"no url here, user@example.com":              "no url here, user@example.com",
	} {
		assert.Equal(t, want, maskURLCredentials(in), in)
	}
}
