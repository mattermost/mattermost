// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"bytes"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

const (
	EmailBatchingTaskName = "Email Batching"
)

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

func (es *Service) InitEmailBatching() {
	if *es.config().EmailSettings.EnableEmailBatching {
		if es.EmailBatching == nil {
			es.EmailBatching = NewEmailBatchingJob(es, *es.config().EmailSettings.EmailBatchingBufferSize)
		}

		// note that we don't support changing EmailBatchingBufferSize without restarting the server

		es.EmailBatching.Start()
	}
}

func (es *Service) AddNotificationEmailToBatch(user *model.User, post *model.Post, team *model.Team) *model.AppError {
	if !*es.config().EmailSettings.EnableEmailBatching {
		return model.NewAppError("AddNotificationEmailToBatch", "api.email_batching.add_notification_email_to_batch.disabled.app_error", nil, "", http.StatusNotImplemented)
	}

	if !es.EmailBatching.Add(user, post, team) {
		mlog.Error("Email batching job's receiving buffer was full. Please increase the EmailBatchingBufferSize. Falling back to sending immediate mail.")
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
	config  func() *model.Config
	service *Service

	newNotifications     chan *batchedNotification
	pendingNotifications map[string][]*batchedNotification
	task                 *model.ScheduledTask
	taskMutex            sync.Mutex
}

func NewEmailBatchingJob(es *Service, bufferSize int) *EmailBatchingJob {
	return &EmailBatchingJob{
		config:               es.config,
		service:              es,
		newNotifications:     make(chan *batchedNotification, bufferSize),
		pendingNotifications: make(map[string][]*batchedNotification),
	}
}

func (job *EmailBatchingJob) Start() {
	mlog.Debug("Email batching job starting. Checking for pending emails periodically.", mlog.Int("interval_in_seconds", *job.config().EmailSettings.EmailBatchingInterval))
	newTask := model.CreateRecurringTask(EmailBatchingTaskName, job.CheckPendingEmails, time.Duration(*job.config().EmailSettings.EmailBatchingInterval)*time.Second)

	job.taskMutex.Lock()
	oldTask := job.task
	job.task = newTask
	job.taskMutex.Unlock()

	if oldTask != nil {
		oldTask.Cancel()
	}
}

// Stop will cancel the task properly, flushing out any pending notifications.
// Although this still won't send those notifications which are yet to be sent
// due to a user's PreferenceNameEmailInterval.
func (job *EmailBatchingJob) Stop() {
	job.taskMutex.Lock()
	if task := job.task; task != nil {
		task.Cancel()
	}
	job.taskMutex.Unlock()
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
	job.checkPendingNotifications(time.Now(), job.service.sendBatchedEmailNotification)

	mlog.Debug("Email batching job ran. Notifications might be still pending.", mlog.Int("number_of_users", len(job.pendingNotifications)))
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
		// Defensive code.
		if len(notifications) == 0 {
			mlog.Warn("Unexpected result. Got 0 pending notifications for batched email.", mlog.String("user_id", userID))
			continue
		}

		// get how long we need to wait to send notifications to the user
		var interval int64
		preference, err := job.service.store.Preference().Get(userID, model.PreferenceCategoryNotifications, model.PreferenceNameEmailInterval)
		if err != nil {
			// use the default batching interval if an error occurs while fetching user preferences
			interval, _ = strconv.ParseInt(model.PreferenceEmailIntervalBatchingSeconds, 10, 64)
		} else {
			if value, err := strconv.ParseInt(preference.Value, 10, 64); err != nil {
				// // use the default batching interval if an error occurs while deserializing user preferences
				interval, _ = strconv.ParseInt(model.PreferenceEmailIntervalBatchingSeconds, 10, 64)
			} else {
				interval = value
			}
		}

		batchStartTime := notifications[0].post.CreateAt
		// Ignore if it isn't time yet to send.
		if now.Sub(time.UnixMilli(batchStartTime)) <= time.Duration(interval)*time.Second {
			continue
		}

		// If the user has viewed any channels in this team since the notification was queued, delete
		// all queued notifications
		inspectedTeamNames := make(map[string]string)
		for _, notification := range notifications {
			// at most, we'll do one check for each team that notifications were sent for
			if inspectedTeamNames[notification.teamName] != "" {
				continue
			}

			team, nErr := job.service.store.Team().GetByName(notifications[0].teamName)
			if nErr != nil {
				mlog.Error("Unable to find Team id for notification", mlog.Err(nErr))
				continue
			}

			if team != nil {
				inspectedTeamNames[notification.teamName] = team.Id
			}

			channelMembers, err := job.service.store.Channel().GetMembersForUser(inspectedTeamNames[notification.teamName], userID)
			if err != nil {
				mlog.Error("Unable to find ChannelMembers for user", mlog.Err(err))
				continue
			}

			deleted := false
			for _, channelMember := range channelMembers {
				if channelMember.LastViewedAt >= batchStartTime {
					mlog.Debug("Deleted notifications for user", mlog.String("user_id", userID))
					delete(job.pendingNotifications, userID)
					deleted = true
					break
				}
			}
			if deleted {
				break
			}
		}

		// The notifications might have been cleared from the above step.
		// We need to check again.
		if len(job.pendingNotifications[userID]) == 0 {
			continue
		}

		handler(userID, job.pendingNotifications[userID])
		delete(job.pendingNotifications, userID)
	}
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

func (es *Service) sendBatchedEmailNotification(userID string, notifications []*batchedNotification) {
	user, err := es.userService.GetUser(userID)
	if err != nil {
		mlog.Warn("Unable to find recipient for batched email notification")
		return
	}

	translateFunc := i18n.GetUserTranslations(user.Locale)
	displayNameFormat := *es.config().TeamSettings.TeammateNameDisplay
	siteURL := *es.config().ServiceSettings.SiteURL

	postsData := make([]*postData, 0 /* len */, len(notifications) /* cap */)
	embeddedFiles := make(map[string]io.Reader)

	emailNotificationContentsType := model.EmailNotificationContentsFull
	if license := es.license(); license != nil && *license.Features.EmailNotificationContents {
		emailNotificationContentsType = *es.config().EmailSettings.EmailNotificationContentsType
	}

	// check if user has CRT set to ON
	appCRT := *es.config().ServiceSettings.CollapsedThreads
	threadsEnabled := appCRT == model.CollapsedThreadsAlwaysOn
	if !threadsEnabled && appCRT != model.CollapsedThreadsDisabled {
		threadsEnabled = appCRT == model.CollapsedThreadsDefaultOn
		// check if a participant has overridden collapsed threads settings
		if preference, errCrt := es.store.Preference().Get(userID, model.PreferenceCategoryDisplaySettings, model.PreferenceNameCollapsedThreadsEnabled); errCrt == nil {
			threadsEnabled = preference.Value == "on"
		}
	}

	var useMilitaryTime bool
	if data, err := es.store.Preference().Get(user.Id, model.PreferenceCategoryDisplaySettings, model.PreferenceNameUseMilitaryTime); err != nil {
		useMilitaryTime = false
	} else {
		useMilitaryTime = data.Value == "true"
	}

	if emailNotificationContentsType == model.EmailNotificationContentsFull {
		for i, notification := range notifications {
			sender, errSender := es.userService.GetUser(notification.post.UserId)
			if errSender != nil {
				mlog.Warn("Unable to find sender of post for batched email notification")
			}

			channel, errCh := es.store.Channel().Get(notification.post.ChannelId, true)
			if errCh != nil {
				mlog.Warn("Unable to find channel of post for batched email notification")
			}

			senderProfileImage, _, errProfileImage := es.userService.GetProfileImage(sender)
			if errProfileImage != nil {
				mlog.Warn("Unable to get the sender user profile image.", mlog.String("user_id", sender.Id), mlog.Err(errProfileImage))
			}

			senderPhoto := fmt.Sprintf("user-avatar-%d.png", i)
			if senderProfileImage != nil {
				embeddedFiles[senderPhoto] = bytes.NewReader(senderProfileImage)
			}

			formattedTime := utils.GetFormattedPostTime(user, notification.post, useMilitaryTime, translateFunc)

			t := translateFunc("api.email_batching.send_batched_email_notification.time", formattedTime)

			MessageURL := siteURL + "/" + notification.teamName + "/pl/" + notification.post.Id

			channelDisplayName := channel.DisplayName
			showChannelIcon := true
			otherChannelMembersCount := 0

			if threadsEnabled && notification.post.RootId != "" {
				props := map[string]any{"channelName": channelDisplayName}
				channelDisplayName = translateFunc("api.push_notification.title.collapsed_threads", props)
				if channel.Type == model.ChannelTypeDirect {
					channelDisplayName = translateFunc("api.push_notification.title.collapsed_threads_dm")
				}
			}

			if channel.Type == model.ChannelTypeGroup {
				otherChannelMembersCount = len(strings.Split(channelDisplayName, ",")) - 1
				showChannelIcon = false
				channelDisplayName = truncateUserNames(channel.DisplayName, 11)
			}

			postMessage := es.GetMessageForNotification(notification.post, notification.teamName, siteURL, translateFunc)
			postsData = append(postsData, &postData{
				SenderPhoto:              senderPhoto,
				SenderName:               truncateUserNames(sender.GetDisplayName(displayNameFormat), 22),
				Time:                     t,
				ChannelName:              channelDisplayName,
				Message:                  template.HTML(postMessage),
				MessageURL:               MessageURL,
				ShowChannelIcon:          showChannelIcon,
				OtherChannelMembersCount: otherChannelMembersCount,
				MessageAttachments:       ProcessMessageAttachments(notification.post, siteURL),
			})
		}
	}

	formattedTime := utils.GetFormattedPostTime(user, notifications[0].post, useMilitaryTime, translateFunc)

	subject := translateFunc("api.email_batching.send_batched_email_notification.subject", len(notifications), map[string]any{
		"SiteName": es.config().TeamSettings.SiteName,
		"Year":     formattedTime.Year,
		"Month":    formattedTime.Month,
		"Day":      formattedTime.Day,
	})

	data := es.NewEmailTemplateData(user.Locale)
	data.Props["SiteURL"] = siteURL
	data.Props["Title"] = translateFunc("api.email_batching.send_batched_email_notification.title", len(notifications)-1)
	data.Props["SubTitle"] = translateFunc("api.email_batching.send_batched_email_notification.subTitle")
	data.Props["Button"] = translateFunc("api.email_batching.send_batched_email_notification.button")
	data.Props["ButtonURL"] = siteURL
	data.Props["Posts"] = postsData
	data.Props["MessageButton"] = translateFunc("api.email_batching.send_batched_email_notification.messageButton")
	data.Props["NotificationFooterTitle"] = translateFunc("app.notification.footer.title")
	data.Props["NotificationFooterInfoLogin"] = translateFunc("app.notification.footer.infoLogin")
	data.Props["NotificationFooterInfo"] = translateFunc("app.notification.footer.info")

	renderedPage, renderErr := es.templatesContainer.RenderToString("messages_notification", data)
	if renderErr != nil {
		mlog.Error("Unable to render email", mlog.Err(renderErr))
	}

	if nErr := es.SendMailWithEmbeddedFiles(user.Email, subject, renderedPage, embeddedFiles, "", "", "", "BatchedEmailNotification"); nErr != nil {
		mlog.Warn("Unable to send batched email notification", mlog.String("email", user.Email), mlog.Err(nErr))
	}
}
