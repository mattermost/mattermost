// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"fmt"
	"html"
	"html/template"
	"io"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	email "github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
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
		useMilitaryTime = false
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
		if nErr := a.Srv().EmailService.SendMailWithEmbeddedFiles(user.Email, html.UnescapeString(subjectText), bodyText, embeddedFiles, messageID, inReplyTo, references, "Notification"); nErr != nil {
			c.Logger().Error("Error while sending the email", mlog.String("user_email", user.Email), mlog.Err(nErr))
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
	t := utils.GetFormattedPostTime(user, post, useMilitaryTime, translateFunc)
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
	t := utils.GetFormattedPostTime(user, post, useMilitaryTime, translateFunc)
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
	t := utils.GetFormattedPostTime(user, post, useMilitaryTime, translateFunc)
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
	MessageAttachments       []*email.EmailMessageAttachment
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(c request.CTX, recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, landingURL string, emailNotificationContentsType string, useMilitaryTime bool, translateFunc i18n.TranslateFunc, senderPhoto string) (string, error) {
	pData := postData{
		SenderName:  truncateUserNames(senderName, 22),
		SenderPhoto: senderPhoto,
	}

	t := utils.GetFormattedPostTime(recipient, post, useMilitaryTime, translateFunc)
	messageTime := map[string]any{
		"Hour":     t.Hour,
		"Minute":   t.Minute,
		"TimeZone": t.TimeZone,
	}

	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		postMessage := a.GetMessageForNotification(post, teamName, a.GetSiteURL(), translateFunc)
		pData.Message = template.HTML(postMessage)
		pData.Time = translateFunc("app.notification.body.dm.time", messageTime)
		pData.MessageAttachments = email.ProcessMessageAttachments(post, a.GetSiteURL())
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

func (a *App) GetMessageForNotification(post *model.Post, teamName, siteUrl string, translateFunc i18n.TranslateFunc) string {
	return a.Srv().EmailService.GetMessageForNotification(post, teamName, siteUrl, translateFunc)
}
