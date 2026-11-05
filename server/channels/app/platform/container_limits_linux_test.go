// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func writeTempCgroupFile(t *testing.T, dir, name, content string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
	return path
}

func TestGetContainerLimits(t *testing.T) {
	dir := t.TempDir()

	originalPaths := resourcePaths
	t.Cleanup(func() { resourcePaths = originalPaths })

	t.Run("limited CPU and memory", func(t *testing.T) {
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_limited", "536870912\n")  // 512 MB
		resourcePaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_limited", "200000 100000\n") // 2 CPUs

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(512), limits.MemoryLimitMB)
		assert.InDelta(t, 2.0, limits.CPULimit, 0.001)
	})

	t.Run("unlimited CPU and memory", func(t *testing.T) {
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_unlimited", "max\n")
		resourcePaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_unlimited", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})

	t.Run("fractional CPU limit", func(t *testing.T) {
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_frac", "max\n")
		resourcePaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_frac", "50000 100000\n") // 0.5 CPUs

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.InDelta(t, 0.5, limits.CPULimit, 0.001)
	})

	t.Run("sub-MB memory rounds up to 1MB", func(t *testing.T) {
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_tiny", "524288\n") // 0.5 MB
		resourcePaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_tiny", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(1), limits.MemoryLimitMB)
	})

	t.Run("missing cgroup files returns zero values", func(t *testing.T) {
		resourcePaths.v2MemoryMax = filepath.Join(dir, "nonexistent_memory")
		resourcePaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_present", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})

	t.Run("missing cpu.max returns zero values", func(t *testing.T) {
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_no_cpu", "max\n")
		resourcePaths.v2CPUMax = filepath.Join(dir, "nonexistent_cpu")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})
}

func TestGetMemoryDiagnostics(t *testing.T) {
	dir := t.TempDir()

	originalPaths := resourcePaths
	t.Cleanup(func() { resourcePaths = originalPaths })

	setProcFiles := func(t *testing.T) {
		t.Helper()
		resourcePaths.procMeminfo = writeTempCgroupFile(t, dir, "meminfo", "MemTotal:       8192000 kB\nMemAvailable:   1024000 kB\nSwapTotal:         4096 kB\nSwapFree:          1024 kB\n")
		resourcePaths.procSelfStatus = writeTempCgroupFile(t, dir, "status", "Name:\tmattermost\nVmRSS:\t131072 kB\n")
	}

	t.Run("host and cgroup v2 memory", func(t *testing.T) {
		setProcFiles(t)
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "memory.max", "1073741824\n")
		resourcePaths.v2MemoryCurrent = writeTempCgroupFile(t, dir, "memory.current", "536870912\n")
		resourcePaths.v2MemoryStat = writeTempCgroupFile(t, dir, "memory.stat", "anon 268435456\ninactive_file 134217728\n")
		resourcePaths.v2MemoryEvents = writeTempCgroupFile(t, dir, "memory.events", "low 0\nhigh 0\nmax 1\noom 3\noom_kill 2\n")

		got, err := getMemoryDiagnostics()
		require.NoError(t, err)
		assert.Equal(t, new(uint64(1000)), got.AvailableMemoryMB)
		assert.Equal(t, new(uint64(4)), got.SwapTotalMB)
		assert.Equal(t, new(uint64(3)), got.SwapUsedMB)
		assert.Equal(t, new(uint64(128)), got.ProcessRSSMB)
		assert.Equal(t, new(uint64(512)), got.ContainerMemoryUsageMB)
		assert.Equal(t, new(uint64(384)), got.ContainerMemoryWorkingSetMB)
		assert.Equal(t, new(uint64(2)), got.ContainerOOMKills)
	})

	t.Run("Linux host without cgroup v2", func(t *testing.T) {
		setProcFiles(t)
		resourcePaths.v2MemoryMax = filepath.Join(dir, "missing-memory.max")

		got, err := getMemoryDiagnostics()
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

		_, err := getMemoryDiagnostics()
		require.ErrorContains(t, err, "MemAvailable not found")
	})

	t.Run("cgroup v2 partial read fails", func(t *testing.T) {
		setProcFiles(t)
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "memory.max_partial", "1073741824\n")
		resourcePaths.v2MemoryCurrent = filepath.Join(dir, "missing-memory.current")

		_, err := getMemoryDiagnostics()
		require.ErrorIs(t, err, os.ErrNotExist)
	})

	t.Run("malformed cgroup memory limit fails", func(t *testing.T) {
		setProcFiles(t)
		resourcePaths.v2MemoryMax = writeTempCgroupFile(t, dir, "memory.max_malformed", "unlimited\n")

		_, err := getMemoryDiagnostics()
		require.ErrorContains(t, err, "memory.max_malformed")
	})
}
