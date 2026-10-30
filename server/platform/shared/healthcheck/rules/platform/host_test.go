// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
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

func fdNode(open, limit *int64) *healthcheck.NodeSnapshot {
	return leaderNode(func(diag *model.SupportPacketDiagnostics) {
		diag.Server.OpenFileDescriptors = open
		diag.Server.MaxFileDescriptors = limit
	})
}

func TestNodeFDExhaustion(t *testing.T) {
	t.Parallel()

	fdsFailed := fdNode(new(int64(950)), new(int64(1000)))
	fdsFailed.Diagnostics.Errors[model.SectionServerFDs] = errors.New("error while getting open file descriptor count")

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{"95 percent", fdNode(new(int64(950)), new(int64(1000))), firing("health.rule.node_fd_exhaustion.message", map[string]string{"open": "950", "max": "1000"}).withValue(0.95)},
		{"exactly 90 percent", fdNode(new(int64(90)), new(int64(100))), firing("health.rule.node_fd_exhaustion.message", map[string]string{"open": "90", "max": "100"}).withValue(0.90)},
		{"89 percent", fdNode(new(int64(89)), new(int64(100))), resolved.withValue(0.89)},
		{"max unsupported", fdNode(new(int64(100)), new(int64(-1))), diagUnknown},
		{"open unsupported", fdNode(new(int64(-1)), new(int64(1000))), diagUnknown},
		{"max zero", fdNode(new(int64(0)), new(int64(0))), diagUnknown},
		{"open not collected", fdNode(nil, new(int64(1000))), diagUnknown},
		{"max not collected", fdNode(new(int64(100)), nil), diagUnknown},
		{"server_fds absent", withoutSection(fdNode(new(int64(950)), new(int64(1000))), model.SectionServerFDs), diagUnknown},
		{"server_fds failed", fdsFailed, diagUnknown},
		{"nil diagnostics", &healthcheck.NodeSnapshot{Hostname: "app-1"}, diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			assertResult(t, tc.want, nodeFDExhaustion.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}
