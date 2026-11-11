// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package platform

// cgroupV2Info has no fields here: cgroups are only read on Linux.
type cgroupV2Info struct{}

func getCgroupV2Info() (cgroupV2Info, error) {
	return cgroupV2Info{}, nil
}

// getContainerLimits returns zero values on non-Linux platforms.
// Container limit detection via cgroups is only supported on Linux.
func getContainerLimits(cgroupV2Info) (ContainerLimits, error) {
	return ContainerLimits{}, nil
}

func getMemoryDiagnostics(cgroupV2Info) (memoryDiagnostics, error) {
	return memoryDiagnostics{}, nil
}

func getCPUStats(cgroupV2Info) (cpuStats, error) {
	return cpuStats{}, nil
}
