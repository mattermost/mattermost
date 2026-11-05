// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/healthcheck"
)

func memoryNode(mutate func(*model.SupportPacketDiagnostics)) *healthcheck.NodeSnapshot {
	return leaderNode(func(diag *model.SupportPacketDiagnostics) {
		diag.Server.TotalMemoryMB = new(uint64(1000))
		diag.Server.AvailableMemoryMB = new(uint64(500))
		diag.Server.ContainerMemoryLimitMB = 1000
		diag.Server.ContainerMemoryWorkingSetMB = new(uint64(500))
		diag.Server.ContainerOOMKills = new(uint64(0))
		diag.Server.GoMemoryLimitMB = new(uint64(800))
		if mutate != nil {
			mutate(diag)
		}
	})
}

func TestNodeContainerMemoryPressure(t *testing.T) {
	t.Parallel()

	failed := memoryNode(nil)
	failed.Diagnostics.Errors[model.SectionServerMemory] = errors.New("memory.current read failed")

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{
			"above 90 percent",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryWorkingSetMB = new(uint64(950))
			}),
			firing("health.rule.node_container_memory_pressure.message", map[string]string{"working_set": "950", "limit": "1000"}).withValue(0.95),
		},
		{
			"exactly 90 percent",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryWorkingSetMB = new(uint64(900))
			}),
			firing("health.rule.node_container_memory_pressure.message", map[string]string{"working_set": "900", "limit": "1000"}).withValue(0.90),
		},
		{"below 90 percent", memoryNode(nil), resolved.withValue(0.50)},
		{
			"no container limit",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryLimitMB = 0
				diag.Server.ContainerMemoryWorkingSetMB = nil
			}),
			resolved,
		},
		{
			"working set not collected",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryWorkingSetMB = nil
			}),
			diagUnknown,
		},
		{"section absent", withoutSection(memoryNode(nil), model.SectionServerMemory), diagUnknown},
		{"section failed", failed, diagUnknown},
		{"nil diagnostics", &healthcheck.NodeSnapshot{Hostname: "app-1"}, diagUnknown},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeContainerMemoryPressure.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}

func TestNodeContainerOOMKills(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{
			"kills recorded",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerOOMKills = new(uint64(3))
			}),
			firing("health.rule.node_container_oom_kills.message", map[string]string{"kills": "3"}),
		},
		{"none recorded", memoryNode(nil), resolved},
		{
			"not collected",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerOOMKills = nil
			}),
			diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeContainerOOMKills.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}

func TestNodeHostMemoryLow(t *testing.T) {
	t.Parallel()

	hostNode := func(available *uint64) *healthcheck.NodeSnapshot {
		return memoryNode(func(diag *model.SupportPacketDiagnostics) {
			diag.Server.ContainerMemoryLimitMB = 0
			diag.Server.AvailableMemoryMB = available
		})
	}

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{
			"below 10 percent",
			hostNode(new(uint64(90))),
			firing("health.rule.node_host_memory_low.message", map[string]string{"available": "90", "total": "1000"}).withValue(0.09),
		},
		{"exactly 10 percent", hostNode(new(uint64(100))), resolved.withValue(0.10)},
		{"above 10 percent", hostNode(new(uint64(500))), resolved.withValue(0.50)},
		{
			"container limit skips host values",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.AvailableMemoryMB = new(uint64(1))
			}),
			resolved,
		},
		{"available not collected", hostNode(nil), diagUnknown},
		{
			"total not collected",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryLimitMB = 0
				diag.Server.TotalMemoryMB = nil
			}),
			diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeHostMemoryLow.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}

func TestNodeGoMemoryLimitAboveContainer(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name string
		node *healthcheck.NodeSnapshot
		want want
	}{
		{
			"above container limit",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.GoMemoryLimitMB = new(uint64(1100))
			}),
			firing("health.rule.node_go_memory_limit_above_container.message", map[string]string{"go_limit": "1100", "container_limit": "1000"}),
		},
		{
			"equal to container limit",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.GoMemoryLimitMB = new(uint64(1000))
			}),
			firing("health.rule.node_go_memory_limit_above_container.message", map[string]string{"go_limit": "1000", "container_limit": "1000"}),
		},
		{"below container limit", memoryNode(nil), resolved},
		{
			"no container limit",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.ContainerMemoryLimitMB = 0
				diag.Server.GoMemoryLimitMB = nil
			}),
			resolved,
		},
		{
			"go limit not collected",
			memoryNode(func(diag *model.SupportPacketDiagnostics) {
				diag.Server.GoMemoryLimitMB = nil
			}),
			diagUnknown,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertResult(t, tc.want, nodeGoMemoryLimitAboveContainer.EvalNode(healthcheck.NewSnapshot([]*healthcheck.NodeSnapshot{tc.node}), tc.node))
		})
	}
}
