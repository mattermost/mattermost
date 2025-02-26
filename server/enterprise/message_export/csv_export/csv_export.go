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
	"slices"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	EnterPostType            = "enter"
	LeavePostType            = "leave"
	PreviouslyJoinedPostType = "previously-joined"
	CSVWarningFilename       = "warning.txt"
)

type Row struct {
	CreateAt           int64
	UpdateAt           int64
	UpdateType         shared.PostUpdatedType
	TeamId             string
	TeamName           string
	TeamDisplayName    string
	ChannelId          string
	ChannelName        string
	ChannelDisplayName string
	ChannelType        string
	UserId             string
	UserEmail          string
	Username           string
	PostId             string
	EditedByPostId     string
	RepliedToPostId    string
	PostMessage        string
	PostType           string
	UserType           string
	PreviewsPostId     string
}

func CsvExport(rctx request.CTX, p shared.ExportParams) (shared.RunExportResults, error) {
	// Build the channel exports for the channels that had post or user join/leave activity this batch.
	exportData, err := shared.GetGenericExportData(p)
	results := exportData.Results
	if err != nil {
		return results, err
	}

	totalRows := results.CreatedPosts + results.EditedOrigMsgPosts + results.DeletedPosts + results.EditedNewMsgPosts +
		results.UpdatedPosts + results.UploadedFiles + results.DeletedFiles + results.Joins
	rows := make([]Row, 0, totalRows)
	for _, channel := range exportData.Exports {
		rows = append(rows, getJoinLeavePosts(channel)...)
		for _, p := range channel.Posts {
			rows = append(rows, postToRow(p, "message", p.PostCreateAt, p.Message))
		}

		for _, u := range channel.UploadStarts {
			rows = append(rows, attachmentToRow(shared.UploadStartToExportEntry(u)))
		}
		for _, d := range channel.DeletedFiles {
			rows = append(rows, attachmentToRow(d))
		}
	}

	// We need to sort all the elements by (CreateAt, PostId) because they were added by type and by channel above.
	slices.SortStableFunc(rows, func(a, b Row) int {
		if a.CreateAt == b.CreateAt {
			return strings.Compare(a.PostId, b.PostId)
		}
		return int(a.CreateAt - b.CreateAt)
	})

	// We've got the data, now its write time:

	// Write this batch to a tmp zip, then copy the zip to the export directory.
	// Using a 2M buffer because the file backend may be s3 and this optimizes speed and
	// memory usage, see: https://github.com/mattermost/mattermost/pull/26629
	buf := make([]byte, 1024*1024*2)
	temp, err := os.CreateTemp("", "compliance-export-batch-*.zip")
	if err != nil {
		return results, fmt.Errorf("unable to create temporary CSV export file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), temp)

	zipFile := zip.NewWriter(temp)
	csvFile, err := zipFile.Create("posts.csv")
	if err != nil {
		return results, fmt.Errorf("unable to create the zip export file: %w", err)
	}
	csvWriter := csv.NewWriter(csvFile)
	err = csvWriter.Write([]string{
		"Post Creation Time",
		"Post Update Time",
		"Post Update Type",
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
		return results, fmt.Errorf("unable to add header to the CSV export: %w", err)
	}

	for _, row := range rows {
		if err = csvWriter.Write(rowToStringSlice(row)); err != nil {
			return results, fmt.Errorf("unable to export a row: %w", err)
		}
	}

	csvWriter.Flush()

	var missingFiles []string
	for _, post := range p.Posts {
		var attachments []*model.FileInfo
		attachments, err = shared.GetPostAttachments(p.Db, post)
		if err != nil {
			return results, err
		}

		for _, attachment := range attachments {
			var r io.ReadCloser
			r, err = p.FileAttachmentBackend.Reader(attachment.Path)
			if err != nil {
				missingFiles = append(missingFiles, "Warning:"+shared.MissingFileMessageDuringBackendRead+" - Post: "+*post.PostId+" - "+attachment.Path)
				rctx.Logger().Warn(shared.MissingFileMessageDuringBackendRead,
					mlog.String("post_id", *post.PostId),
					mlog.String("filename", attachment.Path),
					mlog.Err(err),
				)
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
				// s3 only errors _here_ if the object key wasn't found. So to handle that: if there is a read
				// error (even for local), let's add a warning instead of failing the export.
				// Failing the export would fail the entire export run, and every future run would also fail on
				// this non-existent file -- not good.
				missingFiles = append(missingFiles, "Warning:"+shared.MissingFileMessageDuringCopy+" - Post: "+*post.PostId+" - "+attachment.Path)
				rctx.Logger().Warn(shared.MissingFileMessageDuringCopy,
					mlog.String("post_id", *post.PostId),
					mlog.String("filename", attachment.Path),
					mlog.Err(err),
				)
			}
		}
	}

	results.NumWarnings = len(missingFiles)
	if results.NumWarnings > 0 {
		metadataFile, _ := zipFile.Create(CSVWarningFilename)
		for _, value := range missingFiles {
			_, err = metadataFile.Write([]byte(value + "\n"))
			if err != nil {
				return results, fmt.Errorf("unable to create the warning file: %w", err)
			}
		}
	}

	metadataFile, err := zipFile.Create("metadata.json")
	if err != nil {
		return results, fmt.Errorf("unable to create the zip file: %w", err)
	}
	data, err := json.MarshalIndent(exportData.Metadata, "", "  ")
	if err != nil {
		return results, fmt.Errorf("unable to convert metadata to json: %w", err)
	}
	_, err = metadataFile.Write(data)
	if err != nil {
		return results, fmt.Errorf("unable to add metadata file to the zip file: %w", err)
	}
	err = zipFile.Close()
	if err != nil {
		return results, fmt.Errorf("unable to close the zip file: %w", err)
	}

	_, err = temp.Seek(0, 0)
	if err != nil {
		return results, fmt.Errorf("unable to seek to start of export file: %w", err)
	}

	// Try to write the file without a timeout due to the potential size of the file.
	_, err = filestore.TryWriteFileContext(rctx.Context(), p.ExportBackend, temp, p.BatchPath)
	if err != nil {
		return results, fmt.Errorf("unable to write the csv file: %w", err)
	}
	return results, nil
}

func getJoinLeavePosts(channel shared.ChannelExport) []Row {
	var joinLeavePosts []Row

	for _, join := range channel.JoinEvents {
		enterMessage := fmt.Sprintf("User %s (%s) joined the channel", join.Username, join.UserEmail)
		enterPostType := EnterPostType
		if join.JoinTime <= channel.StartTime {
			enterPostType = PreviouslyJoinedPostType
			enterMessage = fmt.Sprintf("User %s (%s) was already in the channel", join.Username, join.UserEmail)
		}
		joinLeavePosts = append(
			joinLeavePosts,
			postToRow(shared.PostExport{
				MessageExport: model.MessageExport{
					TeamId:             &channel.TeamId,
					TeamName:           &channel.TeamName,
					TeamDisplayName:    &channel.TeamDisplayName,
					ChannelId:          &channel.ChannelId,
					ChannelName:        &channel.ChannelName,
					ChannelDisplayName: &channel.DisplayName,
					ChannelType:        &channel.ChannelType,
					UserId:             &join.UserId,
					UserEmail:          &join.UserEmail,
					Username:           &join.Username,
					IsBot:              join.UserType == shared.Bot,
					PostId:             model.NewPointer(""),
					PostCreateAt:       &join.JoinTime,
					PostMessage:        &enterMessage,
					PostType:           &enterPostType,
					PostOriginalId:     model.NewPointer(""),
					PostFileIds:        []string{},
				},
			}, enterPostType, &join.JoinTime, enterMessage),
		)
	}
	for _, leave := range channel.LeaveEvents {
		if leave.ClosedOut {
			// csv does not record closed-out leaves; see export_data.go for further explanation.
			continue
		}
		leaveMessage := fmt.Sprintf("User %s (%s) left the channel", leave.Username, leave.UserEmail)
		leavePostType := LeavePostType

		joinLeavePosts = append(
			joinLeavePosts,
			postToRow(shared.PostExport{
				MessageExport: model.MessageExport{
					TeamId:             &channel.TeamId,
					TeamName:           &channel.TeamName,
					TeamDisplayName:    &channel.TeamDisplayName,
					ChannelId:          &channel.ChannelId,
					ChannelName:        &channel.ChannelName,
					ChannelDisplayName: &channel.DisplayName,
					ChannelType:        &channel.ChannelType,
					UserId:             &leave.UserId,
					UserEmail:          &leave.UserEmail,
					Username:           &leave.Username,
					IsBot:              leave.UserType == shared.Bot,
					PostId:             model.NewPointer(""),
					PostCreateAt:       &leave.LeaveTime,
					PostMessage:        &leaveMessage,
					PostType:           &leavePostType,
					PostOriginalId:     model.NewPointer(""),
					PostFileIds:        []string{},
				},
			}, leavePostType, &leave.LeaveTime, leaveMessage),
		)
	}

	return joinLeavePosts
}

func postToRow(p shared.PostExport, postType string, createTime *int64, message string) Row {
	userType := "user"
	if p.IsBot {
		userType = "bot"
	}
	return Row{
		CreateAt:           model.SafeDereference(createTime),
		UpdateAt:           model.SafeDereference(p.PostUpdateAt),
		UpdateType:         p.UpdatedType,
		TeamId:             model.SafeDereference(p.TeamId),
		TeamName:           model.SafeDereference(p.TeamName),
		TeamDisplayName:    model.SafeDereference(p.TeamDisplayName),
		ChannelId:          model.SafeDereference(p.ChannelId),
		ChannelName:        model.SafeDereference(p.ChannelName),
		ChannelDisplayName: model.SafeDereference(p.ChannelDisplayName),
		ChannelType:        shared.ChannelTypeDisplayName(model.SafeDereference(p.ChannelType)),
		UserId:             model.SafeDereference(p.UserId),
		UserEmail:          model.SafeDereference(p.UserEmail),
		Username:           model.SafeDereference(p.Username),
		PostId:             model.SafeDereference(p.PostId),
		EditedByPostId:     p.EditedNewMsgId,
		RepliedToPostId:    model.SafeDereference(p.PostRootId),
		PostMessage:        message,
		PostType:           postType,
		UserType:           userType,
		PreviewsPostId:     p.PreviewID(),
	}
}

func rowToStringSlice(r Row) []string {
	return []string{
		strconv.FormatInt(r.CreateAt, 10),
		strconv.FormatInt(r.UpdateAt, 10),
		string(r.UpdateType),
		r.TeamId,
		r.TeamName,
		r.TeamDisplayName,
		r.ChannelId,
		r.ChannelName,
		r.ChannelDisplayName,
		r.ChannelType,
		r.UserId,
		r.UserEmail,
		r.Username,
		r.PostId,
		r.EditedByPostId,
		r.RepliedToPostId,
		r.PostMessage,
		r.PostType,
		r.UserType,
		r.PreviewsPostId,
	}
}

func attachmentToRow(post shared.PostExport) Row {
	message := strings.TrimSpace(fmt.Sprintf("%s (files/%s/%s-%s)", post.FileInfo.Name, *post.PostId, post.FileInfo.Id, path.Base(post.FileInfo.Path)))
	postType := "attachment"
	if post.UpdatedType == shared.FileDeleted {
		postType = "deleted attachment"
		post.PostUpdateAt = model.NewPointer(post.FileInfo.DeleteAt)
	}

	return postToRow(post, postType, post.PostCreateAt, message)
}
