// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"math"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

const (
	cpuThrottlingRatioThreshold = 0.10
	cpuThrottlingMinPeriods     = 1000
	hostLoadPerCoreThreshold    = 2.0
)

func init() {
	healthcheck.Register(nodeCPUThrottled, nodeGOMAXPROCSAboveCPULimit, nodeHostLoadHigh)
}

var nodeCPUThrottled = healthcheck.Rule{
	Code:     "NODE_CPU_THROTTLED",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_cpu_throttled.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_cpu_throttled.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.ContainerCPUThrottling",
	EvalNode:   healthcheck.SingleNode(evalNodeCPUThrottled),
}

var nodeGOMAXPROCSAboveCPULimit = healthcheck.Rule{
	Code:     "NODE_GOMAXPROCS_ABOVE_CPU_LIMIT",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_gomaxprocs_above_cpu_limit.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_gomaxprocs_above_cpu_limit.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "Server.GoMaxProcs",
	EvalNode:   healthcheck.SingleNode(evalNodeGOMAXPROCSAboveCPULimit),
}

var nodeHostLoadHigh = healthcheck.Rule{
	Code:     "NODE_HOST_LOAD_HIGH",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityInfo,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_host_load_high.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_host_load_high.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.LoadAverage15m",
	EvalNode:   healthcheck.SingleNode(evalNodeHostLoadHigh),
}

func nodeCPUDiagnostics(n *healthcheck.NodeSnapshot) (*model.SupportPacketDiagnostics, bool) {
	diag, ok := n.Diag()
	return diag, ok && n.Has(model.SectionServerCPU)
}

func evalNodeCPUThrottled(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeCPUDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	// Nil counters mean cgroup v2 CPU stats do not apply to this process.
	periods := diag.Server.ContainerCPUPeriods
	throttled := diag.Server.ContainerCPUThrottledPeriods
	if periods == nil || throttled == nil {
		return healthcheck.Resolved()
	}
	if *periods == 0 {
		if *throttled != 0 {
			return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
		}
		return healthcheck.Resolved().WithValue(0)
	}

	ratio := float64(*throttled) / float64(*periods)
	if *periods >= cpuThrottlingMinPeriods && ratio >= cpuThrottlingRatioThreshold {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_cpu_throttled.message")).
			WithDetail("throttled", strconv.FormatUint(*throttled, 10)).
			WithDetail("periods", strconv.FormatUint(*periods, 10)).
			WithValue(ratio)
	}
	return healthcheck.Resolved().WithValue(ratio)
}

func evalNodeGOMAXPROCSAboveCPULimit(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeCPUDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	goMaxProcs := diag.Server.GoMaxProcs
	if goMaxProcs == nil {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	cpuLimit := diag.Server.ContainerCPULimit
	if cpuLimit <= 0 {
		return healthcheck.Resolved()
	}

	maxProcs := int(math.Max(2, math.Ceil(cpuLimit)))
	if *goMaxProcs > maxProcs {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_gomaxprocs_above_cpu_limit.message")).
			WithDetail("go_max_procs", strconv.Itoa(*goMaxProcs)).
			WithDetail("cpu_limit", strconv.FormatFloat(cpuLimit, 'f', -1, 64))
	}
	return healthcheck.Resolved()
}

func evalNodeHostLoadHigh(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) healthcheck.Result {
	diag, ok := nodeCPUDiagnostics(n)
	if !ok {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	loadAverage := diag.Server.LoadAverage15m
	if loadAverage == nil || diag.Server.CPUCores <= 0 {
		return healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)
	}

	if diag.Server.ContainerCPULimit > 0 {
		return healthcheck.Resolved()
	}

	ratio := *loadAverage / float64(diag.Server.CPUCores)
	if ratio >= hostLoadPerCoreThreshold {
		return healthcheck.Firing(healthcheck.TranslationId("health.rule.node_host_load_high.message")).
			WithDetail("load", strconv.FormatFloat(*loadAverage, 'f', 2, 64)).
			WithDetail("cores", strconv.Itoa(diag.Server.CPUCores)).
			WithValue(ratio)
	}
	return healthcheck.Resolved().WithValue(ratio)
}
