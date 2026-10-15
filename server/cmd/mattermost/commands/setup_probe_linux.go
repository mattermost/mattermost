// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build linux

package commands

import (
	"fmt"
	"os"
	"os/user"
	"runtime"
	"strconv"
	"syscall"

	"golang.org/x/sys/unix"
)

func probeDirWritableAs(dir string, uid, gid int) error {
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	prevUID, err := unix.SetfsuidRetUid(uid)
	if err != nil {
		return fmt.Errorf("cannot switch filesystem user to %d: %w", uid, err)
	}
	defer unix.SetfsuidRetUid(prevUID)

	current, err := unix.SetfsuidRetUid(uid)
	if err != nil || current != uid {
		return fmt.Errorf("cannot switch filesystem user to %d", uid)
	}

	prevGID, err := unix.SetfsgidRetGid(gid)
	if err != nil {
		return fmt.Errorf("cannot switch filesystem group to %d: %w", gid, err)
	}
	defer unix.SetfsgidRetGid(prevGID)

	return createProbeFile(dir)
}

func fileOwner(path string) string {
	info, err := os.Stat(path)
	if err != nil {
		return "unknown"
	}
	stat, ok := info.Sys().(*syscall.Stat_t)
	if !ok {
		return "unknown"
	}
	if account, err := user.LookupId(strconv.Itoa(int(stat.Uid))); err == nil {
		return account.Username
	}
	return strconv.Itoa(int(stat.Uid))
}
