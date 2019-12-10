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

	"github.com/mattermost/go-i18n/i18n"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func (a *App) sendNotificationEmail(notification *PostNotification, user *model.User, team *model.Team) *model.AppError {
	channel := notification.Channel
	post := notification.Post

	if channel.IsGroupOrDirect() {
		teams, err := a.Srv.Store.Team().GetTeamsByUserId(user.Id)
		if err != nil {
			return err
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
		if data, err := a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); err != nil {
			// if the call fails, assume that the interval has not been explicitly set and batch the notifications
			sendBatched = true
		} else {
			// if the user has chosen to receive notifications immediately, don't batch them
			sendBatched = data.Value != model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS
		}

		if sendBatched {
			if err := a.AddNotificationEmailToBatch(user, post, team); err == nil {
				return nil
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	translateFunc := utils.GetUserTranslations(user.Locale)

	var useMilitaryTime bool
	if data, err := a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_USE_MILITARY_TIME); err != nil {
		useMilitaryTime = true
	} else {
		useMilitaryTime = data.Value == "true"
	}

	nameFormat := a.GetNotificationNameFormat(user)

	channelName := notification.GetChannelName(nameFormat, "")
	senderName := notification.GetSenderName(nameFormat, *a.Config().ServiceSettings.EnablePostUsernameOverride)

	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	if license := a.License(); license != nil && *license.Features.EmailNotificationContents {
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
	var bodyText = a.getNotificationEmailBody(user, post, channel, channelName, senderName, team.Name, landingURL, emailNotificationContentsType, useMilitaryTime, translateFunc)

	a.Srv.Go(func() {
		if err := a.SendNotificationMail(user.Email, html.UnescapeString(subjectText), bodyText); err != nil {
			mlog.Error("Error while sending the email", mlog.String("user_email", user.Email), mlog.Err(err))
		}
	})

	if a.Metrics != nil {
		a.Metrics.IncrementPostSentEmail()
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
func (a *App) getNotificationEmailBody(recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, landingURL string, emailNotificationContentsType string, useMilitaryTime bool, translateFunc i18n.TranslateFunc) string {
	// only include message contents in notification email if email notification contents type is set to full
	var bodyPage *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		bodyPage = a.NewEmailTemplate("post_body_full", recipient.Locale)
		postMessage := a.GetMessageForNotification(post, translateFunc)
		postMessage = html.EscapeString(postMessage)
		normalizedPostMessage := a.generateHyperlinkForChannels(postMessage, teamName, landingURL)
		bodyPage.Props["PostMessage"] = template.HTML(normalizedPostMessage)
	} else {
		bodyPage = a.NewEmailTemplate("post_body_generic", recipient.Locale)
	}

	bodyPage.Props["SiteURL"] = a.GetSiteURL()
	if teamName != "select_team" {
		bodyPage.Props["TeamLink"] = landingURL + "/pl/" + post.Id
	} else {
		bodyPage.Props["TeamLink"] = landingURL
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
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.full")
			bodyPage.Props["Info1"] = ""
			info["SenderName"] = senderName
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.direct.full", info)
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.direct.generic", info)
		}
	} else if channel.Type == model.CHANNEL_GROUP {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.full")
			bodyPage.Props["Info1"] = translateFunc("app.notification.body.text.group_message.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			info["SenderName"] = senderName
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.group_message.full2", info)
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.group_message.generic", info)
		}
	} else {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.full")
			bodyPage.Props["Info1"] = translateFunc("app.notification.body.text.notification.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			info["SenderName"] = senderName
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.notification.full2", info)
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.notification.generic", info)
		}
	}

	bodyPage.Props["Button"] = translateFunc("api.templates.post_body.button")

	return bodyPage.Render()
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

func (a *App) generateHyperlinkForChannels(postMessage, teamName, teamURL string) string {
	team, err := a.GetTeamByName(teamName)
	if err != nil {
		mlog.Error("Encountered error while looking up team by name", mlog.String("team_name", teamName), mlog.Err(err))
		return postMessage
	}

	channelNames := model.ChannelMentions(postMessage)
	if len(channelNames) == 0 {
		return postMessage
	}

	channels, err := a.GetChannelsByNames(channelNames, team.Id)
	if err != nil {
		mlog.Error("Encountered error while getting channels", mlog.Err(err))
		return postMessage
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
	return postMessage
}

func (a *App) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if len(strings.TrimSpace(post.Message)) != 0 || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	infos, err := a.Srv.Store.FileInfo().GetForPost(post.Id, true, false, true)
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
