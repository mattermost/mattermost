// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"syscall"
)

func findMattermostBinary() string {
	for _, file := range []string{"./mattermost", "../mattermost", "./bin/mattermost"} {
		path, _ := filepath.Abs(file)
		if stat, err := os.Stat(path); err == nil && !stat.IsDir() {
			return path
		}
	}
	return "./mattermost"
}

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
	if err := syscall.Exec(findMattermostBinary(), args, nil); err != nil {
		fmt.Println("Could not start Mattermost, use the mattermost command directly.")
	}
}
