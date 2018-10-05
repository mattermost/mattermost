// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"html"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

func (a *App) sendNotificationEmail(notification *postNotification, user *model.User, team *model.Team) *model.AppError {
	channel := notification.channel
	post := notification.post

	if channel.IsGroupOrDirect() {
		result := <-a.Srv.Store.Team().GetTeamsByUserId(user.Id)
		if result.Err != nil {
			return result.Err
		}

		// if the recipient isn't in the current user's team, just pick one
		teams := result.Data.([]*model.Team)
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
			team = &model.Team{Name: "select_team", DisplayName: a.Config().TeamSettings.SiteName}
		}
	}

	if *a.Config().EmailSettings.EnableEmailBatching {
		var sendBatched bool
		if result := <-a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); result.Err != nil {
			// if the call fails, assume that the interval has not been explicitly set and batch the notifications
			sendBatched = true
		} else {
			// if the user has chosen to receive notifications immediately, don't batch them
			sendBatched = result.Data.(model.Preference).Value != model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS
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
	if result := <-a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_USE_MILITARY_TIME); result.Err != nil {
		useMilitaryTime = true
	} else {
		useMilitaryTime = result.Data.(model.Preference).Value == "true"
	}

	var nameFormat string
	if result := <-a.Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, model.PREFERENCE_NAME_NAME_FORMAT); result.Err != nil {
		nameFormat = *a.Config().TeamSettings.TeammateNameDisplay
	} else {
		nameFormat = result.Data.(model.Preference).Value
	}

	channelName := notification.GetChannelName(nameFormat, "")
	senderName := notification.GetSenderName(nameFormat, a.Config().ServiceSettings.EnablePostUsernameOverride)

	emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
	if license := a.License(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
	}

	var subjectText string
	if channel.Type == model.CHANNEL_DIRECT {
		subjectText = getDirectMessageNotificationEmailSubject(user, post, translateFunc, a.Config().TeamSettings.SiteName, senderName, useMilitaryTime)
	} else if channel.Type == model.CHANNEL_GROUP {
		subjectText = getGroupMessageNotificationEmailSubject(user, post, translateFunc, a.Config().TeamSettings.SiteName, channelName, emailNotificationContentsType, useMilitaryTime)
	} else if *a.Config().EmailSettings.UseChannelInEmailNotifications {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName+" ("+channelName+")", useMilitaryTime)
	} else {
		subjectText = getNotificationEmailSubject(user, post, translateFunc, a.Config().TeamSettings.SiteName, team.DisplayName, useMilitaryTime)
	}

	teamURL := a.GetSiteURL() + "/" + team.Name
	var bodyText = a.getNotificationEmailBody(user, post, channel, channelName, senderName, team.Name, teamURL, emailNotificationContentsType, useMilitaryTime, translateFunc)

	a.Go(func() {
		if err := a.SendMail(user.Email, html.UnescapeString(subjectText), bodyText); err != nil {
			mlog.Error(fmt.Sprint("Error to send the email", user.Email, err))
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
	var subjectText string
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		var subjectParameters = map[string]interface{}{
			"SiteName":    siteName,
			"ChannelName": channelName,
			"Month":       t.Month,
			"Day":         t.Day,
			"Year":        t.Year,
		}
		subjectText = translateFunc("app.notification.subject.group_message.full", subjectParameters)
	} else {
		var subjectParameters = map[string]interface{}{
			"SiteName": siteName,
			"Month":    t.Month,
			"Day":      t.Day,
			"Year":     t.Year,
		}
		subjectText = translateFunc("app.notification.subject.group_message.generic", subjectParameters)
	}
	return subjectText
}

/**
 * Computes the email body for notification messages
 */
func (a *App) getNotificationEmailBody(recipient *model.User, post *model.Post, channel *model.Channel, channelName string, senderName string, teamName string, teamURL string, emailNotificationContentsType string, useMilitaryTime bool, translateFunc i18n.TranslateFunc) string {
	// only include message contents in notification email if email notification contents type is set to full
	var bodyPage *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		bodyPage = a.NewEmailTemplate("post_body_full", recipient.Locale)
		bodyPage.Props["PostMessage"] = a.GetMessageForNotification(post, translateFunc)
	} else {
		bodyPage = a.NewEmailTemplate("post_body_generic", recipient.Locale)
	}

	bodyPage.Props["SiteURL"] = a.GetSiteURL()
	if teamName != "select_team" {
		bodyPage.Props["TeamLink"] = teamURL + "/pl/" + post.Id
	} else {
		bodyPage.Props["TeamLink"] = teamURL
	}

	t := getFormattedPostTime(recipient, post, useMilitaryTime, translateFunc)

	if channel.Type == model.CHANNEL_DIRECT {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.full")
			bodyPage.Props["Info1"] = ""
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.direct.full",
				map[string]interface{}{
					"SenderName": senderName,
					"Hour":       t.Hour,
					"Minute":     t.Minute,
					"TimeZone":   t.TimeZone,
					"Month":      t.Month,
					"Day":        t.Day,
				})
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.direct.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.direct.generic",
				map[string]interface{}{
					"Hour":     t.Hour,
					"Minute":   t.Minute,
					"TimeZone": t.TimeZone,
					"Month":    t.Month,
					"Day":      t.Day,
				})
		}
	} else if channel.Type == model.CHANNEL_GROUP {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.full")
			bodyPage.Props["Info1"] = translateFunc("app.notification.body.text.group_message.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.group_message.full2",
				map[string]interface{}{
					"SenderName": senderName,
					"Hour":       t.Hour,
					"Minute":     t.Minute,
					"TimeZone":   t.TimeZone,
					"Month":      t.Month,
					"Day":        t.Day,
				})
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.group_message.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.group_message.generic",
				map[string]interface{}{
					"Hour":     t.Hour,
					"Minute":   t.Minute,
					"TimeZone": t.TimeZone,
					"Month":    t.Month,
					"Day":      t.Day,
				})
		}
	} else {
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.full")
			bodyPage.Props["Info1"] = translateFunc("app.notification.body.text.notification.full",
				map[string]interface{}{
					"ChannelName": channelName,
				})
			bodyPage.Props["Info2"] = translateFunc("app.notification.body.text.notification.full2",
				map[string]interface{}{
					"SenderName": senderName,
					"Hour":       t.Hour,
					"Minute":     t.Minute,
					"TimeZone":   t.TimeZone,
					"Month":      t.Month,
					"Day":        t.Day,
				})
		} else {
			bodyPage.Props["BodyText"] = translateFunc("app.notification.body.intro.notification.generic", map[string]interface{}{
				"SenderName": senderName,
			})
			bodyPage.Props["Info"] = translateFunc("app.notification.body.text.notification.generic",
				map[string]interface{}{
					"Hour":     t.Hour,
					"Minute":   t.Minute,
					"TimeZone": t.TimeZone,
					"Month":    t.Month,
					"Day":      t.Day,
				})
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

func (a *App) GetMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if len(strings.TrimSpace(post.Message)) != 0 || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	var infos []*model.FileInfo
	if result := <-a.Srv.Store.FileInfo().GetForPost(post.Id, true, true); result.Err != nil {
		mlog.Warn(fmt.Sprintf("Encountered error when getting files for notification message, post_id=%v, err=%v", post.Id, result.Err), mlog.String("post_id", post.Id))
	} else {
		infos = result.Data.([]*model.FileInfo)
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
