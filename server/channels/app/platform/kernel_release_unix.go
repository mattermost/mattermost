// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux || darwin

package platform

import "golang.org/x/sys/unix"

func getKernelRelease() (*string, error) {
	var uname unix.Utsname
	if err := unix.Uname(&uname); err != nil {
		return nil, err
	}
	return new(unix.ByteSliceToString(uname.Release[:])), nil
}
