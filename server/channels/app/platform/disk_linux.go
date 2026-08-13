// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package platform

import (
	"errors"
	"syscall"
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
		var stat syscall.Statfs_t
		if err := syscall.Statfs(path, &stat); err != nil {
			ch <- result{err: err}
			return
		}
		bsize := uint64(stat.Bsize)
		ch <- result{info: diskInfo{
			TotalMB:        stat.Blocks * bsize / (1024 * 1024),
			AvailableMB:    stat.Bavail * bsize / (1024 * 1024),
			FilesystemType: fsTypeToString(stat.Type),
		}}
	}()

	select {
	case r := <-ch:
		return r.info, r.err
	case <-time.After(5 * time.Second):
		return diskInfo{}, errDiskInfoTimeout
	}
}

func fsTypeToString(fsType int64) string {
	switch fsType {
	case unix.EXT4_SUPER_MAGIC:
		return "ext4"
	case unix.XFS_SUPER_MAGIC:
		return "xfs"
	case unix.NFS_SUPER_MAGIC:
		return "nfs"
	case unix.BTRFS_SUPER_MAGIC:
		return "btrfs"
	case unix.TMPFS_MAGIC:
		return "tmpfs"
	case unix.SMB_SUPER_MAGIC:
		return "smb"
	case unix.FUSE_SUPER_MAGIC:
		return "fuse"
	case unix.OVERLAYFS_SUPER_MAGIC:
		return "overlay"
	default:
		return "unknown"
	}
}
