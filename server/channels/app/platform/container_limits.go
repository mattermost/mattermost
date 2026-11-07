// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

// ContainerLimits holds the effective CPU limit for the current container. The memory
// limit is read with the other memory diagnostics, see memoryDiagnostics.
// Zero values indicate no limit is set (fields will be omitted from YAML output).
type ContainerLimits struct {
	CPULimit float64
}

type cgroupV2Info struct {
	dir                  string
	memoryStatsSupported bool
}

type memoryDiagnostics struct {
	AvailableMemoryMB           *uint64
	SwapTotalMB                 *uint64
	SwapUsedMB                  *uint64
	ProcessRSSMB                *uint64
	ContainerMemoryLimitMB      uint64 // zero when no limit is set
	ContainerMemoryUsageMB      *uint64
	ContainerMemoryWorkingSetMB *uint64
	ContainerOOMKills           *uint64
}

type cpuStats struct {
	LoadAverage1m                *float64
	LoadAverage5m                *float64
	LoadAverage15m               *float64
	ContainerCPUPeriods          *uint64
	ContainerCPUThrottledPeriods *uint64
	ContainerCPUThrottledSeconds *float64
}
