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
	MaxEmailsPerConnection       = 400
)

// MaxEmailBytes is a var because it needs to be set in tests. Otherwise it shouldn't be touched.
var MaxEmailBytes int64 = 250 * 1024 * 1024 // 250MB

type ChannelExport struct {
	TeamId             string
	TeamName           string
	TeamDisplayName    string
	ChannelId          string // the unique id of the channel
	ChannelName        string // the name of the channel
	ChannelDisplayName string
	ChannelType        model.ChannelType // the channel type
	StartTime          int64             // utc timestamp (seconds), start of export period or create time of channel, whichever is greater. Example: 1366611728.
	EndTime            int64             // utc timestamp (seconds), end of export period or delete time of channel, whichever is lesser. Example: 1366611728.
	Participants       []ParticipantRow  // summary information about the conversation participants
	Messages           []Message         // the messages that were sent during the conversation
	ExportedOn         int64             // utc timestamp (seconds), when this export was generated
	numUserMessages    map[string]int    // key is user id, value is number of messages that they sent during this period
	uploadedFiles      []*model.FileInfo // any files that were uploaded to the channel during the export period
	bytes              int64
}

// a row in the summary table at the top of the export
type ParticipantRow struct {
	shared.JoinExport
	MessagesSent int
}

type Message struct {
	Id             string
	SentTime       int64
	SenderId       string
	SenderUsername string
	PostUsername   string
	SenderUserType string
	SenderEmail    string
	Message        string
	PreviewsPost   string
	UpdateAt       int64
	UpdateType     shared.PostUpdatedType
	EditedNewMsgId string
}

func GlobalRelayExport(rctx request.CTX, p shared.ExportParams) (shared.RunExportResults, error) {
	exportData, err := shared.GetGenericExportData(p)
	results := exportData.Results
	if err != nil {
		return results, err
	}

	var attachmentsRemovedPostIDs []string
	allExports := make(map[string][]*ChannelExport, len(exportData.Exports))

	// save a pointer to the joins for each channel, to be used later in getParticipants
	joinsByChannel := make(map[string][]shared.JoinExport, len(exportData.Exports))

	for _, channel := range exportData.Exports {
		for _, post := range channel.Posts {
			attachmentsRemoved := addToExports(rctx, allExports, channel, post)
			attachmentsRemovedPostIDs = append(attachmentsRemovedPostIDs, attachmentsRemoved...)
		}
		if len(channel.Posts) == 0 {
			// channel has no posts, but it was exported anyway, so it must have joins and leaves.
			if _, present := allExports[channel.ChannelId]; !present {
				// we found a new channel
				allExports[channel.ChannelId] = []*ChannelExport{genericChannelToChannelExport(channel)}
			}
		}
		joinsByChannel[channel.ChannelId] = channel.JoinEvents
	}

	tmpFile, err := os.CreateTemp("", "")
	if err != nil {
		return results, fmt.Errorf("unable to open the temporary export file: %w", err)
	}
	defer file.DeleteTemp(rctx.Logger(), tmpFile)
	zipFile := zip.NewWriter(tmpFile)

	// export each channelExport (sometimes multiple channelExport per real channel)
	for _, channelExportList := range allExports {
		for batchId, channelExport := range channelExportList {
			// we need to make the participant list for each channelExport "batch" (multiple "batches"per real channel)
			// because each batch will have its own number of messages for that participant.
			channelExport.Participants = getParticipants(channelExport, joinsByChannel[channelExport.ChannelId])
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

// addToExports adds the post to the allExports collection. allExports keeps a map of channelId->[]*ChannelExport.
// If a channelId has an existing []*ChannelExport, it adds post to the last ChannelExport in that list.
// If the last ChannelExport is too big, it starts a new ChannelExport and appends it to the list (a new "batch").
func addToExports(rctx request.CTX, allExports map[string][]*ChannelExport, genericChannel shared.ChannelExport,
	post shared.PostExport) []string {
	var channelExport *ChannelExport
	var attachmentsRemovedPostIDs []string
	if channelExports, present := allExports[*post.ChannelId]; !present {
		// we found a new channel
		channelExport = genericChannelToChannelExport(genericChannel)
		allExports[*post.ChannelId] = []*ChannelExport{channelExport}
	} else {
		// we already know about this channel
		channelExport = channelExports[len(channelExports)-1]
	}

	msgBytes := int64(len(*post.PostMessage))

	// Create a new ChannelExport if it would be too many bytes to add the post.
	// NOTE: we are only exporting attachment starts.
	attachmentStarts := make([]*model.FileInfo, 0, len(post.AttachmentCreates))
	for _, start := range post.AttachmentCreates {
		attachmentStarts = append(attachmentStarts, start.FileInfo)
	}
	fileBytes := fileInfoListBytes(attachmentStarts)
	postBytes := fileBytes + msgBytes
	// NOTE: This is only a rough estimate -- we're not including the txt or html portion of the email...
	attachmentsAloneTooLargeToSend := fileBytes > MaxEmailBytes // Attachments must be removed from export, they're too big to send.
	if attachmentsAloneTooLargeToSend {
		postBytes -= fileBytes
	}
	postTooLargeForChannelBatch := channelExport.bytes+postBytes > MaxEmailBytes

	if attachmentsAloneTooLargeToSend {
		attachmentsRemovedPostIDs = append(attachmentsRemovedPostIDs, *post.PostId)
	}

	// new "batch"
	if postTooLargeForChannelBatch {
		channelExport = genericChannelToChannelExport(genericChannel)
		allExports[*post.ChannelId] = append(allExports[*post.ChannelId], channelExport)
	}

	addPostToChannelExport(rctx, channelExport, post)

	// if this post includes files, add them to the collection
	addAttachmentsToChannelExport(channelExport, post, post.AttachmentCreates, post.AttachmentDeletes, attachmentsAloneTooLargeToSend)
	channelExport.bytes += postBytes
	return attachmentsRemovedPostIDs
}

func genericChannelToChannelExport(genericChannel shared.ChannelExport) *ChannelExport {
	return &ChannelExport{
		TeamId:             genericChannel.TeamId,
		TeamName:           genericChannel.TeamName,
		TeamDisplayName:    genericChannel.TeamDisplayName,
		ChannelId:          genericChannel.ChannelId,
		ChannelName:        genericChannel.ChannelName,
		ChannelDisplayName: genericChannel.DisplayName,
		ChannelType:        genericChannel.ChannelType,
		StartTime:          genericChannel.StartTime,
		EndTime:            genericChannel.EndTime,
		// we can't preallocate sizes here because we don't know how many will be in this "batch"
		Participants:    make([]ParticipantRow, 0),
		Messages:        make([]Message, 0),
		ExportedOn:      0,
		numUserMessages: make(map[string]int),
		uploadedFiles:   make([]*model.FileInfo, 0),
		bytes:           0,
	}
}

func getParticipants(channelExport *ChannelExport, joinEvents []shared.JoinExport) []ParticipantRow {
	participants := make([]ParticipantRow, 0, len(joinEvents))
	for _, j := range joinEvents {
		participants = append(participants, ParticipantRow{
			JoinExport:   j,
			MessagesSent: channelExport.numUserMessages[j.UserId],
		})
	}

	sort.Slice(participants, func(i, j int) bool {
		return participants[i].Username < participants[j].Username
	})
	return participants
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

	subject := fmt.Sprintf("Mattermost Compliance Export: %s", channelExport.ChannelDisplayName)
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
		GlobalRelayChannelNameHeader: {encodeRFC2047Word(channelExport.ChannelDisplayName)},
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
	participantEmails := make([]string, 0, len(channelExport.Participants))
	for _, participant := range channelExport.Participants {
		participantEmails = append(participantEmails, participant.UserEmail)
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

func addPostToChannelExport(rctx request.CTX, channelExport *ChannelExport, post shared.PostExport) {
	strPostProps := post.PostProps
	bytePostProps := []byte(*strPostProps)

	// Added to show the username if overridden by a webhook or API integration
	originalUsername := model.SafeDereference(post.Username)
	postUserName := originalUsername
	var postPropsLocal map[string]any
	err := json.Unmarshal(bytePostProps, &postPropsLocal)
	if err != nil {
		rctx.Logger().Warn("Failed to unmarshal post Props into JSON. Ignoring username override.", mlog.Err(err))
	} else {
		if overrideUsername, ok := postPropsLocal["override_username"]; ok {
			postUserName = overrideUsername.(string)
		}

		if postUserName == originalUsername {
			if overrideUsername, ok := postPropsLocal["webhook_display_name"]; ok {
				postUserName = overrideUsername.(string)
			}
		}
	}

	element := postToMessage(post)
	element.PostUsername = postUserName
	channelExport.Messages = append(channelExport.Messages, element)
	channelExport.numUserMessages[*post.UserId] += 1
}

func postToMessage(post shared.PostExport) Message {
	return Message{
		Id:             model.SafeDereference(post.PostId),
		SentTime:       model.SafeDereference(post.PostCreateAt),
		SenderId:       model.SafeDereference(post.UserId),
		SenderUsername: model.SafeDereference(post.Username),
		PostUsername:   model.SafeDereference(post.Username),
		SenderUserType: string(post.UserType),
		SenderEmail:    model.SafeDereference(post.UserEmail),
		Message:        post.Message,
		PreviewsPost:   post.PreviewID(),
		UpdateAt:       post.UpdateAt,
		UpdateType:     post.UpdatedType,
		EditedNewMsgId: post.EditedNewMsgId,
	}
}

func addAttachmentsToChannelExport(channelExport *ChannelExport, post shared.PostExport,
	attachmentStarts []*shared.FileUploadStartExport, attachmentDeletes []shared.PostExport, removeAttachments bool) {
	for _, start := range attachmentStarts {
		var message string

		if removeAttachments {
			message = fmt.Sprintf("Uploaded file %q (id '%s') was removed because it was too large to send.",
				start.FileInfo.Name, start.FileInfo.Id)
		} else {
			channelExport.uploadedFiles = append(channelExport.uploadedFiles, start.FileInfo)
			message = fmt.Sprintf("Uploaded file %s", start.FileInfo.Name)
		}

		uploadElement := postToMessage(post)
		uploadElement.Message = message
		channelExport.Messages = append(channelExport.Messages, uploadElement)
	}

	for _, deleted := range attachmentDeletes {
		uploadElement := postToMessage(deleted)
		uploadElement.Message = fmt.Sprintf("Deleted file %s", deleted.FileInfo.Name)
		channelExport.Messages = append(channelExport.Messages, uploadElement)
	}
}

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}
