// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/jaytaylor/html2text"
	gomail "gopkg.in/mail.v2"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/enterprise/internal/file"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

const (
	GlobalRelayMsgTypeHeader     = "X-GlobalRelay-MsgType"
	GlobalRelayChannelNameHeader = "X-Mattermost-ChannelName"
	GlobalRelayChannelIDHeader   = "X-Mattermost-ChannelID"
	GlobalRelayChannelTypeHeader = "X-Mattermost-ChannelType"
	MaxEmailBytes                = 250 << (10 * 2)
	MaxEmailsPerConnection       = 400
)

type AllExport map[string][]*ChannelExport

type ChannelExport struct {
	ChannelId       string            // the unique id of the channel
	ChannelName     string            // the name of the channel
	ChannelType     model.ChannelType // the channel type
	StartTime       int64             // utc timestamp (seconds), start of export period or create time of channel, whichever is greater. Example: 1366611728.
	EndTime         int64             // utc timestamp (seconds), end of export period or delete time of channel, whichever is lesser. Example: 1366611728.
	Participants    []ParticipantRow  // summary information about the conversation participants
	Messages        []Message         // the messages that were sent during the conversation
	ExportedOn      int64             // utc timestamp (seconds), when this export was generated
	numUserMessages map[string]int    // key is user id, value is number of messages that they sent during this period
	uploadedFiles   []*model.FileInfo // any files that were uploaded to the channel during the export period
	bytes           int64
}

// a row in the summary table at the top of the export
type ParticipantRow struct {
	Username     string
	UserType     string
	Email        string
	JoinTime     int64
	LeaveTime    int64
	MessagesSent int
}

type Message struct {
	SentTime       int64
	SenderUsername string
	PostType       string
	PostUsername   string
	SenderUserType string
	SenderEmail    string
	Message        string
	PreviewsPost   string
}

func GlobalRelayExport(rctx request.CTX, p shared.ExportParams) (shared.RunExportResults, error) {
	results := shared.RunExportResults{}
	var attachmentsRemovedPostIDs []string
	allExports := make(map[string][]*ChannelExport)

	tmpFile, err := os.CreateTemp("", "")
	if err != nil {
		return results, fmt.Errorf("unable to open the temporary export file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), tmpFile)

	zipFile := zip.NewWriter(tmpFile)

	// postAuthorsByChannel is a map so that we don't store duplicate authors
	postAuthorsByChannel := make(map[string]map[string]shared.ChannelMember)
	metadata := shared.Metadata{
		Channels:         p.ChannelMetadata,
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        p.BatchStartTime,
		EndTime:          p.BatchEndTime,
	}
	channelsInThisBatch := make(map[string]bool)

	for _, post := range p.Posts {
		channelId := *post.ChannelId
		channelsInThisBatch[channelId] = true

		var attachments []*model.FileInfo
		attachments, err = shared.GetPostAttachments(p.Db, post)
		if err != nil {
			return results, err
		}

		if err = metadata.UpdateCounts(channelId, 1, len(attachments)); err != nil {
			return results, err
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

		attachmentsRemoved := addToExports(rctx, attachments, allExports, post, p.BatchStartTime, p.BatchEndTime)
		attachmentsRemovedPostIDs = append(attachmentsRemovedPostIDs, attachmentsRemoved...)
	}

	for _, channelExportList := range allExports {
		for batchId, channelExport := range channelExportList {
			channelId := channelExport.ChannelId
			var participants []ParticipantRow
			participants, err = getParticipants(
				p.BatchStartTime,
				p.BatchEndTime,
				p.ChannelMemberHistories[channelId],
				postAuthorsByChannel[channelId],
				channelExport,
			)
			if err != nil {
				return results, err
			}
			channelExport.Participants = participants
			channelExport.ExportedOn = p.JobStartTime

			var channelExportFile io.Writer
			channelExportFile, err = zipFile.Create(fmt.Sprintf("%s - (%s) - %d.eml", channelExport.ChannelName, channelExport.ChannelId, batchId))
			if err != nil {
				return results, fmt.Errorf("unable to create the eml file: %w", err)
			}

			if results.NumWarnings, err = generateEmail(rctx, p.FileAttachmentBackend, channelExport, p.Templates, channelExportFile); err != nil {
				return results, err
			}
		}
	}

	err = zipFile.Close()
	if err != nil {
		return results, fmt.Errorf("unable to close the zip file using tmpFile.Name: %v, err: %w", tmpFile.Name(), err)
	}

	_, err = tmpFile.Seek(0, 0)
	if err != nil {
		return results, fmt.Errorf("unable to re-read the Global Relay temporary export file using tmpFile.Name: %v, err: %w", tmpFile.Name(), err)
	}

	if p.ExportType == model.ComplianceExportTypeGlobalrelayZip {
		// Try to disable the write timeout for the potentially big export file.
		_, err = filestore.TryWriteFileContext(rctx.Context(), p.ExportBackend, tmpFile, p.BatchPath)
		if err != nil {
			return results, fmt.Errorf("unable to write the global relay file, using tmpFile.Name: %v, batchPath: %v, err: %w", tmpFile.Name(), p.BatchPath, err)
		}
	} else {
		err = Deliver(tmpFile, p.Config)
		if err != nil {
			return results, fmt.Errorf("unable to deliver tmpFile.Name: %v, err: %w", tmpFile.Name(), err)
		}
	}

	if len(attachmentsRemovedPostIDs) > 0 {
		rctx.Logger().Warn("Global Relay Attachments Removed because they were too large to send to Global Relay",
			mlog.Int("number_of_attachments_removed", len(attachmentsRemovedPostIDs)))
		rctx.Logger().Warn("List of posts which had attachments removed",
			mlog.Array("post_ids", attachmentsRemovedPostIDs))
	}

	return results, nil
}

func addToExports(rctx request.CTX, attachments []*model.FileInfo, exports map[string][]*ChannelExport, post *model.MessageExport, batchStartTime, batchEndTime int64) []string {
	var channelExport *ChannelExport
	attachmentsRemovedPostIDs := []string{}
	if channelExports, present := exports[*post.ChannelId]; !present {
		// we found a new channel
		channelExport = &ChannelExport{
			ChannelId:       *post.ChannelId,
			ChannelName:     *post.ChannelDisplayName,
			ChannelType:     *post.ChannelType,
			StartTime:       batchStartTime,
			EndTime:         batchEndTime,
			Messages:        make([]Message, 0),
			Participants:    make([]ParticipantRow, 0),
			numUserMessages: make(map[string]int),
			uploadedFiles:   make([]*model.FileInfo, 0),
			bytes:           0,
		}
		exports[*post.ChannelId] = []*ChannelExport{channelExport}
	} else {
		// we already know about this channel
		channelExport = channelExports[len(channelExports)-1]
	}

	// Create a new ChannelExport if it would be too many bytes to add the post
	fileBytes := fileInfoListBytes(attachments)
	msgBytes := int64(len(*post.PostMessage))
	postBytes := fileBytes + msgBytes
	postTooLargeForChannelBatch := channelExport.bytes+postBytes > MaxEmailBytes
	postAloneTooLargeToSend := postBytes > MaxEmailBytes // Attachments must be removed from export, they're too big to send.

	if postAloneTooLargeToSend {
		attachmentsRemovedPostIDs = append(attachmentsRemovedPostIDs, *post.PostId)
	}

	if postTooLargeForChannelBatch && !postAloneTooLargeToSend {
		channelExport = &ChannelExport{
			ChannelId:       *post.ChannelId,
			ChannelName:     *post.ChannelDisplayName,
			ChannelType:     *post.ChannelType,
			StartTime:       batchStartTime,
			EndTime:         batchEndTime,
			Messages:        make([]Message, 0),
			Participants:    make([]ParticipantRow, 0),
			numUserMessages: make(map[string]int),
			uploadedFiles:   make([]*model.FileInfo, 0),
			bytes:           0,
		}
		exports[*post.ChannelId] = append(exports[*post.ChannelId], channelExport)
	}

	addPostToChannelExport(rctx, channelExport, post)

	// if this post includes files, add them to the collection
	for _, fileInfo := range attachments {
		addAttachmentToChannelExport(channelExport, post, fileInfo, postAloneTooLargeToSend)
	}
	channelExport.bytes += postBytes
	return attachmentsRemovedPostIDs
}

func getParticipants(startTime int64, endTime int64, channelMembersHistory []*model.ChannelMemberHistoryResult,
	postAuthors map[string]shared.ChannelMember, channelExport *ChannelExport) ([]ParticipantRow, error) {
	participantsMap := map[string]ParticipantRow{}

	joins, leaves := shared.GetJoinsAndLeavesForChannel(startTime, endTime, channelMembersHistory, postAuthors)

	for _, join := range joins {
		userType := "user"
		if join.IsBot {
			userType = "bot"
		}

		if _, ok := participantsMap[join.UserId]; !ok {
			participantsMap[join.UserId] = ParticipantRow{
				Username:     join.Username,
				UserType:     userType,
				Email:        join.Email,
				JoinTime:     join.Datetime,
				LeaveTime:    endTime,
				MessagesSent: channelExport.numUserMessages[join.UserId],
			}
		}
	}
	for _, leave := range leaves {
		if participantRow, ok := participantsMap[leave.UserId]; ok {
			participantRow.LeaveTime = leave.Datetime //nolint:govet
			participantsMap[leave.UserId] = participantRow
		}
	}

	participants := []ParticipantRow{}
	for _, participant := range participantsMap {
		participants = append(participants, participant)
	}

	sort.Slice(participants, func(i, j int) bool {
		return participants[i].Username < participants[j].Username
	})
	return participants, nil
}

func generateEmail(rctx request.CTX, fileAttachmentBackend filestore.FileBackend, channelExport *ChannelExport, templates *templates.Container, w io.Writer) (int, error) {
	var warningCount int
	participantEmailAddresses := getParticipantEmails(channelExport)

	// GlobalRelay expects the email to come from the person that initiated the conversation.
	// our conversations aren't really initiated, so we just use the first person we find
	from := participantEmailAddresses[0]

	// it also expects the email to be addressed to the other participants in the conversation
	mimeTo := strings.Join(participantEmailAddresses, ",")

	htmlBody, err := channelExportToHTML(rctx, channelExport, templates)
	if err != nil {
		return warningCount, fmt.Errorf("unable to generate eml file data: %w", err)
	}

	subject := fmt.Sprintf("Mattermost Compliance Export: %s", channelExport.ChannelName)
	htmlMessage := "\r\n<html><body>" + htmlBody + "</body></html>"

	txtBody, err := html2text.FromString(htmlBody)
	if err != nil {
		rctx.Logger().Warn("Error transforming html to plain text for GlobalRelay email", mlog.Err(err))
		txtBody = ""
	}

	headers := map[string][]string{
		"From":                       {from},
		"To":                         {mimeTo},
		"Subject":                    {encodeRFC2047Word(subject)},
		"Content-Transfer-Encoding":  {"8bit"},
		"Auto-Submitted":             {"auto-generated"},
		"Precedence":                 {"bulk"},
		GlobalRelayMsgTypeHeader:     {"Mattermost"},
		GlobalRelayChannelNameHeader: {encodeRFC2047Word(channelExport.ChannelName)},
		GlobalRelayChannelIDHeader:   {encodeRFC2047Word(channelExport.ChannelId)},
		GlobalRelayChannelTypeHeader: {encodeRFC2047Word(shared.ChannelTypeDisplayName(channelExport.ChannelType))},
	}

	m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
	m.SetHeaders(headers)
	m.SetDateHeader("Date", time.Unix(channelExport.EndTime/1000, 0).UTC())
	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

	for _, fileInfo := range channelExport.uploadedFiles {
		path := fileInfo.Path

		m.Attach(fileInfo.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			var reader filestore.ReadCloseSeeker
			reader, err = fileAttachmentBackend.Reader(path)
			if err != nil {
				rctx.Logger().Warn("File not found for export", mlog.String("filename", path))
				warningCount += 1
				return nil
			}
			defer reader.Close()

			_, err = io.Copy(writer, reader)
			if err != nil {
				return fmt.Errorf("unable to add attachment to the Global Relay export: %w", err)
			}
			return nil
		}))
	}

	_, err = m.WriteTo(w)
	if err != nil {
		return warningCount, fmt.Errorf("unable to generate eml file data: %w", err)
	}
	return warningCount, nil
}

func getParticipantEmails(channelExport *ChannelExport) []string {
	participantEmails := make([]string, len(channelExport.Participants))
	for i, participant := range channelExport.Participants {
		participantEmails[i] = participant.Email
	}
	return participantEmails
}

func fileInfoListBytes(fileInfoList []*model.FileInfo) int64 {
	totalBytes := int64(0)
	for _, fileInfo := range fileInfoList {
		totalBytes += fileInfo.Size
	}
	return totalBytes
}

func addPostToChannelExport(rctx request.CTX, channelExport *ChannelExport, post *model.MessageExport) {
	userType := "user"
	if post.IsBot {
		userType = "bot"
	}

	strPostProps := post.PostProps
	bytPostProps := []byte(*strPostProps)

	// Added to show the username if overridden by a webhook or API integration
	postUserName := ""
	var postPropsLocal map[string]any
	err := json.Unmarshal(bytPostProps, &postPropsLocal)
	if err != nil {
		rctx.Logger().Warn("Failed to unmarshal post Props into JSON. Ignoring username override.", mlog.Err(err))
	} else {
		if overrideUsername, ok := postPropsLocal["override_username"]; ok {
			postUserName = overrideUsername.(string)
		}

		if postUserName == "" {
			if overrideUsername, ok := postPropsLocal["webhook_display_name"]; ok {
				postUserName = overrideUsername.(string)
			}
		}
	}

	element := Message{
		SentTime:       *post.PostCreateAt,
		Message:        *post.PostMessage,
		SenderUserType: userType,
		PostType:       *post.PostType,
		PostUsername:   postUserName,
		SenderUsername: *post.Username,
		SenderEmail:    *post.UserEmail,
		PreviewsPost:   post.PreviewID(),
	}
	channelExport.Messages = append(channelExport.Messages, element)
	channelExport.numUserMessages[*post.UserId] += 1
}

func addAttachmentToChannelExport(channelExport *ChannelExport, post *model.MessageExport, fileInfo *model.FileInfo, removeAttachments bool) {
	var uploadElement Message
	userType := "user"
	if post.IsBot {
		userType = "bot"
	}
	if removeAttachments {
		// add "post" message indicating that attachments were not sent
		uploadElement = Message{
			SentTime:       fileInfo.CreateAt,
			Message:        fmt.Sprintf("Uploaded file '%s' (id '%s') was removed because it was too large to send.", fileInfo.Name, fileInfo.Id),
			SenderUsername: *post.Username,
			SenderUserType: userType,
			SenderEmail:    *post.UserEmail,
		}

		if fileInfo.DeleteAt != 0 {
			uploadElement.SentTime = fileInfo.DeleteAt
			uploadElement.Message = fmt.Sprintf("Deleted file '%s' (id '%s') was removed because it was too large to send.", fileInfo.Name, fileInfo.Id)
		}
	} else {
		channelExport.uploadedFiles = append(channelExport.uploadedFiles, fileInfo)

		// add an implicit "post" to the export that includes the filename so GlobalRelay knows who uploaded each file
		uploadElement = Message{
			SentTime:       fileInfo.CreateAt,
			Message:        fmt.Sprintf("Uploaded file %s", fileInfo.Name),
			SenderUsername: *post.Username,
			SenderUserType: userType,
			SenderEmail:    *post.UserEmail,
		}

		if fileInfo.DeleteAt != 0 {
			uploadElement.SentTime = fileInfo.DeleteAt
			uploadElement.Message = fmt.Sprintf("Deleted file %s", fileInfo.Name)
		}
	}

	channelExport.Messages = append(channelExport.Messages, uploadElement)
}

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}
