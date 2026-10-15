// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"os"
	"syscall"
)

// getOpenFileDescriptors returns the number of open file descriptors for the current process.
func getOpenFileDescriptors() (int64, error) {
	dir, err := os.Open("/dev/fd")
	if err != nil {
		return -1, err
	}
	defer dir.Close()

	// Only read the names: some descriptors, such as the Go runtime's kqueue, cannot be stat'ed
	// through /dev/fd, and os.ReadDir fails on them.
	names, err := dir.Readdirnames(-1)
	if err != nil {
		return -1, err
	}
	// Subtract 1 because the directory itself is an open file descriptor that appears in the listing.
	return max(int64(len(names))-1, 0), nil
}

// getMaxFileDescriptors returns the soft file descriptor limit for the current process.
func getMaxFileDescriptors() (int64, error) {
	var rlimit syscall.Rlimit
	if err := syscall.Getrlimit(syscall.RLIMIT_NOFILE, &rlimit); err != nil {
		return -1, err
	}
	return int64(rlimit.Cur), nil
}
