// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"fmt"
	"math"
	"os"
	"syscall"
)

// getOpenFileDescriptors returns the number of open file descriptors for the current process.
func getOpenFileDescriptors() (int64, error) {
	entries, err := os.ReadDir("/proc/self/fd")
	if err != nil {
		return -1, err
	}
	// Subtract 1 because the ReadDir call itself opens a file descriptor that appears in the listing.
	return max(int64(len(entries))-1, 0), nil
}

// getMaxFileDescriptors returns the soft file descriptor limit for the current process.
func getMaxFileDescriptors() (int64, error) {
	var rlimit syscall.Rlimit
	if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rlimit); err != nil {
		return -1, err
	}
	if rlimit.Cur > math.MaxInt64 {
		return -1, fmt.Errorf("rlimit.Cur %d overflows int64", rlimit.Cur)
	}
	return int64(rlimit.Cur), nil
}
