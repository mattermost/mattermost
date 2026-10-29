// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(nodeNotResponding)
}

var nodeNotResponding = healthcheck.Rule{
	Code:     "NODE_NOT_RESPONDING",
	Area:     model.AreaCluster,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_not_responding.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_not_responding.remediation"),
		DocsURL:       haDocsURL,
		ConsolePath:   haConsolePath,
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityTopology,
	Subject:    "cluster.node",
	EvalNode:   healthcheck.LicensedNode(healthcheck.FeatureCluster, healthcheck.GateNode(haRunning, healthcheck.ReasonConfigUnavailable, evalNodeNotResponding)),
}

func evalNodeNotResponding(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	switch {
	case n.CollectErr == nil:
		return healthcheck.Resolved()
	case errors.Is(n.CollectErr, healthcheck.ErrNodeOlderVersion):
		return healthcheck.Unknown(healthcheck.TranslationId("health.rule.node_not_responding.message.older_version"))
	default:
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_not_responding.message")).WithUnreachableNode(n.Hostname)
	}
}
