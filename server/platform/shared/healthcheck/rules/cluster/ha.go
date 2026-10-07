// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"net"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(clusterGossipUnencrypted, clusterLRUCache, clusterSingleNode, clusterBadAdvertise, clusterConfigWritable)
}

const (
	haConsolePath = "/admin_console/environment/high_availability"
	haDocsURL     = "https://mattermost.com/pl/high-availability-cluster"

	redisRecommendedUsers = 100_000
)

var clusterGossipUnencrypted = healthcheck.Rule{
	Code:     "CLUSTER_GOSSIP_UNENCRYPTED",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ClusterSettings.EnableGossipEncryption",
	Eval:       evalClusterGossipUnencrypted,
}

var clusterLRUCache = healthcheck.Rule{
	Code:     "CLUSTER_LRU_CACHE",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_lru_cache.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_lru_cache.remediation"),
		ConsolePath:   "/admin_console/environment/cache_settings",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "CacheSettings.CacheType",
	Eval:       evalClusterLRUCache,
}

var clusterSingleNode = healthcheck.Rule{
	Code:     "CLUSTER_SINGLE_NODE",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_single_node.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_single_node.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityTopology,
	Subject:    "ClusterSettings.Enable",
	Eval:       evalClusterSingleNode,
}

var clusterBadAdvertise = healthcheck.Rule{
	Code:     "CLUSTER_BAD_ADVERTISE",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_bad_advertise.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_bad_advertise.remediation"),
		DocsURL:       haDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ClusterSettings.AdvertiseAddress",
	Eval:       evalClusterBadAdvertise,
}

var clusterConfigWritable = healthcheck.Rule{
	Code:     "CLUSTER_CONFIG_WRITABLE",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_config_writable.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_config_writable.remediation"),
		DocsURL:       haDocsURL,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ClusterSettings.ReadOnlyConfig",
	Eval:       evalClusterConfigWritable,
}

// haRunning is the HA gate shared by four codes. ok is false when Config is absent.
func haRunning(s *healthcheck.Snapshot) (running, ok bool) {
	enabled, ok := clusterEnabled(s)
	if !ok || !enabled {
		return false, ok
	}

	name, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ClusterSettings.ClusterName })
	return name != "", ok
}

func clusterEnabled(s *healthcheck.Snapshot) (bool, bool) {
	return s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.Enable })
}

func registeredUsers(s *healthcheck.Snapshot) (int64, bool) {
	return s.Stat(func(stats *model.SupportPacketStats) *int64 { return stats.RegisteredUsers })
}

// leaderDiag returns the leader's diagnostics when section was collected without error.
func leaderDiag(s *healthcheck.Snapshot, section model.NodeSection) (*model.SupportPacketDiagnostics, bool) {
	leader, ok := s.Leader()
	if !ok || !leader.Has(section) {
		return nil, false
	}

	return leader.Diag()
}

func evalClusterGossipUnencrypted(s *healthcheck.Snapshot) []healthcheck.Result {
	running, ok := haRunning(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !running {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	encrypted, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.EnableGossipEncryption })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case !encrypted:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalClusterLRUCache(s *healthcheck.Snapshot) []healthcheck.Result {
	running, ok := haRunning(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !running {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	cacheType, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.CacheSettings.CacheType })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if cacheType != model.CacheTypeLRU {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	users, ok := registeredUsers(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)}
	case users >= redisRecommendedUsers:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_lru_cache.message")).
			WithDetail("users", strconv.FormatInt(users, 10)).
			WithValue(float64(users))}
	default:
		return []healthcheck.Result{healthcheck.Resolved().WithValue(float64(users))}
	}
}

// The server writes NumberOfNodes as 1 when it has no running cluster, so that also fires.
func evalClusterSingleNode(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := clusterEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	diag, ok := leaderDiag(s, model.SectionCluster)
	if !ok || diag.Cluster.NumberOfNodes == nil {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}
	if *diag.Cluster.NumberOfNodes < 2 {
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_single_node.message"))}
	}
	return []healthcheck.Result{healthcheck.Resolved()}
}

// isUnreachableAddress reports whether other nodes cannot reach address. Empty is fine: the
// server then advertises its network interface address.
func isUnreachableAddress(address string) bool {
	if strings.EqualFold(address, "localhost") {
		return true
	}

	ip := net.ParseIP(address)
	return ip != nil && (ip.IsLoopback() || ip.IsUnspecified())
}

func evalClusterBadAdvertise(s *healthcheck.Snapshot) []healthcheck.Result {
	running, ok := haRunning(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !running {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	address, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ClusterSettings.AdvertiseAddress })
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	case isUnreachableAddress(address):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_bad_advertise.message")).WithDetail("address", address)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

// ReadOnlyConfig only has an effect on a file config store; the database store ignores it.
func evalClusterConfigWritable(s *healthcheck.Snapshot) []healthcheck.Result {
	running, ok := haRunning(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !running {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	readOnly, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.ReadOnlyConfig })
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if readOnly {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	diag, ok := leaderDiag(s, model.SectionConfigSource)
	switch {
	case !ok || diag.Config.Source == "":
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	case strings.HasPrefix(diag.Config.Source, "file://"):
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_writable.message"))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
