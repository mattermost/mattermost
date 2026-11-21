// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"maps"
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(configDrift)
}

var (
	reasonMixedBuilds = healthcheck.TranslationId("health.rule.cluster_config_drift.message.mixed_builds")
	reasonNoMajority  = healthcheck.TranslationId("health.rule.cluster_config_drift.message.no_majority")
)

// configDrift compares the client config hash each node gossips. It covers client settings
// only, so drift in server-only settings goes unseen. Packets carry no hash, so offline it is
// always unknown.
var configDrift = healthcheck.Rule{
	Code:     "CLUSTER_CONFIG_DRIFT",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_config_drift.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_config_drift.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityTopology,
	Subject:    "cluster.config",
	Eval:       clusterLicensed(healthcheck.Gate((*healthcheck.Snapshot).ClusterEnabled, healthcheck.ReasonConfigUnavailable, evalConfigDriftGlobal)),
	EvalNode:   healthcheck.LicensedNode(healthcheck.FeatureCluster, healthcheck.GateNode((*healthcheck.Snapshot).ClusterEnabled, healthcheck.ReasonConfigUnavailable, evalConfigDriftNode)),
}

func configHash(n *healthcheck.NodeSnapshot) (string, bool) {
	if n == nil || n.ClusterInfo == nil || n.ClusterInfo.ConfigHash == "" {
		return "", false
	}

	return n.ClusterInfo.ConfigHash, true
}

// hashGroups groups the hostnames of the nodes that advertise a hash by that hash.
func hashGroups(nodes []*healthcheck.NodeSnapshot) map[string][]string {
	groups := map[string][]string{}
	for _, node := range nodes {
		if hash, ok := configHash(node); ok {
			groups[hash] = append(groups[hash], node.Hostname)
		}
	}
	return groups
}

// mixedBuilds reports whether the nodes gossip different builds. The client config embeds the
// build, so their hashes differ whatever their settings.
func mixedBuilds(nodes []*healthcheck.NodeSnapshot) bool {
	builds := map[string]bool{}
	for _, node := range nodes {
		if node.ClusterInfo != nil && node.ClusterInfo.Version != "" {
			builds[node.ClusterInfo.Version] = true
		}
	}
	return len(builds) > 1
}

// splitGroups lists the hostnames grouped by hash, e.g. "app-1, app-3 | app-2".
func splitGroups(groups map[string][]string) string {
	split := make([]string, 0, len(groups))
	for _, hostnames := range groups {
		split = append(split, strings.Join(hostnames, ", "))
	}
	slices.Sort(split)
	return strings.Join(split, " | ")
}

// majorityHash returns the hash most nodes advertise and how many do. ok is false when no node
// advertises one, or when the top count is tied, so the odd node never flips between cycles.
func majorityHash(groups map[string][]string) (hash string, size int, ok bool) {
	tied := false
	for candidate, hostnames := range groups {
		switch {
		case len(hostnames) > size:
			hash, size, tied = candidate, len(hostnames), false
		case len(hostnames) == size:
			tied = true
		}
	}

	return hash, size, size > 0 && !tied
}

func evalConfigDriftGlobal(s *healthcheck.Snapshot) healthcheck.Result {
	nodes := s.Nodes()
	groups := hashGroups(nodes)
	switch {
	case len(groups) == 0:
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	case mixedBuilds(nodes):
		return healthcheck.Unknown(reasonMixedBuilds)
	case len(groups) == 1:
		return healthcheck.Resolved()
	}

	majority, _, ok := majorityHash(groups)
	if !ok {
		return healthcheck.Firing(reasonNoMajority).WithDetail("groups", splitGroups(groups))
	}

	var differing []string
	for _, hash := range slices.Sorted(maps.Keys(groups)) {
		if hash != majority {
			differing = append(differing, groups[hash]...)
		}
	}
	slices.Sort(differing)
	return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message")).WithDetail("nodes", strings.Join(differing, ", "))
}

func evalConfigDriftNode(s *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	hash, ok := configHash(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	nodes := s.Nodes()
	if mixedBuilds(nodes) {
		return healthcheck.Unknown(reasonMixedBuilds)
	}

	groups := hashGroups(nodes)
	majority, size, ok := majorityHash(groups)
	switch {
	case !ok:
		return healthcheck.Unknown(reasonNoMajority).WithDetail("groups", splitGroups(groups))
	case hash != majority:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message.node")).
			WithDetail("node", n.Hostname).
			WithDetail("majority", strconv.Itoa(size))
	default:
		return healthcheck.Resolved()
	}
}
