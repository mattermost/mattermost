// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package search

import (
	"errors"
	"slices"
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
	resolvedWant       = searchWant{state: healthcheck.StateResolved}
	unknownConfigWant  = searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonConfigUnavailable}
	unknownDiagWant    = searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonDiagnosticsUnavailable}
	unknownLicenseWant = searchWant{state: healthcheck.StateUnknown, messageID: healthcheck.ReasonLicenseUnavailable}
)

func enterpriseLicense() model.SupportPacketLicense {
	return model.SupportPacketLicense{
		SkuShortName: model.LicenseShortSkuEnterprise,
		Features:     &model.Features{Elasticsearch: new(true), Cluster: new(true)},
	}
}

// searchSnapshot builds a snapshot from the default config with indexing on, an Enterprise
// license, the given leader diagnostics (nil for no search diagnostics) and post count (nil for no stats).
func searchSnapshot(mutate func(*model.Config), diag *model.SupportPacketDiagnostics, posts *int64) *healthcheck.Snapshot {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ElasticsearchSettings.EnableIndexing = new(true)
	if mutate != nil {
		mutate(cfg)
	}

	// Copied so tests sharing a diag can set different licenses in parallel.
	leaderDiag := model.SupportPacketDiagnostics{}
	var errs model.SectionErrors
	if diag != nil {
		leaderDiag = *diag
	} else {
		errs = model.SectionErrors{model.SectionSearchProbe: errors.New("not collected"), model.SectionSearchEngine: errors.New("not collected")}
	}
	leaderDiag.License = enterpriseLicense()
	leader := &healthcheck.NodeSnapshot{Hostname: "app-1", IsLeader: true, Diagnostics: &model.NodeDiagnostics{Diagnostics: &leaderDiag, Errors: errs}}

	s := healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{leader})
	s.Config = &model.SupportPacketConfig{Config: cfg}
	s.Sections = map[model.WorkspaceSection]error{model.SectionConfig: nil}
	if posts != nil {
		s.Stats = &model.SupportPacketStats{Posts: posts}
		s.Sections[model.SectionStats] = nil
	}

	return s
}

func withLicense(s *healthcheck.Snapshot, license model.SupportPacketLicense) *healthcheck.Snapshot {
	leader, _ := s.Leader()
	leader.Diagnostics.Diagnostics.License = license
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

	configRules := []healthcheck.Rule{esLocalhostURL, searchUnavailable, scaleESRequired, scaleESRecommended, esLiveBatchSync, esLiveBatchTooHigh, esVersionUnsupported, esMissingICU, esSkipTLSVerify}
	failed := searchSnapshot(nil, nil, nil)
	failed.Sections[model.SectionConfig] = errors.New("boom")
	absent := searchSnapshot(nil, nil, nil)
	absent.Config = nil
	absent.Sections = nil

	for name, s := range map[string]*healthcheck.Snapshot{"absent": absent, "failed": failed} {
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

func TestESLicenseGate(t *testing.T) {
	t.Parallel()

	// esLiveBatchTooHigh resolves on this snapshot, so it stays resolved even without license data.
	firingRules := []healthcheck.Rule{esLocalhostURL, esServerError, esLiveBatchSync, esVersionUnsupported, esMissingICU, esSkipTLSVerify}
	esRules := append(slices.Clone(firingRules), esLiveBatchTooHigh)
	firingSnapshot := func() *healthcheck.Snapshot {
		return searchSnapshot(func(cfg *model.Config) {
			cfg.ElasticsearchSettings.ConnectionURL = new("https://localhost:9200")
			cfg.ElasticsearchSettings.LiveIndexingBatchSize = new(1)
			cfg.ElasticsearchSettings.SkipTLSVerification = new(true)
			cfg.ClusterSettings.Enable = new(true)
		}, esDiag(model.StatusFail, model.ElasticsearchSettingsESBackend, "7.17.0"), nil)
	}

	t.Run("licensed", func(t *testing.T) {
		t.Parallel()

		s := firingSnapshot()
		for _, rule := range firingRules {
			results := rule.Eval(s)
			require.Len(t, results, 1, rule.Code)
			assert.Equal(t, healthcheck.StateFiring, results[0].State, rule.Code)
		}
	})

	esOff := enterpriseLicense()
	esOff.Features.Elasticsearch = new(false)
	licenseFailed := firingSnapshot()
	leader, ok := licenseFailed.Leader()
	require.True(t, ok)
	leader.Diagnostics.Errors = model.SectionErrors{model.SectionLicense: errors.New("boom")}

	for name, tc := range map[string]struct {
		snapshot *healthcheck.Snapshot
		rules    []healthcheck.Rule
		want     searchWant
	}{
		"unlicensed":             {snapshot: withLicense(firingSnapshot(), model.SupportPacketLicense{}), rules: esRules, want: resolvedWant},
		"feature off":            {snapshot: withLicense(firingSnapshot(), esOff), rules: esRules, want: resolvedWant},
		"license section failed": {snapshot: licenseFailed, rules: firingRules, want: unknownLicenseWant},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			for _, rule := range tc.rules {
				assertResult(t, rule, tc.snapshot, tc.want)
			}
		})
	}

	t.Run("license section failed keeps resolved rules resolved", func(t *testing.T) {
		t.Parallel()
		assertResult(t, esLiveBatchTooHigh, licenseFailed, resolvedWant)
	})

	t.Run("packet predating features runs the rules", func(t *testing.T) {
		t.Parallel()

		s := withLicense(firingSnapshot(), model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise})
		for _, rule := range esRules {
			assert.Equal(t, rule.Eval(firingSnapshot()), rule.Eval(s), rule.Code)
		}
	})
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
		{name: "fully qualified localhost clustered", url: "http://localhost.:9200", clustered: new(true), want: firing("localhost.")},
		{name: "localhost subdomain clustered", url: "http://es.localhost:9200", clustered: new(true), want: firing("es.localhost")},
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

	clusterLicense := func(cluster *bool) model.SupportPacketLicense {
		license := enterpriseLicense()
		license.Features.Cluster = cluster
		return license
	}
	for name, tc := range map[string]struct {
		license model.SupportPacketLicense
		want    searchWant
	}{
		"cluster unlicensed": {license: clusterLicense(new(false)), want: resolvedWant},
		"cluster feature not recorded counts as clustered": {license: clusterLicense(nil), want: firing("localhost")},
	} {
		t.Run(name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.ConnectionURL = new("http://localhost:9200")
				cfg.ClusterSettings.Enable = new(true)
			}, nil, nil)
			assertResult(t, esLocalhostURL, withLicense(s, tc.license), tc.want)
		})
	}
}

func TestESServerError(t *testing.T) {
	t.Parallel()

	failed := esDiag(model.StatusFail, "", "")
	failed.ElasticSearch.Error = `Get "https://admin:hunter2@search.example.com:9200/": dial tcp: connection refused`
	firing := func(messageID string) searchWant {
		return searchWant{
			state:     healthcheck.StateFiring,
			messageID: messageID,
			details:   map[string]string{"nodes": "app-1", "error": `Get "https://****@search.example.com:9200/": dial tcp: connection refused`},
		}
	}
	// withFollowers adds app-2 and app-3 with the given search diagnostics to s.
	withFollowers := func(s *healthcheck.Snapshot, app2, app3 *healthcheck.NodeSnapshot) *healthcheck.Snapshot {
		nodes := append(s.Nodes(), app2, app3)
		cluster := healthcheck.NewSnapshot(nodes)
		cluster.Config, cluster.Sections = s.Config, s.Sections
		return cluster
	}
	follower := func(hostname string, diag *model.SupportPacketDiagnostics) *healthcheck.NodeSnapshot {
		return &healthcheck.NodeSnapshot{Hostname: hostname, Diagnostics: &model.NodeDiagnostics{Diagnostics: diag}}
	}

	dbSearchDisabled := searchSnapshot(func(cfg *model.Config) {
		cfg.SqlSettings.DisableDatabaseSearch = new(true)
		cfg.ElasticsearchSettings.EnableSearching = new(true)
	}, failed, nil)
	dbSearchDisabledSearchingOff := searchSnapshot(func(cfg *model.Config) {
		cfg.SqlSettings.DisableDatabaseSearch = new(true)
		cfg.ElasticsearchSettings.EnableSearching = new(false)
	}, failed, nil)
	dbSearchAbsent := searchSnapshot(func(cfg *model.Config) { cfg.SqlSettings.DisableDatabaseSearch = nil }, failed, nil)

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
		{name: "fail masks credentials", snapshot: searchSnapshot(nil, failed, nil), want: firing("health.rule.es_server_error.message")},
		{name: "fail without database fallback", snapshot: dbSearchDisabled, want: firing("health.rule.es_server_error.message.no_fallback")},
		{name: "fail without database fallback, searching off", snapshot: dbSearchDisabledSearchingOff, want: firing("health.rule.es_server_error.message")},
		{name: "fail with database search setting absent", snapshot: dbSearchAbsent, want: firing("health.rule.es_server_error.message")},
		{name: "empty status", snapshot: searchSnapshot(nil, esDiag("", "", ""), nil), want: unknownDiagWant},
		{name: "leader without diagnostics", snapshot: searchSnapshot(nil, nil, nil), want: unknownDiagWant},
		{name: "no leader", snapshot: &healthcheck.Snapshot{}, want: unknownLicenseWant},
		{name: "probe section failed", snapshot: sectionFailed, want: unknownDiagWant},
		{
			name:     "every node fails",
			snapshot: withFollowers(searchSnapshot(nil, failed, nil), follower("app-2", failed), follower("app-3", failed)),
			want: searchWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.es_server_error.message",
				details:   map[string]string{"nodes": "app-1, app-2, app-3", "error": `Get "https://****@search.example.com:9200/": dial tcp: connection refused`},
			},
		},
		{
			name:     "one node of three fails",
			snapshot: withFollowers(searchSnapshot(nil, esDiag(model.StatusOk, "", ""), nil), follower("app-2", failed), follower("app-3", esDiag(model.StatusOk, "", ""))),
			want: searchWant{
				state:     healthcheck.StateFiring,
				messageID: "health.rule.es_server_error.message.partial",
				details:   map[string]string{"nodes": "app-2", "error": `Get "https://****@search.example.com:9200/": dial tcp: connection refused`},
			},
		},
		{
			name:     "nodes without the probe are left out",
			snapshot: withFollowers(searchSnapshot(nil, failed, nil), &healthcheck.NodeSnapshot{Hostname: "app-2", CollectErr: healthcheck.ErrNodeNoReply}, follower("app-3", esDiag("", "", ""))),
			want:     firing("health.rule.es_server_error.message"),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, esServerError, tc.snapshot, tc.want)
		})
	}
}

func TestSearchUnavailable(t *testing.T) {
	t.Parallel()

	firing := searchWant{state: healthcheck.StateFiring, messageID: "health.rule.search_unavailable.message"}
	unlicensedFiring := searchWant{state: healthcheck.StateFiring, messageID: "health.rule.search_unavailable.message.unlicensed"}

	esOff := enterpriseLicense()
	esOff.Features.Elasticsearch = new(false)

	testCases := []struct {
		name       string
		dbDisabled *bool
		searching  *bool
		license    *model.SupportPacketLicense
		want       searchWant
	}{
		{name: "database search on, elasticsearch off", dbDisabled: new(false), searching: new(false), want: resolvedWant},
		{name: "database search on, elasticsearch on", dbDisabled: new(false), searching: new(true), want: resolvedWant},
		{name: "database search off, elasticsearch on", dbDisabled: new(true), searching: new(true), want: resolvedWant},
		{name: "database search off, elasticsearch off", dbDisabled: new(true), searching: new(false), want: firing},
		{name: "database search off, elasticsearch on but unlicensed", dbDisabled: new(true), searching: new(true), license: &model.SupportPacketLicense{}, want: unlicensedFiring},
		{name: "database search off, elasticsearch off, unlicensed", dbDisabled: new(true), searching: new(false), license: &model.SupportPacketLicense{}, want: unlicensedFiring},
		{name: "database search off, elasticsearch on but feature off", dbDisabled: new(true), searching: new(true), license: &esOff, want: unlicensedFiring},
		{name: "database search off, elasticsearch on, packet predates features", dbDisabled: new(true), searching: new(true), license: &model.SupportPacketLicense{SkuShortName: model.LicenseShortSkuEnterprise}, want: resolvedWant},
		{name: "database search on, unlicensed", dbDisabled: new(false), searching: new(true), license: &model.SupportPacketLicense{}, want: resolvedWant},
		{name: "database search setting absent", dbDisabled: nil, searching: new(false), want: unknownConfigWant},
		{name: "elasticsearch setting absent", dbDisabled: new(true), searching: nil, want: unknownConfigWant},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			s := searchSnapshot(func(cfg *model.Config) {
				cfg.SqlSettings.DisableDatabaseSearch = tc.dbDisabled
				cfg.ElasticsearchSettings.EnableSearching = tc.searching
			}, nil, nil)
			if tc.license != nil {
				withLicense(s, *tc.license)
			}
			assertResult(t, searchUnavailable, s, tc.want)
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
			name:        "just above 5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(5_000_001))),
			required:    firing("scale_es_required", 5_000_001),
			recommended: resolvedAt(5_000_001),
		},
		{
			name:        "exactly 5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(5_000_000))),
			required:    resolvedAt(5_000_000),
			recommended: firing("scale_es_recommended", 5_000_000),
		},
		{
			name:        "just above 2.5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(2_500_001))),
			required:    resolvedAt(2_500_001),
			recommended: firing("scale_es_recommended", 2_500_001),
		},
		{
			name:        "exactly 2.5M",
			snapshot:    searchSnapshot(searchingOff, nil, new(int64(2_500_000))),
			required:    resolvedAt(2_500_000),
			recommended: resolvedAt(2_500_000),
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
		{
			name: "database search disabled at 6M",
			snapshot: searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.EnableSearching = new(false)
				cfg.SqlSettings.DisableDatabaseSearch = new(true)
			}, nil, new(int64(6_000_000))),
			required:    resolvedWant,
			recommended: resolvedWant,
		},
		{
			name: "database search setting absent",
			snapshot: searchSnapshot(func(cfg *model.Config) {
				cfg.ElasticsearchSettings.EnableSearching = new(false)
				cfg.SqlSettings.DisableDatabaseSearch = nil
			}, nil, new(int64(6_000_000))),
			required:    unknownConfigWant,
			recommended: unknownConfigWant,
		},
		{
			name:        "unlicensed at 6M",
			snapshot:    withLicense(searchSnapshot(searchingOff, nil, new(int64(6_000_000))), model.SupportPacketLicense{}),
			required:    resolvedWant,
			recommended: resolvedAt(6_000_000),
		},
		{
			name:        "unlicensed at 3M",
			snapshot:    withLicense(searchSnapshot(searchingOff, nil, new(int64(3_000_000))), model.SupportPacketLicense{}),
			required:    resolvedAt(3_000_000),
			recommended: resolvedWant,
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
	firing := func(variant, backend, version, minMajor, maxMajor string) searchWant {
		return searchWant{
			state:     healthcheck.StateFiring,
			messageID: "health.rule.es_version_unsupported.message." + variant,
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
		{name: "opensearch 4", backend: model.ElasticsearchSettingsOSBackend, version: "4.0.0", want: firing("too_new", "opensearch", "4.0.0", "2", "3")},
		{name: "opensearch 1", backend: model.ElasticsearchSettingsOSBackend, version: "1.3.20", want: firing("too_old", "opensearch", "1.3.20", "2", "3")},
		{name: "elasticsearch 7", backend: model.ElasticsearchSettingsESBackend, version: "7.17.0", want: firing("too_old", "elasticsearch", "7.17.0", "8", "9")},
		{name: "elasticsearch 8", backend: model.ElasticsearchSettingsESBackend, version: "8.15.3", want: resolvedWant},
		{name: "elasticsearch 9", backend: model.ElasticsearchSettingsESBackend, version: "9.0.0", want: resolvedWant},
		{name: "elasticsearch 10", backend: model.ElasticsearchSettingsESBackend, version: "10.0.0", want: firing("too_new", "elasticsearch", "10.0.0", "8", "9")},
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
