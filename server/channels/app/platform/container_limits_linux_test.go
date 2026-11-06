// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeTempCgroupFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
	return path
}

func setTempCgroupLayout(t *testing.T, dir, membership, mountRoot, mountPoint string) cgroupV2Info {
	t.Helper()
	resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup", "0::"+membership+"\n")
	resourcePaths.procSelfMountInfo = writeTempCgroupFile(t, dir, "proc-self-mountinfo", "31 30 0:28 "+mountRoot+" "+mountPoint+" rw,nosuid,nodev,noexec,relatime - cgroup2 cgroup rw\n")
	relative, err := filepath.Rel(mountRoot, membership)
	require.NoError(t, err)
	writeTempCgroupFile(t, filepath.Join(mountPoint, relative), "memory.max", "max\n")

	info, err := getCgroupV2Info()
	require.NoError(t, err)
	require.True(t, info.memoryStatsSupported)
	return info
}

func TestGetContainerLimits(t *testing.T) {
	dir := t.TempDir()
	info := cgroupV2Info{dir: dir, memoryStatsSupported: true}

	t.Run("limited CPU and memory", func(t *testing.T) {
		writeTempCgroupFile(t, dir, "memory.max", "536870912\n")
		writeTempCgroupFile(t, dir, "cpu.max", "200000 100000\n")

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.Equal(t, uint64(512), limits.MemoryLimitMB)
		assert.InDelta(t, 2.0, limits.CPULimit, 0.001)
	})

	t.Run("unlimited CPU and memory", func(t *testing.T) {
		writeTempCgroupFile(t, dir, "memory.max", "max\n")
		writeTempCgroupFile(t, dir, "cpu.max", "max 100000\n")

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})

	t.Run("fractional CPU limit", func(t *testing.T) {
		writeTempCgroupFile(t, dir, "memory.max", "max\n")
		writeTempCgroupFile(t, dir, "cpu.max", "50000 100000\n")

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.InDelta(t, 0.5, limits.CPULimit, 0.001)
	})

	t.Run("sub-MB memory rounds up to 1MB", func(t *testing.T) {
		writeTempCgroupFile(t, dir, "memory.max", "524288\n")
		writeTempCgroupFile(t, dir, "cpu.max", "max 100000\n")

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.Equal(t, uint64(1), limits.MemoryLimitMB)
	})

	t.Run("missing memory stats fails", func(t *testing.T) {
		missingInfo := cgroupV2Info{dir: filepath.Join(dir, "missing"), memoryStatsSupported: true}
		_, err := getContainerLimits(missingInfo)
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("unsupported cgroup returns zero values", func(t *testing.T) {
		limits, err := getContainerLimits(cgroupV2Info{})

		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})
}

func TestGetCgroupV2Info(t *testing.T) {
	dir := t.TempDir()
	originalPaths := resourcePaths
	t.Cleanup(func() { resourcePaths = originalPaths })

	t.Run("root membership in a private namespace", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "private")
		info := setTempCgroupLayout(t, dir, "/", "/", mountPoint)
		assert.Equal(t, mountPoint, info.dir)
	})

	t.Run("namespace-relative mount root maps to private root", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "namespace-relative")
		info := setTempCgroupLayout(t, dir, "/", "/../..", mountPoint)
		assert.Equal(t, mountPoint, info.dir)
	})

	t.Run("membership preserves trailing spaces", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "trailing-space")
		info := setTempCgroupLayout(t, dir, "/mattermost ", "/", mountPoint)
		assert.Equal(t, filepath.Join(mountPoint, "mattermost "), info.dir)
	})

	t.Run("mountinfo escaped paths are decoded", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "escaped mount")
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup-escaped", "0::/\n")
		encodedMountPoint := strings.ReplaceAll(mountPoint, " ", `\040`)
		resourcePaths.procSelfMountInfo = writeTempCgroupFile(t, dir, "proc-self-mountinfo-escaped", "31 30 0:28 / "+encodedMountPoint+" rw - cgroup2 cgroup rw\n")
		writeTempCgroupFile(t, mountPoint, "memory.max", "max\n")

		info, err := getCgroupV2Info()
		require.NoError(t, err)
		assert.Equal(t, mountPoint, info.dir)
		assert.True(t, info.memoryStatsSupported)
	})

	t.Run("nested systemd membership uses leaf files", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "host")
		info := setTempCgroupLayout(t, dir, "/system.slice/mattermost.service", "/", mountPoint)
		assert.Equal(t, filepath.Join(mountPoint, "system.slice/mattermost.service"), info.dir)

		writeTempCgroupFile(t, mountPoint, "memory.max", "104857600\n")
		writeTempCgroupFile(t, mountPoint, "cpu.max", "100000 100000\n")
		writeTempCgroupFile(t, mountPoint, "memory.current", "94371840\n")
		writeTempCgroupFile(t, mountPoint, "memory.stat", "inactive_file 10485760\n")
		writeTempCgroupFile(t, mountPoint, "memory.events", "oom_kill 99\n")

		writeTempCgroupFile(t, info.dir, "memory.max", "1073741824\n")
		writeTempCgroupFile(t, info.dir, "cpu.max", "200000 100000\n")
		writeTempCgroupFile(t, info.dir, "memory.current", "536870912\n")
		writeTempCgroupFile(t, info.dir, "memory.stat", "inactive_file 134217728\n")
		writeTempCgroupFile(t, info.dir, "memory.events", "oom_kill 2\n")
		resourcePaths.procMeminfo = writeTempCgroupFile(t, dir, "proc-meminfo", "MemAvailable: 1024000 kB\nSwapTotal: 4096 kB\nSwapFree: 1024 kB\n")
		resourcePaths.procSelfStatus = writeTempCgroupFile(t, dir, "proc-status", "VmRSS: 131072 kB\n")

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.Equal(t, uint64(1024), limits.MemoryLimitMB)
		assert.Equal(t, 2.0, limits.CPULimit)

		diagnostics, err := getMemoryDiagnostics(info)
		require.NoError(t, err)
		assert.Equal(t, new(uint64(512)), diagnostics.ContainerMemoryUsageMB)
		assert.Equal(t, new(uint64(384)), diagnostics.ContainerMemoryWorkingSetMB)
		assert.Equal(t, new(uint64(2)), diagnostics.ContainerOOMKills)
	})

	t.Run("non-root mount root maps membership relative to the mount", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "system-slice-view")
		info := setTempCgroupLayout(t, dir, "/system.slice/mattermost.service", "/system.slice", mountPoint)
		assert.Equal(t, filepath.Join(mountPoint, "mattermost.service"), info.dir)
	})

	t.Run("cgroup v1 is unsupported without reading mountinfo", func(t *testing.T) {
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup-v1", "12:memory:/mattermost\n11:cpu:/mattermost\n")
		resourcePaths.procSelfMountInfo = filepath.Join(dir, "missing-mountinfo")

		info, err := getCgroupV2Info()
		require.NoError(t, err)
		assert.False(t, info.memoryStatsSupported)
		assert.Empty(t, info.dir)
	})

	t.Run("cgroup v2 without the memory controller is unsupported", func(t *testing.T) {
		mountPoint := filepath.Join(dir, "no-memory-controller")
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup-no-memory", "0::/\n")
		resourcePaths.procSelfMountInfo = writeTempCgroupFile(t, dir, "proc-self-mountinfo-no-memory", "31 30 0:28 / "+mountPoint+" rw - cgroup2 cgroup rw\n")
		writeTempCgroupFile(t, mountPoint, "cpu.max", "50000 100000\n")

		info, err := getCgroupV2Info()
		require.NoError(t, err)
		assert.False(t, info.memoryStatsSupported)
		assert.Equal(t, mountPoint, info.dir)

		limits, err := getContainerLimits(info)
		require.NoError(t, err)
		assert.Equal(t, 0.5, limits.CPULimit)
		assert.Zero(t, limits.MemoryLimitMB)
	})

	t.Run("v2 membership without a matching mount fails", func(t *testing.T) {
		resourcePaths.procSelfCgroup = writeTempCgroupFile(t, dir, "proc-self-cgroup-unmounted", "0::/mattermost\n")
		resourcePaths.procSelfMountInfo = writeTempCgroupFile(t, dir, "proc-self-mountinfo-unmatched", "31 30 0:28 / /other rw - ext4 /dev/sda rw\n")

		_, err := getCgroupV2Info()
		require.ErrorContains(t, err, "no matching cgroup2 mount")
	})
}

func TestGetMemoryDiagnostics(t *testing.T) {
	dir := t.TempDir()

	originalPaths := resourcePaths
	t.Cleanup(func() { resourcePaths = originalPaths })
	info := cgroupV2Info{dir: dir, memoryStatsSupported: true}

	setProcFiles := func(t *testing.T) {
		t.Helper()
		resourcePaths.procMeminfo = writeTempCgroupFile(t, dir, "proc-meminfo", "MemTotal:       8192000 kB\nMemAvailable:   1024000 kB\nSwapTotal:         4096 kB\nSwapFree:          1024 kB\n")
		resourcePaths.procSelfStatus = writeTempCgroupFile(t, dir, "proc-status", "Name:\tmattermost\nVmRSS:\t131072 kB\n")
	}

	t.Run("host and cgroup v2 memory", func(t *testing.T) {
		setProcFiles(t)
		writeTempCgroupFile(t, dir, "memory.max", "1073741824\n")
		writeTempCgroupFile(t, dir, "memory.current", "536870912\n")
		writeTempCgroupFile(t, dir, "memory.stat", "anon 268435456\ninactive_file 134217728\n")
		writeTempCgroupFile(t, dir, "memory.events", "low 0\nhigh 0\nmax 1\noom 3\noom_kill 2\n")

		got, err := getMemoryDiagnostics(info)
		require.NoError(t, err)
		assert.Equal(t, new(uint64(1000)), got.AvailableMemoryMB)
		assert.Equal(t, new(uint64(4)), got.SwapTotalMB)
		assert.Equal(t, new(uint64(3)), got.SwapUsedMB)
		assert.Equal(t, new(uint64(128)), got.ProcessRSSMB)
		assert.Equal(t, new(uint64(512)), got.ContainerMemoryUsageMB)
		assert.Equal(t, new(uint64(384)), got.ContainerMemoryWorkingSetMB)
		assert.Equal(t, new(uint64(2)), got.ContainerOOMKills)
	})

	t.Run("unsupported cgroup omits container stats", func(t *testing.T) {
		setProcFiles(t)
		got, err := getMemoryDiagnostics(cgroupV2Info{})
		require.NoError(t, err)
		assert.Equal(t, new(uint64(1000)), got.AvailableMemoryMB)
		assert.Equal(t, new(uint64(128)), got.ProcessRSSMB)
		assert.Nil(t, got.ContainerMemoryUsageMB)
		assert.Nil(t, got.ContainerMemoryWorkingSetMB)
		assert.Nil(t, got.ContainerOOMKills)
	})

	t.Run("missing proc field", func(t *testing.T) {
		resourcePaths.procMeminfo = writeTempCgroupFile(t, dir, "meminfo_missing", "MemTotal: 8192000 kB\n")
		resourcePaths.procSelfStatus = writeTempCgroupFile(t, dir, "status_unused", "VmRSS: 131072 kB\n")

		_, err := getMemoryDiagnostics(info)
		require.ErrorContains(t, err, "MemAvailable not found")
	})

	t.Run("cgroup v2 partial read fails", func(t *testing.T) {
		setProcFiles(t)
		testCases := []struct {
			name    string
			current string
			stat    string
			events  string
			wantErr string
		}{
			{name: "missing current", stat: "inactive_file 0\n", events: "oom_kill 0\n", wantErr: "memory.current"},
			{name: "missing inactive file", current: "1\n", stat: "anon 1\n", events: "oom_kill 0\n", wantErr: "inactive_file"},
			{name: "missing OOM kill", current: "1\n", stat: "inactive_file 0\n", events: "oom 1\n", wantErr: "oom_kill"},
		}
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				partialDir := filepath.Join(dir, "partial", strings.ReplaceAll(tc.name, " ", "-"))
				writeTempCgroupFile(t, partialDir, "memory.max", "1073741824\n")
				if tc.current != "" {
					writeTempCgroupFile(t, partialDir, "memory.current", tc.current)
				}
				writeTempCgroupFile(t, partialDir, "memory.stat", tc.stat)
				writeTempCgroupFile(t, partialDir, "memory.events", tc.events)

				_, err := getMemoryDiagnostics(cgroupV2Info{dir: partialDir, memoryStatsSupported: true})
				require.ErrorContains(t, err, tc.wantErr)
			})
		}
	})

	t.Run("malformed cgroup memory limit fails", func(t *testing.T) {
		setProcFiles(t)
		writeTempCgroupFile(t, dir, "memory.max", "unlimited\n")

		_, err := getMemoryDiagnostics(info)
		require.ErrorContains(t, err, "memory.max")
	})
}
