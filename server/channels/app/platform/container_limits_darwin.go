// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"

	"golang.org/x/sys/unix"
)

// cgroupV2Info has no fields here: cgroups are only read on Linux.
type cgroupV2Info struct{}

func getCgroupV2Info() (cgroupV2Info, error) {
	return cgroupV2Info{}, nil
}

// getContainerLimits returns zero values: container limit detection via cgroups is only supported on Linux.
func getContainerLimits(cgroupV2Info) (ContainerLimits, error) {
	return ContainerLimits{}, nil
}

// loadavg mirrors struct loadavg from <sys/resource.h>.
type loadavg struct {
	Ldavg  [3]uint32
	_      uint32
	Fscale int64
}

// xswUsage mirrors struct xsw_usage from <sys/sysctl.h>.
type xswUsage struct {
	Total     uint64
	Avail     uint64
	Used      uint64
	Pagesize  uint32
	Encrypted int32
}

func getCPUStats(cgroupV2Info) (cpuStats, error) {
	var stats cpuStats

	raw, err := unix.SysctlRaw("vm.loadavg")
	if err != nil {
		return stats, fmt.Errorf("failed to get vm.loadavg: %w", err)
	}
	loads, err := decodeLoadAvg(raw)
	if err != nil {
		return stats, err
	}
	stats.LoadAverage1m = &loads[0]
	stats.LoadAverage5m = &loads[1]
	stats.LoadAverage15m = &loads[2]

	return stats, nil
}

func decodeLoadAvg(raw []byte) ([3]float64, error) {
	var (
		avg   loadavg
		loads [3]float64
	)
	if err := binary.Read(bytes.NewReader(raw), binary.NativeEndian, &avg); err != nil {
		return loads, fmt.Errorf("decode vm.loadavg: %w", err)
	}
	if avg.Fscale <= 0 {
		return loads, errors.New("vm.loadavg has a non-positive fscale")
	}
	for i, load := range avg.Ldavg {
		loads[i] = float64(load) / float64(avg.Fscale)
	}
	return loads, nil
}

var availablePageSysctls = []string{"vm.page_free_count", "vm.page_pageable_external_count", "vm.page_purgeable_count"}

func getMemoryDiagnostics(cgroupV2Info) (memoryDiagnostics, error) {
	var diagnostics memoryDiagnostics

	raw, err := unix.SysctlRaw("vm.swapusage")
	if err != nil {
		return diagnostics, fmt.Errorf("failed to get vm.swapusage: %w", err)
	}
	swap, err := decodeSwapUsage(raw)
	if err != nil {
		return diagnostics, err
	}
	diagnostics.SwapTotalMB = new(swap.Total / (1024 * 1024))
	diagnostics.SwapUsedMB = new(swap.Used / (1024 * 1024))

	// Page counts are in kernel pages, which can differ from this process's page size under Rosetta.
	pageSize, err := unix.SysctlUint32("vm.pagesize")
	if err != nil {
		return diagnostics, fmt.Errorf("failed to get vm.pagesize: %w", err)
	}
	// Free pages plus what Activity Monitor calls cached files: file-backed and purgeable pages,
	// which the kernel can reclaim without swapping.
	var availablePages uint64
	for _, name := range availablePageSysctls {
		pages, err := unix.SysctlUint32(name)
		if err != nil {
			return diagnostics, fmt.Errorf("failed to get %s: %w", name, err)
		}
		availablePages += uint64(pages)
	}
	diagnostics.AvailableMemoryMB = new(availablePages * uint64(pageSize) / (1024 * 1024))

	return diagnostics, nil
}

func decodeSwapUsage(raw []byte) (xswUsage, error) {
	var usage xswUsage
	if err := binary.Read(bytes.NewReader(raw), binary.NativeEndian, &usage); err != nil {
		return usage, fmt.Errorf("decode vm.swapusage: %w", err)
	}
	if usage.Used > usage.Total {
		return usage, errors.New("vm.swapusage used exceeds total")
	}
	return usage, nil
}
