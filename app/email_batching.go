// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"fmt"
	"html/template"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"

	"net/http"

	"github.com/nicksnyder/go-i18n/i18n"
)

const (
	EMAIL_BATCHING_TASK_NAME = "Email Batching"
)

func (a *App) InitEmailBatching() {
	if *a.Config().EmailSettings.EnableEmailBatching {
		if a.EmailBatching == nil {
			a.EmailBatching = NewEmailBatchingJob(a, *a.Config().EmailSettings.EmailBatchingBufferSize)
		}

		// note that we don't support changing EmailBatchingBufferSize without restarting the server

		a.EmailBatching.Start()
	}
}

func (a *App) AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team) *model.AppError {
	if !*a.Config().EmailSettings.EnableEmailBatching {
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !a.EmailBatching.Add(user, post, team) {
		mlog.Error("Email batching job's receiving channel was full. Please increase the EmailBatchingBufferSize.")
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.channel_full.app_error", nil, "", http.StatusInternalServerError)
	}

	return nil
}

type batchedNotification struct {
	userId   string
	post     *model.Post
	teamName string
}

type EmailBatchingJob struct {
	app                  *App
	newNotifications     chan *batchedNotification
	pendingNotifications map[string][]*batchedNotification
	task                 *model.ScheduledTask
	taskMutex            sync.Mutex
}

func NewEmailBatchingJob(a *App, bufferSize int) *EmailBatchingJob {
	return &EmailBatchingJob{
		app:                  a,
		newNotifications:     make(chan *batchedNotification, bufferSize),
		pendingNotifications: make(map[string][]*batchedNotification),
	}
}

func (job *EmailBatchingJob) Start() {
	mlog.Debug(fmt.Sprintf("Email batching job starting. Checking for pending emails every %v seconds.", *job.app.Config().EmailSettings.EmailBatchingInterval))
	newTask := model.CreateRecurringTask(EMAIL_BATCHING_TASK_NAME, job.CheckPendingEmails, time.Duration(*job.app.Config().EmailSettings.EmailBatchingInterval)*time.Second)

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
		userId:   user.Id,
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
	job.checkPendingNotifications(time.Now(), job.app.sendBatchedEmailNotification)

	mlog.Debug(fmt.Sprintf("Email batching job ran. %v user(s) still have notifications pending.", len(job.pendingNotifications)))
}

func (job *EmailBatchingJob) handleNewNotifications() {
	receiving := true

	// read in new notifications to send
	for receiving {
		select {
		case notification := <-job.newNotifications:
			userId := notification.userId

			if _, ok := job.pendingNotifications[userId]; !ok {
				job.pendingNotifications[userId] = []*batchedNotification{notification}
			} else {
				job.pendingNotifications[userId] = append(job.pendingNotifications[userId], notification)
			}
		default:
			receiving = false
		}
	}
}

func (job *EmailBatchingJob) checkPendingNotifications(now time.Time, handler func(string, []*batchedNotification)) {
	for userId, notifications := range job.pendingNotifications {
		batchStartTime := notifications[0].post.CreateAt
		inspectedTeamNames := make(map[string]string)
		for _, notification := range notifications {
			// at most, we'll do one check for each team that notifications were sent for
			if inspectedTeamNames[notification.teamName] != "" {
				continue
			}

			result := <-job.app.Srv.Store.Team().GetByName(notifications[0].teamName)
			if result.Err != nil {
				mlog.Error(fmt.Sprint("Unable to find Team id for notification", result.Err))
				continue
			}

			if team, ok := result.Data.(*model.Team); ok {
				inspectedTeamNames[notification.teamName] = team.Id
			}

			// if the user has viewed any channels in this team since the notification was queued, delete
			// all queued notifications
			result = <-job.app.Srv.Store.Channel().GetMembersForUser(inspectedTeamNames[notification.teamName], userId)
			if result.Err != nil {
				mlog.Error(fmt.Sprint("Unable to find ChannelMembers for user", result.Err))
				continue
			}

			if channelMembers, ok := result.Data.(*model.ChannelMembers); ok {
				for _, channelMember := range *channelMembers {
					if channelMember.LastViewedAt >= batchStartTime {
						mlog.Debug(fmt.Sprintf("Deleted notifications for user %s", userId), mlog.String("user_id", userId))
						delete(job.pendingNotifications, userId)
						break
					}
				}
			}
		}

		// get how long we need to wait to send notifications to the user
		var interval int64
		pchan := job.app.Srv.Store.Preference().Get(userId, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL)
		if result := <-pchan; result.Err != nil {
			// use the default batching interval if an error ocurrs while fetching user preferences
			interval, _ = strconv.ParseInt(model.PREFERENCE_EMAIL_INTERVAL_BATCHING_SECONDS, 10, 64)
		} else {
			preference := result.Data.(model.Preference)

			if value, err := strconv.ParseInt(preference.Value, 10, 64); err != nil {
				// // use the default batching interval if an error ocurrs while deserializing user preferences
				interval, _ = strconv.ParseInt(model.PREFERENCE_EMAIL_INTERVAL_BATCHING_SECONDS, 10, 64)
			} else {
				interval = value
			}
		}

		// send the email notification if it's been long enough
		if now.Sub(time.Unix(batchStartTime/1000, 0)) > time.Duration(interval)*time.Second {
			job.app.Go(func(userId string, notifications []*batchedNotification) func() {
				return func() {
					handler(userId, notifications)
				}
			}(userId, notifications))
			delete(job.pendingNotifications, userId)
		}
	}
}

func (a *App) sendBatchedEmailNotification(userId string, notifications []*batchedNotification) {
	result := <-a.Srv.Store.User().Get(userId)
	if result.Err != nil {
		mlog.Warn("Unable to find recipient for batched email notification")
		return
	}
	user := result.Data.(*model.User)

	translateFunc := utils.GetUserTranslations(user.Locale)
	displayNameFormat := *a.Config().TeamSettings.TeammateNameDisplay

	var contents string
	for _, notification := range notifications {
		result := <-a.Srv.Store.User().Get(notification.post.UserId)
		if result.Err != nil {
			mlog.Warn("Unable to find sender of post for batched email notification")
			continue
		}
		sender := result.Data.(*model.User)

		result = <-a.Srv.Store.Channel().Get(notification.post.ChannelId, true)
		if result.Err != nil {
			mlog.Warn("Unable to find channel of post for batched email notification")
			continue
		}
		channel := result.Data.(*model.Channel)

		emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
		if license := a.License(); license != nil && *license.Features.EmailNotificationContents {
			emailNotificationContentsType = *a.Config().EmailSettings.EmailNotificationContentsType
		}

		contents += a.renderBatchedPost(notification, channel, sender, *a.Config().ServiceSettings.SiteURL, displayNameFormat, translateFunc, user.Locale, emailNotificationContentsType)
	}

	tm := time.Unix(notifications[0].post.CreateAt/1000, 0)

	subject := translateFunc("api.email_batching.send_batched_email_notification.subject", len(notifications), map[string]interface{}{
		"SiteName": a.Config().TeamSettings.SiteName,
		"Year":     tm.Year(),
		"Month":    translateFunc(tm.Month().String()),
		"Day":      tm.Day(),
	})

	body := a.NewEmailTemplate("post_batched_body", user.Locale)
	body.Props["SiteURL"] = *a.Config().ServiceSettings.SiteURL
	body.Props["Posts"] = template.HTML(contents)
	body.Props["BodyText"] = translateFunc("api.email_batching.send_batched_email_notification.body_text", len(notifications))

	if err := a.SendMail(user.Email, subject, body.Render()); err != nil {
		mlog.Warn(fmt.Sprintf("Unable to send batched email notification err=%v", err), mlog.String("email", user.Email))
	}
}

func (a *App) renderBatchedPost(notification *batchedNotification, channel *model.Channel, sender *model.User, siteURL string, displayNameFormat string, translateFunc i18n.TranslateFunc, userLocale string, emailNotificationContentsType string) string {
	// don't include message contents if email notification contents type is set to generic
	var template *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		template = a.NewEmailTemplate("post_batched_post_full", userLocale)
	} else {
		template = a.NewEmailTemplate("post_batched_post_generic", userLocale)
	}

	template.Props["Button"] = translateFunc("api.email_batching.render_batched_post.go_to_post")
	template.Props["PostMessage"] = a.GetMessageForNotification(notification.post, translateFunc)
	template.Props["PostLink"] = siteURL + "/" + notification.teamName + "/pl/" + notification.post.Id
	template.Props["SenderName"] = sender.GetDisplayName(displayNameFormat)

	tm := time.Unix(notification.post.CreateAt/1000, 0)
	timezone, _ := tm.Zone()

	template.Props["Date"] = translateFunc("api.email_batching.render_batched_post.date", map[string]interface{}{
		"Year":     tm.Year(),
		"Month":    translateFunc(tm.Month().String()),
		"Day":      tm.Day(),
		"Hour":     tm.Hour(),
		"Minute":   fmt.Sprintf("%02d", tm.Minute()),
		"Timezone": timezone,
	})

	if channel.Type == model.CHANNEL_DIRECT {
		template.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.direct_message")
	} else if channel.Type == model.CHANNEL_GROUP {
		template.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.group_message")
	} else {
		// don't include channel name if email notification contents type is set to generic
		if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
			template.Props["ChannelName"] = channel.DisplayName
		} else {
			template.Props["ChannelName"] = translateFunc("api.email_batching.render_batched_post.notification")
		}
	}

	return template.Render()
}
