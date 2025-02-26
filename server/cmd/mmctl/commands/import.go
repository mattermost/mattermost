// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"text/template"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/commands/importer"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"
)

var ImportCmd = &cobra.Command{
	Use:   "import",
	Short: "Management of imports",
}

var ImportUploadCmd = &cobra.Command{
	Use:     "upload [filepath]",
	Short:   "Upload import files",
	Example: "  import upload import_file.zip",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(importUploadCmdF),
}

var ImportListCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"ls"},
	Short:   "List import files",
	Example: " import list",
}

var ImportListAvailableCmd = &cobra.Command{
	Use:     "available",
	Short:   "List available import files",
	Example: "  import list available",
	Args:    cobra.NoArgs,
	RunE:    withClient(importListAvailableCmdF),
}

var ImportJobCmd = &cobra.Command{
	Use:   "job",
	Short: "List and show import jobs",
}

var ImportListIncompleteCmd = &cobra.Command{
	Use:     "incomplete",
	Short:   "List incomplete import files uploads",
	Example: "  import list incomplete",
	Args:    cobra.NoArgs,
	RunE:    withClient(importListIncompleteCmdF),
}

var ImportJobListCmd = &cobra.Command{
	Use:     "list",
	Example: "  import job list",
	Short:   "List import jobs",
	Aliases: []string{"ls"},
	Args:    cobra.NoArgs,
	RunE:    withClient(importJobListCmdF),
}

var ImportJobShowCmd = &cobra.Command{
	Use:     "show [importJobID]",
	Example: " import job show f3d68qkkm7n8xgsfxwuo498rah",
	Short:   "Show import job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(importJobShowCmdF),
}

var ImportProcessCmd = &cobra.Command{
	Use:     "process [importname]",
	Example: "  import process 35uy6cwrqfnhdx3genrhqqznxc_import.zip",
	Short:   "Start an import job",
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(importProcessCmdF),
}

var ImportValidateCmd = &cobra.Command{
	Use:     "validate [filepath]",
	Example: "  import validate import_file.zip --team myteam --team myotherteam",
	Short:   "Validate an import file",
	Args:    cobra.ExactArgs(1),
	RunE: func(command *cobra.Command, args []string) error {
		return importValidateCmdF(nil, command, args)
	},
}

func init() {
	ImportUploadCmd.Flags().Bool("resume", false, "Set to true to resume an incomplete import upload.")
	ImportUploadCmd.Flags().String("upload", "", "The ID of the import upload to resume.")

	ImportJobListCmd.Flags().Int("page", 0, "Page number to fetch for the list of import jobs")
	ImportJobListCmd.Flags().Int("per-page", DefaultPageSize, "Number of import jobs to be fetched")
	ImportJobListCmd.Flags().Bool("all", false, "Fetch all import jobs. --page flag will be ignore if provided")

	ImportValidateCmd.Flags().StringArray("team", nil, "Predefined team[s] to assume as already present on the destination server. Implies --check-missing-teams. The flag can be repeated")
	ImportValidateCmd.Flags().Bool("check-missing-teams", false, "Check for teams that are not defined but referenced in the archive")
	ImportValidateCmd.Flags().Bool("ignore-attachments", false, "Don't check if the attached files are present in the archive")
	ImportValidateCmd.Flags().Bool("check-server-duplicates", true, "Set to false to ignore teams, channels, and users already present on the server")

	ImportProcessCmd.Flags().Bool("bypass-upload", false, "If this is set, the file is not processed from the server, but rather directly read from the filesystem. Works only in --local mode.")
	ImportProcessCmd.Flags().Bool("extract-content", true, "If this is set, document attachments will be extracted and indexed during the import process. It is advised to disable it to improve performance.")

	ImportListCmd.AddCommand(
		ImportListAvailableCmd,
		ImportListIncompleteCmd,
	)
	ImportJobCmd.AddCommand(
		ImportJobListCmd,
		ImportJobShowCmd,
	)
	ImportCmd.AddCommand(
		ImportUploadCmd,
		ImportListCmd,
		ImportProcessCmd,
		ImportJobCmd,
		ImportValidateCmd,
	)
	RootCmd.AddCommand(ImportCmd)
}

func importListIncompleteCmdF(c client.Client, command *cobra.Command, args []string) error {
	isLocal, _ := command.Flags().GetBool("local")
	userID := "me"
	if isLocal {
		userID = model.UploadNoUserID
	}

	uploads, _, err := c.GetUploadsForUser(context.TODO(), userID)
	if err != nil {
		return fmt.Errorf("failed to get uploads: %w", err)
	}

	var hasImports bool
	for _, us := range uploads {
		if us.Type == model.UploadTypeImport {
			completedPct := float64(us.FileOffset) / float64(us.FileSize) * 100
			printer.PrintT(fmt.Sprintf("  ID: {{.Id}}\n  Name: {{.Filename}}\n  Uploaded: {{.FileOffset}}/{{.FileSize}} (%0.0f%%)\n", completedPct), us)
			hasImports = true
		}
	}

	if !hasImports {
		printer.Print("No incomplete import uploads found")
		return nil
	}

	return nil
}

func importListAvailableCmdF(c client.Client, command *cobra.Command, args []string) error {
	imports, _, err := c.ListImports(context.TODO())
	if err != nil {
		return fmt.Errorf("failed to list imports: %w", err)
	}

	if len(imports) == 0 {
		printer.Print("No import files found")
		return nil
	}

	for _, name := range imports {
		printer.Print(name)
	}

	return nil
}

func importUploadCmdF(c client.Client, command *cobra.Command, args []string) error {
	filepath := args[0]

	isLocal, _ := command.Flags().GetBool("local")
	if isLocal {
		printer.PrintWarning("In --local mode, you don't need to upload the file to server any more. Directly use the import process command with the --bypass-upload flag and pass the export file.")
	}

	file, err := os.Open(filepath)
	if err != nil {
		return fmt.Errorf("failed to open import file: %w", err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat import file: %w", err)
	}

	shouldResume, _ := command.Flags().GetBool("resume")
	var us *model.UploadSession
	if shouldResume {
		uploadID, nErr := command.Flags().GetString("upload")
		if nErr != nil || !model.IsValidId(uploadID) {
			return errors.New("upload session ID is missing or invalid")
		}

		us, _, err = c.GetUpload(context.TODO(), uploadID)
		if err != nil {
			return fmt.Errorf("failed to get upload session: %w", err)
		}

		if us.FileSize != info.Size() {
			return fmt.Errorf("file sizes do not match")
		}

		if _, nErr := file.Seek(us.FileOffset, io.SeekStart); nErr != nil {
			return fmt.Errorf("failed to get seek file: %w", nErr)
		}
	} else {
		isLocal, _ := command.Flags().GetBool("local")
		userID := "me"
		if isLocal {
			userID = model.UploadNoUserID
		}

		us, _, err = c.CreateUpload(context.TODO(), &model.UploadSession{
			Filename: info.Name(),
			FileSize: info.Size(),
			Type:     model.UploadTypeImport,
			UserId:   userID,
		})
		if err != nil {
			return fmt.Errorf("failed to create upload session: %w", err)
		}

		printer.PrintT("Upload session successfully created, ID: {{.Id}} ", us)
	}

	finfo, _, err := c.UploadData(context.TODO(), us.Id, file)
	if err != nil {
		return fmt.Errorf("failed to upload data: %w", err)
	}

	printer.PrintT("Import file successfully uploaded, name: {{.Id}}", finfo)

	return nil
}

func importProcessCmdF(c client.Client, command *cobra.Command, args []string) error {
	importFile := args[0]

	isLocal, _ := command.Flags().GetBool("local")
	bypassUpload, _ := command.Flags().GetBool("bypass-upload")
	if bypassUpload {
		if isLocal {
			// First, we validate whether the server is in HA.
			config, _, err := c.GetOldClientConfig(context.TODO(), "")
			if err != nil {
				return err
			}

			enableCluster, err := strconv.ParseBool(config["EnableCluster"])
			if err != nil {
				return fmt.Errorf("failed to parse EnableCluster: %w", err)
			}

			if enableCluster {
				return errors.New("--bypass-upload flag doesn't work if the server is in HA. Because the file has to be present locally on the server where the job request hits. Please disable HA and try again.")
			}

			// in local mode, we tell the server to directly read from this file.
			if _, err := os.Stat(importFile); errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("file %s doesn't exist. NOTE: If this file was uploaded to the server via mmctl import upload, please omit the --bypass-upload flag to revert to old behavior.", importFile)
			}
			// If it's not an absolute path, then we make it
			if !path.IsAbs(importFile) {
				var err2 error
				importFile, err2 = filepath.Abs(importFile)
				if err2 != nil {
					return fmt.Errorf("error is getting the absolute path to %s: %w", importFile, err2)
				}
			}
		} else {
			printer.PrintWarning("--bypass-upload has no effect in non-local mode.")
		}
	}

	extractContent, _ := command.Flags().GetBool("extract-content")

	job, _, err := c.CreateJob(context.TODO(), &model.Job{
		Type: model.JobTypeImportProcess,
		Data: map[string]string{
			"import_file":     importFile,
			"local_mode":      strconv.FormatBool(isLocal && bypassUpload),
			"extract_content": strconv.FormatBool(extractContent),
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create import process job: %w", err)
	}

	printer.PrintT("Import process job successfully created, ID: {{.Id}}", job)

	return nil
}

func importJobShowCmdF(c client.Client, command *cobra.Command, args []string) error {
	job, _, err := c.GetJob(context.TODO(), args[0])
	if err != nil {
		return fmt.Errorf("failed to get import job: %w", err)
	}

	printJob(job)

	return nil
}

func importJobListCmdF(c client.Client, command *cobra.Command, args []string) error {
	return jobListCmdF(c, command, model.JobTypeImportProcess, "")
}

type Statistics struct {
	Roles          uint64 `json:"roles"`
	Schemes        uint64 `json:"schemes"`
	Teams          uint64 `json:"teams"`
	Channels       uint64 `json:"channels"`
	Users          uint64 `json:"users"`
	Emojis         uint64 `json:"emojis"`
	Posts          uint64 `json:"posts"`
	DirectChannels uint64 `json:"direct_channels"`
	DirectPosts    uint64 `json:"direct_posts"`
	Attachments    uint64 `json:"attachments"`
}

type ImportValidationResult struct {
	FileName   string                            `json:"file_name"`
	TotalLines uint64                            `json:"total_lines"`
	Elapsed    time.Duration                     `json:"elapsed_time_ns"`
	Errors     []*importer.ImportValidationError `json:"errors"`
}

func importValidateCmdF(c client.Client, command *cobra.Command, args []string) error {
	configurePrinter()
	defer printer.Print("Validation complete\n")

	var (
		serverTeams    = make(map[string]*model.Team) // initialize it in case we need to add teams manually
		serverChannels map[importer.ChannelTeam]*model.Channel
		serverUsers    map[string]*model.User
		serverEmails   map[string]*model.User
		maxPostSize    int
	)

	preRunWithClient := func(c client.Client, cmd *cobra.Command, args []string) error {
		users, err := getPages(func(page, numPerPage int, etag string) ([]*model.User, *model.Response, error) {
			return c.GetUsers(context.TODO(), page, numPerPage, etag)
		}, DefaultPageSize)
		if err != nil {
			return err
		}

		config, _, err := c.GetOldClientConfig(context.TODO(), "")
		if err != nil {
			return err
		}

		maxPostSize, err = strconv.Atoi(config["MaxPostSize"])
		if err != nil {
			return fmt.Errorf("failed to parse MaxPostSize: %w", err)
		}

		serverUsers = make(map[string]*model.User)
		serverEmails = make(map[string]*model.User)
		for _, user := range users {
			serverUsers[user.Nickname] = user
			serverEmails[user.Email] = user
		}

		teams, err := getPages(func(page, numPerPage int, etag string) ([]*model.Team, *model.Response, error) {
			return c.GetAllTeams(context.TODO(), etag, page, numPerPage)
		}, DefaultPageSize)
		if err != nil {
			return err
		}

		serverChannels = make(map[importer.ChannelTeam]*model.Channel)
		for _, team := range teams {
			serverTeams[team.Name] = team

			publicChannels, err := getPages(func(page, numPerPage int, etag string) ([]*model.Channel, *model.Response, error) {
				return c.GetPublicChannelsForTeam(context.TODO(), team.Id, page, numPerPage, etag)
			}, DefaultPageSize)
			if err != nil {
				return err
			}

			privateChannels, err := getPages(func(page, numPerPage int, etag string) ([]*model.Channel, *model.Response, error) {
				return c.GetPrivateChannelsForTeam(context.TODO(), team.Id, page, numPerPage, etag)
			}, DefaultPageSize)
			if err != nil {
				return err
			}

			for _, channel := range publicChannels {
				serverChannels[importer.ChannelTeam{Channel: channel.Name, Team: team.Name}] = channel
			}
			for _, channel := range privateChannels {
				serverChannels[importer.ChannelTeam{Channel: channel.Name, Team: team.Name}] = channel
			}
		}

		return nil
	}

	var err error
	if c != nil {
		err = preRunWithClient(c, command, args)
	} else {
		err = withClient(preRunWithClient)(command, args)
	}
	if err != nil {
		printer.Print(fmt.Sprintf("could not initialize client (%s), skipping online checks\n", err.Error()))
	}

	injectedTeams, err := command.Flags().GetStringArray("team")
	if err != nil {
		return err
	}
	for _, team := range injectedTeams {
		if _, ok := serverTeams[team]; !ok {
			serverTeams[team] = &model.Team{
				Id:          "<predefined>",
				Name:        team,
				DisplayName: "team was predefined",
			}
		}
	}

	checkMissingTeams, err := command.Flags().GetBool("check-missing-teams")
	if err != nil {
		return err
	}

	ignoreAttachments, err := command.Flags().GetBool("ignore-attachments")
	if err != nil {
		return err
	}

	checkServerDuplicates, err := command.Flags().GetBool("check-server-duplicates")
	if err != nil {
		return err
	}

	if maxPostSize == 0 {
		maxPostSize = model.PostMessageMaxRunesV2
	}

	createMissingTeams := !checkMissingTeams && len(injectedTeams) == 0
	validator := importer.NewValidator(
		args[0],               // input file
		ignoreAttachments,     // ignore attachments flag
		createMissingTeams,    // create missing teams flag
		checkServerDuplicates, // check for server duplicates flag
		serverTeams,           // map of existing teams
		serverChannels,        // map of existing channels
		serverUsers,           // map of users by name
		serverEmails,          // map of users by email
		maxPostSize,
	)

	var errors []*importer.ImportValidationError
	templateError := template.Must(template.New("").Parse("{{ .Error }}\n"))
	validator.OnError(func(ive *importer.ImportValidationError) error {
		printer.PrintPreparedT(templateError, ive)
		errors = append(errors, ive)
		return nil
	})

	err = validator.Validate()
	if err != nil {
		return err
	}

	stat := Statistics{
		Roles:          validator.Roles(),
		Schemes:        validator.Schemes(),
		Teams:          validator.TeamCount(),
		Channels:       validator.ChannelCount(),
		Users:          validator.UserCount(),
		Posts:          (validator.PostCount()),
		DirectChannels: (validator.DirectChannelCount()),
		DirectPosts:    (validator.DirectPostCount()),
		Emojis:         (validator.Emojis()),
		Attachments:    uint64(len(validator.Attachments())),
	}

	printStatistics(stat)

	createdTeams := validator.CreatedTeams()
	if createMissingTeams && len(createdTeams) != 0 {
		printer.PrintT("Automatically created teams: {{ join .CreatedTeams \", \" }}\n", struct {
			CreatedTeams []string `json:"created_teams"`
		}{createdTeams})
	}

	unusedAttachments := validator.UnusedAttachments()
	if len(unusedAttachments) > 0 {
		printer.PrintT("Unused Attachments ({{ len .UnusedAttachments }}):\n"+
			"{{ range .UnusedAttachments }}  {{ . }}\n{{ end }}", struct {
			UnusedAttachments []string `json:"unused_attachments"`
		}{unusedAttachments})
	}

	printer.PrintT("It took {{ .Elapsed }} to validate {{ .TotalLines }} lines in {{ .FileName }}\n", ImportValidationResult{args[0], validator.Lines(), validator.Duration(), errors})

	return nil
}

func configurePrinter() {
	// we want to manage the newlines ourselves
	printer.SetNoNewline(true)

	// define a join function
	printer.SetTemplateFunc("join", strings.Join)
}

func printStatistics(stat Statistics) {
	tmpl := "\n" +
		"Roles           {{ .Roles }}\n" +
		"Schemes         {{ .Schemes }}\n" +
		"Teams           {{ .Teams }}\n" +
		"Channels        {{ .Channels }}\n" +
		"Users           {{ .Users }}\n" +
		"Emojis          {{ .Emojis }}\n" +
		"Posts           {{ .Posts }}\n" +
		"Direct Channels {{ .DirectChannels }}\n" +
		"Direct Posts    {{ .DirectPosts }}\n" +
		"Attachments     {{ .Attachments }}\n"

	printer.PrintT(tmpl, stat)
}
