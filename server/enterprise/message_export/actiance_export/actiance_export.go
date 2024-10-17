// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package actiance_export

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"

	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const (
	XMLNS                   = "http://www.w3.org/2001/XMLSchema-instance"
	ActianceExportFilename  = "actiance_export.xml"
	ActianceWarningFilename = "warning.txt"
)

// The root-level element of an actiance export
type RootNode struct {
	XMLName  xml.Name        `xml:"FileDump"`
	XMLNS    string          `xml:"xmlns:xsi,attr"` // this should default to "http://www.w3.org/2001/XMLSchema-instance"
	Channels []ChannelExport // one element per channel (open or invite-only), group message, or direct message
}

// The Conversation element indicates an ad hoc IM conversation or a group chat room.
// The messages from a persistent chat room are exported once a day so that a Conversation entry contains the messages posted to a chat room from 12:00:00 AM to 11:59:59 PM
type ChannelExport struct {
	XMLName      xml.Name     `xml:"Conversation"`
	Perspective  string       `xml:"Perspective,attr"` // the value of this attribute doesn't seem to matter. Using the channel name makes the export more human readable
	ChannelId    string       `xml:"-"`                // the unique id of the channel
	RoomId       string       `xml:"RoomID"`
	StartTime    int64        `xml:"StartTimeUTC"` // utc timestamp (seconds), start of export period or create time of channel, whichever is greater. Example: 1366611728.
	JoinEvents   []JoinExport // start with a list of all users who were present in the channel during the export period
	Elements     []any
	UploadStarts []*FileUploadStartExport
	UploadStops  []*FileUploadStopExport
	LeaveEvents  []LeaveExport // finish with a list of all users who were present in the channel during the export period
	EndTime      int64         `xml:"EndTimeUTC"` // utc timestamp (seconds), end of export period or delete time of channel, whichever is lesser. Example: 1366611728.
}

// The ParticipantEntered element indicates each user who participates in a conversation.
// For chat rooms, there must be one ParticipantEntered element for each user present in the chat room at the beginning of the reporting period
type JoinExport struct {
	XMLName          xml.Name `xml:"ParticipantEntered"`
	UserEmail        string   `xml:"LoginName"`   // the email of the person that joined the channel
	UserType         string   `xml:"UserType"`    // the type of the user that joined the channel
	JoinTime         int64    `xml:"DateTimeUTC"` // utc timestamp (seconds), time at which the user joined. Example: 1366611728
	CorporateEmailID string   `xml:"CorporateEmailID"`
}

// The ParticipantLeft element indicates the user who leaves an active IM or chat room conversation.
// For chat rooms, there must be one ParticipantLeft element for each user present in the chat room at the end of the reporting period.
type LeaveExport struct {
	XMLName          xml.Name `xml:"ParticipantLeft"`
	UserEmail        string   `xml:"LoginName"`   // the email of the person that left the channel
	UserType         string   `xml:"UserType"`    // the type of the user that left the channel
	LeaveTime        int64    `xml:"DateTimeUTC"` // utc timestamp (seconds), time at which the user left. Example: 1366611728
	CorporateEmailID string   `xml:"CorporateEmailID"`
}

// The Message element indicates the message sent by a user
type PostExport struct {
	XMLName      xml.Name `xml:"Message"`
	UserEmail    string   `xml:"LoginName"`    // the email of the person that sent the post
	UserType     string   `xml:"UserType"`     // the type of the person that sent the post
	PostTime     int64    `xml:"DateTimeUTC"`  // utc timestamp (seconds), time at which the user sent the post. Example: 1366611728
	Message      string   `xml:"Content"`      // the text body of the post
	PreviewsPost string   `xml:"PreviewsPost"` // the post id of the post that is previewed by the permalink preview feature
}

// The FileTransferStarted element indicates the beginning of a file transfer in a conversation
type FileUploadStartExport struct {
	XMLName         xml.Name `xml:"FileTransferStarted"`
	UserEmail       string   `xml:"LoginName"`    // the email of the person that sent the file
	UploadStartTime int64    `xml:"DateTimeUTC"`  // utc timestamp (seconds), time at which the user started the upload. Example: 1366611728
	Filename        string   `xml:"UserFileName"` // the name of the file that was uploaded
	FilePath        string   `xml:"FileName"`     // the path to the file, as stored on the server
}

// The FileTransferEnded element indicates the end of a file transfer in a conversation
type FileUploadStopExport struct {
	XMLName        xml.Name `xml:"FileTransferEnded"`
	UserEmail      string   `xml:"LoginName"`    // the email of the person that sent the file
	UploadStopTime int64    `xml:"DateTimeUTC"`  // utc timestamp (seconds), time at which the user finished the upload. Example: 1366611728
	Filename       string   `xml:"UserFileName"` // the name of the file that was uploaded
	FilePath       string   `xml:"FileName"`     // the path to the file, as stored on the server
	Status         string   `xml:"Status"`       // set to either "Completed" or "Failed" depending on the outcome of the upload operation
}

type Params struct {
	ChannelMetadata        map[string]*shared.MetadataChannel
	Posts                  []*model.MessageExport
	ChannelMemberHistories map[string][]*model.ChannelMemberHistoryResult
	BatchPath              string
	BatchStartTime         int64
	BatchEndTime           int64
	Db                     store.Store
	FileAttachmentBackend  filestore.FileBackend
	ExportBackend          filestore.FileBackend
}

func ActianceExport(rctx request.CTX, p Params) (shared.RunExportResults, error) {
	// postAuthorsByChannel is a map so that we don't store duplicate authors
	postAuthorsByChannel := make(map[string]map[string]shared.ChannelMember)
	metadata := shared.Metadata{
		Channels:         p.ChannelMetadata,
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        0,
		EndTime:          0,
	}
	elementsByChannel := make(map[string][]any)
	allUploadedFiles := make([]*model.FileInfo, 0)
	channelsInThisBatch := make(map[string]bool)
	results := shared.RunExportResults{}

	for _, post := range p.Posts {
		if post == nil {
			results.IgnoredPosts++
			rctx.Logger().Warn("ignored a nil post reference in the list")
			continue
		}

		isDeleted := false
		channelId := *post.ChannelId
		channelsInThisBatch[channelId] = true

		elementsByChannel[channelId] = append(elementsByChannel[channelId], postToExportEntry(post, post.PostCreateAt, *post.PostMessage))

		if post.PostDeleteAt != nil && *post.PostDeleteAt > 0 && post.PostProps != nil {
			props := make(map[string]any)
			if json.Unmarshal([]byte(*post.PostProps), &props) == nil {
				if _, ok := props[model.PostPropsDeleteBy]; ok {
					isDeleted = true
					elementsByChannel[channelId] = append(elementsByChannel[channelId], postToExportEntry(post,
						post.PostDeleteAt, "delete "+*post.PostMessage))
				}
			}
		}

		startUploads, stopUploads, uploadedFiles, deleteFileMessages, err := postToAttachmentsEntries(post, p.Db)
		if err != nil {
			return results, err
		}
		elementsByChannel[channelId] = append(elementsByChannel[channelId], startUploads...)
		elementsByChannel[channelId] = append(elementsByChannel[channelId], stopUploads...)
		elementsByChannel[channelId] = append(elementsByChannel[channelId], deleteFileMessages...)

		allUploadedFiles = append(allUploadedFiles, uploadedFiles...)

		if err := metadata.UpdateCounts(channelId, 1, len(uploadedFiles)); err != nil {
			return results, err
		}

		if _, ok := postAuthorsByChannel[channelId]; !ok {
			postAuthorsByChannel[channelId] = make(map[string]shared.ChannelMember)
		}
		postAuthorsByChannel[channelId][*post.UserId] = shared.ChannelMember{
			Email:    *post.UserEmail,
			UserId:   *post.UserId,
			IsBot:    post.IsBot,
			Username: *post.Username,
		}

		if isDeleted {
			results.DeletedPosts++
		} else if *post.PostUpdateAt > *post.PostCreateAt {
			results.UpdatedPosts++
		} else {
			results.CreatedPosts++
		}
	}

	// If the channel is not in channelsInThisBatch (i.e. if it didn't have a post), we need to check if it had
	// user activity between this batch's startTime-endTime. If so, add it to the channelsInThisBatch.
	for id := range p.ChannelMetadata {
		if !channelsInThisBatch[id] {
			if channelHasActivity(p.ChannelMemberHistories[id], p.BatchStartTime, p.BatchEndTime) {
				channelsInThisBatch[id] = true
			}
		}
	}

	// Build the channel exports for the channels that had post or user join/leave activity this batch.
	channelExports := make([]ChannelExport, 0, len(channelsInThisBatch))
	for id := range channelsInThisBatch {
		channelExport := buildChannelExport(
			p.BatchStartTime,
			p.BatchEndTime,
			metadata.Channels[id],
			p.ChannelMemberHistories[id],
			postAuthorsByChannel[id],
		)
		channelExport.Elements = elementsByChannel[id]
		channelExports = append(channelExports, *channelExport)
	}

	export := &RootNode{
		XMLNS:    XMLNS,
		Channels: channelExports,
	}

	var err error
	results.NumWarnings, err = writeExport(rctx, export, allUploadedFiles, p.ExportBackend, p.FileAttachmentBackend, p.BatchPath)
	results.NumChannels = len(channelsInThisBatch)
	return results, err
}

func channelHasActivity(cmhs []*model.ChannelMemberHistoryResult, startTime int64, endTime int64) bool {
	for _, cmh := range cmhs {
		if (cmh.JoinTime >= startTime && cmh.JoinTime <= endTime) ||
			(cmh.LeaveTime != nil && *cmh.LeaveTime >= startTime && *cmh.LeaveTime <= endTime) {
			return true
		}
	}
	return false
}

func postToExportEntry(post *model.MessageExport, createTime *int64, message string) *PostExport {
	userType := "user"
	if post.IsBot {
		userType = "bot"
	}
	return &PostExport{
		PostTime:     *createTime,
		Message:      message,
		UserType:     userType,
		UserEmail:    *post.UserEmail,
		PreviewsPost: post.PreviewID(),
	}
}

func postToAttachmentsEntries(post *model.MessageExport, db store.Store) ([]any, []any, []*model.FileInfo, []any, error) {
	// if the post included any files, we need to add special elements to the export.
	if len(post.PostFileIds) == 0 {
		return nil, nil, nil, nil, nil
	}

	fileInfos, err := db.FileInfo().GetForPost(*post.PostId, true, true, false)
	if err != nil {
		return nil, nil, nil, nil, err
	}

	var startUploads []any
	var stopUploads []any
	var deleteFileMessages []any

	var uploadedFiles []*model.FileInfo
	for _, fileInfo := range fileInfos {
		// insert a record of the file upload into the export file
		// path to exported file is relative to the xml file, so it's just the name of the exported file
		startUploads = append(startUploads, &FileUploadStartExport{
			UserEmail:       *post.UserEmail,
			Filename:        fileInfo.Name,
			FilePath:        fileInfo.Path,
			UploadStartTime: *post.PostCreateAt,
		})

		stopUploads = append(stopUploads, &FileUploadStopExport{
			UserEmail:      *post.UserEmail,
			Filename:       fileInfo.Name,
			FilePath:       fileInfo.Path,
			UploadStopTime: *post.PostCreateAt,
			Status:         "Completed",
		})

		if fileInfo.DeleteAt > 0 && post.PostDeleteAt != nil {
			deleteFileMessages = append(deleteFileMessages, postToExportEntry(post, post.PostDeleteAt, "delete "+fileInfo.Path))
		}

		uploadedFiles = append(uploadedFiles, fileInfo)
	}
	return startUploads, stopUploads, uploadedFiles, deleteFileMessages, nil
}

func buildChannelExport(startTime int64, endTime int64, channel *shared.MetadataChannel,
	channelMembersHistory []*model.ChannelMemberHistoryResult, postAuthors map[string]shared.ChannelMember) *ChannelExport {
	channelExport := ChannelExport{
		ChannelId:   channel.ChannelId,
		RoomId:      fmt.Sprintf("%v - %v - %v", shared.ChannelTypeDisplayName(channel.ChannelType), channel.ChannelName, channel.ChannelId),
		StartTime:   startTime,
		EndTime:     endTime,
		Perspective: channel.ChannelDisplayName,
	}

	joins, leaves := shared.GetJoinsAndLeavesForChannel(startTime, endTime, channelMembersHistory, postAuthors)
	type StillJoinedInfo struct {
		Time int64
		Type string
	}
	stillJoined := map[string]StillJoinedInfo{}
	for _, join := range joins {
		userType := "user"
		if join.IsBot {
			userType = "bot"
		}
		channelExport.JoinEvents = append(channelExport.JoinEvents, JoinExport{
			JoinTime:         join.Datetime,
			UserEmail:        join.Email,
			UserType:         userType,
			CorporateEmailID: join.Email,
		})
		if value, ok := stillJoined[join.Email]; !ok {
			stillJoined[join.Email] = StillJoinedInfo{Time: join.Datetime, Type: userType}
		} else {
			if join.Datetime > value.Time {
				stillJoined[join.Email] = StillJoinedInfo{Time: join.Datetime, Type: userType}
			}
		}
	}
	for _, leave := range leaves {
		userType := "user"
		if leave.IsBot {
			userType = "bot"
		}
		channelExport.LeaveEvents = append(channelExport.LeaveEvents, LeaveExport{
			LeaveTime:        leave.Datetime,
			UserEmail:        leave.Email,
			UserType:         userType,
			CorporateEmailID: leave.Email,
		})
		if leave.Datetime > stillJoined[leave.Email].Time {
			delete(stillJoined, leave.Email)
		}
	}

	for email := range stillJoined {
		channelExport.LeaveEvents = append(channelExport.LeaveEvents, LeaveExport{
			LeaveTime:        endTime,
			UserEmail:        email,
			UserType:         stillJoined[email].Type,
			CorporateEmailID: email,
		})
	}

	sort.Slice(channelExport.JoinEvents, func(i, j int) bool {
		if channelExport.JoinEvents[i].JoinTime == channelExport.JoinEvents[j].JoinTime {
			return channelExport.JoinEvents[i].UserEmail < channelExport.JoinEvents[j].UserEmail
		}
		return channelExport.JoinEvents[i].JoinTime < channelExport.JoinEvents[j].JoinTime
	})

	sort.Slice(channelExport.LeaveEvents, func(i, j int) bool {
		if channelExport.LeaveEvents[i].LeaveTime == channelExport.LeaveEvents[j].LeaveTime {
			return channelExport.LeaveEvents[i].UserEmail < channelExport.LeaveEvents[j].UserEmail
		}
		return channelExport.LeaveEvents[i].LeaveTime < channelExport.LeaveEvents[j].LeaveTime
	})

	return &channelExport
}

func writeExport(rctx request.CTX, export *RootNode, uploadedFiles []*model.FileInfo, exportBackend filestore.FileBackend, fileAttachmentBackend filestore.FileBackend, batchPath string) (int, error) {
	// marshal the export object to xml
	xmlData := &bytes.Buffer{}
	xmlData.WriteString(xml.Header)

	enc := xml.NewEncoder(xmlData)
	enc.Indent("", "  ")
	if err := enc.Encode(export); err != nil {
		return 0, fmt.Errorf("unable to convert export to XML: %w", err)
	}
	if err := enc.Flush(); err != nil {
		return 0, fmt.Errorf("unable to flush the XML encoder: %w", err)
	}

	// Write this batch to a tmp zip, then copy the zip to the export directory.
	// Using a 2M buffer because the file backend may be s3 and this optimizes speed and
	// memory usage, see: https://github.com/mattermost/mattermost/pull/26629
	buf := make([]byte, 1024*1024*2)
	temp, err := os.CreateTemp("", "compliance-export-batch-*.zip")
	if err != nil {
		return 0, fmt.Errorf("unable to create the batch temporary file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), temp)

	zipFile := zip.NewWriter(temp)
	w, err := zipFile.Create(ActianceExportFilename)
	if err != nil {
		return 0, fmt.Errorf("unable to create the xml file in the zipFile created with the batch temporary file: %w", err)
	}
	if _, err = io.CopyBuffer(w, xmlData, buf); err != nil {
		return 0, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
	}

	var missingFiles []string
	for _, fileInfo := range uploadedFiles {
		var attachmentReader io.ReadCloser
		attachmentReader, err = fileAttachmentBackend.Reader(fileInfo.Path)
		if err != nil {
			missingFiles = append(missingFiles, "Warning:"+shared.MissingFileMessage+" - "+fileInfo.Path)
			rctx.Logger().Warn(shared.MissingFileMessage, mlog.String("filename", fileInfo.Path))
			continue
		}

		// There could be many uploadedFiles, so be careful about closing readers.
		if err = func() error {
			defer attachmentReader.Close()
			var zipWriter io.Writer
			zipWriter, err = zipFile.Create(fileInfo.Path)
			if err != nil {
				return err
			}

			// CopyBuffer works with dirty buffers, no need to clear it.
			if _, err = io.CopyBuffer(zipWriter, attachmentReader, buf); err != nil {
				return err
			}

			return nil
		}(); err != nil {
			return 0, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
		}
	}

	warningCount := len(missingFiles)
	if warningCount > 0 {
		var w io.Writer
		w, err = zipFile.Create(ActianceWarningFilename)
		if err != nil {
			return warningCount, fmt.Errorf("unable to create the warning file in the zipFile created with the batch temporary file: %w", err)
		}
		r := strings.NewReader(strings.Join(missingFiles, "\n"))
		if _, err = io.CopyBuffer(w, r, buf); err != nil {
			return warningCount, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
		}
	}

	if err = zipFile.Close(); err != nil {
		return warningCount, fmt.Errorf("unable to close the zipFile created with the batch temporary file: %w", err)
	}

	_, err = temp.Seek(0, io.SeekStart)
	if err != nil {
		return warningCount, fmt.Errorf("unable to seek to the beginning of the the batch temporary file: %w", err)
	}

	// Try to write the file without a timeout due to the potential size of the file.
	_, err = filestore.TryWriteFileContext(rctx.Context(), exportBackend, temp, batchPath)
	if err != nil {
		return warningCount, fmt.Errorf("unable to transfer the batch zip to the file backend: %w", err)
	}

	return warningCount, nil
}
