// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

var ChannelAutoArchiveCmd = &cobra.Command{
	Use:   "auto-archive",
	Short: "Manage channel auto-archive settings",
}

var ChannelAutoArchiveGetCmd = &cobra.Command{
	Use:     "get",
	Short:   "Get the current channel auto-archive configuration",
	Long:    "Retrieve the channel auto-archive settings from the server configuration.",
	Example: `  mmctl channel auto-archive get`,
	Args:    cobra.NoArgs,
	RunE:    withClient(channelAutoArchiveGetCmdF),
}

var ChannelAutoArchiveSetCmd = &cobra.Command{
	Use:   "set",
	Short: "Update channel auto-archive configuration",
	Long: `Update one or more channel auto-archive settings.

Settings:
  --enable              Enable or disable auto-archiving (true/false)
  --inactive-days       Number of inactive days before archiving (1-3650)
  --exclude-public      Exclude public channels from auto-archiving (true/false)
  --exclude-private     Exclude private channels from auto-archiving (true/false)`,
	Example: `  mmctl channel auto-archive set --enable true --inactive-days 60
  mmctl channel auto-archive set --exclude-public true`,
	RunE: withClient(channelAutoArchiveSetCmdF),
}

var ChannelAutoArchiveRunCmd = &cobra.Command{
	Use:     "run",
	Short:   "Trigger an immediate channel auto-archive sweep",
	Long:    "Manually trigger the channel auto-archive job outside the normal schedule.",
	Example: `  mmctl channel auto-archive run`,
	Args:    cobra.NoArgs,
	RunE:    withClient(channelAutoArchiveRunCmdF),
}

func init() {
	ChannelAutoArchiveSetCmd.Flags().Bool("enable", false, "Enable auto-archiving")
	ChannelAutoArchiveSetCmd.Flags().Int("inactive-days", 90, "Days of inactivity before archiving (1-3650)")
	ChannelAutoArchiveSetCmd.Flags().Bool("exclude-public", false, "Exclude public channels")
	ChannelAutoArchiveSetCmd.Flags().Bool("exclude-private", true, "Exclude private channels")

	ChannelAutoArchiveCmd.AddCommand(
		ChannelAutoArchiveGetCmd,
		ChannelAutoArchiveSetCmd,
		ChannelAutoArchiveRunCmd,
	)
	ChannelCmd.AddCommand(ChannelAutoArchiveCmd)
}

func channelAutoArchiveGetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	settings, _, err := c.GetChannelAutoArchiveConfig()
	if err != nil {
		return fmt.Errorf("failed to get channel auto-archive config: %w", err)
	}
	printJSON(settings)
	return nil
}

func channelAutoArchiveSetCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	current, _, err := c.GetChannelAutoArchiveConfig()
	if err != nil {
		return fmt.Errorf("failed to get current config: %w", err)
	}

	if cmd.Flags().Changed("enable") {
		v, _ := cmd.Flags().GetBool("enable")
		current.EnableAutoArchive = model.NewPointer(v)
	}
	if cmd.Flags().Changed("inactive-days") {
		v, _ := cmd.Flags().GetInt("inactive-days")
		current.InactiveDaysBeforeArchive = model.NewPointer(v)
	}
	if cmd.Flags().Changed("exclude-public") {
		v, _ := cmd.Flags().GetBool("exclude-public")
		current.ExcludePublicChannels = model.NewPointer(v)
	}
	if cmd.Flags().Changed("exclude-private") {
		v, _ := cmd.Flags().GetBool("exclude-private")
		current.ExcludePrivateChannels = model.NewPointer(v)
	}

	updated, _, err := c.UpdateChannelAutoArchiveConfig(current)
	if err != nil {
		return fmt.Errorf("failed to update channel auto-archive config: %w", err)
	}
	printJSON(updated)
	return nil
}

func channelAutoArchiveRunCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	result, _, err := c.TriggerChannelAutoArchiveRun()
	if err != nil {
		return fmt.Errorf("failed to trigger channel auto-archive run: %w", err)
	}
	fmt.Printf("Auto-archive sweep complete. Channels archived: %d\n", result.ChannelsArchived)
	return nil
}
