// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build !linux

package commands

import "fmt"

func probeDirWritableAs(dir string, uid, gid int) error {
	return fmt.Errorf("probing %s as uid %d is supported only on linux", dir, uid)
}

func fileOwner(path string) string {
	return "unknown"
}
