// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer/human"
)

var LogsCmd = &cobra.Command{
	Use:   "logs",
	Short: "Display logs in a human-readable format",
	Long:  "Display logs in a human-readable format. As the logs format depends on the server, the \"--format\" flag cannot be used with this command.",
	RunE:  withClient(logsCmdF),
}

func init() {
	LogsCmd.Flags().IntP("number", "n", 200, "Number of log lines to retrieve.")
	LogsCmd.Flags().BoolP("logrus", "l", false, "Use logrus for formatting.")
	RootCmd.AddCommand(LogsCmd)
}

func logsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if cmd.Flags().Changed("format") || cmd.Flags().Changed("json") {
		return fmt.Errorf("the %q and %q flags cannot be used with this command", "--format", "--json")
	} else if viper.GetString("format") == printer.FormatJSON {
		return fmt.Errorf("json formatting cannot be applied on this command. Please check the value of %q", "MMCTL_FORMAT")
	}

	number, _ := cmd.Flags().GetInt("number")
	logLines, _, err := c.GetLogs(context.TODO(), 0, number)
	if err != nil {
		return errors.New("Unable to retrieve logs. Error: " + err.Error())
	}

	reader := bytes.NewReader([]byte(strings.Join(logLines, "")))

	var writer human.LogWriter
	if logrus, _ := cmd.Flags().GetBool("logrus"); logrus {
		writer = human.NewLogrusWriter(os.Stdout)
	} else {
		writer = human.NewSimpleWriter(os.Stdout)
	}
	human.ProcessLogs(reader, writer)

	return nil
}
