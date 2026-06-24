// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"encoding/json"
	"errors"
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

	// maxAttachmentReadAttempts bounds how many consecutive read attempts that make no
	// forward progress we tolerate before giving up. Attempts that do make progress reset
	// this budget (and the backoff), so a large attachment can still complete over a flaky
	// connection. If the budget is exhausted, the batch is failed and the job is retried.
	maxAttachmentReadAttempts = 3

	// attachmentReadBackoff is the initial delay before retrying a stalled attachment read;
	// it doubles after each stalled attempt (exponential backoff) and resets once a retry
	// makes progress.
	attachmentReadBackoff = 1 * time.Second
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
		return warningCount, fmt.Errorf("unable to render the channel export to HTML: %w", err)
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

	// attachmentReadErr captures a genuine attachment read/write failure that we must
	// NOT surface to gomail. gomail v2.3.1 stores any error returned by a copy closure
	// and then nil-derefs while writing the *next* attachment, which panics and
	// (because workers don't recover) crashes the whole server (MM-69242). So the
	// closure always returns nil and we fail the batch here, after WriteTo.
	var attachmentReadErr error

	for _, fileInfo := range channelExport.uploadedFiles {
		path := fileInfo.Path

		m.Attach(fileInfo.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			missing, readErr := streamAttachmentForExport(rctx, fileAttachmentBackend, path, writer)
			switch {
			case missing:
				// The attachment no longer exists in the store (confirmed via FileExists).
				// Warn and skip so a single deleted file can't block the export (MM-62493).
				rctx.Logger().Warn("File not found for export", mlog.String("filename", path))
				warningCount += 1
			case readErr != nil:
				// A read/write failure that persisted across retries. Record it and fail the
				// batch after WriteTo so the job retries instead of shipping an incomplete export.
				rctx.Logger().Error("Failed to read attachment for Global Relay export after retries",
					mlog.String("filename", path), mlog.Err(readErr))
				attachmentReadErr = errors.Join(attachmentReadErr, fmt.Errorf("attachment %q: %w", path, readErr))
			}
			// Always return nil: an error here poisons gomail's writer and panics on the
			// next attachment (MM-69242). We fail the batch after WriteTo instead.
			return nil
		}))
	}

	if _, err = m.WriteTo(w); err != nil {
		return warningCount, fmt.Errorf("unable to write the eml message: %w", err)
	}
	if attachmentReadErr != nil {
		return warningCount, fmt.Errorf("unable to read one or more attachments for the eml message: %w", attachmentReadErr)
	}
	return warningCount, nil
}

// errAttachmentStreamFatal wraps a streaming failure that retrying cannot fix — a failure
// writing to the output (gomail) stream, or a failed resume Seek. The caller fails the batch
// rather than retrying or skipping.
var errAttachmentStreamFatal = errors.New("attachment stream cannot be retried")

// streamAttachmentForExport streams the attachment at path directly into dst (the gomail
// writer), retrying transient failures (e.g. an S3 timeout, whether it surfaces when opening
// the reader or mid-read). Each retry re-opens the backend reader and Seeks past the bytes
// already written, so a retry resumes rather than re-downloads: memory stays constant (an S3
// Seek is a ranged GET, not a fresh download) instead of buffering a whole, up to
// ~MaxEmailBytes, attachment. Only attempts that make NO forward progress count against the
// retry budget, so a large attachment can still complete over a flaky connection as long as
// each retry advances; a cancelled job aborts promptly via the context.
//
// An open or read failure is classified, not assumed missing: it returns missing=true only
// when FileExists confirms the object is genuinely gone (the caller skips it, preserving
// MM-62493). A failure on a file that still exists — a transient infrastructure hiccup at open
// or read time, indistinguishable from a deletion by error alone — is retried and, if it
// persists, returned as an error so the batch fails rather than silently dropping an
// attachment from a compliance export (MM-69338).
//
// NOTE: a failed stream may have already written a partial attachment to dst. That is safe
// only because the caller fails the whole batch on a non-nil error, so the incomplete output
// is discarded and the job retries; the closure must NOT return this error to gomail (MM-69242).
func streamAttachmentForExport(rctx request.CTX, backend filestore.FileBackend, path string, dst io.Writer) (missing bool, err error) {
	var written int64
	backoff := attachmentReadBackoff
	for stalled := 0; stalled < maxAttachmentReadAttempts; {
		var n int64
		n, err = streamAttachmentOnce(backend, path, dst, written)
		written += n

		if err == nil {
			return false, nil
		}
		if errors.Is(err, errAttachmentStreamFatal) {
			// Output-stream write failure or a failed resume Seek: retrying can't help, so
			// fail the batch.
			return false, err
		}

		// An open or read failure — both retryable, but first tell a genuinely-missing file
		// apart from a transient hiccup. If the object is gone (and we've emitted nothing yet),
		// skip it so a single deleted file can't block the export forever (preserves MM-62493).
		// Anything else — it still exists, or the existence check itself failed — is treated as
		// transient: retried, then failed, so a transient open/read error can't silently drop an
		// attachment from a compliance export (MM-69338). On S3/MinIO a deleted object isn't even
		// detected on open (minio-go's GetObject is lazy), so this read-time check is what makes
		// the skip work there at all.
		if written == 0 {
			if exists, existsErr := backend.FileExists(path); existsErr == nil && !exists {
				return true, nil
			}
		}

		if n > 0 {
			// Made forward progress: the next attempt resumes further along. Reset the
			// stall budget and backoff so a flaky connection can still finish a large file.
			stalled = 0
			backoff = attachmentReadBackoff
		} else {
			stalled++
			if stalled >= maxAttachmentReadAttempts {
				break
			}
		}

		// Transient failure: back off (exponentially) before retrying, but bail out promptly
		// if the job is being cancelled rather than sleeping through it.
		rctx.Logger().Warn("Transient error streaming attachment for Global Relay export; backing off before retry",
			mlog.String("filename", path), mlog.Int("bytesRead", written),
			mlog.Duration("backoff", backoff), mlog.Err(err))

		select {
		case <-time.After(backoff):
		case <-rctx.Context().Done():
			return false, rctx.Context().Err()
		}

		backoff *= 2
	}

	return false, err
}

// streamAttachmentOnce makes a single open+copy attempt, resuming past resumeFrom bytes so a
// retry continues rather than re-downloads. It returns the bytes copied in this attempt. A nil
// error means the attachment streamed fully. An error wrapping errAttachmentStreamFatal is not
// retryable (output-stream write failure or a failed resume Seek); any other error is a
// retryable open/read failure that the caller classifies as missing-vs-transient.
func streamAttachmentOnce(backend filestore.FileBackend, path string, dst io.Writer, resumeFrom int64) (int64, error) {
	reader, err := backend.Reader(path)
	if err != nil {
		// Open failure: retryable. The caller checks FileExists to tell a deleted file
		// (skip) from a transient hiccup (retry, then fail the batch).
		return 0, err
	}
	defer reader.Close()

	if resumeFrom > 0 {
		// Resume where the previous attempt left off instead of re-reading from the start.
		if _, err = reader.Seek(resumeFrom, io.SeekStart); err != nil {
			return 0, fmt.Errorf("%w: seeking to resume offset %d: %w", errAttachmentStreamFatal, resumeFrom, err)
		}
	}

	rd := &readErrorReader{Reader: reader}
	n, err := io.Copy(dst, rd)
	if err != nil && rd.readErr == nil {
		// io.Copy failed writing to the output stream, not reading the attachment.
		return n, fmt.Errorf("%w: %w", errAttachmentStreamFatal, err)
	}
	return n, err
}

// readErrorReader wraps a reader and remembers the last non-EOF read error. It lets the
// caller of io.Copy tell a failed attachment read (retryable) apart from a failed write to
// the output stream (not retryable), which io.Copy collapses into a single error.
type readErrorReader struct {
	io.Reader
	readErr error
}

func (r *readErrorReader) Read(p []byte) (int, error) {
	n, err := r.Reader.Read(p)
	if err != nil && err != io.EOF {
		r.readErr = err
	}
	return n, err
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
		if overrideUsername, ok := postPropsLocal[model.PostPropsOverrideUsername]; ok {
			postUserName = overrideUsername.(string)
		}

		if postUserName == originalUsername {
			if overrideUsername, ok := postPropsLocal[model.PostPropsWebhookDisplayName]; ok {
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
