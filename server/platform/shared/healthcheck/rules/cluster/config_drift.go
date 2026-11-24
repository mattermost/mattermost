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

// configDrift compares the config section hashes in each node's diagnostics. Live health
// checks collect them from every node and Support Packets carry them in each node's
// diagnostics.yaml, so both evaluate the same data. See healthcheck.ConfigSectionHashes for
// what the hashes leave out.
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

// sectionHashes returns the node's config section hashes. Nodes that did not reply, and
// packets from servers that predate the hashes, have none.
func sectionHashes(n *healthcheck.NodeSnapshot) (map[string]string, bool) {
	diag, ok := n.Diag()
	if !ok || len(diag.Config.SectionHashes) == 0 {
		return nil, false
	}

	return diag.Config.SectionHashes, true
}

// configKey identifies a node's whole config by its section hashes.
func configKey(hashes map[string]string) string {
	var key strings.Builder
	for _, section := range slices.Sorted(maps.Keys(hashes)) {
		key.WriteString(section + "=" + hashes[section] + ";")
	}
	return key.String()
}

type configGroup struct {
	hashes    map[string]string
	hostnames []string
}

// configGroups groups the nodes that report section hashes by their whole config.
func configGroups(nodes []*healthcheck.NodeSnapshot) map[string]*configGroup {
	groups := map[string]*configGroup{}
	for _, node := range nodes {
		hashes, ok := sectionHashes(node)
		if !ok {
			continue
		}
		key := configKey(hashes)
		if groups[key] == nil {
			groups[key] = &configGroup{hashes: hashes}
		}
		groups[key].hostnames = append(groups[key].hostnames, node.Hostname)
	}
	return groups
}

// mixedBuilds reports whether the nodes run different builds. A newer build can add settings
// or change defaults, so their hashes can differ whatever their config files say.
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

// differingSections adds to into the sections whose hashes differ between a and b, including
// sections only one of them has.
func differingSections(into map[string]bool, a, b map[string]string) {
	for section, hash := range a {
		if b[section] != hash {
			into[section] = true
		}
	}
	for section := range b {
		if _, ok := a[section]; !ok {
			into[section] = true
		}
	}
}

func joinSections(sections map[string]bool) string {
	return strings.Join(slices.Sorted(maps.Keys(sections)), ", ")
}

// noMajority explains a tie: the groups, and every section that is not the same on all nodes.
func noMajority(result healthcheck.Result, groups map[string]*configGroup) healthcheck.Result {
	sections := map[string]bool{}
	var first *configGroup
	for _, group := range groups {
		if first == nil {
			first = group
			continue
		}
		differingSections(sections, first.hashes, group.hashes)
	}

	return result.WithDetail("groups", splitGroups(groups)).WithDetail("sections", joinSections(sections))
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
	sections := map[string]bool{}
	for _, group := range groups {
		if group != majority {
			differing = append(differing, group.hostnames...)
			differingSections(sections, group.hashes, majority.hashes)
		}
	}
	slices.Sort(differing)
	return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message")).
		WithDetail("nodes", strings.Join(differing, ", ")).
		WithDetail("sections", joinSections(sections))
}

func evalConfigDriftNode(s *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	hashes, ok := sectionHashes(n)
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
	case configKey(hashes) != configKey(majority.hashes):
		sections := map[string]bool{}
		differingSections(sections, hashes, majority.hashes)
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.cluster_config_drift.message.node")).
			WithDetail("node", n.Hostname).
			WithDetail("majority", strconv.Itoa(len(majority.hostnames))).
			WithDetail("sections", joinSections(sections))
	default:
		return healthcheck.Resolved()
	}
}
