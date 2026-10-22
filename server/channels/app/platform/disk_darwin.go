// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build darwin

package platform

import (
	"errors"
	"time"

	"golang.org/x/sys/unix"
)

type diskInfo struct {
	TotalMB        uint64
	AvailableMB    uint64
	FilesystemType string
}

var errDiskInfoTimeout = errors.New("timed out getting disk space info")

func getDiskInfo(path string) (diskInfo, error) {
	type result struct {
		info diskInfo
		err  error
	}

	ch := make(chan result, 1)
	go func() {
		var stat unix.Statfs_t
		if err := unix.Statfs(path, &stat); err != nil {
			ch <- result{err: err}
			return
		}
		bsize := uint64(stat.Bsize)
		fsType := unix.ByteSliceToString(stat.Fstypename[:])
		ch <- result{info: diskInfo{
			TotalMB:        stat.Blocks * bsize / (1024 * 1024),
			AvailableMB:    stat.Bavail * bsize / (1024 * 1024),
			FilesystemType: fsType,
		}}
	}()

	select {
	case r := <-ch:
		return r.info, r.err
	case <-time.After(5 * time.Second):
		return diskInfo{}, errDiskInfoTimeout
	}
}
