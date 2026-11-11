// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"errors"
	"os"

	"golang.org/x/sys/unix"
)

// reserveSpace allocates disk space for the first size bytes of f without changing its size or
// contents, so writing them afterwards can't fail for lack of space. On copy-on-write filesystems
// (btrfs, ZFS) this doesn't cover overwriting existing data, and filesystems that don't support
// it at all are written to unprotected, as before.
func reserveSpace(f *os.File, size int64) error {
	if size == 0 {
		return nil
	}

	// Some filesystems (e.g. tmpfs) abandon the allocation whenever a signal is pending, so
	// retrying on EINTR is bounded and then falls back to writing unprotected.
	for range 3 {
		err := unix.Fallocate(int(f.Fd()), unix.FALLOC_FL_KEEP_SIZE, 0, size)
		if errors.Is(err, unix.EINTR) {
			continue
		}
		if errors.Is(err, unix.EOPNOTSUPP) || errors.Is(err, unix.ENOSYS) {
			return nil
		}
		return err
	}
	return nil
}
