// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"net"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func init() {
	healthcheck.Register(envUnsupportedOS, bindPrivilegedPort, nodeFDExhaustion)
}

const fdExhaustionRatio = 0.90

var envUnsupportedOS = healthcheck.Rule{
	Code:     "ENV_UNSUPPORTED_OS",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.env_unsupported_os.title"),
		RemediationID: healthcheck.TranslationId("health.rule.env_unsupported_os.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "Server.OS",
	Eval:       evalEnvUnsupportedOS,
}

var bindPrivilegedPort = healthcheck.Rule{
	Code:     "BIND_PRIVILEGED_PORT",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityWarning,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.bind_privileged_port.title"),
		RemediationID: healthcheck.TranslationId("health.rule.bind_privileged_port.remediation"),
		ConsolePath:   "/admin_console/environment/web_server",
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityStable,
	Subject:    "ServiceSettings.ListenAddress",
	Eval:       evalBindPrivilegedPort,
}

var nodeFDExhaustion = healthcheck.Rule{
	Code:     "NODE_FD_EXHAUSTION",
	Area:     model.AreaPlatform,
	Severity: healthcheck.SeverityCritical,
	RuleText: model.RuleText{
		TitleID:       healthcheck.TranslationId("health.rule.node_fd_exhaustion.title"),
		RemediationID: healthcheck.TranslationId("health.rule.node_fd_exhaustion.remediation"),
	},
	Surface:    healthcheck.SurfaceProduct,
	Volatility: healthcheck.VolatilityThreshold,
	Subject:    "Server.FileDescriptors",
	EvalNode:   evalNodeFDExhaustion,
}

// leaderOS returns the leader's operating system. The OS is always collected, so an error
// recorded for another value in the server_host section does not make it unreliable.
func leaderOS(s *healthcheck.Snapshot) (string, bool) {
	leader, ok := s.Leader()
	if !ok {
		return "", false
	}

	diag, ok := leader.Diag()
	if !ok {
		return "", false
	}
	if present, _ := leader.SectionErr(model.SectionServerHost); !present || diag.Server.OS == "" {
		return "", false
	}

	return diag.Server.OS, true
}

func evalEnvUnsupportedOS(s *healthcheck.Snapshot) []healthcheck.Result {
	hostOS, ok := leaderOS(s)
	switch {
	case !ok:
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	case hostOS != "linux":
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.env_unsupported_os.message")).WithDetail("os", hostOS)}
	default:
		return []healthcheck.Result{healthcheck.Resolved()}
	}
}

// listenPort resolves ServiceSettings.ListenAddress to a port the way the server does when it starts listening.
func listenPort(s *healthcheck.Snapshot) (int, bool) {
	address, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ServiceSettings.ListenAddress })
	if !ok {
		return 0, false
	}

	if address == "" {
		security, ok := s.ConfigString(func(cfg *model.Config) *string { return cfg.ServiceSettings.ConnectionSecurity })
		if !ok {
			return 0, false
		}
		address = ":http"
		if security == model.ConnSecurityTLS {
			address = ":https"
		}
	}

	_, port, err := net.SplitHostPort(address)
	if err != nil {
		return 0, false
	}

	switch port {
	case "http":
		return 80, true
	case "https":
		return 443, true
	}

	number, err := strconv.Atoi(port)
	return number, err == nil
}

// Only Linux needs a capability to bind a low port; an unknown OS is treated as Linux, the
// production platform. Port 0 asks the OS for an ephemeral port, which is never privileged.
func evalBindPrivilegedPort(s *healthcheck.Snapshot) []healthcheck.Result {
	port, ok := listenPort(s)
	if !ok {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonConfigUnavailable)}
	}

	if hostOS, known := leaderOS(s); known && hostOS != "linux" {
		return []healthcheck.Result{healthcheck.Resolved()}
	}

	if port > 0 && port < 1024 {
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.bind_privileged_port.message")).WithDetail("port", strconv.Itoa(port))}
	}
	return []healthcheck.Result{healthcheck.Resolved()}
}

// A negative count means the OS does not report file descriptors.
func evalNodeFDExhaustion(_ *healthcheck.Snapshot, n *healthcheck.NodeSnapshot) []healthcheck.Result {
	diag, ok := n.Diag()
	if !ok || !n.Has(model.SectionServerFDs) {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}

	open, limit := diag.Server.OpenFileDescriptors, diag.Server.MaxFileDescriptors
	if open == nil || limit == nil || *open < 0 || *limit <= 0 {
		return []healthcheck.Result{healthcheck.Unknown(healthcheck.ReasonDiagnosticsUnavailable)}
	}

	ratio := float64(*open) / float64(*limit)
	if ratio >= fdExhaustionRatio {
		return []healthcheck.Result{healthcheck.Firing(healthcheck.TranslationId("health.rule.node_fd_exhaustion.message")).
			WithDetail("open", strconv.FormatInt(*open, 10)).
			WithDetail("max", strconv.FormatInt(*limit, 10)).
			WithValue(ratio)}
	}
	return []healthcheck.Result{healthcheck.Resolved().WithValue(ratio)}
}
