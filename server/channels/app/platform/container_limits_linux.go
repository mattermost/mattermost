// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

// resourcePaths holds procfs files used to inspect system resources.
// These are package-level variables so they can be overridden in tests.
var resourcePaths = struct {
	procMeminfo       string
	procSelfStatus    string
	procSelfCgroup    string
	procSelfMountInfo string
}{
	procMeminfo:       "/proc/meminfo",
	procSelfStatus:    "/proc/self/status",
	procSelfCgroup:    "/proc/self/cgroup",
	procSelfMountInfo: "/proc/self/mountinfo",
}

var mountInfoPathReplacer = strings.NewReplacer(
	`\040`, " ",
	`\011`, "\t",
	`\012`, "\n",
	`\134`, `\`,
)

// getContainerLimits reads container resource limits from cgroups v2.
// Returns zero values when no limits are detected (bare metal, unlimited, or non-v2 system).
func getContainerLimits(info cgroupV2Info) (ContainerLimits, error) {
	var limits ContainerLimits
	if info.dir == "" {
		return limits, nil
	}

	if info.memoryStatsSupported != nil && *info.memoryStatsSupported {
		// Memory limit: "max" means unlimited, otherwise bytes
		memStr, err := readTrimmed(filepath.Join(info.dir, "memory.max"))
		if err != nil {
			return limits, err
		}
		if memStr != "max" {
			memBytes, err := strconv.ParseUint(memStr, 10, 64)
			if err != nil {
				return limits, err
			}
			limits.MemoryLimitMB = (memBytes + 1024*1024 - 1) / (1024 * 1024)
		}
	}

	// CPU limit: format is "quota period"; quota is "max" when unlimited
	cpuStr, err := readTrimmed(filepath.Join(info.dir, "cpu.max"))
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

func getCgroupV2Info() (cgroupV2Info, error) {
	cgroup, err := readFile(resourcePaths.procSelfCgroup)
	if err != nil {
		return cgroupV2Info{}, err
	}

	membership, found, err := parseCgroupV2Membership(cgroup)
	if err != nil {
		return cgroupV2Info{}, err
	}
	if !found {
		supported := false
		return cgroupV2Info{memoryStatsSupported: &supported}, nil
	}

	mountInfo, err := readFile(resourcePaths.procSelfMountInfo)
	if err != nil {
		return cgroupV2Info{}, err
	}
	dir, err := resolveCgroupV2Dir(membership, mountInfo)
	if err != nil {
		return cgroupV2Info{}, err
	}

	_, err = os.Stat(filepath.Join(dir, "memory.max"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return cgroupV2Info{}, err
	}
	memoryStatsSupported := err == nil
	return cgroupV2Info{dir: dir, memoryStatsSupported: &memoryStatsSupported}, nil
}

func parseCgroupV2Membership(contents string) (string, bool, error) {
	for line := range strings.SplitSeq(contents, "\n") {
		parts := strings.SplitN(line, ":", 3)
		if len(parts) != 3 || parts[0] != "0" || parts[1] != "" {
			continue
		}
		membership := filepath.Clean(parts[2])
		if !filepath.IsAbs(membership) {
			return "", false, fmt.Errorf("invalid cgroup v2 membership path %q", parts[2])
		}
		return membership, true, nil
	}
	return "", false, nil
}

func resolveCgroupV2Dir(membership, contents string) (string, error) {
	var (
		bestDir     string
		bestRootLen int
	)
	for line := range strings.SplitSeq(contents, "\n") {
		fields := strings.Split(line, " ")
		separator := slices.Index(fields, "-")
		if separator < 6 || separator+1 >= len(fields) || fields[separator+1] != "cgroup2" {
			continue
		}

		root := filepath.Clean(mountInfoPathReplacer.Replace(fields[3]))
		mountPoint := filepath.Clean(mountInfoPathReplacer.Replace(fields[4]))
		if !filepath.IsAbs(root) || !filepath.IsAbs(mountPoint) {
			continue
		}
		relative, err := filepath.Rel(root, membership)
		if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
			continue
		}
		if len(root) > bestRootLen {
			bestDir = filepath.Join(mountPoint, relative)
			bestRootLen = len(root)
		}
	}
	if bestDir == "" {
		return "", fmt.Errorf("cgroup v2 membership %q has no matching cgroup2 mount", membership)
	}
	return bestDir, nil
}

func readTrimmed(path string) (string, error) {
	data, err := readFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(data), nil
}

func readFile(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func getMemoryDiagnostics(info cgroupV2Info) (memoryDiagnostics, error) {
	var diagnostics memoryDiagnostics

	meminfo, err := readTrimmed(resourcePaths.procMeminfo)
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

	status, err := readTrimmed(resourcePaths.procSelfStatus)
	if err != nil {
		return diagnostics, err
	}
	rssKB, err := parseProcKB(status, "VmRSS")
	if err != nil {
		return diagnostics, err
	}
	diagnostics.ProcessRSSMB = new(rssKB / 1024)

	if info.memoryStatsSupported == nil || !*info.memoryStatsSupported {
		return diagnostics, nil
	}

	memoryMaxPath := filepath.Join(info.dir, "memory.max")
	memoryMax, err := readTrimmed(memoryMaxPath)
	if err != nil {
		return diagnostics, err
	}
	if memoryMax != "max" {
		if _, err = strconv.ParseUint(memoryMax, 10, 64); err != nil {
			return diagnostics, fmt.Errorf("parse %s: %w", memoryMaxPath, err)
		}
	}

	current, err := parseUintFile(filepath.Join(info.dir, "memory.current"))
	if err != nil {
		return diagnostics, err
	}
	inactiveFile, err := parseNamedUintFile(filepath.Join(info.dir, "memory.stat"), "inactive_file")
	if err != nil {
		return diagnostics, err
	}
	oomKills, err := parseNamedUintFile(filepath.Join(info.dir, "memory.events"), "oom_kill")
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
