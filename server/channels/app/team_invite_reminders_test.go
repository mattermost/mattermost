// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"maps"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/email"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

func TestSendDueInviteReminders(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.ConfigureInbucketMail()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
	})

	saveInviteToken := func(t *testing.T, invitedEmail string, remindAt int64, extra map[string]string) *model.Token {
		t.Helper()
		tokenExtra := map[string]string{"teamId": th.BasicTeam.Id, "email": invitedEmail, "senderId": th.BasicUser.Id}
		if remindAt != 0 {
			tokenExtra[email.InviteTokenRemindAtKey] = strconv.FormatInt(remindAt, 10)
		}
		maps.Copy(tokenExtra, extra)
		token := model.NewToken(model.TokenTypeTeamInvitation, model.MapToJSON(tokenExtra))
		require.NoError(t, th.App.Srv().Store().Token().Save(token))
		return token
	}

	inviteTokensFor := func(t *testing.T, invitedEmail string) []*model.Token {
		t.Helper()
		tokens, err := th.App.Srv().Store().Token().GetAllTokensByType(model.TokenTypeTeamInvitation)
		require.NoError(t, err)
		var matching []*model.Token
		for _, token := range tokens {
			if model.MapFromJSON(strings.NewReader(token.Extra))["email"] == invitedEmail {
				matching = append(matching, token)
			}
		}
		return matching
	}

	newEmail := func() string {
		return "invitee-" + model.NewId() + "@example.com"
	}

	receivedEmails := func(t *testing.T, invitedEmail string) []mail.JSONMessageInbucket {
		t.Helper()
		var mailbox mail.JSONMessageHeaderInbucket
		require.Eventually(t, func() bool {
			var err error
			mailbox, err = mail.GetMailBox(invitedEmail)
			return err == nil && len(mailbox) > 0
		}, 10*time.Second, 200*time.Millisecond, "no email reached %s", invitedEmail)

		messages := make([]mail.JSONMessageInbucket, 0, len(mailbox))
		for _, header := range mailbox {
			message, err := mail.GetMessageFromMailbox(invitedEmail, header.ID)
			require.NoError(t, err)
			messages = append(messages, message)
		}
		return messages
	}

	t.Run("reminds a due invite once, replacing its token", func(t *testing.T) {
		invitedEmail := newEmail()
		original := saveInviteToken(t, invitedEmail, model.GetMillis()-1, nil)

		th.App.SendDueInviteReminders(th.Context)
		th.App.SendDueInviteReminders(th.Context)

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1, "the reminder should replace the original token exactly once")
		assert.NotEqual(t, original.Token, tokens[0].Token)
		reminderData := model.MapFromJSON(strings.NewReader(tokens[0].Extra))
		assert.Equal(t, th.BasicUser.Id, reminderData["senderId"])
		assert.NotContains(t, reminderData, email.InviteTokenRemindAtKey, "a reminder must not schedule another reminder")

		messages := receivedEmails(t, invitedEmail)
		require.Len(t, messages, 1, "the reminder should be emailed exactly once")
		assert.Contains(t, messages[0].Body.Text, "Reminder")
		assert.Contains(t, messages[0].Body.Text, tokens[0].Token, "the reminder should link to the replacement token")
	})

	t.Run("reminds even when the sender has used up their invitation allowance", func(t *testing.T) {
		sender := th.CreateUser(t)
		th.LinkUserToTeam(t, sender, th.BasicTeam)

		var appErr *model.AppError
		for range 100 {
			memberInvite := &model.MemberInvite{Emails: []string{newEmail()}}
			if _, appErr = th.App.InviteNewUsersToTeamGracefully(th.Context, memberInvite, th.BasicTeam.Id, sender.Id, false); appErr != nil {
				break
			}
		}
		require.NotNil(t, appErr)
		require.Equal(t, "app.email.rate_limit_exceeded.app_error", appErr.Id, "the sender should be rate limited before the reminder runs")

		invitedEmail := newEmail()
		tokenExtra := map[string]string{"teamId": th.BasicTeam.Id, "email": invitedEmail, "senderId": sender.Id, email.InviteTokenRemindAtKey: strconv.FormatInt(model.GetMillis()-1, 10)}
		require.NoError(t, th.App.Srv().Store().Token().Save(model.NewToken(model.TokenTypeTeamInvitation, model.MapToJSON(tokenExtra))))

		th.App.SendDueInviteReminders(th.Context)

		messages := receivedEmails(t, invitedEmail)
		require.Len(t, messages, 1)
		assert.Contains(t, messages[0].Body.Text, "Reminder")
	})

	t.Run("leaves an invite that is not due yet", func(t *testing.T) {
		invitedEmail := newEmail()
		original := saveInviteToken(t, invitedEmail, model.GetMillis()+model.InvitationExpiryTime, nil)

		th.App.SendDueInviteReminders(th.Context)

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1)
		assert.Equal(t, original.Token, tokens[0].Token)
	})

	t.Run("does not re-issue an invite that has already expired", func(t *testing.T) {
		invitedEmail := newEmail()
		tokenExtra := map[string]string{"teamId": th.BasicTeam.Id, "email": invitedEmail, "senderId": th.BasicUser.Id, email.InviteTokenRemindAtKey: strconv.FormatInt(model.GetMillis()-time.Hour.Milliseconds(), 10)}
		expired := model.NewToken(model.TokenTypeTeamInvitation, model.MapToJSON(tokenExtra))
		expired.CreateAt = model.GetMillis() - model.InvitationExpiryTime - time.Minute.Milliseconds()
		require.NoError(t, th.App.Srv().Store().Token().Save(expired))

		th.App.SendDueInviteReminders(th.Context)

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1, "the expired token should be left for cleanup, not replaced")
		assert.Equal(t, expired.Token, tokens[0].Token)
	})

	t.Run("sends the earliest due reminders first, up to the per-run limit", func(t *testing.T) {
		earlierEmail := newEmail()
		laterEmail := newEmail()
		earlier := saveInviteToken(t, earlierEmail, model.GetMillis()-2*time.Minute.Milliseconds(), nil)
		later := saveInviteToken(t, laterEmail, model.GetMillis()-time.Minute.Milliseconds(), nil)

		th.App.sendDueInviteReminders(th.Context, 1)

		earlierTokens := inviteTokensFor(t, earlierEmail)
		require.Len(t, earlierTokens, 1)
		assert.NotEqual(t, earlier.Token, earlierTokens[0].Token, "the earlier reminder should have been sent")
		laterTokens := inviteTokensFor(t, laterEmail)
		require.Len(t, laterTokens, 1)
		assert.Equal(t, later.Token, laterTokens[0].Token, "the later reminder should wait for the next run")

		th.App.sendDueInviteReminders(th.Context, 1)

		laterTokens = inviteTokensFor(t, laterEmail)
		require.Len(t, laterTokens, 1)
		assert.NotEqual(t, later.Token, laterTokens[0].Token, "the next run should send the remaining reminder")
	})

	t.Run("stops once the server is shutting down", func(t *testing.T) {
		invitedEmail := newEmail()
		original := saveInviteToken(t, invitedEmail, model.GetMillis()-1, nil)
		ctx, cancel := context.WithCancel(context.Background())
		cancel()

		th.App.SendDueInviteReminders(th.Context.WithContext(ctx))

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1)
		assert.Equal(t, original.Token, tokens[0].Token)
	})

	t.Run("leaves an invite that never asked for a reminder", func(t *testing.T) {
		invitedEmail := newEmail()
		original := saveInviteToken(t, invitedEmail, 0, nil)

		th.App.SendDueInviteReminders(th.Context)

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1)
		assert.Equal(t, original.Token, tokens[0].Token)
	})

	t.Run("skips an invitee who already joined the team", func(t *testing.T) {
		saveInviteToken(t, th.BasicUser2.Email, model.GetMillis()-1, nil)

		th.App.SendDueInviteReminders(th.Context)

		assert.Empty(t, inviteTokensFor(t, th.BasicUser2.Email))
	})

	t.Run("does not retry a reminder that fails", func(t *testing.T) {
		invitedEmail := newEmail()
		// Pre-set profiles need an Enterprise license, so this reminder is rejected.
		saveInviteToken(t, invitedEmail, model.GetMillis()-1, map[string]string{"username": "preset" + model.NewId()})

		th.App.SendDueInviteReminders(th.Context)
		th.App.SendDueInviteReminders(th.Context)

		assert.Empty(t, inviteTokensFor(t, invitedEmail))
	})

	t.Run("does nothing while email invitations are disabled", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ServiceSettings.EnableEmailInvitations = false
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ServiceSettings.EnableEmailInvitations = true
			})
		})
		invitedEmail := newEmail()
		original := saveInviteToken(t, invitedEmail, model.GetMillis()-1, nil)

		th.App.SendDueInviteReminders(th.Context)

		tokens := inviteTokensFor(t, invitedEmail)
		require.Len(t, tokens, 1)
		assert.Equal(t, original.Token, tokens[0].Token)
	})
}
