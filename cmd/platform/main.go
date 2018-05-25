// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"os"
	"syscall"

	"github.com/mattermost/mattermost-server/utils"
)

func main() {
	// Print angry message to use mattermost command directly
	fmt.Println(`
------------------------------------ ERROR ------------------------------------------------
The platform binary has been deprecated, please switch to using the new mattermost binary.
The platform binary will be removed in a future version.
-------------------------------------------------------------------------------------------
	`)

	// Execve the real MM binary
	args := os.Args
	args[0] = "mattermost"
	args = append(args, "--platform")

	realMattermost := utils.FindFile("mattermost")
	if realMattermost == "" {
		// This will still fail, of course.
		realMattermost = "./mattermost"
	}

	if err := syscall.Exec(utils.FindFile("mattermost"), args, nil); err != nil {
		fmt.Println("Could not start Mattermost, use the mattermost command directly.")
	}
}
