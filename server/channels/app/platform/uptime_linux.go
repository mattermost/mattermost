// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// getHostUptimeSeconds reads /proc/uptime and returns the number of seconds
// the host OS has been running.
func getHostUptimeSeconds() (int64, error) {
	return parseUptimeFile("/proc/uptime")
}

// parseUptimeFile reads an uptime file in the /proc/uptime format and returns
// the number of seconds as an int64.  It is a separate function to allow unit
// tests to supply a synthetic file path.
func parseUptimeFile(path string) (int64, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return 0, fmt.Errorf("failed to read /proc/uptime: %w", err)
	}

	fields := strings.Fields(string(data))
	if len(fields) == 0 {
		return 0, fmt.Errorf("unexpected /proc/uptime format")
	}

	f, err := strconv.ParseFloat(fields[0], 64)
	if err != nil {
		return 0, fmt.Errorf("failed to parse /proc/uptime value: %w", err)
	}

	return int64(f), nil
}
