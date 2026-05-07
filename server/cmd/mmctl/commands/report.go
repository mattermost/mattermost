// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var ReportCmd = &cobra.Command{
	Use:   "report",
	Short: "Reporting commands",
}

var ReportPostsCmd = &cobra.Command{
	Use:   "posts [channel]",
	Short: "Retrieve posts for reporting purposes",
	Long: `Retrieve posts from a channel for reporting purposes. This command supports
pagination and can filter posts by time range. Results can be output in JSON format
for further processing.`,
	Example: `  # Get posts from a channel with default settings
  mmctl report posts myteam:mychannel

  # Get posts with JSON output
  mmctl report posts myteam:mychannel --json

  # Get posts sorted by update_at in descending order
  mmctl report posts myteam:mychannel --time-field update_at --sort-direction desc

  # Get posts including deleted posts and metadata
  mmctl report posts myteam:mychannel --include-deleted --include-metadata

  # Get posts excluding ALL system posts
  mmctl report posts myteam:mychannel --exclude-system-posts

  # Get more posts per page (max 1000)
  mmctl report posts myteam:mychannel --per-page 500

  # Resume pagination from a specific cursor (use next_cursor from previous response)
  mmctl report posts myteam:mychannel --cursor "MTphYmMxMjM6Y3JlYXRlX2F0OmZhbHNlOmZhbHNlOmFzYzoxNjQwMDAwMzAwMDAwOnBvc3Qz"`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(reportPostsCmdF),
}

func init() {
	ReportPostsCmd.Flags().String("time-field", "create_at", "Time field to use for sorting (create_at or update_at)")
	ReportPostsCmd.Flags().String("sort-direction", "asc", "Sort direction (asc or desc)")
	ReportPostsCmd.Flags().String("cursor", "", "Opaque cursor for pagination (use next_cursor from previous response)")
	ReportPostsCmd.Flags().Int("per-page", 100, "Number of posts per page (max 1000)")
	ReportPostsCmd.Flags().Bool("include-deleted", false, "Include deleted posts")
	ReportPostsCmd.Flags().Bool("exclude-system-posts", false, "Exclude ALL system posts (any type starting with 'system_')")
	ReportPostsCmd.Flags().Bool("include-metadata", false, "Include file info, reactions, etc.")

	ReportCmd.AddCommand(ReportPostsCmd)
	RootCmd.AddCommand(ReportCmd)
}

func reportPostsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	// Get flags
	timeField, _ := cmd.Flags().GetString("time-field")
	sortDirection, _ := cmd.Flags().GetString("sort-direction")
	cursor, _ := cmd.Flags().GetString("cursor")
	perPage, _ := cmd.Flags().GetInt("per-page")
	includeDeleted, _ := cmd.Flags().GetBool("include-deleted")
	excludeSystemPosts, _ := cmd.Flags().GetBool("exclude-system-posts")
	includeMetadata, _ := cmd.Flags().GetBool("include-metadata")

	// Validate flags (only validated for first request; ignored when cursor is provided)
	if timeField != model.ReportingTimeFieldCreateAt && timeField != model.ReportingTimeFieldUpdateAt {
		return errors.New("time-field must be either 'create_at' or 'update_at'")
	}
	if sortDirection != model.ReportingSortDirectionAsc && sortDirection != model.ReportingSortDirectionDesc {
		return errors.New("sort-direction must be either 'asc' or 'desc'")
	}
	if perPage <= 0 || perPage > model.MaxReportingPerPage {
		return fmt.Errorf("per-page must be between 1 and %d", model.MaxReportingPerPage)
	}

	// Set up options
	options := model.ReportPostOptions{
		ChannelId:          channel.Id,
		TimeField:          timeField,
		SortDirection:      sortDirection,
		PerPage:            perPage,
		IncludeDeleted:     includeDeleted,
		ExcludeSystemPosts: excludeSystemPosts,
		IncludeMetadata:    includeMetadata,
	}

	// Initialize cursor (opaque string)
	cursorObj := model.ReportPostOptionsCursor{
		Cursor: cursor,
	}

	response, _, err := c.GetPostsForReporting(context.TODO(), options, cursorObj)
	if err != nil {
		return fmt.Errorf("failed to get posts for reporting: %w", err)
	}

	// Print posts (already in correct order from API)
	for _, post := range response.Posts {
		printReportPost(post)
	}

	// Show pagination info
	printer.Print(fmt.Sprintf("\nShowing %d posts.", len(response.Posts)))
	if response.NextCursor != nil && response.NextCursor.Cursor != "" {
		printer.Print(fmt.Sprintf("To get the next page, use: --cursor \"%s\"", response.NextCursor.Cursor))
	} else {
		printer.Print("No more posts available.")
	}

	return nil
}

func printReportPost(post *model.Post) {
	jsonOutput, _ := RootCmd.Flags().GetBool("json")

	if jsonOutput {
		jsonBytes, err := json.MarshalIndent(post, "", "  ")
		if err != nil {
			printer.PrintError("Error marshaling post to JSON: " + err.Error())
			return
		}
		fmt.Println(string(jsonBytes))
	} else {
		// Print in a readable format
		createdAt := time.Unix(post.CreateAt/1000, 0).Format("2006-01-02 15:04:05")
		updatedAt := time.Unix(post.UpdateAt/1000, 0).Format("2006-01-02 15:04:05")

		fmt.Fprintf(os.Stdout, "Post ID: %s\n", post.Id)
		fmt.Fprintf(os.Stdout, "User ID: %s\n", post.UserId)
		fmt.Fprintf(os.Stdout, "Channel ID: %s\n", post.ChannelId)
		fmt.Fprintf(os.Stdout, "Created At: %s\n", createdAt)
		fmt.Fprintf(os.Stdout, "Updated At: %s\n", updatedAt)
		fmt.Fprintf(os.Stdout, "Message: %s\n", printer.SanitizeForTerminal(post.Message))
		if post.DeleteAt > 0 {
			deletedAt := time.Unix(post.DeleteAt/1000, 0).Format("2006-01-02 15:04:05")
			fmt.Fprintf(os.Stdout, "Deleted At: %s\n", deletedAt)
		}
		fmt.Fprintf(os.Stdout, "---\n")
	}
}
