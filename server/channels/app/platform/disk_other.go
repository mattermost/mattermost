// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux && !darwin

package platform

import "errors"

// ErrDiskSpaceUnsupportedPlatform is returned when disk space detection is not supported on the current platform.
var ErrDiskSpaceUnsupportedPlatform = errors.New("disk space detection not supported on this platform")

type diskInfo struct {
	TotalMB        uint64
	AvailableMB    uint64
	FilesystemType string
}

func getDiskInfo(_ string) (diskInfo, error) {
	return diskInfo{}, ErrDiskSpaceUnsupportedPlatform
}
