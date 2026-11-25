// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestBuildInviteTokenDataReminder(t *testing.T) {
	inviteData := InviteEmailData{
		Team:         &model.Team{Id: model.NewId(), Name: "team", DisplayName: "Team"},
		SenderUserID: model.NewId(),
	}

	t.Run("records the sender without a reminder", func(t *testing.T) {
		tokenExtra, _ := buildInviteTokenData(inviteData, "user@example.com")

		assert.Equal(t, inviteData.SenderUserID, tokenExtra["senderId"])
		assert.NotContains(t, tokenExtra, InviteTokenRemindAtKey)
	})

	t.Run("schedules the reminder before the invite expires", func(t *testing.T) {
		withReminder := inviteData
		withReminder.ScheduleReminder = true

		before := model.GetMillis()
		tokenExtra, _ := buildInviteTokenData(withReminder, "user@example.com")
		after := model.GetMillis()

		remindAt, err := strconv.ParseInt(tokenExtra[InviteTokenRemindAtKey], 10, 64)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, remindAt, before+inviteReminderDelay())
		assert.LessOrEqual(t, remindAt, after+inviteReminderDelay())
		assert.Less(t, inviteReminderDelay(), int64(model.InvitationExpiryTime))
	})

	t.Run("honours the delay override", func(t *testing.T) {
		t.Setenv("MM_RESEND_INVITATION_EMAIL_JOB_DURATION", "1000")
		withReminder := inviteData
		withReminder.ScheduleReminder = true

		before := model.GetMillis()
		tokenExtra, _ := buildInviteTokenData(withReminder, "user@example.com")

		remindAt, err := strconv.ParseInt(tokenExtra[InviteTokenRemindAtKey], 10, 64)
		require.NoError(t, err)
		assert.InDelta(t, before+1000, remindAt, 1000)
	})
}

func TestCheckInviteRateLimitSkipsReminders(t *testing.T) {
	service, _ := newInviteRateLimitTestService(t, model.ServiceSettingsDefaultMaxEmailInvitationsPerUserPerHour)
	rctx := request.TestContext(t)

	inviteData := InviteEmailData{
		Team:         &model.Team{Id: model.NewId()},
		SenderUserID: model.NewId(),
		Invites:      []string{"user@example.com"},
	}
	var err error
	for range 2 * model.ServiceSettingsDefaultMaxEmailInvitationsPerUserPerHour {
		if err = service.checkInviteRateLimit(rctx, inviteData); err != nil {
			break
		}
	}
	require.ErrorIs(t, err, RateLimitExceededError)

	inviteData.ReminderData = &model.TeamInviteReminderData{Interval: InviteReminderInterval}
	assert.NoError(t, service.checkInviteRateLimit(rctx, inviteData))
}

func newInviteRateLimitTestService(t *testing.T, perHour int) (*Service, *model.Config) {
	t.Helper()
	cfg := &model.Config{}
	cfg.SetDefaults()
	*cfg.ServiceSettings.MaxEmailInvitationsPerUserPerHour = perHour
	service := &Service{config: func() *model.Config { return cfg }}
	require.NoError(t, service.setUpRateLimiters())
	return service, cfg
}

func TestUpdateInviteRateLimit(t *testing.T) {
	service, cfg := newInviteRateLimitTestService(t, 2)
	rctx := request.TestContext(t)
	senderID := model.NewId()
	teamID := model.NewId()

	require.NoError(t, service.checkSenderInviteRateLimit(rctx, senderID, teamID, 2), "the full allowance is available at once")
	require.ErrorIs(t, service.checkSenderInviteRateLimit(rctx, senderID, teamID, 1), RateLimitExceededError, "no more than the limit per hour")

	*cfg.ServiceSettings.MaxEmailInvitationsPerUserPerHour = 100
	require.NoError(t, service.UpdateInviteRateLimit())
	assert.NoError(t, service.checkSenderInviteRateLimit(rctx, senderID, teamID, 100), "the raised limit applies immediately")
}

func TestCheckSenderInviteRateLimitRejectsOversizedBatch(t *testing.T) {
	service, _ := newInviteRateLimitTestService(t, 2)
	rctx := request.TestContext(t)
	senderID := model.NewId()
	teamID := model.NewId()

	err := service.checkSenderInviteRateLimit(rctx, senderID, teamID, 3)
	var batchErr *InviteBatchExceedsLimitError
	require.ErrorAs(t, err, &batchErr)
	assert.Equal(t, 3, batchErr.Count)
	assert.Equal(t, 2, batchErr.Limit)
	assert.Equal(t, "app.email.invite_batch_exceeds_limit.app_error", model.AsAppError(batchErr.AppError("test")).Id)

	assert.NoError(t, service.checkSenderInviteRateLimit(rctx, senderID, teamID, 2), "a rejected batch does not use up the allowance")
}
