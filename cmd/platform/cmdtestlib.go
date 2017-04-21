// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package main

import (
	"bytes"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

func runCommand(argString string) error {
	err, _ := runCommandWithOutput(argString)

	return err
}

func runCommandWithOutput(argString string) (error, string) {
	// Set arguments on the root command
	rootCmd.SetArgs(strings.Split(argString, " "))
	defer rootCmd.SetArgs([]string{})

	output := new(bytes.Buffer)
	rootCmd.SetOutput(output)
	defer rootCmd.SetOutput(nil)

	// Executing the root command will call the necessary subcommand
	cmd, err := rootCmd.ExecuteC()

	// And clear the arguments on the subcommand that was actually called since they'd otherwise
	// be used on the next call to this command
	clearArgs(cmd)

	return err, output.String()
}

func clearArgs(command *cobra.Command) {
	command.Flags().VisitAll(clearFlag)
}

func clearFlag(flag *pflag.Flag) {
	flag.Value.Set(flag.DefValue)
}
