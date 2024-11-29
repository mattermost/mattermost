// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package actiance_export

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/common_export"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
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
	XMLName   xml.Name       `xml:"Message"`
	MessageId string         `xml:"MessageId"`   // the message id in the db
	UserEmail string         `xml:"LoginName"`   // the email of the person that sent the post
	UserType  exportUserType `xml:"UserType"`    // the type of the person that sent the post: "user" or "bot"
	CreateAt  int64          `xml:"DateTimeUTC"` // utc timestamp (unix milliseconds), the post's createAt

	// Allows us to differentiate between:
	// - "EditedOriginalMsg": the newly created message (new Id), which holds the pre-edited message contents. The
	//    "EditedNewMsgId" field will point to the message (original Id) which has the post-edited message content.
	// - "EditedNewMsg": the post-edited message content. This is confusing, so be careful: in the db, this EditedNewMsg
	//    is actually the original messageId because we wanted an edited message to have the same messageId as the
	//    pre-edited message. But for the purposes of exporting and to keep the mental model clear for end-users, we are
	//    calling this the EditedNewMsg and EditedNewMsgId, because this will hold the NEW post-edited message contents,
	//    and that's what's important to the end-user viewing the export.
	//  - "UpdatedNoMsgChange": the message content hasn't changed, but the post was updated for some reason (reaction,
	//	  replied-to, a reply was edited, a reply was deleted (as of 10.2), perhaps other reasons)
	//  - "Deleted": the message was deleted.
	//  - "FileDeleted": this message is recording that a file was deleted.
	UpdatedType shared.PostUpdatedType `xml:"UpdatedType,omitempty"`
	UpdateAt    int64                  `xml:"UpdatedDateTimeUTC,omitempty"` // if this is an updated post, this is the updated time (same as deleted time for deleted posts).

	// when a message is edited, the EditedOriginalMsg points to the message Id that now has the newly edited message.
	EditedNewMsgId string `xml:"EditedNewMsgId,omitempty"`

	Message      string `xml:"Content"`                // the text body of the post
	PreviewsPost string `xml:"PreviewsPost,omitempty"` // the post id of the post that is previewed by the permalink preview feature
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

func ActianceExport(rctx request.CTX, p shared.ExportParams) (shared.RunExportResults, error) {
	start := time.Now()

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

	for i, post := range p.Posts {
		channelId := *post.ChannelId
		channelsInThisBatch[channelId] = true

		// Was the post deleted (not an edited post), and originally posted during the current job window?
		// If so, we need to record it. It may actually belong in an earlier batch, but there's no way to know that
		// before now because of the way we export posts (by updateAt).
		if common_export.IsDeletedMsg(post) && !isEditedOriginalMsg(post) && *post.PostCreateAt >= p.JobStartTime {
			results.CreatedPosts++
			elementsByChannel[channelId] = append(elementsByChannel[channelId], createdPostToExportEntry(post))
		}
		var postExport PostExport
		postExport, results = getPostExport(p.Posts, i, results)
		elementsByChannel[channelId] = append(elementsByChannel[channelId], postExport)

		uploadedFiles, startUploads, stopUploads, deleteFileMessages, err := postToAttachmentsEntries(post, p.Db)
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
			UserId:   *post.UserId,
			Email:    *post.UserEmail,
			Username: *post.Username,
			IsBot:    post.IsBot,
		}
	}

	// If the channel is not in channelsInThisBatch (i.e. if it didn't have a post), we need to check if it had
	// user activity between this batch's startTime-endTime. If so, add it to the channelsInThisBatch.
	for id := range p.ChannelMetadata {
		if !channelsInThisBatch[id] {
			if shared.ChannelHasActivity(p.ChannelMemberHistories[id], p.BatchStartTime, p.BatchEndTime) {
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

	results.ProcessingPostsMs = time.Since(start).Milliseconds()

	var err error
	results.WriteExportResult, err = writeExport(rctx, export, allUploadedFiles, p.ExportBackend, p.FileAttachmentBackend, p.BatchPath)
	results.NumChannels = len(channelsInThisBatch)
	return results, err
}

func writeExport(rctx request.CTX, export *RootNode, uploadedFiles []*model.FileInfo, exportBackend filestore.FileBackend, fileAttachmentBackend filestore.FileBackend, batchPath string) (res shared.WriteExportResult, err error) {
	start := time.Now()
	// marshal the export object to xml
	xmlData := &bytes.Buffer{}
	xmlData.WriteString(xml.Header)

	enc := xml.NewEncoder(xmlData)
	enc.Indent("", "  ")
	if err = enc.Encode(export); err != nil {
		return res, fmt.Errorf("unable to convert export to XML: %w", err)
	}
	if err = enc.Flush(); err != nil {
		return res, fmt.Errorf("unable to flush the XML encoder: %w", err)
	}

	// Write this batch to a tmp zip, then copy the zip to the export directory.
	// Using a 2M buffer because the file backend may be s3 and this optimizes speed and
	// memory usage, see: https://github.com/mattermost/mattermost/pull/26629
	buf := make([]byte, 1024*1024*2)
	temp, err := os.CreateTemp("", "compliance-export-batch-*.zip")
	if err != nil {
		return res, fmt.Errorf("unable to create the batch temporary file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), temp)

	zipFile := zip.NewWriter(temp)
	w, err := zipFile.Create(ActianceExportFilename)
	if err != nil {
		return res, fmt.Errorf("unable to create the xml file in the zipFile created with the batch temporary file: %w", err)
	}
	if _, err = io.CopyBuffer(w, xmlData, buf); err != nil {
		return res, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
	}
	res.ProcessingXmlMs = time.Since(start).Milliseconds()

	start = time.Now()

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
			return res, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
		}
	}

	res.TransferringFilesMs = time.Since(start).Milliseconds()
	res.NumWarnings = len(missingFiles)
	if res.NumWarnings > 0 {
		var w io.Writer
		w, err = zipFile.Create(ActianceWarningFilename)
		if err != nil {
			return res, fmt.Errorf("unable to create the warning file in the zipFile created with the batch temporary file: %w", err)
		}
		r := strings.NewReader(strings.Join(missingFiles, "\n"))
		if _, err = io.CopyBuffer(w, r, buf); err != nil {
			return res, fmt.Errorf("unable to write into the zipFile created with the batch temporary file: %w", err)
		}
	}

	if err = zipFile.Close(); err != nil {
		return res, fmt.Errorf("unable to close the zipFile created with the batch temporary file: %w", err)
	}

	_, err = temp.Seek(0, io.SeekStart)
	if err != nil {
		return res, fmt.Errorf("unable to seek to the beginning of the the batch temporary file: %w", err)
	}

	start = time.Now()

	// Try to write the file without a timeout due to the potential size of the file.
	_, err = filestore.TryWriteFileContext(rctx.Context(), exportBackend, temp, batchPath)
	if err != nil {
		return res, fmt.Errorf("unable to transfer the batch zip to the file backend: %w", err)
	}

	res.TransferringZipMs = time.Since(start).Milliseconds()

	return res, nil
}
