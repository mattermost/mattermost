// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	containerMemoryPressureRatio = 0.90
	hostMemoryLowRatio           = 0.10
)

func init() {
	healthcheck.Register(
		nodeContainerMemoryPressure,
		nodeContainerOOMKills,
		nodeHostMemoryLow,
		nodeGoMemoryLimitAboveContainer,
	)
}

var nodeContainerMemoryPressure = healthcheck.Rule{
	Code:     "NODE_CONTAINER_MEMORY_PRESSURE",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_container_memory_pressure.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_container_memory_pressure.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.ContainerMemory",
	EvalNode:   healthcheck.SingleNode(evalNodeContainerMemoryPressure),
}

var nodeContainerOOMKills = healthcheck.Rule{
	Code:     "NODE_CONTAINER_OOM_KILLS",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_container_oom_kills.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_container_oom_kills.remediation"),
		ConsolePath:   "/admin_console/plugins/plugin_management",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.ContainerOOMKills",
	EvalNode:   healthcheck.SingleNode(evalNodeContainerOOMKills),
}

var nodeHostMemoryLow = healthcheck.Rule{
	Code:     "NODE_HOST_MEMORY_LOW",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_host_memory_low.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_host_memory_low.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.HostMemory",
	EvalNode:   healthcheck.SingleNode(evalNodeHostMemoryLow),
}

var nodeGoMemoryLimitAboveContainer = healthcheck.Rule{
	Code:     "NODE_GO_MEMORY_LIMIT_ABOVE_CONTAINER",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_go_memory_limit_above_container.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_go_memory_limit_above_container.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "Server.GoMemoryLimit",
	EvalNode:   healthcheck.SingleNode(evalNodeGoMemoryLimitAboveContainer),
}

func nodeMemoryDiagnostics(n *healthcheck.NodeSnapshot) (*model.SupportPacketDiagnostics, bool) {
	if !n.Has(model.SectionServerMemory) {
		return nil, false
	}
	return n.Diag()
}

func evalNodeContainerMemoryPressure(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeMemoryDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if diag.Server.ContainerMemoryLimitMB == 0 {
		return healthcheck.Resolved()
	}
	workingSet := diag.Server.ContainerMemoryWorkingSetMB
	if workingSet == nil {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	ratio := float64(*workingSet) / float64(diag.Server.ContainerMemoryLimitMB)
	if ratio >= containerMemoryPressureRatio {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_container_memory_pressure.message")).
			WithDetail("working_set", strconv.FormatUint(*workingSet, 10)).
			WithDetail("limit", strconv.FormatUint(diag.Server.ContainerMemoryLimitMB, 10)).
			WithValue(ratio)
	}
	return healthcheck.Resolved().WithValue(ratio)
}

func evalNodeContainerOOMKills(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeMemoryDiagnostics(n)
	if !ok || diag.Server.ContainerOOMKills == nil {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if *diag.Server.ContainerOOMKills > 0 {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_container_oom_kills.message")).
			WithDetail("kills", strconv.FormatUint(*diag.Server.ContainerOOMKills, 10))
	}
	return healthcheck.Resolved()
}

func evalNodeHostMemoryLow(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeMemoryDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if diag.Server.ContainerMemoryLimitMB > 0 {
		return healthcheck.Resolved()
	}
	available, total := diag.Server.AvailableMemoryMB, diag.Server.TotalMemoryMB
	if available == nil || total == nil || *total == 0 {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	ratio := float64(*available) / float64(*total)
	if ratio < hostMemoryLowRatio {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_host_memory_low.message")).
			WithDetail("available", strconv.FormatUint(*available, 10)).
			WithDetail("total", strconv.FormatUint(*total, 10)).
			WithValue(ratio)
	}
	return healthcheck.Resolved().WithValue(ratio)
}

func evalNodeGoMemoryLimitAboveContainer(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeMemoryDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if diag.Server.ContainerMemoryLimitMB == 0 {
		return healthcheck.Resolved()
	}
	if diag.Server.GoMemoryLimitMB == nil {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}
	if *diag.Server.GoMemoryLimitMB >= diag.Server.ContainerMemoryLimitMB {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_go_memory_limit_above_container.message")).
			WithDetail("go_limit", strconv.FormatUint(*diag.Server.GoMemoryLimitMB, 10)).
			WithDetail("container_limit", strconv.FormatUint(diag.Server.ContainerMemoryLimitMB, 10))
	}
	return healthcheck.Resolved()
}
