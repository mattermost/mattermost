// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"fmt"
	"time"

	"golang.org/x/sys/unix"
)

// getHostUptimeSeconds uses kern.boottime sysctl to return the number of seconds
// the host OS has been running.
func getHostUptimeSeconds() (int64, error) {
	tv, err := unix.SysctlTimeval("kern.boottime")
	if err != nil {
		return 0, fmt.Errorf("failed to get kern.boottime: %w", err)
	}
	bootTime := time.Unix(tv.Sec, int64(tv.Usec)*int64(time.Microsecond))
	return int64(time.Since(bootTime).Seconds()), nil
}
