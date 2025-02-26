// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"

	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/client"
	"github.com/mattermost/mattermost/server/v8/cmd/mmctl/printer"

	"github.com/hashicorp/go-multierror"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var PostCmd = &cobra.Command{
	Use:   "post",
	Short: "Management of posts",
}

var PostCreateCmd = &cobra.Command{
	Use:     "create",
	Short:   "Create a post",
	Example: `  post create myteam:mychannel --message "some text for the post"`,
	Args:    cobra.ExactArgs(1),
	RunE:    withClient(postCreateCmdF),
}

var PostListCmd = &cobra.Command{
	Use:   "list",
	Short: "List posts for a channel",
	Example: `  post list myteam:mychannel
  post list myteam:mychannel --number 20`,
	Args: cobra.ExactArgs(1),
	RunE: withClient(postListCmdF),
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
)

func init() {
	PostCreateCmd.Flags().StringP("message", "m", "", "Message for the post")
	PostCreateCmd.Flags().StringP("reply-to", "r", "", "Post id to reply to")

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
	)

	RootCmd.AddCommand(PostCmd)
}

func postCreateCmdF(c client.Client, cmd *cobra.Command, args []string) error {
	message, _ := cmd.Flags().GetString("message")
	if message == "" {
		return errors.New("message cannot be empty")
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

	channel := getChannelFromChannelArg(c, args[0])
	if channel == nil {
		return errors.New("Unable to find channel '" + args[0] + "'")
	}

	post := &model.Post{
		ChannelId: channel.Id,
		Message:   message,
		RootId:    replyTo,
	}

	url := "/posts" + "?set_online=false"
	data, err := post.ToJSON()
	if err != nil {
		return fmt.Errorf("could not decode post: %w", err)
	}

	if _, err := c.DoAPIPost(context.TODO(), url, data); err != nil {
		return fmt.Errorf("could not create post: %s", err.Error())
	}
	return nil
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

	if showTimestamp {
		printer.PrintT(fmt.Sprintf("\u001b[32m%s\u001b[0m \u001b[34;1m[%s]\u001b[0m {{.Message}}", createdAt, username), post)
	} else {
		if showIds {
			printer.PrintT(fmt.Sprintf("\u001b[31m%s\u001b[0m \u001b[34;1m[%s]\u001b[0m {{.Message}}", post.Id, username), post)
		} else {
			printer.PrintT(fmt.Sprintf("\u001b[34;1m[%s]\u001b[0m {{.Message}}", username), post)
		}
	}
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
