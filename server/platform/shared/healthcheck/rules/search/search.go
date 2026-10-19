// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package search

import (
	"net"
	"net/url"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(
		esLocalhostURL,
		esServerError,
		searchUnavailable,
		scaleESRequired,
		scaleESRecommended,
		esLiveBatchSync,
		esLiveBatchTooHigh,
		esVersionUnsupported,
		esMissingICU,
		esSkipTLSVerify,
	)
}

const (
	searchConsolePath = "/admin_console/environment/elasticsearch"
	searchDocsURL     = "https://mattermost.com/pl/setup-elasticsearch"

	connectionURLSubject   = "ElasticsearchSettings.ConnectionURL"
	enableSearchingSubject = "ElasticsearchSettings.EnableSearching"
	liveBatchSubject       = "ElasticsearchSettings.LiveIndexingBatchSize"

	scaleRecommendedPosts = 2_500_000
	scaleRequiredPosts    = 5_000_000
	maxLiveBatchSize      = 100
)

// Mirrors the enterprise elasticsearch/opensearch Min/MaxVersion constants, which this package cannot import.
var supportedMajors = map[string]struct{ min, max int }{
	model.ElasticsearchSettingsESBackend: {8, 9},
	model.ElasticsearchSettingsOSBackend: {2, 3},
}

var icuPlugins = []string{"analysis-icu", "opensearch-analysis-icu"}

var urlCredentials = regexp.MustCompile(`([A-Za-z][A-Za-z0-9+.-]*://)[^\s/]+@`)

var esLocalhostURL = healthcheck.Rule{
	Code:     "ES_LOCALHOST_URL",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_localhost_url.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_localhost_url.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    connectionURLSubject,
	Eval:       whenIndexing(evalESLocalhostURL),
}

var esServerError = healthcheck.Rule{
	Code:     "ES_SERVER_ERROR",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_server_error.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_server_error.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityProbe,
	Subject:    connectionURLSubject,
	Eval:       evalESServerError,
}

var searchUnavailable = healthcheck.Rule{
	Code:     "SEARCH_UNAVAILABLE",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.search_unavailable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.search_unavailable.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "SqlSettings.DisableDatabaseSearch",
	Eval:       evalSearchUnavailable,
}

var scaleESRequired = healthcheck.Rule{
	Code:     "SCALE_ES_REQUIRED",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.scale_es_required.title"),
		RemediationID: healthcheck.TranslationId("health.rule.scale_es_required.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    enableSearchingSubject,
	Eval:       evalScaleESRequired,
}

var scaleESRecommended = healthcheck.Rule{
	Code:     "SCALE_ES_RECOMMENDED",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.scale_es_recommended.title"),
		RemediationID: healthcheck.TranslationId("health.rule.scale_es_recommended.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    enableSearchingSubject,
	Eval:       evalScaleESRecommended,
}

var esLiveBatchSync = healthcheck.Rule{
	Code:     "ES_LIVE_BATCH_SYNC",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_live_batch_sync.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_live_batch_sync.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    liveBatchSubject,
	Eval:       whenIndexing(evalESLiveBatchSync),
}

var esLiveBatchTooHigh = healthcheck.Rule{
	Code:     "ES_LIVE_BATCH_TOO_HIGH",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_live_batch_too_high.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_live_batch_too_high.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    liveBatchSubject,
	Eval:       whenIndexing(evalESLiveBatchTooHigh),
}

var esVersionUnsupported = healthcheck.Rule{
	Code:     "ES_VERSION_UNSUPPORTED",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_version_unsupported.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_version_unsupported.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ElasticsearchSettings.Backend",
	Eval:       whenIndexing(evalESVersionUnsupported),
}

var esMissingICU = healthcheck.Rule{
	Code:     "ES_MISSING_ICU",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_missing_icu.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_missing_icu.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    connectionURLSubject,
	Eval:       whenIndexing(evalESMissingICU),
}

var esSkipTLSVerify = healthcheck.Rule{
	Code:     "ES_SKIP_TLS_VERIFY",
	Area:     model.AreaSearch,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.es_skip_tls_verify.title"),
		RemediationID: healthcheck.TranslationId("health.rule.es_skip_tls_verify.remediation"),
		DocsURL:       searchDocsURL,
		ConsolePath:   searchConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ElasticsearchSettings.SkipTLSVerification",
	Eval:       whenIndexing(evalESSkipTLSVerify),
}

func unknownConfig() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
}

func unknownDiag() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
}

func resolved() []healthcheck.Result {
	return []healthcheck.Result{healthcheck.Resolved()}
}

// whenIndexing resolves the rule while Elasticsearch indexing is off.
func whenIndexing(eval func(*healthcheck.Snapshot) []healthcheck.Result) func(*healthcheck.Snapshot) []healthcheck.Result {
	return func(s *healthcheck.Snapshot) []healthcheck.Result {
		indexing, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ElasticsearchSettings.EnableIndexing })
		if !ok {
			return unknownConfig()
		}
		if !indexing {
			return resolved()
		}
		return eval(s)
	}
}

func databaseSearchDisabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.SqlSettings.DisableDatabaseSearch })
}

func searchingEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ElasticsearchSettings.EnableSearching })
}

func connectionURL(s *healthcheck.Snapshot) (string, bool) {
	return s.ConfigString(func(cfg *model.Config) *string { return cfg.ElasticsearchSettings.ConnectionURL })
}

// leaderDiag returns the leader's diagnostics, or ok=false when they or the given section were not collected.
func leaderDiag(s *healthcheck.Snapshot, section model.NodeSection) (*model.SupportPacketDiagnostics, bool) {
	leader, _ := s.Leader()
	if _, err := leader.SectionErr(section); err != nil {
		return nil, false
	}
	return leader.Diag()
}

func isLoopbackHost(host string) bool {
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return true
	}

	ip := net.ParseIP(host)
	return ip != nil && (ip.IsLoopback() || ip.IsUnspecified())
}

func maskURLCredentials(s string) string {
	return urlCredentials.ReplaceAllString(s, "${1}****@")
}

func majorVersion(version string) (int, bool) {
	major, _, _ := strings.Cut(version, ".")
	n, err := strconv.Atoi(major)
	return n, err == nil
}

func evalESLocalhostURL(s *healthcheck.Snapshot) []healthcheck.Result {
	clustered, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
	if !ok {
		return unknownConfig()
	}
	if !clustered {
		return resolved()
	}

	connURL, ok := connectionURL(s)
	if !ok {
		return unknownConfig()
	}

	u, err := url.Parse(connURL)
	if err != nil || !isLoopbackHost(u.Hostname()) {
		return resolved()
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.es_localhost_url.message")).WithDetail("host", u.Hostname())}
}

func evalESServerError(s *healthcheck.Snapshot) []healthcheck.Result {
	diag, ok := leaderDiag(s, model.SectionSearchProbe)
	if !ok {
		return unknownDiag()
	}

	switch diag.ElasticSearch.Status {
	case model.StatusFail:
		return []healthcheck.Result{healthcheck.Firing(esServerErrorMessage(s)).WithDetail("error", maskURLCredentials(diag.ElasticSearch.Error))}
	case model.StatusOk, model.StatusDisabled:
		return resolved()
	default:
		return unknownDiag()
	}
}

// esServerErrorMessage says search is fully down when Elasticsearch serves search and there is no database fallback.
func esServerErrorMessage(s *healthcheck.Snapshot) string {
	searching, searchingOK := searchingEnabled(s)
	if dbDisabled, ok := databaseSearchDisabled(s); ok && dbDisabled && searchingOK && searching {
		return healthcheck.TranslationId("health.rule.es_server_error.message.no_fallback")
	}
	return healthcheck.TranslationId("health.rule.es_server_error.message")
}

// evalSearchUnavailable fires when neither the database nor Elasticsearch serves search.
func evalSearchUnavailable(s *healthcheck.Snapshot) []healthcheck.Result {
	dbDisabled, ok := databaseSearchDisabled(s)
	if !ok {
		return unknownConfig()
	}
	if !dbDisabled {
		return resolved()
	}

	searching, ok := searchingEnabled(s)
	if !ok {
		return unknownConfig()
	}
	if searching {
		return resolved()
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.search_unavailable.message"))}
}

// evalScale fires when fires(posts) holds while search runs against the database.
func evalScale(s *healthcheck.Snapshot, messageID string, fires func(posts int64) bool) []healthcheck.Result {
	searching, ok := searchingEnabled(s)
	if !ok {
		return unknownConfig()
	}
	if searching {
		return resolved()
	}

	// SEARCH_UNAVAILABLE owns the case where database search is disabled too.
	dbDisabled, ok := databaseSearchDisabled(s)
	if !ok {
		return unknownConfig()
	}
	if dbDisabled {
		return resolved()
	}

	posts, ok := s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.Posts })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	}

	if fires(posts) {
		return []healthcheck.Result{healthcheck.Firing(messageID).WithDetail("posts", strconv.FormatInt(posts, 10)).WithValue(float64(posts))}
	}

	return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(posts))}
}

func evalScaleESRequired(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalScale(s, healthcheck.TranslationId("health.rule.scale_es_required.message"), func(posts int64) bool {
		return posts > scaleRequiredPosts
	})
}

func evalScaleESRecommended(s *healthcheck.Snapshot) []healthcheck.Result {
	return evalScale(s, healthcheck.TranslationId("health.rule.scale_es_recommended.message"), func(posts int64) bool {
		return posts > scaleRecommendedPosts && posts <= scaleRequiredPosts
	})
}

func liveBatchSize(s *healthcheck.Snapshot) (int, bool) {
	return s.ConfigInt(func(cfg *model.Config) *int { return cfg.ElasticsearchSettings.LiveIndexingBatchSize })
}

func evalESLiveBatchSync(s *healthcheck.Snapshot) []healthcheck.Result {
	size, ok := liveBatchSize(s)
	switch {
	case !ok:
		return unknownConfig()
	case size <= 1:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.es_live_batch_sync.message"))}
	default:
		return resolved()
	}
}

func evalESLiveBatchTooHigh(s *healthcheck.Snapshot) []healthcheck.Result {
	size, ok := liveBatchSize(s)
	switch {
	case !ok:
		return unknownConfig()
	case size > maxLiveBatchSize:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.es_live_batch_too_high.message")).WithDetail("size", strconv.Itoa(size))}
	default:
		return resolved()
	}
}

func evalESVersionUnsupported(s *healthcheck.Snapshot) []healthcheck.Result {
	diag, ok := leaderDiag(s, model.SectionSearchEngine)
	if !ok {
		return unknownDiag()
	}

	backend, version := diag.ElasticSearch.Backend, diag.ElasticSearch.ServerVersion
	if version == "" {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.TranslationId("health.rule.es_version_unsupported.message.unavailable"))}
	}

	supported, known := supportedMajors[backend]
	major, parsed := majorVersion(version)
	if !known || !parsed {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.TranslationId("health.rule.es_version_unsupported.message.unrecognized"))}
	}

	if major >= supported.min && major <= supported.max {
		return resolved()
	}

	messageID := healthcheck.TranslationId("health.rule.es_version_unsupported.message.too_old")
	if major > supported.max {
		messageID = healthcheck.TranslationId("health.rule.es_version_unsupported.message.too_new")
	}

	return []healthcheck.Result{healthcheck.Firing(messageID).
		WithDetail("backend", backend).
		WithDetail("version", version).
		WithDetail("min", strconv.Itoa(supported.min)).
		WithDetail("max", strconv.Itoa(supported.max))}
}

func evalESMissingICU(s *healthcheck.Snapshot) []healthcheck.Result {
	// The plugin list is fetched only after the version, and an empty list is omitted from the packet.
	diag, ok := leaderDiag(s, model.SectionSearchEngine)
	if !ok {
		return unknownDiag()
	}
	if diag.ElasticSearch.ServerVersion == "" {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.TranslationId("health.rule.es_missing_icu.message.unavailable"))}
	}

	for _, plugin := range icuPlugins {
		if slices.Contains(diag.ElasticSearch.ServerPlugins, plugin) {
			return resolved()
		}
	}

	return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.es_missing_icu.message"))}
}

func evalESSkipTLSVerify(s *healthcheck.Snapshot) []healthcheck.Result {
	skip, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ElasticsearchSettings.SkipTLSVerification })
	if !ok {
		return unknownConfig()
	}

	connURL, ok := connectionURL(s)
	if !ok {
		return unknownConfig()
	}

	if skip && strings.HasPrefix(strings.ToLower(connURL), "https://") {
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.es_skip_tls_verify.message"))}
	}

	return resolved()
}
