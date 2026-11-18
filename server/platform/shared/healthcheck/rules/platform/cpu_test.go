// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func cpuNode(mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	return leaderNode(func(diag *model.SupportPacketDiagnostics) {
		diag.Server.CPUCores = 8
		diag.Server.LoadAverage15m = new(3.0)
		diag.Server.ContainerCPUPeriods = new(uint64(2000))
		diag.Server.ContainerCPUThrottledPeriods = new(uint64(100))
		diag.Server.GoMaxProcs = new(4)
		if mutate != nil {
			mutate(diag)
		}
	})
}

func TestNodeCPUThrottled(t *testing.T) {
	t.Parallel()

	failed := cpuNode(nil)
	failed.Diagnostics.Errors[model.SectionServerCPU] = errors.New("failed to read cpu.stat")

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{"at threshold", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = new(uint64(1000))
			d.Server.ContainerCPUThrottledPeriods = new(uint64(100))
		}), firing("health.rule.node_cpu_throttled.message", map[string]string{"throttled": "100", "periods": "1000"}).withValue(0.10)},
		{"above threshold", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = new(uint64(2000))
			d.Server.ContainerCPUThrottledPeriods = new(uint64(300))
		}), firing("health.rule.node_cpu_throttled.message", map[string]string{"throttled": "300", "periods": "2000"}).withValue(0.15)},
		{"below threshold", cpuNode(nil), resolved.withValue(0.05)},
		{"not enough periods", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = new(uint64(999))
			d.Server.ContainerCPUThrottledPeriods = new(uint64(999))
		}), resolved.withValue(1)},
		{"cgroup CPU stats not applicable", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = nil
			d.Server.ContainerCPUThrottledPeriods = nil
		}), resolved},
		{"zero periods", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = new(uint64(0))
			d.Server.ContainerCPUThrottledPeriods = new(uint64(0))
		}), resolved.withValue(0)},
		{"throttled periods without periods", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPUPeriods = new(uint64(0))
			d.Server.ContainerCPUThrottledPeriods = new(uint64(1))
		}), diagUnknown},
		{"server_cpu absent", withoutSection(cpuNode(nil), model.SectionServerCPU), diagUnknown},
		{"server_cpu failed", failed, diagUnknown},
		{"nil diagnostics", &healthcheck.NodeSnapshot{Hostname: "app-1"}, diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeCPUThrottled.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}

func TestNodeGOMAXPROCSAboveCPULimit(t *testing.T) {
	t.Parallel()

	failed := cpuNode(nil)
	failed.Diagnostics.Errors[model.SectionServerCPU] = errors.New("failed to read CPU statistics")

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{"above CPU limit", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 4
			d.Server.GoMaxProcs = new(5)
		}), firing("health.rule.node_gomaxprocs_above_cpu_limit.message", map[string]string{"go_max_procs": "5", "cpu_limit": "4"})},
		{"fractional limit uses minimum of two", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 0.5
			d.Server.GoMaxProcs = new(3)
		}), firing("health.rule.node_gomaxprocs_above_cpu_limit.message", map[string]string{"go_max_procs": "3", "cpu_limit": "0.5"})},
		{"at rounded CPU limit", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 2.1
			d.Server.GoMaxProcs = new(3)
		}), resolved},
		{"no CPU limit", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 0
		}), resolved},
		{"GOMAXPROCS missing without a CPU limit", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 0
			d.Server.GoMaxProcs = nil
		}), diagUnknown},
		{"GOMAXPROCS missing", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 4
			d.Server.GoMaxProcs = nil
		}), diagUnknown},
		{"server_cpu absent", withoutSection(cpuNode(nil), model.SectionServerCPU), diagUnknown},
		{"server_cpu failed", failed, diagUnknown},
		{"nil diagnostics", &healthcheck.NodeSnapshot{Hostname: "app-1"}, diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeGOMAXPROCSAboveCPULimit.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}

func TestNodeHostLoadHigh(t *testing.T) {
	t.Parallel()

	failed := cpuNode(nil)
	failed.Diagnostics.Errors[model.SectionServerCPU] = errors.New("failed to read load average")

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{"at threshold", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.LoadAverage15m = new(16.0)
		}), firing("health.rule.node_host_load_high.message", map[string]string{"load": "16.00", "cores": "8"}).withValue(2)},
		{"below threshold", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.LoadAverage15m = new(8.0)
		}), resolved.withValue(1)},
		{"container is skipped", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 4
			d.Server.LoadAverage15m = new(32.0)
		}), resolved},
		{"container with load average missing", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.ContainerCPULimit = 4
			d.Server.LoadAverage15m = nil
		}), diagUnknown},
		{"load average missing", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.LoadAverage15m = nil
		}), diagUnknown},
		{"CPU cores missing", cpuNode(func(d *model.SupportPacketDiagnostics) {
			d.Server.CPUCores = 0
		}), diagUnknown},
		{"server_cpu absent", withoutSection(cpuNode(nil), model.SectionServerCPU), diagUnknown},
		{"server_cpu failed", failed, diagUnknown},
		{"nil diagnostics", &healthcheck.NodeSnapshot{Hostname: "app-1"}, diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeHostLoadHigh.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}
