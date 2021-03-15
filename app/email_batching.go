// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/i18n"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

const (
	EmailBatchingTaskName = "Email Batching"
)

func (es *EmailService) InitEmailBatching() {
	if *es.srv.Config().EmailSettings.EnableEmailBatching {
		if es.EmailBatching == nil {
			es.EmailBatching = NewEmailBatchingJob(es, *es.srv.Config().EmailSettings.EmailBatchingBufferSize)
		}

		// note that we don't support changing EmailBatchingBufferSize without restarting the server

		es.EmailBatching.Start()
	}
}

func (es *EmailService) AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team) *model.AppError {
	if !*es.srv.Config().EmailSettings.EnableEmailBatching {
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !es.EmailBatching.Add(user, post, team) {
		mlog.Error("Email batching job's receiving channel was full. Please increase the EmailBatchingBufferSize.")
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.channel_full.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

type batchedNotification struct {
	userID   string
	post     *model.Post
	teamName string
}

type EmailBatchingJob struct {
	server               *Server
	newNotifications     chan *batchedNotification
	pendingNotifications map[string][]*batchedNotification
	task                 *model.ScheduledTask
	taskMutex            sync.Mutex
}

func NewEmailBatchingJob(es *EmailService, bufferSize int) *EmailBatchingJob {
	return &EmailBatchingJob{
		server:               es.srv,
		newNotifications:     make(chan *batchedNotification, bufferSize),
		pendingNotifications: make(map[string][]*batchedNotification),
	}
}

func (job *EmailBatchingJob) Start() {
	mlog.Debug("Email batching job starting. Checking for pending emails periodically.", mlog.Int("interval_in_seconds", *job.server.Config().EmailSettings.EmailBatchingInterval))
	newTask := model.CreateRecurringTask(EmailBatchingTaskName, job.CheckPendingEmails, time.Duration(*job.server.Config().EmailSettings.EmailBatchingInterval)*time.Second)

	job.taskMutex.Lock()
	oldTask := job.task
	job.task = newTask
	job.taskMutex.Unlock()

	if oldTask != nil {
		oldTask.Cancel()
	}
}

func (job *EmailBatchingJob) Add(user *model.User, post *model.Post, team *model.Team) bool {
	notification := &batchedNotification{
		userID:   user.Id,
		post:     post,
		teamName: team.Name,
	}

	select {
	case job.newNotifications <- notification:
		return true
	default:
		// return false if we couldn't queue the email notification so that we can send an immediate email
		return false
	}
}

func (job *EmailBatchingJob) CheckPendingEmails() {
	job.handleNewNotifications()

	// it's a bit weird to pass the send email function through here, but it makes it so that we can test
	// without actually sending emails
	job.checkPendingNotifications(time.Now(), job.server.EmailService.sendBatchedEmailNotification)

	mlog.Debug("Email batching job ran. Some users still have notifications pending.", mlog.Int("number_of_users", len(job.pendingNotifications)))
}

func (job *EmailBatchingJob) handleNewNotifications() {
	receiving := true

	// read in new notifications to send
	for receiving {
		select {
		case notification := <-job.newNotifications:
			userID := notification.userID

			if _, ok := job.pendingNotifications[userID]; !ok {
				job.pendingNotifications[userID] = []*batchedNotification{notification}
			} else {
				job.pendingNotifications[userID] = append(job.pendingNotifications[userID], notification)
			}
		default:
			receiving = false
		}
	}
}

func (job *EmailBatchingJob) checkPendingNotifications(now time.Time, handler func(string, []*batchedNotification)) {
	for userID, notifications := range job.pendingNotifications {
		batchStartTime := notifications[0].post.CreateAt
		inspectedTeamNames := make(map[string]string)
		for _, notification := range notifications {
			// at most, we'll do one check for each team that notifications were sent for
			if inspectedTeamNames[notification.teamName] != "" {
				continue
			}

			team, nErr := job.server.Store.Team().GetByName(notifications[0].teamName)
			if nErr != nil {
				mlog.Error("Unable to find Team id for notification", mlog.Err(nErr))
				continue
			}

			if team != nil {
				inspectedTeamNames[notification.teamName] = team.Id
			}

			// if the user has viewed any channels in this team since the notification was queued, delete
			// all queued notifications
			channelMembers, err := job.server.Store.Channel().GetMembersForUser(inspectedTeamNames[notification.teamName], userID)
			if err != nil {
				mlog.Error("Unable to find ChannelMembers for user", mlog.Err(err))
				continue
			}

			for _, channelMember := range *channelMembers {
				if channelMember.LastViewedAt >= batchStartTime {
					mlog.Debug("Deleted notifications for user", mlog.String("user_id", userID))
					delete(job.pendingNotifications, userID)
					break
				}
			}
		}

		// get how long we need to wait to send notifications to the user
		var interval int64
		preference, err := job.server.Store.Preference().Get(userID, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL)
		if err != nil {
			// use the default batching interval if an error ocurrs while fetching user preferences
			interval, _ = strconv.ParseInt(model.PREFERENCE_EMAIL_INTERVAL_BATCHING_SECONDS, 10, 64)
		} else {
			if value, err := strconv.ParseInt(preference.Value, 10, 64); err != nil {
				// // use the default batching interval if an error ocurrs while deserializing user preferences
				interval, _ = strconv.ParseInt(model.PREFERENCE_EMAIL_INTERVAL_BATCHING_SECONDS, 10, 64)
			} else {
				interval = value
			}
		}

		// send the email notification if there are notifications to send AND it's been long enough
		if len(job.pendingNotifications[userID]) > 0 && now.Sub(time.Unix(batchStartTime/1000, 0)) > time.Duration(interval)*time.Second {
			job.server.Go(func(userID string, notifications []*batchedNotification) func() {
				return func() {
					handler(userID, notifications)
				}
			}(userID, job.pendingNotifications[userID]))
			delete(job.pendingNotifications, userID)
		}
	}
}

func (es *EmailService) sendBatchedEmailNotification(userID string, notifications []*batchedNotification) {
	user, err := es.srv.Store.User().Get(context.Background(), userID)
	if err != nil {
		mlog.Warn("Unable to find recipient for batched email notification")
		return
	}

	translateFunc := i18n.GetUserTranslations(user.Locale)
	displayNameFormat := *es.srv.Config().TeamSettings.TeammateNameDisplay

	var contents string
	for _, notification := range notifications {
		sender, err := es.srv.Store.User().Get(context.Background(), notification.post.UserId)
		if err != nil {
			mlog.Warn("Unable to find sender of post for batched email notification")
			continue
		}

		channel, errCh := es.srv.Store.Channel().Get(notification.post.ChannelId, true)
		if errCh != nil {
			mlog.Warn("Unable to find channel of post for batched email notification")
			continue
		}

		emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
		if license := es.srv.License(); license != nil && *license.Features.EmailNotificationContents {
			emailNotificationContentsType = *es.srv.Config().EmailSettings.EmailNotificationContentsType
		}

		postContent, err := es.renderBatchedPost(notification, channel, sender, *es.srv.Config().ServiceSettings.SiteURL, displayNameFormat, translateFunc, user.Locale, emailNotificationContentsType)
		if err != nil {
			mlog.Warn("Unable to render post for batched email notification template", mlog.Err(err))
			continue
		}

		contents += postContent
	}

	tm := time.Unix(notifications[0].post.CreateAt/1000, 0)

	subject := translateFunc("api.email_batching.send_batched_email_notification.subject", len(notifications), map[string]interface{}{
		"SiteName": es.srv.Config().TeamSettings.SiteName,
		"Year":     tm.Year(),
		"Month":    translateFunc(tm.Month().String()),
		"Day":      tm.Day(),
	})

	data := es.newEmailTemplateData(user.Locale)
	data.Props["SiteURL"] = *es.srv.Config().ServiceSettings.SiteURL
	data.Props["Posts"] = template.HTML(contents)
	data.Props["BodyText"] = translateFunc("api.email_batching.send_batched_email_notification.body_text", len(notifications))

	body, err2 := es.srv.TemplatesContainer().RenderToString("post_batched_body", data)
	if err2 != nil {
		mlog.Warn("Unable build the batched email notification template", mlog.Err(err2))
		return
	}

	if nErr := es.sendNotificationMail(user.Email, subject, body); nErr != nil {
		mlog.Warn("Unable to send batched email notification", mlog.String("email", user.Email), mlog.Err(nErr))
	}
}

func (es *EmailService) renderBatchedPost(notification *batchedNotification, channel *model.Channel, sender *model.User, siteURL string, displayNameFormat string, translateFunc i18n.TranslateFunc, userLocale string, emailNotificationContentsType string) (string, error) {
	// don't include message contents if email notification contents type is set to generic
	var templateName = "post_batched_post_generic"
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		templateName = "post_batched_post_full"
	}

	data := es.newEmailTemplateData(userLocale)
	data.Props["Button"] = translateFunc("api.email_batching.render_batched_post.go_to_post")
	data.Props["PostMessage"] = es.srv.GetMessageForNotification(notification.post, translateFunc)
	data.Props["PostLink"] = siteURL + "/" + notification.teamName + "/pl/" + notification.post.Id
	data.Props["SenderName"] = sender.GetDisplayName(displayNameFormat)

	tm := time.Unix(notification.post.CreateAt/1000, 0)
	timezone, _ := tm.Zone()

	data.Props["Date"] = translateFunc("api.email_batching.render_batched_post.date", map[string]interface{}{
		"Year":     tm.Year(),
		"Month":    translateFunc(tm.Month().String()),
		"Day":      tm.Day(),
		"Hour":     tm.Hour(),
		"Minute":   fmt.Sprintf("%02d", tm.Minute()),
		"Timezone": timezone,
	})

	if channel.Type == model.CHANNEL_DIRECT {
		data.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.direct_message")
	} else if channel.Type == model.CHANNEL_GROUP {
		data.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.group_message")
	} else {
		// don't include channel name if email notification contents type is set to generic
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			data.Props["ChannelName"] = channel.DisplayName
		} else {
			data.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.notification")
		}
	}

	return es.srv.TemplatesContainer().RenderToString(templateName, data)
}
