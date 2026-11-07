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
	procLoadAvg       string
}{
	procMeminfo:       "/proc/meminfo",
	procSelfStatus:    "/proc/self/status",
	procSelfCgroup:    "/proc/self/cgroup",
	procSelfMountInfo: "/proc/self/mountinfo",
	procLoadAvg:       "/proc/loadavg",
}

var mountInfoPathReplacer = strings.NewReplacer(
	`\040`, " ",
	`\011`, "\t",
	`\012`, "\n",
	`\134`, `\`,
)

// getContainerLimits reads the container CPU limit from cgroups v2.
// Returns zero values when no limits are detected (bare metal, unlimited, or non-v2 system).
func getContainerLimits(info cgroupV2Info) (ContainerLimits, error) {
	var limits ContainerLimits
	if info.dir == "" {
		return limits, nil
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
		return cgroupV2Info{}, nil
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
	return cgroupV2Info{dir: dir, memoryStatsSupported: err == nil}, nil
}

func parseCgroupV2Membership(contents string) (string, bool, error) {
	for line := range strings.SplitSeq(contents, "\n") {
		parts := strings.SplitN(line, ":", 3)
		if len(parts) != 3 || parts[0] != "0" || parts[1] != "" {
			continue
		}
		if !filepath.IsAbs(parts[2]) {
			return "", false, fmt.Errorf("invalid cgroup v2 membership path %q", parts[2])
		}
		return parts[2], true, nil
	}
	return "", false, nil
}

// cleanCgroupPath cleans a cgroup path as a path relative to the cgroup
// namespace root. Unlike filepath.Clean on the absolute path, it keeps leading
// ".." elements, which point above the namespace root.
func cleanCgroupPath(path string) string {
	return filepath.Clean(strings.TrimLeft(path, "/"))
}

func resolveCgroupV2Dir(membership, contents string) (string, error) {
	var (
		bestDir     string
		bestRootLen int
	)
	cleanMembership := cleanCgroupPath(membership)
	for line := range strings.SplitSeq(contents, "\n") {
		fields := strings.Split(line, " ")
		separator := slices.Index(fields, "-")
		if separator < 6 || separator+1 >= len(fields) || fields[separator+1] != "cgroup2" {
			continue
		}

		root := mountInfoPathReplacer.Replace(fields[3])
		mountPoint := filepath.Clean(mountInfoPathReplacer.Replace(fields[4]))
		if !filepath.IsAbs(root) || !filepath.IsAbs(mountPoint) {
			continue
		}
		root = cleanCgroupPath(root)
		relative, err := filepath.Rel(root, cleanMembership)
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

func getCPUStats(info cgroupV2Info) (cpuStats, error) {
	var stats cpuStats

	loadAverage, err := readTrimmed(resourcePaths.procLoadAvg)
	if err != nil {
		return stats, err
	}
	fields := strings.Fields(loadAverage)
	if len(fields) < 3 {
		return stats, errors.New("unexpected format in loadavg")
	}
	var loads [3]float64
	for i := range loads {
		loads[i], err = strconv.ParseFloat(fields[i], 64)
		if err != nil {
			return stats, err
		}
	}
	stats.LoadAverage1m = &loads[0]
	stats.LoadAverage5m = &loads[1]
	stats.LoadAverage15m = &loads[2]

	if info.dir == "" {
		return stats, nil
	}
	if _, err = os.Stat(filepath.Join(info.dir, "cpu.max")); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return stats, nil
		}
		return stats, err
	}

	cpuStat, err := readTrimmed(filepath.Join(info.dir, "cpu.stat"))
	if err != nil {
		return stats, err
	}
	values := make(map[string]uint64)
	for line := range strings.SplitSeq(cpuStat, "\n") {
		parts := strings.Fields(line)
		if len(parts) != 2 {
			continue
		}
		switch parts[0] {
		case "nr_periods", "nr_throttled", "throttled_usec":
			values[parts[0]], err = strconv.ParseUint(parts[1], 10, 64)
			if err != nil {
				return stats, err
			}
		}
	}

	periods, periodsOK := values["nr_periods"]
	throttled, throttledOK := values["nr_throttled"]
	throttledUsec, secondsOK := values["throttled_usec"]
	if !periodsOK || !throttledOK || !secondsOK {
		return stats, errors.New("cpu.stat is missing throttling counters")
	}
	stats.ContainerCPUPeriods = &periods
	stats.ContainerCPUThrottledPeriods = &throttled
	throttledSeconds := float64(throttledUsec) / 1_000_000
	stats.ContainerCPUThrottledSeconds = &throttledSeconds

	return stats, nil
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

	if !info.memoryStatsSupported {
		return diagnostics, nil
	}

	// Memory limit: "max" means unlimited, otherwise bytes.
	memoryMaxPath := filepath.Join(info.dir, "memory.max")
	memoryMax, err := readTrimmed(memoryMaxPath)
	if err != nil {
		return diagnostics, err
	}
	if memoryMax != "max" {
		memoryMaxBytes, parseErr := strconv.ParseUint(memoryMax, 10, 64)
		if parseErr != nil {
			return diagnostics, fmt.Errorf("parse %s: %w", memoryMaxPath, parseErr)
		}
		diagnostics.ContainerMemoryLimitMB = (memoryMaxBytes + 1024*1024 - 1) / (1024 * 1024)
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
