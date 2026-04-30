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

	originalPaths := cgroupPaths
	t.Cleanup(func() { cgroupPaths = originalPaths })

	t.Run("limited CPU and memory", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_limited", "536870912\n")  // 512 MB
		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_limited", "200000 100000\n") // 2 CPUs

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(512), limits.MemoryLimitMB)
		assert.InDelta(t, 2.0, limits.CPULimit, 0.001)
	})

	t.Run("unlimited CPU and memory", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_unlimited", "max\n")
		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_unlimited", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})

	t.Run("fractional CPU limit", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_frac", "max\n")
		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_frac", "50000 100000\n") // 0.5 CPUs

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.InDelta(t, 0.5, limits.CPULimit, 0.001)
	})

	t.Run("sub-MB memory rounds up to 1MB", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_tiny", "524288\n") // 0.5 MB
		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_tiny", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(1), limits.MemoryLimitMB)
	})

	t.Run("missing cgroup files returns zero values", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = filepath.Join(dir, "nonexistent_memory")
		cgroupPaths.v2CPUMax = writeTempCgroupFile(t, dir, "cpu_present", "max 100000\n")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})

	t.Run("missing cpu.max returns zero values", func(t *testing.T) {
		cgroupPaths.v2MemoryMax = writeTempCgroupFile(t, dir, "mem_no_cpu", "max\n")
		cgroupPaths.v2CPUMax = filepath.Join(dir, "nonexistent_cpu")

		limits, err := getContainerLimits()
		require.NoError(t, err)
		assert.Equal(t, uint64(0), limits.MemoryLimitMB)
		assert.Equal(t, float64(0), limits.CPULimit)
	})
}
