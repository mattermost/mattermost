// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

var SystemCmd = &cobra.Command{
	Use:   "system",
	Short: "System management",
	Long:  `System management commands for interacting with the server state and configuration.`,
}

var SystemGetBusyCmd = &cobra.Command{
	Use:     "getbusy",
	Short:   "Get the current busy state",
	Long:    `Gets the server busy state (high load) and timestamp corresponding to when the server busy flag will be automatically cleared.`,
	Example: `  system getbusy`,
	Args:    cobra.NoArgs,
	RunE:    withClient(getBusyCmdF),
}

var SystemSetBusyCmd = &cobra.Command{
	Use:     "setbusy -s [seconds]",
	Short:   "Set the busy state to true",
	Long:    `Set the busy state to true for the specified number of seconds, which disables non-critical services.`,
	Example: `  system setbusy -s 3600`,
	Args:    cobra.NoArgs,
	RunE:    withClient(setBusyCmdF),
}

var SystemClearBusyCmd = &cobra.Command{
	Use:     "clearbusy",
	Short:   "Clears the busy state",
	Long:    `Clear the busy state, which re-enables non-critical services.`,
	Example: `  system clearbusy`,
	Args:    cobra.NoArgs,
	RunE:    withClient(clearBusyCmdF),
}

var SystemVersionCmd = &cobra.Command{
	Use:     "version",
	Short:   "Prints the remote server version",
	Long:    "Prints the server version of the currently connected Mattermost instance",
	Example: `  system version`,
	Args:    cobra.NoArgs,
	RunE:    withClient(systemVersionCmdF),
}

var SystemStatusCmd = &cobra.Command{
	Use:     "status",
	Short:   "Prints the status of the server",
	Long:    "Prints the server status calculated using several basic server healthchecks",
	Example: `  system status`,
	Args:    cobra.NoArgs,
	RunE:    withClient(systemStatusCmdF),
}

func init() {
	SystemSetBusyCmd.Flags().UintP("seconds", "s", 3600, "Number of seconds until server is automatically marked as not busy.")
	_ = SystemSetBusyCmd.MarkFlagRequired("seconds")
	SystemCmd.AddCommand(
		SystemGetBusyCmd,
		SystemSetBusyCmd,
		SystemClearBusyCmd,
		SystemVersionCmd,
		SystemStatusCmd,
	)
	RootCmd.AddCommand(SystemCmd)
}

func getBusyCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	sbs, _, err := c.GetServerBusy(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to get busy state: %w", err)
	}
	printer.PrintT("busy:{{.Busy}} expires:{{.Expires_ts}}", sbs)
	return nil
}

func setBusyCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	seconds, err := cmd.Flags().GetUint("seconds")
	if err != nil || seconds == 0 {
		return errors.New("seconds must be a number > 0")
	}

	_, err = c.SetServerBusy(context.TODO(), int(seconds))
	if err != nil {
		return fmt.Errorf("unable to set busy state: %w", err)
	}

	printer.PrintT("Busy state set", map[string]string{"status": "ok"})
	return nil
}

func clearBusyCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	_, err := c.ClearServerBusy(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to clear busy state: %w", err)
	}
	printer.PrintT("Busy state cleared", map[string]string{"status": "ok"})
	return nil
}

func systemVersionCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)
	// server version information comes with all responses. We can't
	// use the initial "withClient" connection information as local
	// mode doesn't need to log in, so we use an endpoint that will
	// always return a valid response
	_, resp, err := c.GetPing(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to fetch server version: %w", err)
	}

	printer.PrintT("Server version {{.version}}", map[string]string{"version": resp.ServerVersion})
	return nil
}

func systemStatusCmdF(c client.Client, cmd *cobra.Command, _ []string) error {
	printer.SetSingle(true)

	status, _, err := c.GetPingWithFullServerStatus(context.TODO())
	if err != nil {
		return fmt.Errorf("unable to fetch server status: %w", err)
	}

	printer.PrintT(`Server status: {{.status}}
Android Latest Version: {{.AndroidLatestVersion}}
Android Minimum Version: {{.AndroidMinVersion}}
Desktop Latest Version: {{.DesktopLatestVersion}}
Desktop Minimum Version: {{.DesktopMinVersion}}
Ios Latest Version: {{.IosLatestVersion}}
Ios Minimum Version: {{.IosMinVersion}}
Database Status: {{.database_status}}
Filestore Status: {{.filestore_status}}`, status)

	return nil
}
