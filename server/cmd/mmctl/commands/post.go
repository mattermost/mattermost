// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var PostCmd = &cobra.Command{
	Use:   "post",
	Short: "Management of posts",
}

var PostCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a post",
	Long:  "Create a post in a channel or send a direct message to a user by prefixing the user with '@'.",
	Example: `  post create myteam:mychannel --message "some text for the post"
  post create @target-user --message "some text for the direct message"
  post create myteam:mychannel --message "see attachment" --file ./report.pdf --file ./image.png`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(postCreateCmdF),
}

var PostListCmd = &cobra.Command{
	Use:   "list",
	Short: "List posts for a channel",
	Example: `  post list myteam:mychannel
  post list myteam:mychannel --number 20`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(postListCmdF),
}

var PostRevealCmd = &cobra.Command{
	Use:     "reveal [post]",
	Short:   "Reveal a post",
	Example: `  post reveal udjmt396tjghi8wnsk3a1qs1sw`,
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(revealPostCmdF),
}

var PostDeleteCmd = &cobra.Command{
	Use:   "delete [posts]",
	Short: "Mark posts as deleted or permanently delete posts with the --permanent flag",
	Long:  `This command will mark the post as deleted and remove it from the user's clients, but it does not permanently delete the post from the database. Please use the --permanent flag to permanently delete a post and its attachments from your database.`,
	Example: `  # Mark Post as deleted
  $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw

  # Permanently delete a post and it's file contents from the database and filestore
  $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw --permanent

  # Permanently delete multiple posts and their file contents from the database and filestore
  $ mmctl post delete udjmt396tjghi8wnsk3a1qs1sw 7jgcjt7tyjyyu83qz81wo84w6o --permanent`,
	Args: cobra.MinimumNArgs(1),
	RunE: withClient(deletePostsCmdF),
}

const (
	ISO8601Layout  = "2006-01-02T15:04:05-07:00"
	PostTimeFormat = "2006-01-02 15:04:05-07:00"

	directMessagePrefix = "@"
)

func init() {
	PostCreateCmd.Flags().StringP("message", "m", "", "Message for the post")
	PostCreateCmd.Flags().StringP("reply-to", "r", "", "Post id to reply to")
	PostCreateCmd.Flags().BoolP("burn-on-read", "b", false, "Message will be deleted after a certain time after being read")
	PostCreateCmd.Flags().StringArrayP("file", "f", nil, "Path to a local file to attach to the post. Can be specified multiple times to attach multiple files")

	PostListCmd.Flags().IntP("number", "n", 20, "Number of messages to list")
	PostListCmd.Flags().BoolP("show-ids", "i", false, "Show posts ids")
	PostListCmd.Flags().BoolP("follow", "f", false, "Output appended data as new messages are posted to the channel")
	PostListCmd.Flags().StringP("since", "s", "", "List messages posted after a certain time (ISO 8601)")

	PostDeleteCmd.Flags().Bool("confirm", false, "Confirm you really want to delete the post and a DB backup has been performed")
	PostDeleteCmd.Flags().Bool("permanent", false, "Permanently delete the post and its contents from the database")

	PostCmd.AddCommand(
		PostCreateCmd,
		PostListCmd,
		PostDeleteCmd,
		PostRevealCmd,
	)

	RootCmd.AddCommand(PostCmd)
}

func postCreateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	if viper.GetBool("local") {
		return errors.New("creating posts is not supported in local mode")
	}

	message, _ := cmd.Flags().GetString("message")
	files, _ := cmd.Flags().GetStringArray("file")
	if message == "" && len(files) == 0 {
		return errors.New("a post must have a message or at least one file attachment")
	}

	replyTo, _ := cmd.Flags().GetString("reply-to")
	if replyTo != "" {
		replyToPost, _, err := c.GetPost(context.TODO(), replyTo, "")
		if err != nil {
			return err
		}
		if replyToPost.RootId != "" {
			replyTo = replyToPost.RootId
		}
	}

	channelID, err := getPostChannelID(c, args[0])
	if err != nil {
		return err
	}

	fileIDs, uploadErr, err := uploadPostFiles(c, channelID, files)
	if err != nil {
		// A file could not be opened, so nothing was uploaded and no
		// attachments were orphaned. Abort before creating the post.
		return err
	}
	if message == "" && len(fileIDs) == 0 {
		if uploadErr != nil {
			return uploadErr
		}
		return errors.New("a post must have a message or at least one file attachment")
	}

	post := &model.Post{
		ChannelId: channelID,
		Message:   message,
		RootId:    replyTo,
		FileIds:   fileIDs,
	}

	if burnOnRead, _ := cmd.Flags().GetBool("burn-on-read"); burnOnRead {
		post.Type = model.PostTypeBurnOnRead
	}

	url := "/posts" + "?set_online=false"
	data, err := post.ToJSON()
	if err != nil {
		return fmt.Errorf("could not decode post: %w", err)
	}

	if _, err := c.DoAPIPost(context.TODO(), url, data); err != nil {
		return fmt.Errorf("could not create post: %w", err)
	}

	// Any files that uploaded successfully are attached to the post above, so
	// a partial batch failure never leaves those uploads orphaned. The error is
	// returned last so the caller still learns which files could not be sent.
	return uploadErr
}

// uploadPostFiles streams each local file to the server and returns the IDs of
// the files that were uploaded successfully. All files are opened up front so
// an unreadable path (returned as the final error) fails before any upload
// happens, leaving nothing orphaned. Once uploads start, a failure on one file
// does not abort the batch: it is collected in uploadErr while the files that
// did upload are still returned so they can be attached to the post.
func uploadPostFiles(c client.Client, channelID string, files []string) (fileIDs []string, uploadErr error, err error) {
	if len(files) == 0 {
		return nil, nil, nil
	}

	handles := make([]*os.File, 0, len(files))
	defer func() {
		for _, f := range handles {
			f.Close()
		}
	}()
	for _, file := range files {
		f, openErr := os.Open(file)
		if openErr != nil {
			return nil, nil, fmt.Errorf("could not read file '%s': %w", file, openErr)
		}
		handles = append(handles, f)
	}

	var errs *multierror.Error
	for i, f := range handles {
		fileID, uploadFileErr := uploadPostFile(c, channelID, files[i], f)
		if uploadFileErr != nil {
			errs = multierror.Append(errs, uploadFileErr)
			continue
		}
		fileIDs = append(fileIDs, fileID)
	}

	return fileIDs, errs.ErrorOrNil(), nil
}

func uploadPostFile(c client.Client, channelID, path string, f *os.File) (string, error) {
	info, err := f.Stat()
	if err != nil {
		return "", fmt.Errorf("could not read file '%s': %w", path, err)
	}

	us, _, err := c.CreateUpload(context.TODO(), &model.UploadSession{
		Type:      model.UploadTypeAttachment,
		ChannelId: channelID,
		Filename:  filepath.Base(path),
		FileSize:  info.Size(),
		UserId:    "me",
	})
	if err != nil {
		return "", fmt.Errorf("could not upload file '%s': %w", path, err)
	}

	fileInfo, _, err := c.UploadData(context.TODO(), us.Id, f)
	if err != nil {
		return "", fmt.Errorf("could not upload file '%s': %w", path, err)
	}
	if fileInfo == nil {
		return "", fmt.Errorf("could not upload file '%s': upload did not complete", path)
	}

	return fileInfo.Id, nil
}

func getPostChannelID(c client.Client, arg string) (string, error) {
	if username, ok := strings.CutPrefix(arg, directMessagePrefix); ok {
		channel, err := getDirectChannel(c, username)
		if err != nil {
			return "", err
		}
		return channel.Id, nil
	}

	channel := getChannelFromChannelArg(c, arg)
	if channel == nil {
		return "", errors.New("Unable to find channel '" + arg + "'")
	}
	return channel.Id, nil
}

func getDirectChannel(c client.Client, username string) (*model.Channel, error) {
	user, err := getUserFromArg(c, username)
	if err != nil {
		return nil, err
	}

	me, _, err := c.GetMe(context.TODO(), "")
	if err != nil {
		return nil, fmt.Errorf("could not retrieve the current user: %w", err)
	}

	channel, _, err := c.CreateDirectChannel(context.TODO(), me.Id, user.Id)
	if err != nil {
		return nil, fmt.Errorf("could not create direct channel with '%s': %w", username, err)
	}
	return channel, nil
}

func eventDataToPost(eventData map[string]any) (*model.Post, error) {
	post := &model.Post{}
	var rawPost string
	for k, v := range eventData {
		if k == "post" {
			rawPost = v.(string)
		}
	}

	err := json.Unmarshal([]byte(rawPost), &post)
	if err != nil {
		return nil, err
	}
	return post, nil
}

func printPost(c client.Client, post *model.Post, usernames map[string]string, showIds, showTimestamp bool) {
	var username string

	if usernames[post.UserId] != "" {
		username = usernames[post.UserId]
	} else {
		user, _, err := c.GetUser(context.TODO(), post.UserId, "")
		if err != nil {
			username = post.UserId
		} else {
			usernames[post.UserId] = user.Username
			username = user.Username
		}
	}

	postTime := model.GetTimeForMillis(post.CreateAt)
	createdAt := postTime.Format(PostTimeFormat)

	var templatedMessage string

	if showTimestamp {
		templatedMessage = fmt.Sprintf("{{ if eq .Type \"burn_on_read\" }}🔥 {{ end }}\u001b[32m%s\u001b[0m \u001b[34;1m[%s]\u001b[0m {{.Message}}", createdAt, username)
	} else {
		if showIds {
			templatedMessage = fmt.Sprintf("{{ if eq .Type \"burn_on_read\" }}🔥 {{ end }}\u001b[31m%s\u001b[0m \u001b[34;1m[%s]\u001b[0m {{.Message}}", post.Id, username)
		} else {
			templatedMessage = fmt.Sprintf("{{ if eq .Type \"burn_on_read\" }}🔥 {{ end }}\u001b[34;1m[%s]\u001b[0m {{.Message}}", username)
		}
	}

	if post.Type == model.PostTypeBurnOnRead {
		expireAt := post.Metadata.ExpireAt
		if expireAt != 0 {
			dur := time.Until(time.UnixMilli(expireAt))
			templatedMessage = fmt.Sprintf("%s (expires in %s)", templatedMessage, dur.String())
		}
	}
	printer.PrintT(templatedMessage, post)
}

func getPostList(client client.Client, channelID, since string, perPage int) (*model.PostList, *model.Response, error) {
	if since == "" {
		return client.GetPostsForChannel(context.TODO(), channelID, 0, perPage, "", false, false)
	}

	sinceTime, err := time.Parse(ISO8601Layout, since)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid since time '%s'", since)
	}

	sinceTimeMillis := model.GetMillisForTime(sinceTime)
	return client.GetPostsSince(context.TODO(), channelID, sinceTimeMillis, false)
}

func postListCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	printer.SetSingle(true)

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	number, _ := cmd.Flags().GetInt("number")
	showIds, _ := cmd.Flags().GetBool("show-ids")
	follow, _ := cmd.Flags().GetBool("follow")
	since, _ := cmd.Flags().GetString("since")

	postList, _, err := getPostList(c, channel.Id, since, number)
	if err != nil {
		return err
	}

	posts := postList.ToSlice()
	showTimestamp := since != ""
	usernames := map[string]string{}
	for i := 1; i <= len(posts); i++ {
		post := posts[len(posts)-i]
		printPost(c, post, usernames, showIds, showTimestamp)
	}

	var multiErr *multierror.Error
	if follow {
		ws, err := InitWebSocketClient()
		if err != nil {
			return err
		}

		appErr := ws.Connect()
		if appErr != nil {
			return errors.New(appErr.Error())
		}

		ws.Listen()
		for {
			event := <-ws.EventChannel
			if event.EventType() == model.WebsocketEventPosted {
				post, err := eventDataToPost(event.GetData())
				if err != nil {
					printer.PrintError("Error parsing incoming post: " + err.Error())
					multiErr = multierror.Append(multiErr, err)
				}
				if post.ChannelId == channel.Id {
					printPost(c, post, usernames, showIds, showTimestamp)
				}
			}
		}
	}
	return multiErr.ErrorOrNil()
}

func deletePostsCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	permanent, err := cmd.Flags().GetBool("permanent")
	if err != nil {
		return err
	}

	confirmFlag, _ := cmd.Flags().GetBool("confirm")
	if !confirmFlag && permanent {
		if err = getConfirmation("Are you sure you want to delete the posts specified?", true); err != nil {
			return err
		}
	}

	var result *multierror.Error
	var deleteFunc func(ctx context.Context, postID string) (*model.Response, error)

	if permanent {
		deleteFunc = c.PermanentDeletePost
	} else {
		deleteFunc = c.DeletePost
	}

	for _, postID := range args {
		isValidId := model.IsValidId(postID)
		if !isValidId {
			printer.PrintError(fmt.Sprintf("Invalid postID: %s", postID))
			result = multierror.Append(result, err)
			continue
		}
		if _, err := deleteFunc(context.TODO(), postID); err != nil {
			printer.PrintError(fmt.Sprintf("Error deleting post: %s. Error: %s", postID, err.Error()))
			result = multierror.Append(result, err)
			continue
		}
		printer.Print(fmt.Sprintf("%s successfully deleted", postID))
	}
	return result.ErrorOrNil()
}

func revealPostCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	postID := args[0]
	post, _, err := c.RevealPost(context.TODO(), postID)
	if err != nil {
		return err
	}
	printPost(c, post, map[string]string{}, false, false)
	return nil
}
