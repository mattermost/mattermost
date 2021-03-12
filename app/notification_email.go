// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"html"
	"html/template"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/pkg/errors"
)

func (a *App) sendNotificationEmail(notification *PostNotification, user *model.User, team *model.Team) error {
	channel := notification.Channel
	post := notification.Post

	if channel.IsGroupOrDirect() {
		teams, err := a.Srv().Store.Team().GetTeamsByUserId(user.Id)
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
		if data, err := a.Srv().Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); err != nil {
			// if the call fails, assume that the interval has not been explicitly set and batch the notifications
			sendBatched = true
		} else {
			// if the user has chosen to receive notifications immediately, don't batch them
			sendBatched = data.Value != model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS
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
	if data, err := a.Srv().Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_USE_MILITARY_TIME); err != nil {
		useMilitaryTime = true
	} else {
		useMilitaryTime = data.Value == "true"
	}

	nameFormat := a.GetNotificationNameFormat(user)

	channelName := notification.GetChannelName(nameFormat, "")
	senderName := notification.GetSenderName(nameFormat, *a.Config().ServiceSettings.EnablePostUsernameOverride)

	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	if license := a.Srv().License(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	var subjectText string
	if channel.Type == model.CHANNEL_DIRECT {
		subjectText = getDirectMessageNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, senderName, useMilitaryTime)
	} else if channel.Type == model.CHANNEL_GROUP {
		subjectText = getGroupMessageNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, channelName, emailNotificationContentsType, useMilitaryTime)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channelName+")", useMilitaryTime)
	} else {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, *a.Config().TeamSettings.SiteName, team.DisplayName, useMilitaryTime)
	}

	landingURL := a.GetSiteURL() + "/landing#/" + team.Name
	var bodyText, err = a.getNotificationEmailBody(user, post, channel, channelName, senderName, team.Name, landingURL, emailNotificationContentsType, useMilitaryTime, translateFunc)
	if err != nil {
		return errors.Wrap(err, "unable to render the email notification template")
	}

	a.Srv().Go(func() {
		if nErr := a.Srv().EmailService.sendNotificationMail(user.Email, html.UnescapeString(subjectText), bodyText); nErr != nil {
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
	var subjectParameters = map[string]interface{}{
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
	var subjectParameters = map[string]interface{}{
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
	var subjectParameters = map[string]interface{}{
		"SiteName": siteName,
		"Month":    t.Month,
		"Day":      t.Day,
		"Year":     t.Year,
	}
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		subjectParameters["ChannelName"] = channelName
		return translateFunc("app.notification.subject.group_message.full", subjectParameters)
	}
	return translateFunc("app.notification.subject.group_message.generic", subjectParameters)
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, landingURL string, emailNotificationContentsType string, useMilitaryTime bool, translateFunc i18n.TranslateFunc) (string, error) {
	// only include message contents in notification email if email notification contents type is set to full
	var templateName = "post_body_generic"
	data := a.Srv().EmailService.newEmailTemplateData(recipient.Locale)
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		templateName = "post_body_full"
		postMessage := a.GetMessageForNotification(post, translateFunc)
		postMessage = html.EscapeString(postMessage)
		normalizedPostMessage, err := a.generateHyperlinkForChannels(postMessage, teamName, landingURL)
		if err != nil {
			mlog.Warn("Encountered error while generating hyperlink for channels", mlog.String("team_name", teamName), mlog.Err(err))
			normalizedPostMessage = postMessage
		}
		data.Props["PostMessage"] = template.HTML(normalizedPostMessage)
	}

	data.Props["SiteURL"] = a.GetSiteURL()
	if teamName != "select_team" {
		data.Props["TeamLink"] = landingURL + "/pl/" + post.Id
	} else {
		data.Props["TeamLink"] = landingURL
	}

	t := getFormattedPostTime(recipient, post, useMilitaryTime, translateFunc)

	info := map[string]interface{}{
		"Hour":     t.Hour,
		"Minute":   t.Minute,
		"TimeZone": t.TimeZone,
		"Month":    t.Month,
		"Day":      t.Day,
	}
	if channel.Type == model.CHANNEL_DIRECT {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.full")
			data.Props["Info1"] = ""
			info["SenderName"] = senderName
			data.Props["Info2"] = translateFunc("app.notification.body.text.direct.full", info)
		} else {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			data.Props["Info"] = translateFunc("app.notification.body.text.direct.generic", info)
		}
	} else if channel.Type == model.CHANNEL_GROUP {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.full")
			data.Props["Info1"] = translateFunc("app.notification.body.text.group_message.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			info["SenderName"] = senderName
			data.Props["Info2"] = translateFunc("app.notification.body.text.group_message.full2", info)
		} else {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			data.Props["Info"] = translateFunc("app.notification.body.text.group_message.generic", info)
		}
	} else {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.full")
			data.Props["Info1"] = translateFunc("app.notification.body.text.notification.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			info["SenderName"] = senderName
			data.Props["Info2"] = translateFunc("app.notification.body.text.notification.full2", info)
		} else {
			data.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			data.Props["Info"] = translateFunc("app.notification.body.text.notification.generic", info)
		}
	}

	data.Props["Button"] = translateFunc("api.templates.post_body.button")

	return a.Srv().TemplatesContainer().RenderToString(templateName, data)
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

func (a *App) generateHyperlinkForChannels(postMessage, teamName, teamURL string) (string, *model.AppError) {
	team, err := a.GetTeamByName(teamName)
	if err != nil {
		return "", err
	}

	channelNames := model.ChannelMentions(postMessage)
	if len(channelNames) == 0 {
		return postMessage, nil
	}

	channels, err := a.GetChannelsByNames(channelNames, team.Id)
	if err != nil {
		return "", err
	}

	visited := make(map[string]bool)
	for _, ch := range channels {
		if !visited[ch.Id] && ch.Type == model.CHANNEL_OPEN {
			channelURL := teamURL + "/channels/" + ch.Name
			channelHyperLink := fmt.Sprintf("<a href='%s'>%s</a>", channelURL, "~"+ch.Name)
			postMessage = strings.Replace(postMessage, "~"+ch.Name, channelHyperLink, -1)
			visited[ch.Id] = true
		}
	}
	return postMessage, nil
}

func (s *Server) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if strings.TrimSpace(post.Message) != "" || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	infos, err := s.Store.FileInfo().GetForPost(post.Id, true, false, true)
	if err != nil {
		mlog.Warn("Encountered error when getting files for notification message", mlog.String("post_id", post.Id), mlog.Err(err))
	}

	filenames := make([]string, len(infos))
	onlyImages := true
	for i, info := range infos {
		if escaped, err := url.QueryUnescape(filepath.Base(info.Name)); err != nil {
			// this should never error since filepath was escaped using url.QueryEscape
			filenames[i] = escaped
		} else {
			filenames[i] = info.Name
		}

		onlyImages = onlyImages && info.IsImage()
	}

	props := map[string]interface{}{"Filenames": strings.Join(filenames, ", ")}

	if onlyImages {
		return translateFunc("api.post.get_message_for_notification.images_sent", len(filenames), props)
	}
	return translateFunc("api.post.get_message_for_notification.files_sent", len(filenames), props)
}

func (a *App) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	return a.Srv().GetMessageForNotification(post, translateFunc)
}
