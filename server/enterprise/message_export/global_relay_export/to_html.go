// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"bytes"
	"html/template"
	"sort"
	"strings"
	"time"

	"github.com/hako/durafmt"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/shared/templates"
)

func TimestampConvert(timestampMS int64) string {
	return time.Unix(timestampMS/1000, 0).UTC().Format(time.RFC3339)

	// for testing:  (keep in case we need to be specific -- helps when you have joins and leaves within millis of each other)
	//return fmt.Sprintf("%d", timestampMS)
}

func channelExportToHTML(rctx request.CTX, channelExport *ChannelExport, t *templates.Container) (string, error) {
	durationMilliseconds := channelExport.EndTime - channelExport.StartTime
	duration := time.Duration(durationMilliseconds) * time.Millisecond

	var participantRowsBuffer bytes.Buffer
	for i := range channelExport.Participants {
		participantHTML, err := participantToHTML(&channelExport.Participants[i], t)
		if err != nil {
			rctx.Logger().Error("Unable to render participant html for compliance export", mlog.Err(err))
			continue
		}
		participantRowsBuffer.WriteString(participantHTML)
	}

	var messagesBuffer bytes.Buffer
	sort.Slice(channelExport.Messages, func(i, j int) bool {
		if channelExport.Messages[i].SentTime == channelExport.Messages[j].SentTime {
			return !strings.HasPrefix(channelExport.Messages[i].Message, "Uploaded file") &&
				!strings.HasPrefix(channelExport.Messages[i].Message, "Deleted file") &&
				channelExport.Messages[i].UpdateType == ""
		}
		return channelExport.Messages[i].SentTime < channelExport.Messages[j].SentTime
	})
	for i := range channelExport.Messages {
		messageHTML, err := messageToHTML(&channelExport.Messages[i], t)
		if err != nil {
			rctx.Logger().Error("Unable to render message html for compliance export", mlog.Err(err))
			continue
		}
		messagesBuffer.WriteString(messageHTML)
	}

	data := templates.Data{
		Props: map[string]any{
			"TeamId":             channelExport.TeamId,
			"TeamName":           channelExport.TeamName,
			"TeamDisplayName":    channelExport.TeamDisplayName,
			"ChannelId":          channelExport.ChannelId,
			"ChannelName":        channelExport.ChannelName,
			"ChannelDisplayName": channelExport.ChannelDisplayName,
			"Started":            TimestampConvert(channelExport.StartTime),
			"Ended":              TimestampConvert(channelExport.EndTime),
			"Duration":           durafmt.Parse(duration.Round(time.Minute)).String(),
			"ParticipantRows":    template.HTML(participantRowsBuffer.String()),
			"Messages":           template.HTML(messagesBuffer.String()),
			"ExportDate":         TimestampConvert(channelExport.ExportedOn),
		},
	}

	return t.RenderToString("globalrelay_compliance_export", data)
}

func participantToHTML(participant *ParticipantRow, t *templates.Container) (string, error) {
	durationMilliseconds := participant.LeaveTime - participant.JoinTime
	duration := time.Duration(durationMilliseconds) * time.Millisecond

	data := templates.Data{
		Props: map[string]any{
			"UserId":      participant.UserId,
			"Username":    participant.Username,
			"UserType":    participant.UserType,
			"Email":       participant.UserEmail,
			"Joined":      TimestampConvert(participant.JoinTime),
			"Left":        TimestampConvert(participant.LeaveTime),
			"Duration":    durafmt.Parse(duration.Round(time.Minute)).String(),
			"NumMessages": participant.MessagesSent,
		},
	}
	return t.RenderToString("globalrelay_compliance_export_participant_row", data)
}

func messageToHTML(message *Message, t *templates.Container) (string, error) {
	postUsername := message.PostUsername
	// Added to improve readability
	if postUsername != "" {
		postUsername = "@" + postUsername
	}
	data := templates.Data{
		Props: map[string]any{
			"PostId":         message.Id,
			"SentTime":       TimestampConvert(message.SentTime),
			"UserId":         message.SenderId,
			"Username":       message.SenderUsername,
			"PostUsername":   postUsername,
			"UserType":       message.SenderUserType,
			"Email":          message.SenderEmail,
			"Message":        message.Message,
			"PreviewsPost":   message.PreviewsPost,
			"UpdateTime":     TimestampConvert(message.UpdateAt),
			"UpdateType":     message.UpdateType,
			"EditedNewMsgId": message.EditedNewMsgId,
		},
	}

	return t.RenderToString("globalrelay_compliance_export_message", data)
}
