// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs/bot_events_cleanup"
)

func saveEventsAt(t *testing.T, th *TestHelper, botID string, createAts ...int64) []*model.BotEvent {
	t.Helper()

	events := make([]*model.BotEvent, len(createAts))
	for i, createAt := range createAts {
		events[i] = &model.BotEvent{Id: model.NewId(), BotUserId: botID, Type: model.BotEventTypePostDM, CreateAt: createAt, Payload: []byte(`{}`)}
	}
	for start := 0; start < len(events); start += 1000 {
		require.NoError(t, th.App.Srv().Store().BotEvent().Save(th.Context, events[start:min(start+1000, len(events))]))
	}
	return events
}

func TestBotEventsCleanup(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	ss := th.App.Srv().Store()

	now := model.GetMillis()
	recent := now - 60*1000
	old := now - model.BotEventMaxEventAge.Milliseconds() - 60*1000

	t.Run("acknowledged events are deleted and the rest kept", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		events := saveEventsAt(t, th, bot.UserId, recent, recent+1, recent+2, recent+3)
		_, err := ss.BotEventSubscription().AdvanceAckCursor(th.Context, bot.UserId, events[1].Cursor(), now)
		require.NoError(t, err)

		result, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.AckedDeleted, int64(2))

		assert.Equal(t, []string{events[2].Id, events[3].Id}, eventIDsFromEvents(botEventsFor(t, th, bot.UserId)))
	})

	t.Run("a large acknowledged backlog is deleted across batches", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		createAts := make([]int64, 2500)
		for i := range createAts {
			createAts[i] = recent + int64(i)
		}
		events := saveEventsAt(t, th, bot.UserId, createAts...)
		_, err := ss.BotEventSubscription().AdvanceAckCursor(th.Context, bot.UserId, events[2399].Cursor(), now)
		require.NoError(t, err)

		_, err = bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)

		count, err := ss.BotEvent().CountAfterCursor(th.Context, bot.UserId, model.BotEventCursor{})
		require.NoError(t, err)
		assert.Equal(t, int64(100), count)
	})

	t.Run("aged events are deleted, including those of bots without a subscription", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		events := saveEventsAt(t, th, bot.UserId, old, old+1, recent)
		orphan := model.NewId()
		orphanEvents := saveEventsAt(t, th, orphan, old, recent)

		result, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.AgedDeleted, int64(3))

		assert.Equal(t, []string{events[2].Id}, eventIDsFromEvents(botEventsFor(t, th, bot.UserId)))
		assert.Equal(t, []string{orphanEvents[1].Id}, eventIDsFromEvents(botEventsFor(t, th, orphan)))
	})

	t.Run("a second run changes nothing", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		saveEventsAt(t, th, bot.UserId, old, recent)

		_, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		before := eventIDsFromEvents(botEventsFor(t, th, bot.UserId))

		_, err = bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)

		assert.Equal(t, before, eventIDsFromEvents(botEventsFor(t, th, bot.UserId)))
	})
}

func eventIDsFromEvents(events []*model.BotEvent) []string {
	ids := make([]string, len(events))
	for i, e := range events {
		ids[i] = e.Id
	}
	return ids
}
