// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
	"github.com/sirupsen/logrus"
)

const RetrospectivePrefix = "retro_"

// HandleReminder is the handler for all reminder events.
func (s *PlaybookRunServiceImpl) HandleReminder(key string) {
	if strings.HasPrefix(key, RetrospectivePrefix) {
		s.handleReminderToFillRetro(strings.TrimPrefix(key, RetrospectivePrefix))
	} else {
		s.handleStatusUpdateReminder(key)
	}
}

func (s *PlaybookRunServiceImpl) handleReminderToFillRetro(playbookRunID string) {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

	playbookRunToRemind, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		logger.WithError(err).Errorf("handleReminderToFillRetro failed to get playbook run")
		return
	}

	// In the meantime we did publish a retrospective, so no reminder.
	if playbookRunToRemind.RetrospectivePublishedAt != 0 {
		return
	}

	// If we are not in the finished state then don't remind
	if playbookRunToRemind.CurrentStatus != StatusFinished {
		return
	}

	if err = s.postRetrospectiveReminder(playbookRunToRemind, false); err != nil {
		logger.WithError(err).Errorf("couldn't post reminder")
		return
	}

	// Jobs can't be rescheduled within themselves with the same key. As a temporary workaround do it in a delayed goroutine
	go func() {
		time.Sleep(time.Second * 2)
		if err = s.SetReminder(RetrospectivePrefix+playbookRunID, time.Duration(playbookRunToRemind.RetrospectiveReminderIntervalSeconds)*time.Second); err != nil {
			logger.WithError(err).Errorf("failed to reocurr retrospective reminder")
			return
		}
	}()
}

func (s *PlaybookRunServiceImpl) handleStatusUpdateReminder(playbookRunID string) {
	logger := logrus.WithField("playbook_run_id", playbookRunID)

	playbookRunToModify, err := s.GetPlaybookRun(playbookRunID)
	if err != nil {
		logger.WithError(err).Error("HandleReminder failed to get playbook run")
		return
	}

	owner, err := s.api.GetUserByID(playbookRunToModify.OwnerUserID)
	if err != nil {
		logger.WithError(err).WithField("user_id", playbookRunToModify.OwnerUserID).Error("HandleReminder failed to get owner")
		return
	}

	attachments := []*model.SlackAttachment{
		{
			Actions: []*model.PostAction{
				{
					Type: "button",
					Name: "Update status",
					Integration: &model.PostActionIntegration{
						URL: fmt.Sprintf("/plugins/%s/api/v0/runs/%s/reminder/button-update",
							"playbooks",
							playbookRunToModify.ID),
					},
				},
			},
		},
	}

	post := &model.Post{
		Message:   fmt.Sprintf("@%s, please provide a status update for [%s](%s).", owner.Username, playbookRunToModify.Name, GetRunDetailsRelativeURL(playbookRunID)),
		ChannelId: playbookRunToModify.ChannelID,
		Type:      "custom_update_status",
		Props: map[string]any{
			"targetUsername": owner.Username,
			"playbookRunId":  playbookRunToModify.ID,
		},
	}
	model.ParseSlackAttachment(post, attachments)

	if err := s.poster.PostMessageToThread("", post); err != nil {
		logger.WithError(err).Errorf("HandleReminder error posting reminder message")
		return
	}

	// broadcast to followers
	message, err := s.buildOverdueStatusUpdateMessage(playbookRunToModify, owner.Username)
	if err != nil {
		logger.WithError(err).Error("failed to build overdue status update message")
	} else {
		err = s.dmPostToRunFollowers(&model.Post{Message: message}, overdueStatusUpdateMessage, playbookRunToModify.ID, "")
		if err != nil {
			logger.WithError(err).Error("failed to dm post to run followers")
		}
	}

	playbookRunToModify.ReminderPostID = post.Id
	if _, err = s.store.UpdatePlaybookRun(playbookRunToModify); err != nil {
		logger.WithError(err).Error("error updating with reminder post id")
	}
}

func (s *PlaybookRunServiceImpl) buildOverdueStatusUpdateMessage(playbookRun *PlaybookRun, ownerUserName string) (string, error) {
	channel, err := s.api.GetChannelByID(playbookRun.ChannelID)
	if err != nil {
		return "", errors.Wrapf(err, "can't get channel - %s", playbookRun.ChannelID)
	}

	team, err := s.api.GetTeam(channel.TeamId)
	if err != nil {
		return "", errors.Wrapf(err, "can't get team - %s", channel.TeamId)
	}

	message := fmt.Sprintf("Status update is overdue for [%s](/%s/channels/%s?telem_action=todo_overduestatus_clicked&telem_run_id=%s&forceRHSOpen) (Owner: @%s)\n",
		channel.DisplayName, team.Name, channel.Name, playbookRun.ID, ownerUserName)

	return message, nil
}

// SetReminder sets a reminder. After timeInMinutes in the future, the owner will be
// reminded to update the playbook run's status.
func (s *PlaybookRunServiceImpl) SetReminder(playbookRunID string, fromNow time.Duration) error {
	if _, err := s.scheduler.ScheduleOnce(playbookRunID, time.Now().Add(fromNow)); err != nil {
		return errors.Wrap(err, "unable to schedule reminder")
	}

	return nil
}

// RemoveReminder removes the pending reminder for the given playbook run, if any.
func (s *PlaybookRunServiceImpl) RemoveReminder(playbookRunID string) {
	s.scheduler.Cancel(playbookRunID)
}

// resetReminderTimer sets the previous reminder timer to 0.
func (s *PlaybookRunServiceImpl) resetReminderTimer(playbookRunID string) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	playbookRunToModify.PreviousReminder = 0

	playbookRunToModify, err = s.store.UpdatePlaybookRun(playbookRunToModify)
	if err != nil {
		return errors.Wrapf(err, "failed to update playbook run after resetting reminder timer")
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

	return nil
}

// ResetReminder creates a timeline event for a reminder being reset and then creates a new reminder
func (s *PlaybookRunServiceImpl) ResetReminder(playbookRunID string, newReminder time.Duration) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	eventTime := model.GetMillis()
	event := &TimelineEvent{
		PlaybookRunID: playbookRunToModify.ID,
		CreateAt:      eventTime,
		EventAt:       eventTime,
		EventType:     StatusUpdateSnoozed,
		SubjectUserID: playbookRunToModify.ReporterUserID,
	}

	if _, err := s.store.CreateTimelineEvent(event); err != nil {
		return errors.Wrapf(err, "failed to create timeline event after resetting reminder timer")
	}

	return s.SetNewReminder(playbookRunID, newReminder)
}

// SetNewReminder sets a new reminder for playbookRunID, removes any pending reminder, removes the
// reminder post in the playbookRun's channel, and resets the PreviousReminder and
// LastStatusUpdateAt (so the countdown timer to "update due" shows the correct time)
func (s *PlaybookRunServiceImpl) SetNewReminder(playbookRunID string, newReminder time.Duration) error {
	playbookRunToModify, err := s.store.GetPlaybookRun(playbookRunID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve playbook run")
	}

	// Remove pending reminder (if any)
	s.RemoveReminder(playbookRunID)

	// Remove reminder post (if any)
	if playbookRunToModify.ReminderPostID != "" {
		if err = s.removePost(playbookRunToModify.ReminderPostID); err != nil {
			return err
		}
		playbookRunToModify.ReminderPostID = ""
	}

	playbookRunToModify.PreviousReminder = newReminder
	playbookRunToModify.LastStatusUpdateAt = model.GetMillis()

	playbookRunToModify, err = s.store.UpdatePlaybookRun(playbookRunToModify)
	if err != nil {
		return errors.Wrapf(err, "failed to update playbook run after resetting reminder timer")
	}

	if newReminder != 0 {
		if err = s.SetReminder(playbookRunID, newReminder); err != nil {
			return errors.Wrap(err, "failed to set the reminder for playbook run")
		}
	}

	s.poster.PublishWebsocketEventToChannel(playbookRunUpdatedWSEvent, playbookRunToModify, playbookRunToModify.ChannelID)

	return nil
}

func (s *PlaybookRunServiceImpl) removePost(postID string) error {
	post, err := s.api.GetPost(postID)
	if err != nil {
		return errors.Wrapf(err, "failed to retrieve reminder post %s", postID)
	}

	if post.DeleteAt != 0 {
		return nil
	}

	if _, err = s.api.DeletePost(postID); err != nil {
		return errors.Wrapf(err, "failed to delete reminder post %s", postID)
	}

	return nil
}
