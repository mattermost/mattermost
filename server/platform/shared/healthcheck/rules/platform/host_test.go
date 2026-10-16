// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func listenOn(address string) func(*model.Config) {
	return func(cfg *model.Config) {
		cfg.ServiceSettings.ListenAddress = new(address)
	}
}

func onOS(os string) *healthcheck.NodeSnapshot {
	return leaderNode(func(diag *model.SupportPacketDiagnostics) {
		diag.Server.OS = os
	})
}

func withoutSection(node *healthcheck.NodeSnapshot, section model.NodeSection) *healthcheck.NodeSnapshot {
	delete(node.Diagnostics.Errors, section)
	return node
}

func TestHostRules(t *testing.T) {
	t.Parallel()

	rules := []healthcheck.Rule{envUnsupportedOS, bindPrivilegedPort}
	unsupported := func(os string) want {
		return firing("health.rule.env_unsupported_os.message", map[string]string{"os": os})
	}
	privileged := func(port string) want {
		return firing("health.rule.bind_privileged_port.message", map[string]string{"port": port})
	}

	hostnameFailed := onOS("linux")
	hostnameFailed.Diagnostics.Errors[model.SectionServerHost] = errors.New("error while getting hostname")

	testCases := []struct {
		name     string
		snapshot *healthcheck.Snapshot
		want     map[string]want
	}{
		{
			name:     "linux on a high port",
			snapshot: configSnapshot(listenOn(":8065"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "linux on 443",
			snapshot: configSnapshot(listenOn(":443"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name:     "linux on 80 with a host",
			snapshot: configSnapshot(listenOn("0.0.0.0:80"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("80")},
		},
		{
			name:     "linux on 1023",
			snapshot: configSnapshot(listenOn("[::1]:1023"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("1023")},
		},
		{
			name:     "linux on 1024",
			snapshot: configSnapshot(listenOn("[::1]:1024"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "linux on an ephemeral port",
			snapshot: configSnapshot(listenOn("localhost:0"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "windows on 443",
			snapshot: configSnapshot(listenOn(":443"), onOS("windows")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": unsupported("windows"), "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "darwin",
			snapshot: configSnapshot(listenOn(":8065"), onOS("darwin")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": unsupported("darwin"), "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "server_host absent still evaluates the port from config",
			snapshot: configSnapshot(listenOn(":443"), withoutSection(onOS("windows"), model.SectionServerHost)),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": diagUnknown, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name:     "a failed hostname lookup does not hide the OS",
			snapshot: configSnapshot(listenOn(":8065"), hostnameFailed),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": resolved},
		},
		{
			name:     "empty OS",
			snapshot: configSnapshot(listenOn(":443"), onOS("")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": diagUnknown, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name:     "no leader diagnostics",
			snapshot: configSnapshot(listenOn(":443"), &healthcheck.NodeSnapshot{IsLeader: true}),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": diagUnknown, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name:     "config absent",
			snapshot: healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{onOS("linux")}),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": configUnknown},
		},
		{
			name: "listen address unreadable",
			snapshot: configSnapshot(func(cfg *model.Config) {
				cfg.ServiceSettings.ListenAddress = nil
			}, onOS("linux")),
			want: map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": configUnknown},
		},
		{
			name:     "empty listen address without TLS resolves to 80",
			snapshot: configSnapshot(listenOn(""), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("80")},
		},
		{
			name: "empty listen address with TLS resolves to 443",
			snapshot: configSnapshot(all(listenOn(""), func(cfg *model.Config) {
				cfg.ServiceSettings.ConnectionSecurity = new(model.ConnSecurityTLS)
			}), onOS("linux")),
			want: map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name: "empty listen address with unreadable connection security",
			snapshot: configSnapshot(all(listenOn(""), func(cfg *model.Config) {
				cfg.ServiceSettings.ConnectionSecurity = nil
			}), onOS("linux")),
			want: map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": configUnknown},
		},
		{
			name:     "https service name",
			snapshot: configSnapshot(listenOn(":https"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("443")},
		},
		{
			name:     "http service name",
			snapshot: configSnapshot(listenOn("localhost:http"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": privileged("80")},
		},
		{
			name:     "address without a port",
			snapshot: configSnapshot(listenOn("8065"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": configUnknown},
		},
		{
			name:     "non-numeric port",
			snapshot: configSnapshot(listenOn(":mattermost"), onOS("linux")),
			want:     map[string]want{"ENV_UNSUPPORTED_OS": resolved, "BIND_PRIVILEGED_PORT": configUnknown},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertRules(t, rules, tc.snapshot, tc.want)
		})
	}
}

func fdNode(hostname string, leader bool, open, limit *int64) *healthcheck.NodeSnapshot {
	return diagNode(hostname, leader, func(diag *model.SupportPacketDiagnostics) {
		diag.Server.OpenFileDescriptors = open
		diag.Server.MaxFileDescriptors = limit
	})
}

func TestNodeFDExhaustion(t *testing.T) {
	t.Parallel()

	fdsFailed := fdNode("app-1", true, new(int64(950)), new(int64(1000)))
	fdsFailed.Diagnostics.Errors[model.SectionServerFDs] = errors.New("error while getting open file descriptor count")

	testCases := []struct {
		name    string
		node    *healthcheck.NodeSnapshot
		state   healthcheck.State
		message string
		details map[string]string
		value   *float64
	}{
		{
			name:    "95 percent",
			node:    fdNode("app-1", true, new(int64(950)), new(int64(1000))),
			state:   healthcheck.StateFiring,
			message: "health.rule.node_fd_exhaustion.message",
			details: map[string]string{"open": "950", "max": "1000"},
			value:   new(0.95),
		},
		{
			name:    "exactly 90 percent",
			node:    fdNode("app-1", true, new(int64(90)), new(int64(100))),
			state:   healthcheck.StateFiring,
			message: "health.rule.node_fd_exhaustion.message",
			details: map[string]string{"open": "90", "max": "100"},
			value:   new(0.90),
		},
		{
			name:  "89 percent",
			node:  fdNode("app-1", true, new(int64(89)), new(int64(100))),
			state: healthcheck.StateResolved,
			value: new(0.89),
		},
		{name: "max unsupported", node: fdNode("app-1", true, new(int64(100)), new(int64(-1))), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "open unsupported", node: fdNode("app-1", true, new(int64(-1)), new(int64(1000))), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "max zero", node: fdNode("app-1", true, new(int64(0)), new(int64(0))), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "open not collected", node: fdNode("app-1", true, nil, new(int64(1000))), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "max not collected", node: fdNode("app-1", true, new(int64(100)), nil), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "server_fds absent", node: withoutSection(fdNode("app-1", true, new(int64(950)), new(int64(1000))), model.SectionServerFDs), state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "server_fds failed", node: fdsFailed, state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
		{name: "nil diagnostics", node: &healthcheck.NodeSnapshot{Hostname: "app-1"}, state: healthcheck.StateUnknown, message: healthcheck.ReasonDiagnosticsUnavailable},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			results := nodeFDExhaustion.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node)
			require.Len(t, results, 1)
			assert.Equal(t, tc.state, results[0].State)
			assert.Equal(t, tc.message, results[0].MessageID)
			assert.Equal(t, tc.details, results[0].Details)
			if tc.value == nil {
				assert.Nil(t, results[0].Value)
			} else {
				require.NotNil(t, results[0].Value)
				assert.InDelta(t, *tc.value, *results[0].Value, 1e-9)
			}
		})
	}
}

func evaluateFDs(t *testing.T, nodes ...*healthcheck.NodeSnapshot) map[string]healthcheck.Result {
	t.Helper()

	registry := healthcheck.NewRegistry()
	registry.Register(nodeFDExhaustion)
	evaluations := healthcheck.NewEngine(healthcheck.EngineOpts{Registry: registry}).Evaluate(healthcheck.NewSnapshot(nodes))
	require.Len(t, evaluations, len(nodes))

	byScope := map[string]healthcheck.Result{}
	for _, evaluation := range evaluations {
		byScope[evaluation.Result.Scope] = evaluation.Result
	}
	return byScope
}

func TestNodeFDExhaustionPerNode(t *testing.T) {
	t.Parallel()

	t.Run("three node packet with one node near the limit", func(t *testing.T) {
		t.Parallel()

		results := evaluateFDs(t,
			fdNode("app-1", false, new(int64(120)), new(int64(65536))),
			fdNode("app-2", true, new(int64(62260)), new(int64(65536))),
			fdNode("app-3", false, new(int64(240)), new(int64(65536))),
		)

		require.Len(t, results, 3)
		assert.Equal(t, healthcheck.StateFiring, results["app-2"].State)
		assert.Equal(t, healthcheck.StateResolved, results["app-1"].State)
		assert.Equal(t, healthcheck.StateResolved, results["app-3"].State)
		for scope, result := range results {
			assert.NotNil(t, result.Value, scope)
			assert.Equal(t, "Server.FileDescriptors", result.Subject, scope)
		}
	})

	t.Run("live snapshot with leader-only diagnostics", func(t *testing.T) {
		t.Parallel()

		results := evaluateFDs(t,
			&healthcheck.NodeSnapshot{Hostname: "app-1"},
			fdNode("app-2", true, new(int64(120)), new(int64(65536))),
			&healthcheck.NodeSnapshot{Hostname: "app-3"},
		)

		require.Len(t, results, 3)
		assert.Equal(t, healthcheck.StateResolved, results["app-2"].State)
		assert.NotNil(t, results["app-2"].Value)
		for _, follower := range []string{"app-1", "app-3"} {
			assert.Equal(t, healthcheck.StateUnknown, results[follower].State, follower)
			assert.Equal(t, healthcheck.ReasonDiagnosticsUnavailable, results[follower].MessageID, follower)
			assert.Nil(t, results[follower].Value, follower)
		}
	})
}
