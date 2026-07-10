// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestPatExpiryBucket(t *testing.T) {
	now := int64(1_000_000_000_000)

	testCases := []struct {
		name      string
		expiresAt int64
		expected  int
	}{
		{"already expired", now - model.DayInMilliseconds, 0},
		{"expires now", now, 0},
		{"12 hours left -> 1-day bucket", now + 12*60*60*1000, 1},
		{"exactly 1 day left -> 1-day bucket", now + 1*model.DayInMilliseconds, 1},
		{"2 days left -> 3-day bucket", now + 2*model.DayInMilliseconds, 3},
		{"exactly 3 days left -> 3-day bucket", now + 3*model.DayInMilliseconds, 3},
		{"5 days left -> 7-day bucket", now + 5*model.DayInMilliseconds, 7},
		{"exactly 7 days left -> 7-day bucket", now + 7*model.DayInMilliseconds, 7},
		{"8 days left -> outside cascade", now + 8*model.DayInMilliseconds, 0},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.expected, patExpiryBucket(tc.expiresAt, now))
		})
	}
}

func TestNotifyPersonalAccessTokensExpiring(t *testing.T) {
	setup := func(t *testing.T) *TestHelper {
		th := Setup(t).InitBasic(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = true })
		return th
	}

	systemBotDMMessages := func(t *testing.T, th *TestHelper, userID string) []string {
		systemBot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)
		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, userID, systemBot.UserId)
		require.Nil(t, appErr)
		posts, appErr := th.App.GetPosts(th.Context, channel.Id, 0, 50)
		require.Nil(t, appErr)
		var messages []string
		for _, p := range posts.Posts {
			if p.UserId == systemBot.UserId {
				messages = append(messages, p.Message)
			}
		}
		return messages
	}

	t.Run("disabled when EnableUserAccessTokens is off", func(t *testing.T) {
		th := setup(t)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableUserAccessTokens = false })

		token := &model.UserAccessToken{Token: model.NewId(), UserId: th.BasicUser.Id, Description: "t", ExpiresAt: model.GetMillis() + 5*model.DayInMilliseconds}
		_, err := th.App.Srv().Store().UserAccessToken().Save(token)
		require.NoError(t, err)

		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		require.Empty(t, systemBotDMMessages(t, th, th.BasicUser.Id))
	})

	t.Run("warns once and dedups on re-run", func(t *testing.T) {
		th := setup(t)

		token := &model.UserAccessToken{Token: model.NewId(), UserId: th.BasicUser.Id, Description: "deploy bot", ExpiresAt: model.GetMillis() + 5*model.DayInMilliseconds}
		_, err := th.App.Srv().Store().UserAccessToken().Save(token)
		require.NoError(t, err)

		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		messages := systemBotDMMessages(t, th, th.BasicUser.Id)
		require.Len(t, messages, 1, "owner should get exactly one warning")
		require.Contains(t, messages[0], "deploy bot", "warning should name the token")
		require.Contains(t, messages[0], "7 days or less", "5-day token is in the 7-day bucket")
		require.Contains(t, messages[0], "regenerate", "warning should tell the owner to regenerate the token")
		require.NotContains(t, messages[0], "day(s)", "message must not use the awkward day(s) plural")

		stored, err := th.App.Srv().Store().UserAccessToken().Get(token.Id)
		require.NoError(t, err)
		require.NotNil(t, stored.LastNotifiedAt, "last-notified time should be recorded")

		// A second run in the same bucket must not send another DM.
		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		require.Len(t, systemBotDMMessages(t, th, th.BasicUser.Id), 1, "re-run in the same bucket must not duplicate")
	})

	t.Run("token already inside window sends only the current bucket, not a catch-up burst", func(t *testing.T) {
		th := setup(t)

		// Token surfaces with only 2 days left (e.g. created short-lived, or owner
		// just reactivated). It must get a single warning at the 3-day bucket, never
		// the already-passed 7-day one.
		token := &model.UserAccessToken{Token: model.NewId(), UserId: th.BasicUser.Id, Description: "short lived", ExpiresAt: model.GetMillis() + 2*model.DayInMilliseconds}
		_, err := th.App.Srv().Store().UserAccessToken().Save(token)
		require.NoError(t, err)

		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		messages := systemBotDMMessages(t, th, th.BasicUser.Id)
		require.Len(t, messages, 1, "exactly one warning, no 7+3 burst")
		require.Contains(t, messages[0], "3 days or less", "2-day token is in the 3-day bucket")

		stored, err := th.App.Srv().Store().UserAccessToken().Get(token.Id)
		require.NoError(t, err)
		require.NotNil(t, stored.LastNotifiedAt, "last-notified time should be recorded")
	})

	t.Run("sub-day token uses the 24-hour wording", func(t *testing.T) {
		th := setup(t)

		token := &model.UserAccessToken{Token: model.NewId(), UserId: th.BasicUser.Id, Description: "almost gone", ExpiresAt: model.GetMillis() + 12*60*60*1000}
		_, err := th.App.Srv().Store().UserAccessToken().Save(token)
		require.NoError(t, err)

		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		messages := systemBotDMMessages(t, th, th.BasicUser.Id)
		require.Len(t, messages, 1)
		require.Contains(t, messages[0], "within 24 hours", "sub-day token uses the dedicated 24-hour message")
		require.NotContains(t, messages[0], "day", "the 24-hour message must not mention days")
	})

	t.Run("bot-owned token is not notified", func(t *testing.T) {
		th := setup(t)

		bot, appErr := th.App.CreateBot(th.Context, &model.Bot{Username: "expiring_bot", OwnerId: th.BasicUser.Id})
		require.Nil(t, appErr)

		token := &model.UserAccessToken{Token: model.NewId(), UserId: bot.UserId, Description: "bot token", ExpiresAt: model.GetMillis() + 5*model.DayInMilliseconds}
		_, err := th.App.Srv().Store().UserAccessToken().Save(token)
		require.NoError(t, err)

		require.NoError(t, th.App.NotifyPersonalAccessTokensExpiring())
		require.Empty(t, systemBotDMMessages(t, th, bot.UserId), "bot accounts must not be warned")

		stored, err := th.App.Srv().Store().UserAccessToken().Get(token.Id)
		require.NoError(t, err)
		require.Nil(t, stored.LastNotifiedAt, "bot token marker must stay unset")
	})
}
