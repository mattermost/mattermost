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
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	email "github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

func (a *App) buildEmailNotification(
	rctx request.CTX,
	notification *PostNotification,
	user *model.User,
	team *model.Team,
) *model.EmailNotification {
	channel := notification.Channel
	post := notification.Post
	sender := notification.Sender

	translateFunc := i18n.GetUserTranslations(user.Locale)
	nameFormat := a.GetNotificationNameFormat(user)

	var useMilitaryTime bool
	if data, err := a.Srv().Store().Preference().Get(
		user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime,
	); err != nil {
		rctx.Logger().Debug("Failed to retrieve user military time preference, defaulting to false",
			mlog.String("user_id", user.Id), mlog.Err(err))
		useMilitaryTime = false
	} else {
		useMilitaryTime = data.Value == "true"
	}

	channelName := notification.GetChannelName(nameFormat, "")
	senderName := notification.GetSenderName(nameFormat,
		*a.Config().ServiceSettings.EnablePostUsernameOverride)

	emailNotificationContentsType := model.EmailNotificationContentsFull
	if license := a.Srv().License(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	var subject string
	if channel.Type == model.ChannelTypeDirect {
		subject = getDirectMessageNotificationEmailSubject(
			user, post, translateFunc, *a.Config().TeamSettings.SiteName, senderName, useMilitaryTime)
	} else if channel.Type == model.ChannelTypeGroup {
		subject = getGroupMessageNotificationEmailSubject(
			user, post, translateFunc, *a.Config().TeamSettings.SiteName, channelName, emailNotificationContentsType, useMilitaryTime)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subject = getNotificationEmailSubject(
			user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channelName+")", useMilitaryTime)
	} else {
		subject = getNotificationEmailSubject(
			user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName, useMilitaryTime)
	}

	var title, subtitle string
	if channel.Type == model.ChannelTypeDirect {
		title = translateFunc("app.notification.body.dm.title", map[string]any{"SenderName": senderName})
		subtitle = translateFunc("app.notification.body.dm.subTitle", map[string]any{"SenderName": senderName})
	} else if channel.Type == model.ChannelTypeGroup {
		title = translateFunc("app.notification.body.group.title", map[string]any{"SenderName": senderName})
		subtitle = translateFunc("app.notification.body.group.subTitle", map[string]any{"SenderName": senderName})
	} else {
		title = translateFunc("app.notification.body.mention.title", map[string]any{"SenderName": senderName})
		subtitle = translateFunc("app.notification.body.mention.subTitle", map[string]any{"SenderName": senderName, "ChannelName": channelName})
	}

	if a.IsCRTEnabledForUser(rctx, user.Id) && post.RootId != "" {
		title = translateFunc("app.notification.body.thread.title", map[string]any{"SenderName": senderName})
		if channel.Type == model.ChannelTypeDirect {
			subtitle = translateFunc("app.notification.body.thread_dm.subTitle", map[string]any{"SenderName": senderName})
		} else if channel.Type == model.ChannelTypeGroup {
			subtitle = translateFunc("app.notification.body.thread_gm.subTitle", map[string]any{"SenderName": senderName})
		} else if emailNotificationContentsType == model.EmailNotificationContentsFull {
			subtitle = translateFunc("app.notification.body.thread_channel_full.subTitle", map[string]any{"SenderName": senderName, "ChannelName": channelName})
		} else {
			subtitle = translateFunc("app.notification.body.thread_channel.subTitle", map[string]any{"SenderName": senderName})
		}
	}

	var messageHTML, messageText string
	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		messageHTML = a.GetMessageForNotification(post, team.Name, a.GetSiteURL(), translateFunc)
		messageText = post.Message
	}

	landingURL := a.GetSiteURL() + "/landing#/" + team.Name
	buttonURL := landingURL
	if team.Name != "select_team" {
		buttonURL = landingURL + "/pl/" + post.Id
	}

	return &model.EmailNotification{
		// Core identifiers (immutable)
		PostId:            post.Id,
		ChannelId:         channel.Id,
		TeamId:            team.Id,
		SenderId:          sender.Id,
		SenderDisplayName: senderName,
		RecipientId:       user.Id,
		RootId:            post.RootId,

		// Context for plugin decision-making (immutable)
		ChannelType:     string(channel.Type),
		ChannelName:     channelName,
		TeamName:        team.DisplayName,
		SenderUsername:  sender.Username,
		IsDirectMessage: channel.Type == model.ChannelTypeDirect,
		IsGroupMessage:  channel.Type == model.ChannelTypeGroup,
		IsThreadReply:   post.RootId != "",
		IsCRTEnabled:    a.IsCRTEnabledForUser(rctx, user.Id),
		UseMilitaryTime: useMilitaryTime,

		// Customizable content fields
		EmailNotificationContent: model.EmailNotificationContent{
			Subject:     subject,
			Title:       title,
			SubTitle:    subtitle,
			MessageHTML: messageHTML,
			MessageText: messageText,
			ButtonText:  translateFunc("api.templates.post_body.button"),
			ButtonURL:   buttonURL,
			FooterText:  translateFunc("app.notification.footer.title"),
		},
	}
}

func (a *App) sendNotificationEmail(rctx request.CTX, notification *PostNotification, user *model.User, team *model.Team, senderProfileImage []byte) (*model.EmailNotification, error) {
	channel := notification.Channel
	post := notification.Post

	if channel.IsGroupOrDirect() {
		teams, err := a.Srv().Store().Team().GetTeamsByUserId(user.Id)
		if err != nil {
			return nil, errors.Wrap(err, "unable to get user teams")
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

	// Create EmailNotification object for plugin customization
	emailNotification := a.buildEmailNotification(rctx, notification, user, team)

	// Call plugin hook to allow customization of emailNotification
	rejectionReason := ""
	a.ch.RunMultiHook(func(hooks plugin.Hooks, manifest *model.Manifest) bool {
		var replacementContent *model.EmailNotificationContent
		replacementContent, rejectionReason = hooks.EmailNotificationWillBeSent(emailNotification)
		if rejectionReason != "" {
			rctx.Logger().Info("Email notification cancelled by plugin.",
				mlog.String("rejection_reason", rejectionReason),
				mlog.String("plugin_id", manifest.Id),
				mlog.String("plugin_name", manifest.Name))
			return false
		}
		if replacementContent != nil {
			emailNotification.EmailNotificationContent = *replacementContent
		}
		return true
	}, plugin.EmailNotificationWillBeSentID)

	if rejectionReason != "" {
		// Email notification rejected by plugin
		a.CountNotificationReason(model.NotificationStatusNotSent, model.NotificationTypeEmail, model.NotificationReasonRejectedByPlugin, model.NotificationNoPlatform)
		rctx.Logger().LogM(mlog.MlvlNotificationDebug, "Email notification rejected by plugin",
			mlog.String("type", model.NotificationTypeEmail),
			mlog.String("status", model.NotificationStatusNotSent),
			mlog.String("reason", model.NotificationReasonRejectedByPlugin),
			mlog.String("rejection_reason", rejectionReason),
			mlog.String("user_id", user.Id),
			mlog.String("post_id", post.Id),
		)
		return nil, nil
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
				return emailNotification, nil
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	// Handle sender photo
	senderPhoto := ""
	embeddedFiles := make(map[string]io.Reader)
	if emailNotification.MessageHTML != "" && senderProfileImage != nil {
		senderPhoto = "user-avatar.png"
		embeddedFiles = map[string]io.Reader{
			senderPhoto: bytes.NewReader(senderProfileImage),
		}
	}

	// Build email body using EmailNotification data
	var bodyText, err = a.getNotificationEmailBodyFromEmailNotification(rctx, user, emailNotification, post, senderPhoto)
	if err != nil {
		return nil, errors.Wrap(err, "unable to render the email notification template")
	}

	templateString := "<%s@" + utils.GetHostnameFromSiteURL(a.GetSiteURL()) + ">"
	messageID := ""
	inReplyTo := ""
	references := ""

	if emailNotification.PostId != "" {
		messageID = fmt.Sprintf(templateString, emailNotification.PostId)
	}

	if emailNotification.RootId != "" {
		referencesVal := fmt.Sprintf(templateString, emailNotification.RootId)
		inReplyTo = referencesVal
		references = referencesVal
	}

	a.Srv().Go(func() {
		if nErr := a.Srv().EmailService.SendMailWithEmbeddedFiles(user.Email, html.UnescapeString(emailNotification.Subject), bodyText, embeddedFiles, messageID, inReplyTo, references, "Notification"); nErr != nil {
			rctx.Logger().Error("Error while sending the email", mlog.String("user_email", user.Email), mlog.Err(nErr))
		}
	})

	if a.Metrics() != nil {
		a.Metrics().IncrementPostSentEmail()
	}

	return emailNotification, nil
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

func (a *App) GetMessageForNotification(post *model.Post, teamName, siteUrl string, translateFunc i18n.TranslateFunc) string {
	return a.Srv().EmailService.GetMessageForNotification(post, teamName, siteUrl, translateFunc)
}

func (a *App) getNotificationEmailBodyFromEmailNotification(rctx request.CTX, recipient *model.User, emailNotification *model.EmailNotification, post *model.Post, senderPhoto string) (string, error) {
	translateFunc := i18n.GetUserTranslations(recipient.Locale)

	pData := postData{
		SenderName:  truncateUserNames(emailNotification.SenderDisplayName, 22),
		SenderPhoto: senderPhoto,
	}

	if emailNotification.MessageHTML != "" {
		pData.Message = template.HTML(emailNotification.MessageHTML)

		// Get formatted time for message using the UseMilitaryTime field
		t := utils.GetFormattedPostTime(recipient, post, emailNotification.UseMilitaryTime, translateFunc)
		messageTime := map[string]any{
			"Hour":     t.Hour,
			"Minute":   t.Minute,
			"TimeZone": t.TimeZone,
		}
		pData.Time = translateFunc("app.notification.body.dm.time", messageTime)

		// Process message attachments
		pData.MessageAttachments = email.ProcessMessageAttachments(post, a.GetSiteURL())
	}

	data := a.Srv().EmailService.NewEmailTemplateData(recipient.Locale)
	data.Props["SiteURL"] = a.GetSiteURL()
	data.Props["ButtonURL"] = emailNotification.ButtonURL
	data.Props["SenderName"] = emailNotification.SenderDisplayName
	data.Props["Button"] = emailNotification.ButtonText
	data.Props["NotificationFooterTitle"] = emailNotification.FooterText
	data.Props["NotificationFooterInfoLogin"] = translateFunc("app.notification.footer.infoLogin")
	data.Props["NotificationFooterInfo"] = translateFunc("app.notification.footer.info")
	data.Props["Title"] = emailNotification.Title
	data.Props["SubTitle"] = emailNotification.SubTitle

	if emailNotification.IsDirectMessage || emailNotification.IsGroupMessage {
		// No channel name for DM/GM
	} else {
		pData.ChannelName = emailNotification.ChannelName
	}

	// Only include posts in notification email if message content is available
	if emailNotification.MessageHTML != "" {
		data.Props["Posts"] = []postData{pData}
	} else {
		data.Props["Posts"] = []postData{}
	}

	return a.Srv().TemplatesContainer().RenderToString("messages_notification", data)
}
