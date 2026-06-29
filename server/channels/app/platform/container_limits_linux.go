// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"errors"
	"os"
	"strconv"
	"strings"
)

// cgroupPaths holds the file paths used to read cgroup v2 resource limits.
// These are package-level variables so they can be overridden in tests.
var cgroupPaths = struct {
	v2MemoryMax string
	v2CPUMax    string
}{
	v2MemoryMax: "/sys/fs/cgroup/memory.max",
	v2CPUMax:    "/sys/fs/cgroup/cpu.max",
}

// ContainerLimits holds effective CPU and memory limits for the current container.
// Zero values indicate no limit is set (fields will be omitted from YAML output).
type ContainerLimits struct {
	CPULimit      float64
	MemoryLimitMB uint64
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
