// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
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

// maxListedSettings caps how many differing settings a finding names; its count gives the total.
const maxListedSettings = 10

// configDrift compares each node's sanitized config setting by setting. Live health checks
// collect the configs from every node with its diagnostics, and the packet reader reads each
// node's sanitized_config.json, so both evaluate the same data. See healthcheck.FlattenConfig
// for what the comparison leaves out.
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

// nodeSettings returns the node's flattened config. Nodes that did not reply, nodes on a build
// that does not send its config, and packet nodes without a readable config have none.
func nodeSettings(n *healthcheck.NodeSnapshot) (map[string]string, bool) {
	if n == nil || n.Diagnostics == nil {
		return nil, false
	}

	settings := healthcheck.FlattenConfig(n.Diagnostics.Config)
	return settings, len(settings) > 0
}

type configGroup struct {
	settings  map[string]string
	hostnames []string
}

// configGroups groups the nodes that have a config by that config.
func configGroups(nodes []*healthcheck.NodeSnapshot) map[string]*configGroup {
	groups := map[string]*configGroup{}
	for _, node := range nodes {
		settings, ok := nodeSettings(node)
		if !ok {
			continue
		}
		key := healthcheck.ConfigKey(settings)
		if groups[key] == nil {
			groups[key] = &configGroup{settings: settings}
		}
		groups[key].hostnames = append(groups[key].hostnames, node.Hostname)
	}
	return groups
}

// mixedBuilds reports whether the nodes run different builds. A newer build can add settings
// or change defaults, so their configs can differ whatever their config files say.
func mixedBuilds(nodes []*healthcheck.NodeSnapshot) bool {
	builds := map[string]bool{}
	for _, node := range nodes {
		if diag, ok := node.Diag(); ok && diag.Server.Version != "" {
			builds[diag.Server.Version+" "+diag.Server.BuildHash] = true
		}
	}
	return len(builds) > 1
}

// splitGroups lists the hostnames grouped by config, e.g. "app-1, app-3 | app-2".
func splitGroups(groups map[string]*configGroup) string {
	split := make([]string, 0, len(groups))
	for _, group := range groups {
		split = append(split, strings.Join(group.hostnames, ", "))
	}
	slices.Sort(split)
	return strings.Join(split, " | ")
}

// majorityConfig returns the config most nodes run. ok is false when the top count is tied, so
// the odd node never flips between cycles.
func majorityConfig(groups map[string]*configGroup) (majority *configGroup, ok bool) {
	tied := false
	for _, group := range groups {
		switch {
		case majority == nil || len(group.hostnames) > len(majority.hostnames):
			majority, tied = group, false
		case len(group.hostnames) == len(majority.hostnames):
			tied = true
		}
	}

	return majority, majority != nil && !tied
}

// withSettings names the differing settings, the first maxListedSettings by path, and how many
// there are in total.
func withSettings(result healthcheck.Result, paths map[string]bool) healthcheck.Result {
	sorted := healthcheck.SortedSettings(paths)
	listed := sorted[:min(len(sorted), maxListedSettings)]
	return result.
		WithDetail("settings", strings.Join(listed, ", ")).
		WithDetail("count", strconv.Itoa(len(sorted)))
}

// noMajority explains a tie: the groups, and every setting that is not the same on all nodes.
func noMajority(result healthcheck.Result, groups map[string]*configGroup) healthcheck.Result {
	paths := map[string]bool{}
	var first *configGroup
	for _, group := range groups {
		if first == nil {
			first = group
			continue
		}
		healthcheck.DifferingSettings(paths, first.settings, group.settings)
	}

	return withSettings(result.WithDetail("groups", splitGroups(groups)), paths)
}

func evalConfigDriftGlobal(s *healthcheck.Snapshot) healthcheck.Result {
	nodes := s.Nodes()
	groups := configGroups(nodes)
	switch {
	case len(groups) == 0:
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	case mixedBuilds(nodes):
		return healthcheck.Unknown(reasonMixedBuilds)
	case len(groups) == 1:
		return healthcheck.Resolved()
	}

	majority, ok := majorityConfig(groups)
	if !ok {
		return noMajority(healthcheck.Firing(reasonNoMajority), groups)
	}

	var differing []string
	paths := map[string]bool{}
	for _, group := range groups {
		if group != majority {
			differing = append(differing, group.hostnames...)
			healthcheck.DifferingSettings(paths, group.settings, majority.settings)
		}
	}
	slices.Sort(differing)
	return withSettings(healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message")).
		WithDetail("nodes", strings.Join(differing, ", ")), paths)
}

func evalConfigDriftNode(s *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	settings, ok := nodeSettings(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	nodes := s.Nodes()
	if mixedBuilds(nodes) {
		return healthcheck.Unknown(reasonMixedBuilds)
	}

	groups := configGroups(nodes)
	majority, ok := majorityConfig(groups)
	switch {
	case !ok:
		return noMajority(healthcheck.Unknown(reasonNoMajority), groups)
	case healthcheck.ConfigKey(settings) != healthcheck.ConfigKey(majority.settings):
		paths := map[string]bool{}
		healthcheck.DifferingSettings(paths, settings, majority.settings)
		return withSettings(healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message.node")).
			WithDetail("node", n.Hostname).
			WithDetail("majority", strconv.Itoa(len(majority.hostnames))), paths)
	default:
		return healthcheck.Resolved()
	}
}
