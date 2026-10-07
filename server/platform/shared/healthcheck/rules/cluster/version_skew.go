// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"maps"
	"slices"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(versionSkew)
}

// versionSkew emits one global result naming the version set and one result per node, so an
// upgraded node resolves rather than going stale.
var versionSkew = healthcheck.Rule{
	Code:     "CLUSTER_VERSION_SKEW",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.cluster_version_skew.title"),
		RemediationID: healthcheck.TranslationId("health.rule.cluster_version_skew.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityTopology,
	Subject:    "cluster.version",
	Eval:       evalVersionSkewGlobal,
	EvalNode:   evalVersionSkewNode,
}

// versionCounts counts the nodes reporting each version; nodes that report none are left out.
func versionCounts(nodes []*healthcheck.NodeSnapshot) map[string]int {
	counts := map[string]int{}
	for _, node := range nodes {
		if version, ok := node.NodeVersion(); ok {
			counts[version]++
		}
	}
	return counts
}

// majorityVersion returns the version most nodes report. ok is false when no node reports a
// version, or when the top count is tied, so the odd node never flips between cycles.
func majorityVersion(nodes []*healthcheck.NodeSnapshot) (version string, ok bool) {
	top, tied := 0, false
	for candidate, count := range versionCounts(nodes) {
		switch {
		case count > top:
			version, top, tied = candidate, count, false
		case count == top:
			tied = true
		}
	}

	return version, top > 0 && !tied
}

func evalVersionSkewGlobal(s *healthcheck.Snapshot) []healthcheck.Result {
	enabled, ok := clusterEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	counts := versionCounts(s.Nodes())
	switch {
	case len(counts) == 0:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	case len(counts) > 1:
		versions := slices.Sorted(maps.Keys(counts))
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_version_skew.message")).WithDetail("versions", strings.Join(versions, ", "))}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

func evalVersionSkewNode(s *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) []healthcheck.Result {
	enabled, ok := clusterEnabled(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}
	if !enabled {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	version, ok := n.NodeVersion()
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}

	majority, ok := majorityVersion(s.Nodes())
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.TranslationId("health.rule.cluster_version_skew.message.no_majority"))}
	case version != majority:
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_version_skew.message.node")).
			WithDetail("version", version).
			WithDetail("majority", majority)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}
