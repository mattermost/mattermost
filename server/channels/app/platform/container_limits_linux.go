// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// cgroupPaths holds the file paths used to read cgroup v2 resource limits.
// These are package-level variables so they can be overridden in tests.
var cgroupPaths = struct {
	v2MemoryMax     string
	v2CPUMax        string
	v2MemoryCurrent string
	v2MemoryStat    string
	v2MemoryEvents  string
	procMeminfo     string
	procSelfStatus  string
}{
	v2MemoryMax:     "/sys/fs/cgroup/memory.max",
	v2CPUMax:        "/sys/fs/cgroup/cpu.max",
	v2MemoryCurrent: "/sys/fs/cgroup/memory.current",
	v2MemoryStat:    "/sys/fs/cgroup/memory.stat",
	v2MemoryEvents:  "/sys/fs/cgroup/memory.events",
	procMeminfo:     "/proc/meminfo",
	procSelfStatus:  "/proc/self/status",
}

// ContainerLimits holds effective CPU and memory limits for the current container.
// Zero values indicate no limit is set (fields will be omitted from YAML output).
type ContainerLimits struct {
	CPULimit      float64
	MemoryLimitMB uint64
}

type memoryDiagnostics struct {
	AvailableMemoryMB           *uint64
	SwapTotalMB                 *uint64
	SwapUsedMB                  *uint64
	ProcessRSSMB                *uint64
	ContainerMemoryUsageMB      *uint64
	ContainerMemoryWorkingSetMB *uint64
	ContainerOOMKills           *uint64
}

// getContainerLimits reads container resource limits from cgroups v2.
// Returns zero values when no limits are detected (bare metal, unlimited, or non-v2 system).
func getContainerLimits() (ContainerLimits, error) {
	var limits ContainerLimits

	// Memory limit: "max" means unlimited, otherwise bytes
	memStr, err := readTrimmed(cgroupPaths.v2MemoryMax)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return limits, nil
		}
		return limits, err
	}
	if memStr != "max" {
		var memBytes uint64
		memBytes, err = strconv.ParseUint(memStr, 10, 64)
		if err != nil {
			return limits, err
		}
		limits.MemoryLimitMB = (memBytes + 1024*1024 - 1) / (1024 * 1024)
	}

	// CPU limit: format is "quota period"; quota is "max" when unlimited
	cpuStr, err := readTrimmed(cgroupPaths.v2CPUMax)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return limits, nil
		}
		return limits, err
	}
	parts := strings.Fields(cpuStr)
	if len(parts) != 2 {
		return limits, errors.New("unexpected format in cpu.max")
	}
	if parts[0] != "max" {
		quota, err := strconv.ParseFloat(parts[0], 64)
		if err != nil {
			return limits, err
		}
		period, err := strconv.ParseFloat(parts[1], 64)
		if err != nil {
			return limits, err
		}
		if period > 0 {
			limits.CPULimit = quota / period
		}
	}

	return limits, nil
}

func readTrimmed(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func getMemoryDiagnostics() (memoryDiagnostics, error) {
	var diagnostics memoryDiagnostics

	meminfo, err := readTrimmed(cgroupPaths.procMeminfo)
	if err != nil {
		return diagnostics, err
	}
	availableKB, err := parseProcKB(meminfo, "MemAvailable")
	if err != nil {
		return diagnostics, err
	}
	swapTotalKB, err := parseProcKB(meminfo, "SwapTotal")
	if err != nil {
		return diagnostics, err
	}
	swapFreeKB, err := parseProcKB(meminfo, "SwapFree")
	if err != nil {
		return diagnostics, err
	}
	if swapFreeKB > swapTotalKB {
		return diagnostics, errors.New("SwapFree exceeds SwapTotal in /proc/meminfo")
	}
	diagnostics.AvailableMemoryMB = new(availableKB / 1024)
	diagnostics.SwapTotalMB = new(swapTotalKB / 1024)
	diagnostics.SwapUsedMB = new((swapTotalKB - swapFreeKB) / 1024)

	status, err := readTrimmed(cgroupPaths.procSelfStatus)
	if err != nil {
		return diagnostics, err
	}
	rssKB, err := parseProcKB(status, "VmRSS")
	if err != nil {
		return diagnostics, err
	}
	diagnostics.ProcessRSSMB = new(rssKB / 1024)

	memoryMax, err := readTrimmed(cgroupPaths.v2MemoryMax)
	if errors.Is(err, os.ErrNotExist) {
		return diagnostics, nil
	} else if err != nil {
		return diagnostics, err
	}
	if memoryMax != "max" {
		if _, err = strconv.ParseUint(memoryMax, 10, 64); err != nil {
			return diagnostics, fmt.Errorf("parse %s: %w", cgroupPaths.v2MemoryMax, err)
		}
	}

	current, err := parseUintFile(cgroupPaths.v2MemoryCurrent)
	if err != nil {
		return diagnostics, err
	}
	inactiveFile, err := parseNamedUintFile(cgroupPaths.v2MemoryStat, "inactive_file")
	if err != nil {
		return diagnostics, err
	}
	oomKills, err := parseNamedUintFile(cgroupPaths.v2MemoryEvents, "oom_kill")
	if err != nil {
		return diagnostics, err
	}

	workingSet := uint64(0)
	if current > inactiveFile {
		workingSet = current - inactiveFile
	}
	diagnostics.ContainerMemoryUsageMB = new(current / (1024 * 1024))
	diagnostics.ContainerMemoryWorkingSetMB = new(workingSet / (1024 * 1024))
	diagnostics.ContainerOOMKills = new(oomKills)

	return diagnostics, nil
}

func parseProcKB(contents, key string) (uint64, error) {
	for line := range strings.SplitSeq(contents, "\n") {
		fields := strings.Fields(line)
		if len(fields) == 3 && fields[0] == key+":" && fields[2] == "kB" {
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, fmt.Errorf("parse %s: %w", key, err)
			}
			return value, nil
		}
	}
	return 0, fmt.Errorf("%s not found", key)
}

func parseUintFile(path string) (uint64, error) {
	value, err := readTrimmed(path)
	if err != nil {
		return 0, err
	}
	parsed, err := strconv.ParseUint(value, 10, 64)
	if err != nil {
		return 0, fmt.Errorf("parse %s: %w", path, err)
	}
	return parsed, nil
}

func parseNamedUintFile(path, key string) (uint64, error) {
	contents, err := readTrimmed(path)
	if err != nil {
		return 0, err
	}
	for line := range strings.SplitSeq(contents, "\n") {
		fields := strings.Fields(line)
		if len(fields) == 2 && fields[0] == key {
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				return 0, fmt.Errorf("parse %s in %s: %w", key, path, err)
			}
			return value, nil
		}
	}
	return 0, fmt.Errorf("%s not found in %s", key, path)
}
