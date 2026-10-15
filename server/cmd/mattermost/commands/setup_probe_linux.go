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

	groups, err := serviceGroups(uid, gid)
	if err != nil {
		return err
	}
	prevGroups, err := unix.Getgroups()
	if err != nil {
		return fmt.Errorf("cannot read groups: %w", err)
	}
	if err := unix.Setgroups(groups); err != nil {
		return fmt.Errorf("cannot set groups for uid %d: %w", uid, err)
	}
	defer unix.Setgroups(prevGroups)

	restoreCaps, err := dropDACCapabilities()
	if err != nil {
		return err
	}
	defer restoreCaps()

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

func serviceGroups(uid, gid int) ([]int, error) {
	ids := []int{gid}
	seen := map[int]bool{gid: true}
	account, err := user.LookupId(strconv.Itoa(uid))
	if err != nil {
		return ids, nil
	}
	extra, err := account.GroupIds()
	if err != nil {
		return ids, nil
	}
	for _, raw := range extra {
		n, convErr := strconv.Atoi(raw)
		if convErr != nil || seen[n] {
			continue
		}
		seen[n] = true
		ids = append(ids, n)
	}
	return ids, nil
}

func dropDACCapabilities() (func(), error) {
	hdr := unix.CapUserHeader{Version: unix.LINUX_CAPABILITY_VERSION_3}
	var data [2]unix.CapUserData
	if err := unix.Capget(&hdr, &data[0]); err != nil {
		return nil, fmt.Errorf("cannot read capabilities: %w", err)
	}
	saved := data
	for _, cap := range []int{unix.CAP_DAC_OVERRIDE, unix.CAP_DAC_READ_SEARCH, unix.CAP_FOWNER} {
		word := cap / 32
		bit := uint32(1) << (uint(cap) % 32)
		data[word].Effective &^= bit
		data[word].Permitted &^= bit
		data[word].Inheritable &^= bit
	}
	if err := unix.Capset(&hdr, &data[0]); err != nil {
		return nil, fmt.Errorf("cannot drop directory-override capabilities: %w", err)
	}
	return func() {
		restore := unix.CapUserHeader{Version: unix.LINUX_CAPABILITY_VERSION_3}
		_ = unix.Capset(&restore, &saved[0])
	}, nil
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
