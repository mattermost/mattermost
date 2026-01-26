// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"syscall"
)

// getTotalMemory returns the total system memory in bytes.
func getTotalMemory() (uint64, error) {
	var info syscall.Sysinfo_t
	err := syscall.Sysinfo(&info)
	if err != nil {
		return 0, err
	}
	// Sysinfo returns memory in units of info.Unit bytes
	return info.Totalram * uint64(info.Unit), nil
}
