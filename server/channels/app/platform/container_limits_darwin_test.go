// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"encoding/binary"
	"math"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// rawLoadAvg lays out struct loadavg as the C ABI does: ldavg at offsets 0, 4, 8 and fscale at 16.
func rawLoadAvg(ldavg [3]uint32, fscale int64) []byte {
	raw := make([]byte, 24)
	for i, load := range ldavg {
		binary.NativeEndian.PutUint32(raw[i*4:], load)
	}
	binary.NativeEndian.PutUint64(raw[16:], uint64(fscale))
	return raw
}

// rawSwapUsage lays out struct xsw_usage as the C ABI does: total, avail and used at offsets 0, 8 and 16.
func rawSwapUsage(total, avail, used uint64) []byte {
	raw := make([]byte, 32)
	binary.NativeEndian.PutUint64(raw[0:], total)
	binary.NativeEndian.PutUint64(raw[8:], avail)
	binary.NativeEndian.PutUint64(raw[16:], used)
	binary.NativeEndian.PutUint32(raw[24:], 16384)
	return raw
}

func sysctlOutput(t *testing.T, names ...string) string {
	t.Helper()
	out, err := exec.Command("sysctl", append([]string{"-n"}, names...)...).Output()
	require.NoError(t, err)
	return strings.TrimSpace(string(out))
}

// sysctlLoadAvg parses output like "{ 1.23 1.45 1.67 }".
func sysctlLoadAvg(t *testing.T) [3]float64 {
	t.Helper()
	fields := strings.Fields(strings.Trim(sysctlOutput(t, "vm.loadavg"), "{} "))
	require.Len(t, fields, 3)
	var loads [3]float64
	for i, field := range fields {
		var err error
		loads[i], err = strconv.ParseFloat(field, 64)
		require.NoError(t, err)
	}
	return loads
}

var swapUsagePattern = regexp.MustCompile(`total = ([\d.]+)M\s+used = ([\d.]+)M`)

// sysctlSwapUsageMB parses output like "total = 2048.00M  used = 1024.50M  free = 1023.50M  (encrypted)".
func sysctlSwapUsageMB(t *testing.T) (total, used float64) {
	t.Helper()
	matches := swapUsagePattern.FindStringSubmatch(sysctlOutput(t, "vm.swapusage"))
	require.Len(t, matches, 3)
	total, err := strconv.ParseFloat(matches[1], 64)
	require.NoError(t, err)
	used, err = strconv.ParseFloat(matches[2], 64)
	require.NoError(t, err)
	return total, used
}

func sysctlAvailableMemoryMB(t *testing.T) float64 {
	t.Helper()
	values := strings.Fields(sysctlOutput(t, append([]string{"vm.pagesize"}, availablePageSysctls...)...))
	require.Len(t, values, 1+len(availablePageSysctls))
	pageSize, err := strconv.ParseUint(values[0], 10, 64)
	require.NoError(t, err)
	var pages uint64
	for _, value := range values[1:] {
		count, err := strconv.ParseUint(value, 10, 64)
		require.NoError(t, err)
		pages += count
	}
	return float64(pages*pageSize) / (1024 * 1024)
}

// assertBetweenReads checks got against values read before and after it, since live values can change in between.
func assertBetweenReads(t *testing.T, before, after, got, tolerance float64, name string) {
	t.Helper()
	assert.GreaterOrEqual(t, got, min(before, after)-tolerance, name)
	assert.LessOrEqual(t, got, max(before, after)+tolerance, name)
}

func TestDecodeLoadAvg(t *testing.T) {
	t.Run("divides each load by fscale", func(t *testing.T) {
		loads, err := decodeLoadAvg(rawLoadAvg([3]uint32{4096, 1024, 512}, 2048))
		require.NoError(t, err)
		assert.Equal(t, [3]float64{2, 0.5, 0.25}, loads)
	})

	t.Run("rejects zero fscale", func(t *testing.T) {
		_, err := decodeLoadAvg(rawLoadAvg([3]uint32{1, 2, 3}, 0))
		require.Error(t, err)
	})

	t.Run("rejects truncated input", func(t *testing.T) {
		_, err := decodeLoadAvg(rawLoadAvg([3]uint32{1, 2, 3}, 2048)[:16])
		require.Error(t, err)
	})
}

func TestDecodeSwapUsage(t *testing.T) {
	t.Run("decodes total and used", func(t *testing.T) {
		usage, err := decodeSwapUsage(rawSwapUsage(3<<30, 2<<30, 1<<30))
		require.NoError(t, err)
		assert.Equal(t, uint64(3<<30), usage.Total)
		assert.Equal(t, uint64(2<<30), usage.Avail)
		assert.Equal(t, uint64(1<<30), usage.Used)
	})

	t.Run("rejects used greater than total", func(t *testing.T) {
		_, err := decodeSwapUsage(rawSwapUsage(1, 0, 2))
		require.Error(t, err)
	})

	t.Run("rejects truncated input", func(t *testing.T) {
		_, err := decodeSwapUsage(rawSwapUsage(3, 2, 1)[:20])
		require.Error(t, err)
	})
}

func TestGetCPUStats(t *testing.T) {
	before := sysctlLoadAvg(t)
	stats, err := getCPUStats(cgroupV2Info{})
	after := sysctlLoadAvg(t)
	require.NoError(t, err)
	require.NotNil(t, stats.LoadAverage1m)
	require.NotNil(t, stats.LoadAverage5m)
	require.NotNil(t, stats.LoadAverage15m)
	assert.Nil(t, stats.ContainerCPUPeriods)
	assert.Nil(t, stats.ContainerCPUThrottledPeriods)
	assert.Nil(t, stats.ContainerCPUThrottledSeconds)

	// sysctl prints two decimals.
	for i, got := range []float64{*stats.LoadAverage1m, *stats.LoadAverage5m, *stats.LoadAverage15m} {
		assertBetweenReads(t, before[i], after[i], got, 0.01, "load average "+strconv.Itoa(i))
	}
}

func TestGetMemoryDiagnostics(t *testing.T) {
	const attempts = 5

	var diagnostics memoryDiagnostics
	comparedToSysctl := false
	// Swap can change during the call, so only compare with sysctl when it held steady around the call.
	for range attempts {
		totalBefore, usedBefore := sysctlSwapUsageMB(t)
		var err error
		diagnostics, err = getMemoryDiagnostics(cgroupV2Info{})
		totalAfter, usedAfter := sysctlSwapUsageMB(t)
		require.NoError(t, err)
		require.NotNil(t, diagnostics.SwapTotalMB)
		require.NotNil(t, diagnostics.SwapUsedMB)
		require.NotNil(t, diagnostics.AvailableMemoryMB)

		if totalBefore != totalAfter || usedBefore != usedAfter {
			continue
		}
		comparedToSysctl = true
		// Our values are truncated to whole MB.
		assert.InDelta(t, totalBefore, float64(*diagnostics.SwapTotalMB), 1, "swap total")
		assert.InDelta(t, usedBefore, float64(*diagnostics.SwapUsedMB), 1, "swap used")
		break
	}
	if !comparedToSysctl {
		t.Logf("swap changed during all %d attempts; skipped comparison with sysctl vm.swapusage", attempts)
	}
	assert.Nil(t, diagnostics.ProcessRSSMB)
	assert.Zero(t, diagnostics.ContainerMemoryLimitMB)
	assert.LessOrEqual(t, *diagnostics.SwapUsedMB, *diagnostics.SwapTotalMB)

	totalMemory, err := getTotalMemory()
	require.NoError(t, err)
	totalMemoryMB := totalMemory / (1024 * 1024)
	assert.LessOrEqual(t, *diagnostics.AvailableMemoryMB, totalMemoryMB)

	// The free page count changes constantly and other processes can allocate between the reads,
	// so allow 5% of total memory and retry, failing only if no attempt matches.
	tolerance := float64(totalMemoryMB) / 20
	var got, want float64
	for range attempts {
		diagnostics, err = getMemoryDiagnostics(cgroupV2Info{})
		require.NoError(t, err)
		got, want = float64(*diagnostics.AvailableMemoryMB), sysctlAvailableMemoryMB(t)
		if math.Abs(got-want) <= tolerance {
			break
		}
	}
	assert.InDelta(t, want, got, tolerance, "available memory did not match sysctl in %d attempts", attempts)
}
