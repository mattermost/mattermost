// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

// splitTrimComma splits a comma-separated flag value into trimmed, non-empty parts.
func splitTrimComma(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

var ExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Management of exports",
}

var ExportCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create export file",
	Args:  cobra.NoArgs,
	RunE:  withClient(exportCreateCmdF),
}

var ExportDownloadCmd = &cobra.Command{
	Use:   "download [exportname] [filepath]",
	Short: "Download export files",
	Example: `  # you can indicate the name of the export and its destination path
  $ mmctl export download samplename sample_export.zip

  # or if you only indicate the name, the path would match it
  $ mmctl export download sample_export.zip`,
	Args: cobra.MinimumNArgs(1),
	RunE: withClient(exportDownloadCmdF),
}

var ExportGeneratePresignedURLCmd = &cobra.Command{
	Use:   "generate-presigned-url [exportname]",
	Short: "Generate a presigned url for an export file. This is helpful when an export is big and might have trouble downloading from the Mattermost server.",
	Args:  cobra.ExactArgs(1),
	RunE:  withClient(exportGeneratePresignedURLCmdF),
}

var ExportDeleteCmd = &cobra.Command{
	Use:     "delete [exportname]",
	Aliases: []string{"rm"},
	Example: "  export delete export_file.zip",
	Short:   "Delete export file",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(exportDeleteCmdF),
}

var ExportListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List export files",
	Args:    cobra.NoArgs,
	RunE:    withClient(exportListCmdF),
}

var ExportJobCmd = &cobra.Command{
	Use:   "job",
	Short: "List, show and cancel export jobs",
}

var ExportJobListCmd = &cobra.Command{
	Use:     "list",
	Example: "  export job list",
	Short:   "List export jobs",
	Aliases: []string{"ls"},
	Args:    cobra.NoArgs,
	RunE:    withClient(exportJobListCmdF),
}

var ExportJobShowCmd = &cobra.Command{
	Use:     "show [exportJobID]",
	Example: "  export job show o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Show export job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(exportJobShowCmdF),
}

var ExportJobCancelCmd = &cobra.Command{
	Use:     "cancel [exportJobID]",
	Example: "  export job cancel o98rj3ur83dp5dppfyk5yk6osy",
	Short:   "Cancel export job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(exportJobCancelCmdF),
}

func init() {
	ExportCreateCmd.Flags().Bool("no-attachments", false, "Exclude file attachments from the export file.")
	ExportCreateCmd.Flags().Bool("include-archived-channels", false, "Include archived channels in the export file.")
	ExportCreateCmd.Flags().Bool("include-profile-pictures", false, "Include profile pictures in the export file.")
	ExportCreateCmd.Flags().Bool("no-roles-and-schemes", false, "Exclude roles and custom permission schemes from the export file.")
	ExportCreateCmd.Flags().String("team-name", "", "Export only the specified team(s) by name/slug. Accepts a comma-separated list. Mutually exclusive with --team-id.")
	ExportCreateCmd.Flags().String("team-id", "", "Export only the specified team(s) by ID. Accepts a comma-separated list. Mutually exclusive with --team-name.")
	ExportCreateCmd.Flags().String("channel-name", "", "Export only the specified channel(s) by name. Accepts a comma-separated list. Requires --team-name or --team-id. Mutually exclusive with --channel-id.")
	ExportCreateCmd.Flags().String("channel-id", "", "Export only the specified channel(s) by ID. Accepts a comma-separated list. The team is inferred from each channel when --team-name/--team-id is omitted; if teams are provided, each channel must belong to one of them. Mutually exclusive with --channel-name.")

	ExportDownloadCmd.Flags().Int("num-retries", 5, "Number of retries to do to resume a download.")

	ExportJobListCmd.Flags().Int("page", 0, "Page number to fetch for the list of export jobs")
	ExportJobListCmd.Flags().Int("per-page", DefaultPageSize, "Number of export jobs to be fetched")
	ExportJobListCmd.Flags().Bool("all", false, "Fetch all export jobs. --page flag will be ignore if provided")

	ExportJobCmd.AddCommand(
		ExportJobListCmd,
		ExportJobShowCmd,
		ExportJobCancelCmd,
	)
	ExportCmd.AddCommand(
		ExportCreateCmd,
		ExportListCmd,
		ExportDeleteCmd,
		ExportDownloadCmd,
		ExportGeneratePresignedURLCmd,
		ExportJobCmd,
	)
	RootCmd.AddCommand(ExportCmd)
}

func exportCreateCmdF(c client.Client, command *cobra.Command, args []string) error {
	data := make(map[string]string)

	excludeAttachments, _ := command.Flags().GetBool("no-attachments")
	if !excludeAttachments {
		data["include_attachments"] = "true"
	}

	excludeRolesAndSchemes, _ := command.Flags().GetBool("no-roles-and-schemes")
	if !excludeRolesAndSchemes {
		data["include_roles_and_schemes"] = "true"
	}

	includeArchivedChannels, _ := command.Flags().GetBool("include-archived-channels")
	if includeArchivedChannels {
		data["include_archived_channels"] = "true"
	}

	includeProfilePictures, _ := command.Flags().GetBool("include-profile-pictures")
	if includeProfilePictures {
		data["include_profile_pictures"] = "true"
	}

	teamNameFlag, _ := command.Flags().GetString("team-name")
	teamIDFlag, _ := command.Flags().GetString("team-id")
	channelNameFlag, _ := command.Flags().GetString("channel-name")
	channelIDFlag, _ := command.Flags().GetString("channel-id")

	if teamNameFlag != "" && teamIDFlag != "" {
		return fmt.Errorf("--team-name and --team-id are mutually exclusive")
	}
	if channelNameFlag != "" && channelIDFlag != "" {
		return fmt.Errorf("--channel-name and --channel-id are mutually exclusive")
	}

	// resolvedTeams accumulates (name, id) pairs for all teams in the export scope.
	type teamEntry struct{ name, id string }
	var resolvedTeams []teamEntry
	resolvedTeamIDSet := make(map[string]bool)

	addTeam := func(t teamEntry) {
		if !resolvedTeamIDSet[t.id] {
			resolvedTeams = append(resolvedTeams, t)
			resolvedTeamIDSet[t.id] = true
		}
	}

	// Resolve --team-id (comma-separated IDs → names).
	for _, id := range splitTrimComma(teamIDFlag) {
		team, _, err := c.GetTeam(context.TODO(), id, "")
		if err != nil {
			return fmt.Errorf("failed to lookup team by ID %q: %w", id, err)
		}
		if team == nil {
			return fmt.Errorf("team with ID %q not found", id)
		}
		addTeam(teamEntry{name: team.Name, id: team.Id})
	}

	// Resolve --team-name (comma-separated names → IDs for cross-validation).
	for _, name := range splitTrimComma(teamNameFlag) {
		team, _, err := c.GetTeamByName(context.TODO(), name, "")
		if err != nil {
			return fmt.Errorf("failed to lookup team %q: %w", name, err)
		}
		if team == nil {
			return fmt.Errorf("team %q not found", name)
		}
		addTeam(teamEntry{name: team.Name, id: team.Id})
	}

	// Resolve --channel-id (comma-separated IDs → names).
	// When no teams are specified, the team is inferred from each channel's TeamId.
	// When teams are specified, each channel must belong to one of them.
	var resolvedChannelNames []string
	for _, id := range splitTrimComma(channelIDFlag) {
		channel, _, err := c.GetChannel(context.TODO(), id)
		if err != nil {
			return fmt.Errorf("failed to lookup channel by ID %q: %w", id, err)
		}
		if channel == nil {
			return fmt.Errorf("channel with ID %q not found", id)
		}
		if len(resolvedTeams) == 0 {
			// Infer team from the channel.
			team, _, err := c.GetTeam(context.TODO(), channel.TeamId, "")
			if err != nil {
				return fmt.Errorf("failed to lookup team for channel %q: %w", id, err)
			}
			if team == nil {
				return fmt.Errorf("team for channel %q not found", id)
			}
			addTeam(teamEntry{name: team.Name, id: team.Id})
		} else if !resolvedTeamIDSet[channel.TeamId] {
			return fmt.Errorf("channel %q does not belong to any of the specified teams", id)
		}
		resolvedChannelNames = append(resolvedChannelNames, channel.Name)
	}

	// Pass-through --channel-name. When exactly one team is in scope, validate
	// each channel exists in that team. For multi-team exports the backend
	// handles missing channels gracefully.
	for _, name := range splitTrimComma(channelNameFlag) {
		if len(resolvedTeams) == 1 {
			ch, _, err := c.GetChannelByName(context.TODO(), name, resolvedTeams[0].id, "")
			if err != nil {
				return fmt.Errorf("failed to lookup channel %q in team %q: %w", name, resolvedTeams[0].name, err)
			}
			if ch == nil {
				return fmt.Errorf("channel %q not found in team %q", name, resolvedTeams[0].name)
			}
		}
		resolvedChannelNames = append(resolvedChannelNames, name)
	}

	if len(resolvedChannelNames) > 0 && len(resolvedTeams) == 0 {
		return fmt.Errorf("please specify a team (--team-name or --team-id) to export a channel from")
	}

	if len(resolvedTeams) > 0 {
		names := make([]string, len(resolvedTeams))
		for i, t := range resolvedTeams {
			names[i] = t.name
		}
		data["team_name"] = strings.Join(names, ",")
	}
	if len(resolvedChannelNames) > 0 {
		data["channel_name"] = strings.Join(resolvedChannelNames, ",")
	}

	job, _, err := c.CreateJob(context.TODO(), &model.Job{
		Type: model.JobTypeExportProcess,
		Data: data,
	})
	if err != nil {
		return fmt.Errorf("failed to create export process job: %w", err)
	}

	printer.PrintT("Export process job successfully created, ID: {{.Id}}", job)

	return nil
}

func exportListCmdF(c client.Client, command *cobra.Command, args []string) error {
	exports, _, err := c.ListExports(context.TODO())
	if err != nil {
		return fmt.Errorf("failed to list exports: %w", err)
	}

	if len(exports) == 0 {
		printer.Print("No export files found")
		return nil
	}

	for _, name := range exports {
		printer.Print(name)
	}

	return nil
}

func exportDeleteCmdF(c client.Client, command *cobra.Command, args []string) error {
	name := args[0]

	if _, err := c.DeleteExport(context.TODO(), name); err != nil {
		return fmt.Errorf("failed to delete export: %w", err)
	}

	printer.Print(fmt.Sprintf("Export file %q has been deleted", name))

	return nil
}

func exportGeneratePresignedURLCmdF(c client.Client, command *cobra.Command, args []string) error {
	name := args[0]

	presignedURL, _, err := c.GeneratePresignedURL(context.TODO(), name)
	if err != nil {
		return fmt.Errorf("failed to generate export link: %w", err)
	}

	printer.PrintT("Export link: {{.Link}}\nExpiration: {{.Expiration}}", map[string]any{
		"Link":       presignedURL.URL,
		"Expiration": presignedURL.Expiration.String(),
	})

	return nil
}

func exportDownloadCmdF(c client.Client, command *cobra.Command, args []string) error {
	var path string
	name := args[0]
	if len(args) > 1 {
		path = args[1]
	}
	if path == "" {
		path = name
	}

	retries, _ := command.Flags().GetInt("num-retries")

	downloadFn := func(outFile *os.File) (string, error) {
		off, err := outFile.Seek(0, io.SeekEnd)
		if err != nil {
			return "", fmt.Errorf("failed to seek file: %w", err)
		}

		_, _, err = c.DownloadExport(context.TODO(), name, outFile, off)
		return "", err
	}

	_, err := downloadFile(path, downloadFn, retries, "export")
	if err != nil {
		return err
	}

	printer.Print(fmt.Sprintf("Export file downloaded to %q", path))
	return nil
}

// downloadFile handles the common logic for downloading files in export and compliance-export commands
func downloadFile(path string, downloadFn func(*os.File) (string, error), retries int, fileType string) (string, error) {
	var outFile *os.File
	var createdFile bool
	info, err := os.Stat(path)
	switch {
	case err != nil && !os.IsNotExist(err):
		// some error occurred and not because file doesn't exist
		return "", fmt.Errorf("failed to stat %s file: %w", fileType, err)
	case err == nil && info.Size() > 0:
		// we exit to avoid overwriting an existing non-empty file
		return "", fmt.Errorf("%s file already exists", fileType)
	case err != nil:
		// file does not exist, we create it
		outFile, err = os.OpenFile(path, os.O_WRONLY|os.O_CREATE, 0600)
		createdFile = true
	default:
		// no error, file exists, we double check the permissions and then open it
		permErr := os.Chmod(path, 0600)
		if permErr != nil {
			return "", fmt.Errorf("failed to change permissions on output file: %w", permErr)
		}

		outFile, err = os.OpenFile(path, os.O_WRONLY, 0600)
	}

	if err != nil {
		return "", fmt.Errorf("failed to create/open %s file: %w", fileType, err)
	}
	defer outFile.Close()

	var suggestedFilename string
	for i := range retries + 1 { // need to include the first attempt
		suggestedFilename, err = downloadFn(outFile)
		if err != nil {
			if i >= retries {
				// Cleanup the file we created earlier
				if createdFile {
					rmErr := os.Remove(path)
					if rmErr != nil {
						printer.PrintError(fmt.Sprintf("Failed to cleanup tempory file: %s", rmErr))
					}
				}
				return "", fmt.Errorf("failed to download %s after %d retries: %w", fileType, retries, err)
			}
			printer.PrintWarning(fmt.Sprintf("Download attempt %d/%d failed. Retrying...", i+1, retries+1))
			continue
		}
		break
	}

	return suggestedFilename, nil
}

func exportJobListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, model.JobTypeExportProcess, "")
}

func exportJobShowCmdF(c client.Client, command *cobra.Command, args []string) error {
	job, _, err := c.GetJob(context.TODO(), args[0])
	if err != nil {
		return fmt.Errorf("failed to get export job: %w", err)
	}

	printJob(job)

	return nil
}

func exportJobCancelCmdF(c client.Client, _ *cobra.Command, args []string) error {
	job, _, err := c.GetJob(context.TODO(), args[0])
	if err != nil {
		return fmt.Errorf("failed to get export job: %w", err)
	}

	if _, err := c.CancelJob(context.TODO(), job.Id); err != nil {
		return fmt.Errorf("failed to cancel export job: %w", err)
	}

	return nil
}
