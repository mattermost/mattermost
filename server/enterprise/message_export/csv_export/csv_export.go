// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package csv_export

import (
	"archive/zip"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path"
	"sort"
	"strconv"

	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	EnterPostType            = "enter"
	LeavePostType            = "leave"
	PreviouslyJoinedPostType = "previously-joined"
	CSVWarningFilename       = "warning.txt"
)

func CsvExport(rctx request.CTX, posts []*model.MessageExport, db store.Store, fileBackend filestore.FileBackend, batchPath string) (warningCount int, err error) {
	// Write this batch to a tmp zip, then copy the zip to the export directory.
	// Using a 2M buffer because the file backend may be s3 and this optimizes speed and
	// memory usage, see: https://github.com/mattermost/mattermost/pull/26629
	buf := make([]byte, 1024*1024*2)
	temp, err := os.CreateTemp("", "compliance-export-batch-*.zip")
	if err != nil {
		return warningCount, fmt.Errorf("unable to create temporary CSV export file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), temp)

	zipFile := zip.NewWriter(temp)
	csvFile, err := zipFile.Create("posts.csv")
	if err != nil {
		return warningCount, fmt.Errorf("unable to create the zip export file: %w", err)
	}
	csvWriter := csv.NewWriter(csvFile)
	err = csvWriter.Write([]string{
		"Post Creation Time",
		"Team Id",
		"Team Name",
		"Team Display Name",
		"Channel Id",
		"Channel Name",
		"Channel Display Name",
		"Channel Type",
		"User Id",
		"User Email",
		"Username",
		"Post Id",
		"Edited By Post Id",
		"Replied to Post Id",
		"Post Message",
		"Post Type",
		"User Type",
		"Previews Post Id",
	})

	if err != nil {
		return warningCount, fmt.Errorf("unable to add header to the CSV export: %w", err)
	}

	metadata := shared.Metadata{
		Channels:         map[string]*shared.MetadataChannel{},
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        0,
		EndTime:          0,
	}

	postAuthorsByChannel := make(map[string]map[string]shared.ChannelMember)

	for _, post := range posts {
		var attachments []*model.FileInfo
		attachments, err = getPostAttachments(db, post)
		if err != nil {
			return warningCount, err
		}

		if _, ok := postAuthorsByChannel[*post.ChannelId]; !ok {
			postAuthorsByChannel[*post.ChannelId] = make(map[string]shared.ChannelMember)
		}

		postAuthorsByChannel[*post.ChannelId][*post.UserId] = shared.ChannelMember{
			UserId:   *post.UserId,
			Username: *post.Username,
			IsBot:    post.IsBot,
			Email:    *post.UserEmail,
		}

		metadata.Update(post, len(attachments))
	}

	var joinLeavePosts []*model.MessageExport
	joinLeavePosts, err = getJoinLeavePosts(metadata.Channels, postAuthorsByChannel, db)
	if err != nil {
		return warningCount, err
	}

	postsGenerator := mergePosts(joinLeavePosts, posts)

	for post := postsGenerator(); post != nil; post = postsGenerator() {
		if err = csvWriter.Write(postToRow(post, post.PostCreateAt, *post.PostMessage)); err != nil {
			return warningCount, fmt.Errorf("unable to export a post: %w", err)
		}

		if post.PostDeleteAt != nil && *post.PostDeleteAt > 0 && post.PostProps != nil {
			props := map[string]any{}
			if json.Unmarshal([]byte(*post.PostProps), &props) == nil {
				if _, ok := props[model.PostPropsDeleteBy]; ok {
					if err = csvWriter.Write(postToRow(post, post.PostDeleteAt, "delete "+*post.PostMessage)); err != nil {
						return warningCount, fmt.Errorf("unable to export a post: %w", err)
					}
				}
			}
		}

		var attachments []*model.FileInfo
		attachments, err = getPostAttachments(db, post)
		if err != nil {
			return warningCount, err
		}

		for _, attachment := range attachments {
			if err = csvWriter.Write(attachmentToRow(post, attachment)); err != nil {
				return warningCount, fmt.Errorf("unable to add attachment to the CSV export: %w", err)
			}
		}
	}

	csvWriter.Flush()

	var missingFiles []string
	for _, post := range posts {
		var attachments []*model.FileInfo
		attachments, err = getPostAttachments(db, post)
		if err != nil {
			return warningCount, err
		}

		for _, attachment := range attachments {
			var r io.ReadCloser
			r, nErr := fileBackend.Reader(attachment.Path)
			if nErr != nil {
				missingFiles = append(missingFiles, "Warning:"+shared.MissingFileMessage+" - Post: "+*post.PostId+" - "+attachment.Path)
				rctx.Logger().Warn(shared.MissingFileMessage, mlog.String("post_id", *post.PostId), mlog.String("filename", attachment.Path))
				continue
			}

			// Probably don't need to be this careful (see actiance_export.go), but may as well be consistent.
			if err = func() error {
				defer r.Close()
				var attachmentDst io.Writer
				attachmentDst, err = zipFile.Create(path.Join("files", *post.PostId, fmt.Sprintf("%s-%s", attachment.Id, path.Base(attachment.Path))))
				if err != nil {
					return err
				}

				_, err = io.CopyBuffer(attachmentDst, r, buf)
				if err != nil {
					return err
				}

				return nil
			}(); err != nil {
				return warningCount, fmt.Errorf("unable to copy the attachment into the zip file: %w", err)
			}
		}
	}

	warningCount = len(missingFiles)
	if warningCount > 0 {
		metadataFile, _ := zipFile.Create(CSVWarningFilename)
		for _, value := range missingFiles {
			_, err = metadataFile.Write([]byte(value + "\n"))
			if err != nil {
				return warningCount, fmt.Errorf("unable to create the warning file: %w", err)
			}
		}
	}

	metadataFile, err := zipFile.Create("metadata.json")
	if err != nil {
		return warningCount, fmt.Errorf("unable to create the zip file: %w", err)
	}
	data, err := json.MarshalIndent(metadata, "", "  ")
	if err != nil {
		return warningCount, fmt.Errorf("unable to convert metadata to json: %w", err)
	}
	_, err = metadataFile.Write(data)
	if err != nil {
		return warningCount, fmt.Errorf("unable to add metadata file to the zip file: %w", err)
	}
	err = zipFile.Close()
	if err != nil {
		return warningCount, fmt.Errorf("unable to close the zip file: %w", err)
	}

	_, err = temp.Seek(0, 0)
	if err != nil {
		return warningCount, fmt.Errorf("unable to seek to start of export file: %w", err)
	}

	// Try to write the file without a timeout due to the potential size of the file.
	_, err = filestore.TryWriteFileContext(rctx.Context(), fileBackend, temp, batchPath)
	if err != nil {
		return warningCount, fmt.Errorf("unable to write the csv file: %w", err)
	}
	return warningCount, nil
}

func mergePosts(left []*model.MessageExport, right []*model.MessageExport) func() *model.MessageExport {
	leftCursor := 0
	rightCursor := 0
	return func() *model.MessageExport {
		if leftCursor >= len(left) && rightCursor >= len(right) {
			return nil
		}

		if leftCursor >= len(left) {
			rightCursor += 1
			return right[rightCursor-1]
		}

		if rightCursor >= len(right) {
			leftCursor += 1
			return left[leftCursor-1]
		}

		if *left[leftCursor].PostCreateAt <= *right[rightCursor].PostCreateAt {
			leftCursor += 1
			return left[leftCursor-1]
		}

		rightCursor += 1
		return right[rightCursor-1]
	}
}

func getJoinLeavePosts(channels map[string]*shared.MetadataChannel,
	postAuthorsByChannel map[string]map[string]shared.ChannelMember, db store.Store) ([]*model.MessageExport, error) {
	joinLeavePosts := []*model.MessageExport{}
	for _, channel := range channels {
		channelMembersHistory, err := db.ChannelMemberHistory().GetUsersInChannelDuring(channel.StartTime, channel.EndTime, []string{channel.ChannelId})
		if err != nil {
			return nil, fmt.Errorf("failed to get users in channel during specified time period: %w", err)
		}

		joins, leaves := shared.GetJoinsAndLeavesForChannel(channel.StartTime, channel.EndTime, channelMembersHistory, postAuthorsByChannel[channel.ChannelId])

		for _, join := range joins {
			enterMessage := fmt.Sprintf("User %s (%s) joined the channel", join.Username, join.Email)
			enterPostType := EnterPostType
			createAt := model.NewPointer(join.Datetime)
			channelCopy := channel
			if join.Datetime <= channel.StartTime {
				enterPostType = PreviouslyJoinedPostType
				enterMessage = fmt.Sprintf("User %s (%s) was already in the channel", join.Username, join.Email)
				createAt = model.NewPointer(channel.StartTime)
			}
			joinLeavePosts = append(
				joinLeavePosts,
				&model.MessageExport{
					TeamId:          channel.TeamId,
					TeamName:        channel.TeamName,
					TeamDisplayName: channel.TeamDisplayName,

					ChannelId:          &channelCopy.ChannelId,
					ChannelName:        &channelCopy.ChannelName,
					ChannelDisplayName: &channelCopy.ChannelDisplayName,
					ChannelType:        &channelCopy.ChannelType,

					UserId:    model.NewPointer(join.UserId),
					UserEmail: model.NewPointer(join.Email),
					Username:  model.NewPointer(join.Username),
					IsBot:     join.IsBot,

					PostId:         model.NewPointer(""),
					PostCreateAt:   createAt,
					PostMessage:    &enterMessage,
					PostType:       &enterPostType,
					PostOriginalId: model.NewPointer(""),
					PostFileIds:    []string{},
				},
			)
		}
		for _, leave := range leaves {
			leaveMessage := fmt.Sprintf("User %s (%s) leaved the channel", leave.Username, leave.Email)
			leavePostType := LeavePostType
			channelCopy := channel

			joinLeavePosts = append(
				joinLeavePosts,
				&model.MessageExport{
					TeamId:          channel.TeamId,
					TeamName:        channel.TeamName,
					TeamDisplayName: channel.TeamDisplayName,

					ChannelId:          &channelCopy.ChannelId,
					ChannelName:        &channelCopy.ChannelName,
					ChannelDisplayName: &channelCopy.ChannelDisplayName,
					ChannelType:        &channelCopy.ChannelType,

					UserId:    model.NewPointer(leave.UserId),
					UserEmail: model.NewPointer(leave.Email),
					Username:  model.NewPointer(leave.Username),
					IsBot:     leave.IsBot,

					PostId:         model.NewPointer(""),
					PostCreateAt:   model.NewPointer(leave.Datetime),
					PostMessage:    &leaveMessage,
					PostType:       &leavePostType,
					PostOriginalId: model.NewPointer(""),
					PostFileIds:    []string{},
				},
			)
		}
	}

	sort.Slice(joinLeavePosts, func(i, j int) bool {
		return *joinLeavePosts[i].PostCreateAt < *joinLeavePosts[j].PostCreateAt
	})
	return joinLeavePosts, nil
}

func getPostAttachments(db store.Store, post *model.MessageExport) ([]*model.FileInfo, error) {
	// if the post included any files, we need to add special elements to the export.
	if len(post.PostFileIds) == 0 {
		return []*model.FileInfo{}, nil
	}

	attachments, err := db.FileInfo().GetForPost(*post.PostId, true, true, false)
	if err != nil {
		return nil, fmt.Errorf("failed to get file info for a post: %w", err)
	}
	return attachments, nil
}

func postToRow(post *model.MessageExport, createTime *int64, message string) []string {
	teamId := ""
	teamName := ""
	teamDisplayName := ""
	if post.TeamId != nil {
		teamId = *post.TeamId
	}
	if post.TeamName != nil {
		teamName = *post.TeamName
	}
	if post.TeamDisplayName != nil {
		teamDisplayName = *post.TeamDisplayName
	}
	postType := "message"
	if post.PostType != nil && *post.PostType != "" {
		postType = *post.PostType
	}
	postRootId := ""
	if post.PostRootId != nil {
		postRootId = *post.PostRootId
	}
	userType := "user"
	if post.IsBot {
		userType = "bot"
	}

	return []string{
		strconv.FormatInt(*createTime, 10),
		teamId,
		teamName,
		teamDisplayName,
		*post.ChannelId,
		*post.ChannelName,
		*post.ChannelDisplayName,
		shared.ChannelTypeDisplayName(*post.ChannelType),
		*post.UserId,
		*post.UserEmail,
		*post.Username,
		*post.PostId,
		*post.PostOriginalId,
		postRootId,
		message,
		postType,
		userType,
		post.PreviewID(),
	}
}

func attachmentToRow(post *model.MessageExport, attachment *model.FileInfo) []string {
	row := postToRow(post, post.PostCreateAt, *post.PostMessage)

	attachmentEntry := fmt.Sprintf("%s (files/%s/%s-%s)", attachment.Name, *post.PostId, attachment.Id, path.Base(attachment.Path))
	attachmentMessage := "attachment"
	userType := row[len(row)-2]

	if attachment.DeleteAt > 0 && post.PostDeleteAt != nil {
		deleteRow := postToRow(post, post.PostDeleteAt, *post.PostMessage)
		row = append(
			deleteRow[:len(deleteRow)-4],
			attachmentEntry,
			"deleted "+attachmentMessage,
			userType,
		)
	} else {
		row = append(
			row[:len(row)-4],
			attachmentEntry,
			attachmentMessage,
			userType,
		)
	}
	return row
}
