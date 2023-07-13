// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package commands

import (
	"github.com/spf13/cobra"
)

var Version = "v0.1-monorepo"

type Command = cobra.Command

func Run(args []string) error {
	RootCmd.SetArgs(args)
	return RootCmd.Execute()
}

var RootCmd = &cobra.Command{
	Use:     "mmgotool",
	Short:   "Mattermost dev utils cli",
	Long:    `Mattermost cli to help in the development process`,
	Version: Version,
}
