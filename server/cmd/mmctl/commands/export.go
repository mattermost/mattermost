// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"fmt"
	"io"
	"os"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"
)

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
	ExportCreateCmd.Flags().Bool("attachments", false, "Set to true to include file attachments in the export file.")
	_ = ExportCreateCmd.Flags().MarkHidden("attachments")
	_ = ExportCreateCmd.Flags().MarkDeprecated("attachments", "the tool now includes attachments by default. The flag will be removed in a future version.")

	ExportCreateCmd.Flags().Bool("no-attachments", false, "Set to true to exclude file attachments in the export file.")
	ExportCreateCmd.Flags().Bool("include-archived-channels", false, "Set to true to include archived channels in the export file.")

	ExportDownloadCmd.Flags().Bool("resume", false, "Set to true to resume an export download.")
	_ = ExportDownloadCmd.Flags().MarkHidden("resume")
	// Intentionally the message does not start with a capital letter because
	// cobra prepends "Flag --resume has been deprecated,"
	_ = ExportDownloadCmd.Flags().MarkDeprecated("resume", "the tool now resumes a download automatically. The flag will be removed in a future version.")
	ExportDownloadCmd.Flags().Int("num-retries", 5, "Number of retries to do to resume a download.")

	ExportJobListCmd.Flags().Int("page", 0, "Page number to fetch for the list of export jobs")
	ExportJobListCmd.Flags().Int("per-page", 200, "Number of export jobs to be fetched")
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

	includeArchivedChannels, _ := command.Flags().GetBool("include-archived-channels")
	if includeArchivedChannels {
		data["include_archived_channels"] = "true"
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

	printer.PrintT("Export link: {{.Link}}\nExpiration: {{.Expiration}}", map[string]interface{}{
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

	var outFile *os.File
	info, err := os.Stat(path)
	switch {
	case err != nil && !os.IsNotExist(err):
		// some error occurred and not because file doesn't exist
		return fmt.Errorf("failed to stat export file: %w", err)
	case err == nil && info.Size() > 0:
		// we exit to avoid overwriting an existing non-empty file
		return fmt.Errorf("export file already exists")
	case err != nil:
		// file does not exist, we create it
		outFile, err = os.Create(path)
	default:
		// no error, file exists, we open it
		outFile, err = os.OpenFile(path, os.O_WRONLY, 0600)
	}

	if err != nil {
		return fmt.Errorf("failed to create/open export file: %w", err)
	}
	defer outFile.Close()

	i := 0
	for i < retries+1 {
		off, err := outFile.Seek(0, io.SeekEnd)
		if err != nil {
			return fmt.Errorf("failed to seek export file: %w", err)
		}

		if _, _, err := c.DownloadExport(context.TODO(), name, outFile, off); err != nil {
			printer.PrintWarning(fmt.Sprintf("failed to download export file: %v. Retrying...", err))
			i++
			continue
		}
		break
	}

	if retries != 0 && i == retries+1 {
		return fmt.Errorf("failed to download export after %d retries", retries)
	}

	return nil
}

func exportJobListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, model.JobTypeExportProcess)
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
