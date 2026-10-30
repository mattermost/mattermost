// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck/rules/internal/hosts"
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
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ClusterSettings.EnableGossipEncryption",
	Eval:       clusterLicensed(healthcheck.Gate(haRunning, healthcheck.ReasonConfigUnavailable, evalClusterGossipUnencrypted)),
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
	Eval:       clusterLicensed(healthcheck.Gate(haRunning, healthcheck.ReasonConfigUnavailable, evalClusterLRUCache)),
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
	Eval:       clusterLicensed(healthcheck.Gate((*healthcheck.Snapshot).ClusterEnabled, healthcheck.ReasonConfigUnavailable, evalClusterSingleNode)),
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
	Eval:       clusterLicensed(healthcheck.Gate(haRunning, healthcheck.ReasonConfigUnavailable, evalClusterBadAdvertise)),
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
	Eval:       clusterLicensed(healthcheck.Gate(haRunning, healthcheck.ReasonConfigUnavailable, evalClusterConfigWritable)),
}

func clusterLicensed(eval func(*healthcheck.Snapshot) []healthcheck.Result) func(*healthcheck.Snapshot) []healthcheck.Result {
	return healthcheck.Licensed(healthcheck.FeatureCluster, eval)
}

// haRunning is the HA gate shared by four codes. ok is false when Config is absent.
func haRunning(s *healthcheck.Snapshot) (running, ok bool) {
	enabled, ok := s.ClusterEnabled()
	if !ok || !enabled {
		return false, ok
	}

	name, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ClusterSettings.ClusterName })
	return name != "", ok
}

func evalClusterGossipUnencrypted(s *healthcheck.Snapshot) healthcheck.Result {
	encrypted, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.EnableGossipEncryption })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	case !encrypted:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_gossip_unencrypted.message"))
	default:
		return healthcheck.Resolved()
	}
}

func evalClusterLRUCache(s *healthcheck.Snapshot) healthcheck.Result {
	cacheType, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.CacheSettings.CacheType })
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	if cacheType != model.CacheTypeLRU {
		return healthcheck.Resolved()
	}

	users, ok := s.RegisteredUsers()
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonStatsUnavailable)
	case users >= redisRecommendedUsers:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_lru_cache.message")).
			WithDetail("users", strconv.FormatInt(users, 10)).
			WithValue(float64(users))
	default:
		return healthcheck.Resolved().WithValue(float64(users))
	}
}

// The server writes NumberOfConnectedNodes as 1 when it has no running cluster, so that also fires.
// NumberOfNodes would hide a node cut off from gossip, because it still counts its database registration.
func evalClusterSingleNode(s *healthcheck.Snapshot) healthcheck.Result {
	diag, ok := s.LeaderDiag(model.SectionCluster)
	if !ok || diag.Cluster.NumberOfConnectedNodes == nil {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if *diag.Cluster.NumberOfConnectedNodes < 2 {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_single_node.message"))
	}
	return healthcheck.Resolved()
}

func evalClusterBadAdvertise(s *healthcheck.Snapshot) healthcheck.Result {
	address, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ClusterSettings.AdvertiseAddress })
	switch {
	case !ok:
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	// Empty is fine: the server then advertises its network interface address.
	case hosts.IsLocal(address):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_bad_advertise.message")).WithDetail("address", address)
	default:
		return healthcheck.Resolved()
	}
}

// ReadOnlyConfig only has an effect on a file config store; the database store ignores it.
func evalClusterConfigWritable(s *healthcheck.Snapshot) healthcheck.Result {
	readOnly, ok := s.ConfigBool(func(cfg *model.Config) *bool { return cfg.ClusterSettings.ReadOnlyConfig })
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)
	}
	if readOnly {
		return healthcheck.Resolved()
	}

	diag, ok := s.LeaderDiag(model.SectionConfigSource)
	switch {
	case !ok || diag.Config.Source == "":
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	case strings.HasPrefix(diag.Config.Source, "file://"):
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_writable.message"))
	default:
		return healthcheck.Resolved()
	}
}
