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
		_, err := th.App.Srv().Store().BotEvent().Save(th.Context, events[start:min(start+1000, len(events))])
		require.NoError(t, err)
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

	truncatedOf := func(t *testing.T, botID string) model.BotEventCursor {
		sub, err := ss.BotEventSubscription().Get(th.Context, botID)
		require.NoError(t, err)
		return sub.TruncatedCursor()
	}

	t.Run("acknowledged events are deleted and the rest kept", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		events := saveEventsAt(t, th, bot.UserId, recent, recent+1, recent+2, recent+3)
		_, err := ss.BotEventSubscription().AdvanceAckCursor(th.Context, bot.UserId, events[1].Cursor(), now)
		require.NoError(t, err)

		result, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.AckedDeleted, int64(2))

		left := botEventsFor(t, th, bot.UserId)
		assert.Equal(t, []string{events[2].Id, events[3].Id}, eventIDsFromEvents(left))
		assert.Equal(t, model.BotEventCursor{}, truncatedOf(t, bot.UserId), "acknowledged events are not truncation")
	})

	t.Run("a backlog over the cap drops the oldest and marks truncation", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		extra := 5
		createAts := make([]int64, model.BotEventMaxBacklog+extra)
		for i := range createAts {
			createAts[i] = recent + int64(i)
		}
		events := saveEventsAt(t, th, bot.UserId, createAts...)

		result, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.BacklogDropped, int64(extra))

		assert.Equal(t, events[extra-1].Cursor(), truncatedOf(t, bot.UserId))
		count, err := ss.BotEvent().CountAfterCursor(th.Context, bot.UserId, model.BotEventCursor{})
		require.NoError(t, err)
		assert.Equal(t, int64(model.BotEventMaxBacklog), count)

		first := botEventsFor(t, th, bot.UserId)[0]
		assert.Equal(t, events[extra].Id, first.Id)
	})

	t.Run("aged events are deleted and marked truncated", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		events := saveEventsAt(t, th, bot.UserId, old, old+1, recent)

		result, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, result.AgedDeleted, int64(2))

		assert.Equal(t, []string{events[2].Id}, eventIDsFromEvents(botEventsFor(t, th, bot.UserId)))
		assert.Equal(t, events[1].Cursor(), truncatedOf(t, bot.UserId))
	})

	t.Run("orphaned events are aged out", func(t *testing.T) {
		orphan := model.NewId()
		saveEventsAt(t, th, orphan, old, recent)

		_, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)

		assert.Len(t, botEventsFor(t, th, orphan), 1)
	})

	t.Run("a second run changes nothing", func(t *testing.T) {
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		saveEventsAt(t, th, bot.UserId, old, recent)

		_, err := bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)
		before := botEventsFor(t, th, bot.UserId)
		truncated := truncatedOf(t, bot.UserId)

		_, err = bot_events_cleanup.Cleanup(th.Context, ss, now)
		require.NoError(t, err)

		assert.Equal(t, eventIDsFromEvents(before), eventIDsFromEvents(botEventsFor(t, th, bot.UserId)))
		assert.Equal(t, truncated, truncatedOf(t, bot.UserId))
	})
}

func eventIDsFromEvents(events []*model.BotEvent) []string {
	ids := make([]string, len(events))
	for i, e := range events {
		ids[i] = e.Id
	}
	return ids
}
