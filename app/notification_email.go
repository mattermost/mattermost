// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"html"
	"html/template"
	"io"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/app/request"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/i18n"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils"
	"github.com/pkg/errors"
)

func (a *App) sendNotificationEmail(c request.CTX, notification *PostNotification, user *model.User, team *model.Team, senderProfileImage []byte) error {
	channel := notification.Channel
	post := notification.Post

	if channel.IsGroupOrDirect() {
		teams, err := a.Srv().Store().Team().GetTeamsByUserId(user.Id)
		if err != nil {
			return errors.Wrap(err, "unable to get user teams")
		}

		// if the recipient isn't in the current user's team, just pick one
		found := false

		for i := range teams {
			if teams[i].Id == team.Id {
				found = true
				break
			}
		}

		if !found && len(teams) > 0 {
			team = teams[0]
		} else {
			// in case the user hasn't joined any teams we send them to the select_team page
			team = &model.Team{Name: "select_team", DisplayName: *a.Config().TeamSettings.SiteName}
		}
	}

	if *a.Config().EmailSettings.EnableEmailBatching {
		var sendBatched bool
		if data, err := a.Srv().Store().Preference().Get(user.Id, model.PreferenceCategoryNotifications, model.PreferenceNameEmailInterval); err != nil {
			// if the call fails, assume that the interval has not been explicitly set and batch the notifications
			sendBatched = true
		} else {
			// if the user has chosen to receive notifications immediately, don't batch them
			sendBatched = data.Value != model.PreferenceEmailIntervalNoBatchingSeconds
		}

		if sendBatched {
			if err := a.Srv().EmailService.AddNotificationEmailToBatch(user, post, team); err == nil {
				return nil
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	translateFunc := i18n.GetUserTranslations(user.Locale)

	var useMilitaryTime bool
	if data, err := a.Srv().Store().Preference().Get(user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime); err != nil {
		useMilitaryTime = true
	} else {
		useMilitaryTime = data.Value == "true"
	}

	nameFormat := a.GetNotificationNameFormat(user)

	channelName := notification.GetChannelName(nameFormat, "")
	senderName := notification.GetSenderName(nameFormat, *a.Config().ServiceSettings.EnablePostUsernameOverride)

	emailNotificationContentsType := model.EmailNotificationContentsFull
	if license := a.Srv().License(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	var subjectText string
	if channel.Type == model.ChannelTypeDirect {
		subjectText = getDirectMessageNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, senderName, useMilitaryTime)
	} else if channel.Type == model.ChannelTypeGroup {
		subjectText = getGroupMessageNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, channelName, emailNotificationContentsType, useMilitaryTime)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channelName+")", useMilitaryTime)
	} else {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName, useMilitaryTime)
	}

	senderPhoto := ""
	embeddedFiles := make(map[string]io.Reader)
	if emailNotificationContentsType == model.EmailNotificationContentsFull && senderProfileImage != nil {
		senderPhoto = "user-avatar.png"
		embeddedFiles = map[string]io.Reader{
			senderPhoto: bytes.NewReader(senderProfileImage),
		}
	}

	landingURL := a.GetSiteURL() + "/landing#/" + team.Name

	var bodyText, err = a.getNotificationEmailBody(c, user, post, channel, channelName, senderName, team.Name, landingURL, emailNotificationContentsType, useMilitaryTime, translateFunc, senderPhoto)
	if err != nil {
		return errors.Wrap(err, "unable to render the email notification template")
	}

	templateString := "<%s@" + utils.GetHostnameFromSiteURL(a.GetSiteURL()) + ">"
	messageID := ""
	inReplyTo := ""
	references := ""

	if post.Id != "" {
		messageID = fmt.Sprintf(templateString, post.Id)
	}

	if post.RootId != "" {
		referencesVal := fmt.Sprintf(templateString, post.RootId)
		inReplyTo = referencesVal
		references = referencesVal
	}

	a.Srv().Go(func() {
		if nErr := a.Srv().EmailService.SendMailWithEmbeddedFiles(user.Email, html.UnescapeString(subjectText), bodyText, embeddedFiles, messageID, inReplyTo, references); nErr != nil {
			mlog.Error("Error while sending the email", mlog.String("user_email", user.Email), mlog.Err(nErr))
		}
	})

	if a.Metrics() != nil {
		a.Metrics().IncrementPostSentEmail()
	}

	return nil
}

/**
 * Computes the subject line for direct notification email messages
 */
func getDirectMessageNotificationEmailSubject(user *model.User, post *model.Post, translateFunc i18n.TranslateFunc, siteName string, senderName string, useMilitaryTime bool) string {
	t := getFormattedPostTime(user, post, useMilitaryTime, translateFunc)
	var subjectParameters = map[string]any{
		"SiteName":          siteName,
		"SenderDisplayName": senderName,
		"Month":             t.Month,
		"Day":               t.Day,
		"Year":              t.Year,
	}
	return translateFunc("app.notification.subject.direct.full", subjectParameters)
}

/**
 * Computes the subject line for group, public, and private email messages
 */
func getNotificationEmailSubject(user *model.User, post *model.Post, translateFunc i18n.TranslateFunc, siteName string, teamName string, useMilitaryTime bool) string {
	t := getFormattedPostTime(user, post, useMilitaryTime, translateFunc)
	var subjectParameters = map[string]any{
		"SiteName": siteName,
		"TeamName": teamName,
		"Month":    t.Month,
		"Day":      t.Day,
		"Year":     t.Year,
	}
	return translateFunc("app.notification.subject.notification.full", subjectParameters)
}

/**
 * Computes the subject line for group email messages
 */
func getGroupMessageNotificationEmailSubject(user *model.User, post *model.Post, translateFunc i18n.TranslateFunc, siteName string, channelName string, emailNotificationContentsType string, useMilitaryTime bool) string {
	t := getFormattedPostTime(user, post, useMilitaryTime, translateFunc)
	var subjectParameters = map[string]any{
		"SiteName": siteName,
		"Month":    t.Month,
		"Day":      t.Day,
		"Year":     t.Year,
	}
	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		subjectParameters["ChannelName"] = channelName
		return translateFunc("app.notification.subject.group_message.full", subjectParameters)
	}
	return translateFunc("app.notification.subject.group_message.generic", subjectParameters)
}

/**
* If the name is longer than i characters, replace remaining characters with ...
 */
func truncateUserNames(name string, i int) string {
	runes := []rune(name)
	if len(runes) > i {
		newString := string(runes[:i])
		return newString + "..."
	}
	return name
}

type FieldRow struct {
	Cells []*model.SlackAttachmentField
}

type EmailMessageAttachment struct {
	model.SlackAttachment

	Pretext   template.HTML
	Text      template.HTML
	FieldRows []FieldRow
}

type postData struct {
	SenderName               string
	ChannelName              string
	Message                  template.HTML
	MessageURL               string
	SenderPhoto              string
	PostPhoto                string
	Time                     string
	ShowChannelIcon          bool
	OtherChannelMembersCount int
	MessageAttachments       []*EmailMessageAttachment
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(c request.CTX, recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, landingURL string, emailNotificationContentsType string, useMilitaryTime bool, translateFunc i18n.TranslateFunc, senderPhoto string) (string, error) {
	pData := postData{
		SenderName:  truncateUserNames(senderName, 22),
		SenderPhoto: senderPhoto,
	}

	t := getFormattedPostTime(recipient, post, useMilitaryTime, translateFunc)
	messageTime := map[string]any{
		"Hour":     t.Hour,
		"Minute":   t.Minute,
		"TimeZone": t.TimeZone,
	}

	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		postMessage := a.GetMessageForNotification(post, translateFunc)
		postMessage = html.EscapeString(postMessage)
		mdPostMessage, mdErr := utils.MarkdownToHTML(postMessage)
		if mdErr != nil {
			mlog.Warn("Encountered error while converting markdown to HTML", mlog.Err(mdErr))
			mdPostMessage = postMessage
		}

		normalizedPostMessage, err := a.generateHyperlinkForChannels(c, mdPostMessage, teamName, landingURL)
		if err != nil {
			mlog.Warn("Encountered error while generating hyperlink for channels", mlog.String("team_name", teamName), mlog.Err(err))
			normalizedPostMessage = mdPostMessage
		}
		pData.Message = template.HTML(normalizedPostMessage)
		pData.Time = translateFunc("app.notification.body.dm.time", messageTime)
		pData.MessageAttachments = a.processMessageAttachments(post)
	}

	data := a.Srv().EmailService.NewEmailTemplateData(recipient.Locale)
	data.Props["SiteURL"] = a.GetSiteURL()
	if teamName != "select_team" {
		data.Props["ButtonURL"] = landingURL + "/pl/" + post.Id
	} else {
		data.Props["ButtonURL"] = landingURL
	}

	data.Props["SenderName"] = senderName
	data.Props["Button"] = translateFunc("api.templates.post_body.button")
	data.Props["NotificationFooterTitle"] = translateFunc("app.notification.footer.title")
	data.Props["NotificationFooterInfoLogin"] = translateFunc("app.notification.footer.infoLogin")
	data.Props["NotificationFooterInfo"] = translateFunc("app.notification.footer.info")

	if channel.Type == model.ChannelTypeDirect {
		// Direct Messages
		data.Props["Title"] = translateFunc("app.notification.body.dm.title", map[string]any{"SenderName": senderName})
		data.Props["SubTitle"] = translateFunc("app.notification.body.dm.subTitle", map[string]any{"SenderName": senderName})
	} else if channel.Type == model.ChannelTypeGroup {
		// Group Messages
		data.Props["Title"] = translateFunc("app.notification.body.group.title", map[string]any{"SenderName": senderName})
		data.Props["SubTitle"] = translateFunc("app.notification.body.group.subTitle", map[string]any{"SenderName": senderName})
	} else {
		// mentions
		data.Props["Title"] = translateFunc("app.notification.body.mention.title", map[string]any{"SenderName": senderName})
		data.Props["SubTitle"] = translateFunc("app.notification.body.mention.subTitle", map[string]any{"SenderName": senderName, "ChannelName": channelName})
		pData.ChannelName = channelName
	}

	// Override title and subtile for replies with CRT enabled
	if a.IsCRTEnabledForUser(c, recipient.Id) && post.RootId != "" {
		// Title is the same in all cases
		data.Props["Title"] = translateFunc("app.notification.body.thread.title", map[string]any{"SenderName": senderName})

		if channel.Type == model.ChannelTypeDirect {
			// Direct Reply
			data.Props["SubTitle"] = translateFunc("app.notification.body.thread_dm.subTitle", map[string]any{"SenderName": senderName})
		} else if channel.Type == model.ChannelTypeGroup {
			// Group Reply
			data.Props["SubTitle"] = translateFunc("app.notification.body.thread_gm.subTitle", map[string]any{"SenderName": senderName})
		} else if emailNotificationContentsType == model.EmailNotificationContentsFull {
			// Channel Reply with full content
			data.Props["SubTitle"] = translateFunc("app.notification.body.thread_channel_full.subTitle", map[string]any{"SenderName": senderName, "ChannelName": channelName})
		} else {
			// Channel Reply with generic content
			data.Props["SubTitle"] = translateFunc("app.notification.body.thread_channel.subTitle", map[string]any{"SenderName": senderName})
		}
	}

	// only include posts in notification email if email notification contents type is set to full
	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		data.Props["Posts"] = []postData{pData}
	} else {
		data.Props["Posts"] = []postData{}
	}

	return a.Srv().TemplatesContainer().RenderToString("messages_notification", data)
}

func (a *App) processMessageAttachments(post *model.Post) []*EmailMessageAttachment {
	emailMessageAttachments := []*EmailMessageAttachment{}

	for _, messageAttachment := range post.Attachments() {
		emailMessageAttachment := &EmailMessageAttachment{
			SlackAttachment: *messageAttachment,
			Pretext:         a.prepareTextForEmail(messageAttachment.Pretext),
			Text:            a.prepareTextForEmail(messageAttachment.Text),
		}

		stripedTitle, err := utils.StripMarkdown(emailMessageAttachment.Title)
		if err != nil {
			mlog.Warn("Failed parse to markdown from messageatatchment title", mlog.String("post_id", post.Id), mlog.Err(err))
			stripedTitle = ""
		}

		emailMessageAttachment.Title = stripedTitle

		shortFieldRow := FieldRow{}

		for i := range messageAttachment.Fields {
			// Create a new instance to avoid altering the original pointer reference
			// We update field value to parse markdown.
			// If we do that on the original pointer, the rendered text in mattermost
			// becomes invalid as its no longer a markdown string, but rather an HTML string.
			field := &model.SlackAttachmentField{
				Title: messageAttachment.Fields[i].Title,
				Value: messageAttachment.Fields[i].Value,
				Short: messageAttachment.Fields[i].Short,
			}

			if stringValue, ok := field.Value.(string); ok {
				field.Value = a.prepareTextForEmail(stringValue)
			}

			if !field.Short {
				if len(shortFieldRow.Cells) > 0 {
					emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
					shortFieldRow = FieldRow{}
				}

				emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, FieldRow{[]*model.SlackAttachmentField{field}})
			} else {
				shortFieldRow.Cells = append(shortFieldRow.Cells, field)

				if len(shortFieldRow.Cells) == 2 {
					emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
					shortFieldRow = FieldRow{}
				}
			}
		}

		// collect any leftover short fields
		if len(shortFieldRow.Cells) > 0 {
			emailMessageAttachment.FieldRows = append(emailMessageAttachment.FieldRows, shortFieldRow)
			shortFieldRow = FieldRow{}
		}

		emailMessageAttachments = append(emailMessageAttachments, emailMessageAttachment)
	}

	return emailMessageAttachments
}

func (a *App) prepareTextForEmail(text string) template.HTML {
	escapedText := html.EscapeString(text)
	markdownText, err := utils.MarkdownToHTML(escapedText)
	if err != nil {
		mlog.Warn("Encountered error while converting markdown to HTML", mlog.Err(err))
		return template.HTML(text)
	}

	return template.HTML(markdownText)
}

type formattedPostTime struct {
	Time     time.Time
	Year     string
	Month    string
	Day      string
	Hour     string
	Minute   string
	TimeZone string
}

func getFormattedPostTime(user *model.User, post *model.Post, useMilitaryTime bool, translateFunc i18n.TranslateFunc) formattedPostTime {
	preferredTimezone := user.GetPreferredTimezone()
	postTime := time.Unix(post.CreateAt/1000, 0)
	zone, _ := postTime.Zone()

	localTime := postTime
	if preferredTimezone != "" {
		loc, _ := time.LoadLocation(preferredTimezone)
		if loc != nil {
			localTime = postTime.In(loc)
			zone, _ = localTime.Zone()
		}
	}

	hour := localTime.Format("15")
	period := ""
	if !useMilitaryTime {
		hour = localTime.Format("3")
		period = " " + localTime.Format("PM")
	}

	return formattedPostTime{
		Time:     localTime,
		Year:     fmt.Sprintf("%d", localTime.Year()),
		Month:    translateFunc(localTime.Month().String()),
		Day:      fmt.Sprintf("%d", localTime.Day()),
		Hour:     hour,
		Minute:   fmt.Sprintf("%02d"+period, localTime.Minute()),
		TimeZone: zone,
	}
}

func (a *App) generateHyperlinkForChannels(c request.CTX, postMessage, teamName, teamURL string) (string, *model.AppError) {
	team, err := a.GetTeamByName(teamName)
	if err != nil {
		return "", err
	}

	channelNames := model.ChannelMentions(postMessage)
	if len(channelNames) == 0 {
		return postMessage, nil
	}

	channels, err := a.GetChannelsByNames(c, channelNames, team.Id)
	if err != nil {
		return "", err
	}

	visited := make(map[string]bool)
	for _, ch := range channels {
		if !visited[ch.Id] && ch.Type == model.ChannelTypeOpen {
			channelURL := teamURL + "/channels/" + ch.Name
			channelHyperLink := fmt.Sprintf("<a href='%s'>%s</a>", channelURL, "~"+ch.Name)
			postMessage = strings.ReplaceAll(postMessage, "~"+ch.Name, channelHyperLink)
			visited[ch.Id] = true
		}
	}
	return postMessage, nil
}

func (a *App) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	return a.Srv().EmailService.GetMessageForNotification(post, translateFunc)
}
