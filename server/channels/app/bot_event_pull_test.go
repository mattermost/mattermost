// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// setupPullTest returns a helper whose long-poll timings are shortened.
func setupPullTest(t *testing.T) (*TestHelper, *model.Bot) {
	t.Helper()

	th := Setup(t).InitBasic(t)
	svc := th.App.Srv().botEvents
	svc.settleWindow = 100 * time.Millisecond
	svc.recheckInterval = 50 * time.Millisecond

	bot := th.CreateBot(t)
	subscribeTestBot(t, th, bot, nil)
	return th, bot
}

// getBotEvents applies the default limit that the API parser sets.
func getBotEvents(th *TestHelper, rctx request.CTX, botID string, opts model.BotEventsOptions) (*model.BotEventList, *model.AppError) {
	if opts.Limit == 0 {
		opts.Limit = model.BotEventsDefaultLimit
	}
	return th.App.GetBotEvents(rctx, botID, opts)
}

// seedBotEvents stores n settled events, oldest first.
func seedBotEvents(t *testing.T, th *TestHelper, botID string, n int) []*model.BotEvent {
	t.Helper()

	base := model.GetMillis() - 60000
	events := make([]*model.BotEvent, n)
	for i := range events {
		events[i] = &model.BotEvent{Id: model.NewId(), BotUserId: botID, Type: model.BotEventTypePostDM, CreateAt: base + int64(i), Payload: []byte(`{"post":{"id":"p"}}`)}
	}
	require.NoError(t, th.App.Srv().Store().BotEvent().Save(th.Context, events))
	return events
}

func eventIDsOf(list *model.BotEventList) []string {
	ids := make([]string, len(list.Events))
	for i, e := range list.Events {
		ids[i] = e.EventId
	}
	return ids
}

func TestGetBotEvents(t *testing.T) {
	mainHelper.Parallel(t)
	th, bot := setupPullTest(t)
	events := seedBotEvents(t, th, bot.UserId, 5)

	ackOf := func(t *testing.T) model.BotEventCursor {
		sub, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
		require.NoError(t, err)
		return sub.AckCursor()
	}

	t.Run("without a cursor nothing is acknowledged", func(t *testing.T) {
		first, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{})
		require.Nil(t, appErr)
		second, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{})
		require.Nil(t, appErr)

		assert.Len(t, first.Events, 5)
		assert.Equal(t, eventIDsOf(first), eventIDsOf(second))
		assert.Equal(t, model.BotEventCursor{}, ackOf(t))
		assert.Equal(t, events[4].Cursor().Encode(), first.NextCursor)
	})

	t.Run("pagination acknowledges with the cursor", func(t *testing.T) {
		page1, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Limit: 2})
		require.Nil(t, appErr)
		assert.Equal(t, []string{events[0].Id, events[1].Id}, eventIDsOf(page1))

		cursor, err := model.DecodeBotEventCursor(page1.NextCursor)
		require.NoError(t, err)
		page2, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Cursor: &cursor, Limit: 2})
		require.Nil(t, appErr)
		assert.Equal(t, []string{events[2].Id, events[3].Id}, eventIDsOf(page2))
		assert.Equal(t, events[1].Cursor(), ackOf(t))

		sub, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
		require.NoError(t, err)
		assert.NotZero(t, sub.LastDeliveredAt)
	})

	t.Run("an older cursor does not move the acknowledgement back", func(t *testing.T) {
		newer := events[3].Cursor()
		_, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Cursor: &newer})
		require.Nil(t, appErr)

		older := events[0].Cursor()
		list, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Cursor: &older})
		require.Nil(t, appErr)

		assert.Equal(t, events[3].Cursor(), ackOf(t))
		assert.Equal(t, []string{events[4].Id}, eventIDsOf(list), "the effective cursor is the newer one")
	})

	t.Run("nothing left", func(t *testing.T) {
		last := events[4].Cursor()
		list, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Cursor: &last})
		require.Nil(t, appErr)

		assert.NotNil(t, list.Events)
		assert.Empty(t, list.Events)
		assert.Equal(t, last.Encode(), list.NextCursor, "an empty response returns the acknowledged cursor")
	})
}

func TestGetBotEventsSubscriptionState(t *testing.T) {
	mainHelper.Parallel(t)
	th, bot := setupPullTest(t)
	subs := th.App.Srv().Store().BotEventSubscription()

	t.Run("unknown bot or subscription", func(t *testing.T) {
		_, appErr := getBotEvents(th, th.Context, model.NewId(), model.BotEventsOptions{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("disabled", func(t *testing.T) {
		require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
		_, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Equal(t, "app.bot_event.pull.disabled.app_error", appErr.Id)
		require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, true, "", model.GetMillis()))
	})

	t.Run("push mode", func(t *testing.T) {
		sub, err := subs.Get(th.Context, bot.UserId)
		require.NoError(t, err)
		sub.Mode = model.BotEventSubscriptionModePush
		sub.CallbackURL = "https://example.com/hook"
		_, err = subs.Update(th.Context, sub)
		require.NoError(t, err)

		_, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusConflict, appErr.StatusCode)
		assert.Equal(t, "app.bot_event.pull.wrong_mode.app_error", appErr.Id)
	})
}

func TestGetBotEventsLongPoll(t *testing.T) {
	mainHelper.Parallel(t)
	th, _ := setupPullTest(t)
	svc := th.App.Srv().botEvents

	t.Run("a produced event wakes the poll once it has settled", func(t *testing.T) {
		// With a long recheck interval only the wake-up can make this poll return in time.
		svc.recheckInterval = 10 * time.Second
		defer func() { svc.recheckInterval = 50 * time.Millisecond }()
		other := th.CreateBot(t)
		subscribeTestBot(t, th, other, nil)

		const produceAfter = 300 * time.Millisecond // after the poll's first look
		start := time.Now()
		go func() {
			time.Sleep(produceAfter)
			th.App.saveBotEvents(th.Context, []*model.BotEvent{{BotUserId: other.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)}})
		}()

		list, appErr := getBotEvents(th, th.Context, other.UserId, model.BotEventsOptions{Wait: 5 * time.Second})
		require.Nil(t, appErr)

		require.Len(t, list.Events, 1)
		elapsed := time.Since(start)
		assert.GreaterOrEqual(t, elapsed, produceAfter+svc.settleWindow, "the event is not readable before it settles")
		assert.Less(t, elapsed, produceAfter+svc.settleDelay()+time.Second)
	})

	t.Run("an event written just before the poll starts is found after the settle delay", func(t *testing.T) {
		svc.recheckInterval = 10 * time.Second
		defer func() { svc.recheckInterval = 50 * time.Millisecond }()
		other := th.CreateBot(t)
		subscribeTestBot(t, th, other, nil)
		require.NoError(t, th.App.Srv().Store().BotEvent().Save(th.Context, []*model.BotEvent{{Id: model.NewId(), BotUserId: other.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)}}))

		start := time.Now()
		list, appErr := getBotEvents(th, th.Context, other.UserId, model.BotEventsOptions{Wait: 5 * time.Second})
		require.Nil(t, appErr)

		assert.Len(t, list.Events, 1)
		assert.Less(t, time.Since(start), svc.settleDelay()+time.Second)
	})

	t.Run("an event written without a wake-up is found by the recheck", func(t *testing.T) {
		other := th.CreateBot(t)
		subscribeTestBot(t, th, other, nil)

		start := time.Now()
		go func() {
			time.Sleep(300 * time.Millisecond)
			assert.NoError(t, th.App.Srv().Store().BotEvent().Save(th.Context, []*model.BotEvent{{Id: model.NewId(), BotUserId: other.UserId, Type: model.BotEventTypePostDM, Payload: []byte(`{}`)}}))
		}()

		list, appErr := getBotEvents(th, th.Context, other.UserId, model.BotEventsOptions{Wait: 5 * time.Second})
		require.Nil(t, appErr)

		assert.Len(t, list.Events, 1)
		assert.Less(t, time.Since(start), 2*time.Second)
	})

	t.Run("the wait expires", func(t *testing.T) {
		other := th.CreateBot(t)
		subscribeTestBot(t, th, other, nil)

		start := time.Now()
		list, appErr := getBotEvents(th, th.Context, other.UserId, model.BotEventsOptions{Wait: 300 * time.Millisecond})
		require.Nil(t, appErr)

		elapsed := time.Since(start)
		assert.Empty(t, list.Events)
		assert.GreaterOrEqual(t, elapsed, 250*time.Millisecond)
		assert.Less(t, elapsed, 2*time.Second)
	})

	t.Run("a cancelled request returns promptly", func(t *testing.T) {
		other := th.CreateBot(t)
		subscribeTestBot(t, th, other, nil)

		ctx, cancel := context.WithCancel(context.Background())
		time.AfterFunc(100*time.Millisecond, cancel)

		start := time.Now()
		list, appErr := getBotEvents(th, th.Context.WithContext(ctx), other.UserId, model.BotEventsOptions{Wait: 30 * time.Second})
		require.Nil(t, appErr)

		assert.Empty(t, list.Events)
		assert.Less(t, time.Since(start), 2*time.Second)
	})

	t.Run("waiters are released from the registry", func(t *testing.T) {
		svc.mu.Lock()
		defer svc.mu.Unlock()
		assert.Empty(t, svc.waiters)
	})
}

func TestGetBotEventsShutdownReleasesPolls(t *testing.T) {
	mainHelper.Parallel(t)
	th, bot := setupPullTest(t)
	svc := newBotEventService()
	th.App.Srv().botEvents = svc

	done := make(chan *model.BotEventList, 1)
	go func() {
		list, appErr := getBotEvents(th, th.Context, bot.UserId, model.BotEventsOptions{Wait: 30 * time.Second})
		assert.Nil(t, appErr)
		done <- list
	}()

	require.Eventually(t, func() bool {
		svc.mu.Lock()
		defer svc.mu.Unlock()
		return len(svc.waiters[bot.UserId]) == 1
	}, 5*time.Second, 10*time.Millisecond)

	start := time.Now()
	svc.shutdown()

	select {
	case list := <-done:
		assert.Empty(t, list.Events)
		assert.Less(t, time.Since(start), time.Second)
	case <-time.After(5 * time.Second):
		require.Fail(t, "long-poll was not released by shutdown")
	}
}

func TestEffectiveBotEventsWait(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	tests := []struct {
		name         string
		writeTimeout int
		requested    time.Duration
		want         time.Duration
	}{
		{"short request is kept", 300, 10 * time.Second, 10 * time.Second},
		{"default write timeout leaves room for the margin", 300, time.Hour, 295 * time.Second},
		{"write timeout lowers the cap", 8, 60 * time.Second, 3 * time.Second},
		{"write timeout below the margin disables waiting", 5, 60 * time.Second, 0},
		{"zero", 300, 0, 0},
		{"negative", 300, -time.Second, 0},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.WriteTimeout = &tc.writeTimeout })
			assert.Equal(t, tc.want, th.App.effectiveBotEventsWait(tc.requested))
		})
	}
}
