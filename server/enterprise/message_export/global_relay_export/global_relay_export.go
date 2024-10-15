// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/jaytaylor/html2text"
	gomail "gopkg.in/mail.v2"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/common_export"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
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

func GlobalRelayExport(rctx request.CTX, posts []*model.MessageExport, db store.Store, fileBackend filestore.FileBackend, dest io.Writer, templates *templates.Container) ([]string, int64, *model.AppError) {
	var warningCount int64
	attachmentsRemovedPostIDs := []string{}
	allExports := make(map[string][]*ChannelExport)

	zipFile := zip.NewWriter(dest)

	postAuthorsByChannel := make(map[string]map[string]common_export.ChannelMember)
	metadata := common_export.Metadata{
		Channels:         map[string]*common_export.MetadataChannel{},
		MessagesCount:    0,
		AttachmentsCount: 0,
		StartTime:        0,
		EndTime:          0,
	}

	for _, post := range posts {
		if _, ok := postAuthorsByChannel[*post.ChannelId]; !ok {
			postAuthorsByChannel[*post.ChannelId] = make(map[string]common_export.ChannelMember)
		}

		postAuthorsByChannel[*post.ChannelId][*post.UserId] = common_export.ChannelMember{
			UserId:   *post.UserId,
			Username: *post.Username,
			IsBot:    post.IsBot,
			Email:    *post.UserEmail,
		}

		var attachments []*model.FileInfo
		if len(post.PostFileIds) > 0 {
			var err error
			attachments, err = db.FileInfo().GetForPost(*post.PostId, true, true, false)
			if err != nil {
				return nil, warningCount, model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay_export.get_attachment_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
		}

		attachmentsRemoved := addToExports(rctx, attachments, allExports, post)
		attachmentsRemovedPostIDs = append(attachmentsRemovedPostIDs, attachmentsRemoved...)

		metadata.Update(post, len(attachments))
	}

	for _, channelExportList := range allExports {
		for batchId, channelExport := range channelExportList {
			participants, appErr := getParticipants(db, channelExport, postAuthorsByChannel[channelExport.ChannelId])
			if appErr != nil {
				return nil, warningCount, appErr
			}
			channelExport.Participants = participants
			channelExport.ExportedOn = time.Now().Unix() * 1000

			channelExportFile, err := zipFile.Create(fmt.Sprintf("%s - (%s) - %d.eml", channelExport.ChannelName, channelExport.ChannelId, batchId))
			if err != nil {
				return nil, warningCount, model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay.create_file_in_zip.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			if appErr, warningCount = generateEmail(rctx, fileBackend, channelExport, templates, channelExportFile); appErr != nil {
				return nil, warningCount, appErr
			}
		}
	}

	err := zipFile.Close()
	if err != nil {
		return nil, warningCount, model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay.close_zip_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return attachmentsRemovedPostIDs, warningCount, nil
}

func addToExports(rctx request.CTX, attachments []*model.FileInfo, exports map[string][]*ChannelExport, post *model.MessageExport) []string {
	var channelExport *ChannelExport
	attachmentsRemovedPostIDs := []string{}
	if channelExports, present := exports[*post.ChannelId]; !present {
		// we found a new channel
		channelExport = &ChannelExport{
			ChannelId:       *post.ChannelId,
			ChannelName:     *post.ChannelDisplayName,
			ChannelType:     *post.ChannelType,
			StartTime:       *post.PostCreateAt,
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
			StartTime:       *post.PostCreateAt,
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

func getParticipants(db store.Store, channelExport *ChannelExport,
	postAuthors map[string]common_export.ChannelMember) ([]ParticipantRow, *model.AppError) {
	participantsMap := map[string]ParticipantRow{}
	channelMembersHistory, err := db.ChannelMemberHistory().GetUsersInChannelDuring(channelExport.StartTime, channelExport.EndTime, []string{channelExport.ChannelId})
	if err != nil {
		return nil, model.NewAppError("getParticipants", "ent.get_users_in_channel_during", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	joins, leaves := common_export.GetJoinsAndLeavesForChannel(channelExport.StartTime, channelExport.EndTime, channelMembersHistory, postAuthors)

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
				LeaveTime:    channelExport.EndTime,
				MessagesSent: channelExport.numUserMessages[join.UserId],
			}
		}
	}
	for _, leave := range leaves {
		if participantRow, ok := participantsMap[leave.UserId]; ok {
			participantRow.LeaveTime = leave.Datetime //nolint:govet
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

func generateEmail(rctx request.CTX, fileBackend filestore.FileBackend, channelExport *ChannelExport, templates *templates.Container, w io.Writer) (*model.AppError, int64) {
	var warningCount int64
	participantEmailAddresses := getParticipantEmails(channelExport)

	// GlobalRelay expects the email to come from the person that initiated the conversation.
	// our conversations aren't really initiated, so we just use the first person we find
	from := participantEmailAddresses[0]

	// it also expects the email to be addressed to the other participants in the conversation
	mimeTo := strings.Join(participantEmailAddresses, ",")

	htmlBody, err := channelExportToHTML(rctx, channelExport, templates)
	if err != nil {
		return model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay.generate_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err), warningCount
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
		GlobalRelayChannelTypeHeader: {encodeRFC2047Word(common_export.ChannelTypeDisplayName(channelExport.ChannelType))},
	}

	m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
	m.SetHeaders(headers)
	m.SetDateHeader("Date", time.Unix(channelExport.EndTime/1000, 0).UTC())
	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

	for _, fileInfo := range channelExport.uploadedFiles {
		path := fileInfo.Path

		m.Attach(fileInfo.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			reader, appErr := fileBackend.Reader(path)
			if appErr != nil {
				rctx.Logger().Warn("File not found for export", mlog.String("filename", path))
				warningCount += 1
				return nil
			}
			defer reader.Close()

			_, err = io.Copy(writer, reader)
			if err != nil {
				return model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay.attach_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		}))
	}

	_, err = m.WriteTo(w)
	if err != nil {
		return model.NewAppError("GlobalRelayExport", "ent.message_export.global_relay.generate_email.app_error", nil, "", http.StatusInternalServerError).Wrap(err), warningCount
	}
	return nil, warningCount
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
	channelExport.EndTime = *post.PostCreateAt
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
