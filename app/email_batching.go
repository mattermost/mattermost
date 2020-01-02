// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"html/template"
	"strconv"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/utils"

	"net/http"

	"github.com/mattermost/go-i18n/i18n"
)

const (
	EMAIL_BATCHING_TASK_NAME = "Email Batching"
)

func (s *Server) InitEmailBatching() {
	if *s.Config().EmailSettings.EnableEmailBatching {
		if s.EmailBatching == nil {
			s.EmailBatching = NewEmailBatchingJob(s, *s.Config().EmailSettings.EmailBatchingBufferSize)
		}

		// note that we don't support changing EmailBatchingBufferSize without restarting the server

		s.EmailBatching.Start()
	}
}

func (a *App) AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team) *model.AppError {
	if !*a.Config().EmailSettings.EnableEmailBatching {
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !a.Srv.EmailBatching.Add(user, post, team) {
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
	server               *Server
	newNotifications     chan *batchedNotification
	pendingNotifications map[string][]*batchedNotification
	task                 *model.ScheduledTask
	taskMutex            sync.Mutex
}

func NewEmailBatchingJob(s *Server, bufferSize int) *EmailBatchingJob {
	return &EmailBatchingJob{
		server:               s,
		newNotifications:     make(chan *batchedNotification, bufferSize),
		pendingNotifications: make(map[string][]*batchedNotification),
	}
}

func (job *EmailBatchingJob) Start() {
	mlog.Debug("Email batching job starting. Checking for pending emails periodically.", mlog.Int("interval_in_seconds", *job.server.Config().EmailSettings.EmailBatchingInterval))
	newTask := model.CreateRecurringTask(EMAIL_BATCHING_TASK_NAME, job.CheckPendingEmails, time.Duration(*job.server.Config().EmailSettings.EmailBatchingInterval)*time.Second)

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
	job.checkPendingNotifications(time.Now(), job.server.sendBatchedEmailNotification)

	mlog.Debug("Email batching job ran. Some users still have notifications pending.", mlog.Int("number_of_users", len(job.pendingNotifications)))
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

			team, err := job.server.Store.Team().GetByName(notifications[0].teamName)
			if err != nil {
				mlog.Error("Unable to find Team id for notification", mlog.Err(err))
				continue
			}

			if team != nil {
				inspectedTeamNames[notification.teamName] = team.Id
			}

			// if the user has viewed any channels in this team since the notification was queued, delete
			// all queued notifications
			channelMembers, err := job.server.Store.Channel().GetMembersForUser(inspectedTeamNames[notification.teamName], userId)
			if err != nil {
				mlog.Error("Unable to find ChannelMembers for user", mlog.Err(err))
				continue
			}

			for _, channelMember := range *channelMembers {
				if channelMember.LastViewedAt >= batchStartTime {
					mlog.Debug("Deleted notifications for user", mlog.String("user_id", userId))
					delete(job.pendingNotifications, userId)
					break
				}
			}
		}

		// get how long we need to wait to send notifications to the user
		var interval int64
		preference, err := job.server.Store.Preference().Get(userId, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL)
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

		// send the email notification if it's been long enough
		if now.Sub(time.Unix(batchStartTime/1000, 0)) > time.Duration(interval)*time.Second {
			job.server.Go(func(userId string, notifications []*batchedNotification) func() {
				return func() {
					handler(userId, notifications)
				}
			}(userId, notifications))
			delete(job.pendingNotifications, userId)
		}
	}
}

func (s *Server) sendBatchedEmailNotification(userId string, notifications []*batchedNotification) {
	user, err := s.Store.User().Get(userId)
	if err != nil {
		mlog.Warn("Unable to find recipient for batched email notification")
		return
	}

	translateFunc := utils.GetUserTranslations(user.Locale)
	displayNameFormat := *s.Config().TeamSettings.TeammateNameDisplay

	var contents string
	for _, notification := range notifications {
		sender, err := s.Store.User().Get(notification.post.UserId)
		if err != nil {
			mlog.Warn("Unable to find sender of post for batched email notification")
			continue
		}

		channel, errCh := s.Store.Channel().Get(notification.post.ChannelId, true)
		if errCh != nil {
			mlog.Warn("Unable to find channel of post for batched email notification")
			continue
		}

		emailNotificationContentsType := model.EMAIL_NOTIFICATION_CONTENTS_FULL
		if license := s.License(); license != nil && *license.Features.EmailNotificationContents {
			emailNotificationContentsType = *s.Config().EmailSettings.EmailNotificationContentsType
		}

		contents += s.renderBatchedPost(notification, channel, sender, *s.Config().ServiceSettings.SiteURL, displayNameFormat, translateFunc, user.Locale, emailNotificationContentsType)
	}

	tm := time.Unix(notifications[0].post.CreateAt/1000, 0)

	subject := translateFunc("api.email_batching.send_batched_email_notification.subject", len(notifications), map[string]interface{}{
		"SiteName": s.Config().TeamSettings.SiteName,
		"Year":     tm.Year(),
		"Month":    translateFunc(tm.Month().String()),
		"Day":      tm.Day(),
	})

	body := s.FakeApp().NewEmailTemplate("post_batched_body", user.Locale)
	body.Props["SiteURL"] = *s.Config().ServiceSettings.SiteURL
	body.Props["Posts"] = template.HTML(contents)
	body.Props["BodyText"] = translateFunc("api.email_batching.send_batched_email_notification.body_text", len(notifications))

	if err := s.FakeApp().SendNotificationMail(user.Email, subject, body.Render()); err != nil {
		mlog.Warn("Unable to send batched email notification", mlog.String("email", user.Email), mlog.Err(err))
	}
}

func (s *Server) renderBatchedPost(notification *batchedNotification, channel *model.Channel, sender *model.User, siteURL string, displayNameFormat string, translateFunc i18n.TranslateFunc, userLocale string, emailNotificationContentsType string) string {
	// don't include message contents if email notification contents type is set to generic
	var template *utils.HTMLTemplate
	if emailNotificationContentsType == model.EMAIL_NOTIFICATION_CONTENTS_FULL {
		template = s.FakeApp().NewEmailTemplate("post_batched_post_full", userLocale)
	} else {
		template = s.FakeApp().NewEmailTemplate("post_batched_post_generic", userLocale)
	}

	template.Props["Button"] = translateFunc("api.email_batching.render_batched_post.go_to_post")
	template.Props["PostMessage"] = s.FakeApp().GetMessageForNotification(notification.post, translateFunc)
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
