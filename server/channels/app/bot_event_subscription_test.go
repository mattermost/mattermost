// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func pullPatch() *model.BotEventSubscriptionPatch {
	return &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePull)}
}

func TestBotEventSubscriptionLifecycle(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	bot := th.CreateBot(t)

	t.Run("get before create", func(t *testing.T) {
		_, appErr := th.App.GetBotEventSubscription(th.Context, bot.UserId)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	created, wasCreated, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pullPatch())
	require.Nil(t, appErr)
	assert.True(t, wasCreated)
	assert.Len(t, created.Secret, model.BotEventSecretLength)
	assert.True(t, created.Enabled)
	assert.True(t, created.IgnoreBotAuthors, "ignore_bot_authors defaults to true")

	updated, wasCreated, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(false)})
	require.Nil(t, appErr)
	assert.False(t, wasCreated)
	assert.Empty(t, updated.Secret, "updates never return the secret")
	assert.False(t, updated.IgnoreBotAuthors)
	assert.Equal(t, model.BotEventSubscriptionModePull, updated.Mode)

	stored, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
	require.NoError(t, err)
	assert.Equal(t, created.Secret, stored.Secret, "updating keeps the secret")

	events := []*model.BotEvent{
		{Id: model.NewId(), BotUserId: bot.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)},
		{Id: model.NewId(), BotUserId: bot.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)},
	}
	_, err = th.App.Srv().Store().BotEvent().Save(th.Context, events)
	require.NoError(t, err)

	got, appErr := th.App.GetBotEventSubscription(th.Context, bot.UserId)
	require.Nil(t, appErr)
	assert.Empty(t, got.Secret)
	require.NotNil(t, got.BacklogSize)
	assert.Equal(t, int64(2), *got.BacklogSize)

	regenerated, appErr := th.App.RegenerateBotEventSubscriptionSecret(th.Context, bot.UserId)
	require.Nil(t, appErr)
	assert.Len(t, regenerated.Secret, model.BotEventSecretLength)
	assert.NotEqual(t, created.Secret, regenerated.Secret)
	stored, err = th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
	require.NoError(t, err)
	assert.Equal(t, regenerated.Secret, stored.Secret)
	assert.NotEqual(t, created.Secret, stored.Secret, "the old secret is gone")

	require.NoError(t, th.App.Srv().Store().BotEventSubscription().SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
	enabled, appErr := th.App.EnableBotEventSubscription(th.Context, bot.UserId)
	require.Nil(t, appErr)
	assert.True(t, enabled.Enabled)
	assert.Empty(t, enabled.DisabledReason)
	assert.Empty(t, enabled.Secret)
	_, appErr = th.App.EnableBotEventSubscription(th.Context, bot.UserId)
	require.Nil(t, appErr, "enabling is idempotent")

	require.Nil(t, th.App.DeleteBotEventSubscription(th.Context, bot.UserId))
	assert.Empty(t, botEventsFor(t, th, bot.UserId), "events are deleted with the subscription")
	_, appErr = th.App.GetBotEventSubscription(th.Context, bot.UserId)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	appErr = th.App.DeleteBotEventSubscription(th.Context, bot.UserId)
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
}

func TestBotEventSubscriptionErrors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	bot := th.CreateBot(t)

	t.Run("push is not available yet", func(t *testing.T) {
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePush),
			CallbackURL: new("https://example.com/hook"),
		})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.push_unavailable.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		_, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
		assert.Error(t, err)
	})

	t.Run("switching an existing subscription to push is rejected", func(t *testing.T) {
		other := th.CreateBot(t)
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, other.UserId, pullPatch())
		require.Nil(t, appErr)

		_, _, appErr = th.App.CreateOrUpdateBotEventSubscription(th.Context, other.UserId, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePush),
			CallbackURL: new("https://example.com/hook"),
		})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.push_unavailable.app_error", appErr.Id)
	})

	t.Run("mode is required to create", func(t *testing.T) {
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(true)})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("pull with a callback url", func(t *testing.T) {
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePull),
			CallbackURL: new("https://example.com/hook"),
		})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("system owned bots", func(t *testing.T) {
		systemBot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		_, _, appErr = th.App.CreateOrUpdateBotEventSubscription(th.Context, systemBot.UserId, pullPatch())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.system_owned.app_error", appErr.Id)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("missing bot", func(t *testing.T) {
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, model.NewId(), pullPatch())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

		_, appErr = th.App.RegenerateBotEventSubscriptionSecret(th.Context, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("regenerate and enable without a subscription", func(t *testing.T) {
		_, appErr := th.App.RegenerateBotEventSubscriptionSecret(th.Context, bot.UserId)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

		_, appErr = th.App.EnableBotEventSubscription(th.Context, bot.UserId)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}

func TestBotEventSubscriptionConcurrentCreate(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	bot := th.CreateBot(t)

	const workers = 4
	results := make([]bool, workers)
	errs := make([]*model.AppError, workers)
	var wg sync.WaitGroup
	for i := range workers {
		wg.Go(func() {
			_, results[i], errs[i] = th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pullPatch())
		})
	}
	wg.Wait()

	created := 0
	for i := range workers {
		require.Nil(t, errs[i])
		if results[i] {
			created++
		}
	}
	assert.Equal(t, 1, created, "exactly one request creates the subscription")

	var count int
	require.NoError(t, th.SQLStore.GetMaster().Get(&count, "SELECT COUNT(*) FROM BotEventSubscriptions WHERE BotUserId = $1", bot.UserId))
	assert.Equal(t, 1, count)
}

func TestBotEventSubscriptionRemovedWithBot(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	newSubscribedBot := func(t *testing.T) *model.Bot {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		_, err := th.App.Srv().Store().BotEvent().Save(th.Context, []*model.BotEvent{
			{Id: model.NewId(), BotUserId: bot.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)},
		})
		require.NoError(t, err)
		return bot
	}

	assertGone := func(t *testing.T, botID string) {
		_, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, botID)
		assert.True(t, store.IsErrNotFound(err))
		assert.Empty(t, botEventsFor(t, th, botID))
	}

	t.Run("permanent delete of the user", func(t *testing.T) {
		bot := newSubscribedBot(t)
		user, appErr := th.App.GetUser(th.Context, bot.UserId)
		require.Nil(t, appErr)

		require.Nil(t, th.App.PermanentDeleteUser(th.Context, user))

		assertGone(t, bot.UserId)
	})

	t.Run("permanent delete of the bot", func(t *testing.T) {
		bot := newSubscribedBot(t)

		require.Nil(t, th.App.PermanentDeleteBot(th.Context, bot.UserId))

		assertGone(t, bot.UserId)
	})

	t.Run("conversion to a user", func(t *testing.T) {
		bot := newSubscribedBot(t)

		_, appErr := th.App.ConvertBotToUser(th.Context, bot, &model.UserPatch{Password: new(model.NewTestPassword())}, false)
		require.Nil(t, appErr)

		assertGone(t, bot.UserId)
	})
}

func TestCreateBotWithEventSubscription(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	newBot := func() *model.Bot {
		return &model.Bot{Username: "bot" + model.NewId(), OwnerId: th.BasicUser.Id}
	}

	t.Run("creates both", func(t *testing.T) {
		bot, sub, appErr := th.App.CreateBotWithEventSubscription(th.Context, newBot(), pullPatch())
		require.Nil(t, appErr)
		assert.Equal(t, bot.UserId, sub.BotUserId)
		assert.Len(t, sub.Secret, model.BotEventSecretLength)
	})

	t.Run("failed subscription leaves no bot", func(t *testing.T) {
		bot := newBot()
		// Passes the create checks but fails validation: pull mode cannot have a callback url.
		_, _, appErr := th.App.CreateBotWithEventSubscription(th.Context, bot, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePull),
			CallbackURL: new("https://example.com/hook"),
		})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		_, err := th.App.Srv().Store().User().GetByUsername(bot.Username)
		assert.Error(t, err, "the bot user must have been removed")
		_, err = th.App.Srv().Store().Bot().Get(bot.UserId, true)
		assert.Error(t, err)
	})

	t.Run("invalid patches are rejected before the bot is created", func(t *testing.T) {
		bot := newBot()
		_, _, appErr := th.App.CreateBotWithEventSubscription(th.Context, bot, &model.BotEventSubscriptionPatch{})
		require.NotNil(t, appErr)

		_, _, appErr = th.App.CreateBotWithEventSubscription(th.Context, bot, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePush),
			CallbackURL: new("https://example.com/hook"),
		})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.push_unavailable.app_error", appErr.Id)

		_, err := th.App.Srv().Store().User().GetByUsername(bot.Username)
		assert.Error(t, err)
	})
}

func TestBotEventSubscriptionClusterInvalidation(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &testlib.FakeClusterInterface{}
	th := SetupWithClusterMock(t, cluster).InitBasic(t)
	bot := th.CreateBot(t)

	invalidations := func() []string {
		var ids []string
		for _, msg := range cluster.SelectMessages(func(m *model.ClusterMessage) bool {
			return m.Event == model.ClusterEventInvalidateCacheForBotEventSubscriptions
		}) {
			ids = append(ids, string(msg.Data))
		}
		return ids
	}

	cluster.ClearMessages()
	subscribeTestBot(t, th, bot, nil)
	assert.Equal(t, []string{bot.UserId}, invalidations(), "create")

	cluster.ClearMessages()
	subscribeTestBot(t, th, bot, new(false))
	assert.Equal(t, []string{bot.UserId}, invalidations(), "update")

	cluster.ClearMessages()
	require.Nil(t, th.App.DeleteBotEventSubscription(th.Context, bot.UserId))
	assert.Equal(t, []string{bot.UserId}, invalidations(), "delete")
}
