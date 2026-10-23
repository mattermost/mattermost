// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package storetest

import (
	"encoding/json"
	"math/rand/v2"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestBotEventStore(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	t.Run("Save", func(t *testing.T) { testBotEventSave(t, rctx, ss, s) })
	t.Run("GetAfterCursor", func(t *testing.T) { testBotEventGetAfterCursor(t, rctx, ss) })
	t.Run("SettleWindow", func(t *testing.T) { testBotEventSettleWindow(t, rctx, ss, s) })
	t.Run("LateCommitOrdering", func(t *testing.T) { testBotEventLateCommitOrdering(t, rctx, ss, s) })
	t.Run("ConcurrentWritersAndReader", func(t *testing.T) { testBotEventConcurrentWritersAndReader(t, rctx, ss) })
	t.Run("CountAfterCursor", func(t *testing.T) { testBotEventCountAfterCursor(t, rctx, ss) })
	t.Run("DeleteUpToCursor", func(t *testing.T) { testBotEventDeleteUpToCursor(t, rctx, ss) })
	t.Run("GetBacklogCutoff", func(t *testing.T) { testBotEventGetBacklogCutoff(t, rctx, ss) })
	t.Run("DeleteOlderThan", func(t *testing.T) { testBotEventDeleteOlderThan(t, rctx, ss, s) })
}

func botEventDBNow(t *testing.T, s SqlStore) int64 {
	t.Helper()
	var now int64
	require.NoError(t, s.GetMaster().Get(&now, "SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint"))
	return now
}

func newTestBotEvent(botID string, createAt int64) *model.BotEvent {
	return &model.BotEvent{
		Id:        model.NewId(),
		BotUserId: botID,
		Type:      model.BotEventTypePostDM,
		CreateAt:  createAt,
		Payload:   json.RawMessage(`{"post":{"id":"x"}}`),
	}
}

func saveTestBotEvents(t *testing.T, rctx request.CTX, ss store.Store, events ...*model.BotEvent) {
	t.Helper()
	saved, err := ss.BotEvent().Save(rctx, events)
	require.NoError(t, err)
	require.Len(t, saved, len(events))
}

func eventIDs(events []*model.BotEvent) []string {
	ids := make([]string, len(events))
	for i, e := range events {
		ids[i] = e.Id
	}
	return ids
}

func testBotEventSave(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	botID := model.NewId()

	t.Run("empty input is a no-op", func(t *testing.T) {
		saved, err := ss.BotEvent().Save(rctx, nil)
		require.NoError(t, err)
		assert.Empty(t, saved)
	})

	t.Run("database clock is written back", func(t *testing.T) {
		before := botEventDBNow(t, s)
		e1, e2 := newTestBotEvent(botID, 0), newTestBotEvent(botID, 0)
		saveTestBotEvents(t, rctx, ss, e1, e2)

		for _, e := range []*model.BotEvent{e1, e2} {
			assert.GreaterOrEqual(t, e.CreateAt, before)
			assert.InDelta(t, model.GetMillis(), e.CreateAt, 5000)
		}

		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 10)
		require.NoError(t, err)
		require.Len(t, got, 2)
		byID := map[string]*model.BotEvent{got[0].Id: got[0], got[1].Id: got[1]}
		assert.Equal(t, e1.CreateAt, byID[e1.Id].CreateAt)
		assert.Equal(t, e2.CreateAt, byID[e2.Id].CreateAt)
	})

	t.Run("explicit create at is honoured", func(t *testing.T) {
		e := newTestBotEvent(botID, 1234)
		saveTestBotEvents(t, rctx, ss, e)
		assert.Equal(t, int64(1234), e.CreateAt)

		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{CreateAt: 1233}, 0, 1)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, e.Id, got[0].Id)
		assert.Equal(t, int64(1234), got[0].CreateAt)
	})

	t.Run("invalid id is rejected", func(t *testing.T) {
		e := newTestBotEvent(botID, 0)
		e.Id = "bad"
		_, err := ss.BotEvent().Save(rctx, []*model.BotEvent{e})
		var invalid *store.ErrInvalidInput
		require.ErrorAs(t, err, &invalid)
	})

	t.Run("payload round trips", func(t *testing.T) {
		bot := model.NewId()
		payload := `{"post":{"message":"héllo 👋 \"quoted\" \\ 日本語","props":{"n":[1,2,3],"nested":{"a":null}}},"team":null}`
		e := newTestBotEvent(bot, 0)
		e.Payload = json.RawMessage(payload)
		saveTestBotEvents(t, rctx, ss, e)

		got, err := ss.BotEvent().GetAfterCursor(rctx, bot, model.BotEventCursor{}, 0, 10)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.JSONEq(t, payload, string(got[0].Payload))
		assert.Equal(t, model.BotEventTypePostDM, got[0].Type)
		assert.Equal(t, bot, got[0].BotUserId)
	})
}

func testBotEventGetAfterCursor(t *testing.T, rctx request.CTX, ss store.Store) {
	botID := model.NewId()
	otherBot := model.NewId()

	// Three events share a timestamp so the id breaks the tie.
	tied := []*model.BotEvent{newTestBotEvent(botID, 1000), newTestBotEvent(botID, 1000), newTestBotEvent(botID, 1000)}
	early := newTestBotEvent(botID, 500)
	late := newTestBotEvent(botID, 2000)
	saveTestBotEvents(t, rctx, ss, late, tied[0], tied[1], early, tied[2], newTestBotEvent(otherBot, 10))

	byCursor := func(a, b *model.BotEvent) bool { return a.Cursor().Less(b.Cursor()) }
	expected := []*model.BotEvent{early, tied[0], tied[1], tied[2], late}
	for i := range expected {
		for j := i + 1; j < len(expected); j++ {
			if byCursor(expected[j], expected[i]) {
				expected[i], expected[j] = expected[j], expected[i]
			}
		}
	}

	all, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, eventIDs(expected), eventIDs(all), "ordered by (create_at, id) and scoped to the bot")

	t.Run("cursor is exclusive", func(t *testing.T) {
		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, expected[1].Cursor(), 0, 100)
		require.NoError(t, err)
		assert.Equal(t, eventIDs(expected[2:]), eventIDs(got))

		got, err = ss.BotEvent().GetAfterCursor(rctx, botID, expected[4].Cursor(), 0, 100)
		require.NoError(t, err)
		assert.Empty(t, got)
	})

	t.Run("limit", func(t *testing.T) {
		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 2)
		require.NoError(t, err)
		assert.Equal(t, eventIDs(expected[:2]), eventIDs(got))

		next, err := ss.BotEvent().GetAfterCursor(rctx, botID, got[1].Cursor(), 0, 2)
		require.NoError(t, err)
		assert.Equal(t, eventIDs(expected[2:4]), eventIDs(next))
	})

	t.Run("limit is clamped", func(t *testing.T) {
		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 0)
		require.NoError(t, err)
		assert.Len(t, got, 1)

		got, err = ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, -5)
		require.NoError(t, err)
		assert.Len(t, got, 1)
	})
}

func testBotEventSettleWindow(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	botID := model.NewId()
	e := newTestBotEvent(botID, botEventDBNow(t, s)-200)
	saveTestBotEvents(t, rctx, ss, e)

	hidden, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, model.BotEventSettleWindowMillis, 10)
	require.NoError(t, err)
	assert.Empty(t, hidden)

	visible, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 10)
	require.NoError(t, err)
	require.Len(t, visible, 1)
	assert.Equal(t, e.Id, visible[0].Id)

	// The event settles once the database clock passes CreateAt + window.
	require.Eventually(t, func() bool {
		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, model.BotEventSettleWindowMillis, 10)
		return err == nil && len(got) == 1
	}, 5*time.Second, 50*time.Millisecond)
}

// A writer that committed late must not be skipped: events become readable in
// CreateAt order only after the settle window, so a reader that advanced past B
// can never miss an A with an earlier CreateAt that committed afterwards.
func testBotEventLateCommitOrdering(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	const settle = 400
	botID := model.NewId()

	now := botEventDBNow(t, s)
	b := newTestBotEvent(botID, now)
	saveTestBotEvents(t, rctx, ss, b)
	a := newTestBotEvent(botID, now-50)
	saveTestBotEvents(t, rctx, ss, a)

	first, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, settle, 10)
	require.NoError(t, err)
	assert.Empty(t, first, "neither event is readable inside the window")

	var got []*model.BotEvent
	require.Eventually(t, func() bool {
		got, err = ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, settle, 10)
		return err == nil && len(got) > 0
	}, 5*time.Second, 10*time.Millisecond)

	assert.Equal(t, a.Id, got[0].Id, "the earlier CreateAt is delivered first even though it committed later")
	if len(got) == 2 {
		assert.Equal(t, b.Id, got[1].Id)
	}
}

func testBotEventConcurrentWritersAndReader(t *testing.T, rctx request.CTX, ss store.Store) {
	botID := model.NewId()
	const writers = 8
	const perWriter = 50
	const total = writers * perWriter

	var wg sync.WaitGroup
	for range writers {
		wg.Go(func() {
			for range perWriter {
				time.Sleep(time.Duration(rand.IntN(5)) * time.Millisecond)
				_, err := ss.BotEvent().Save(rctx, []*model.BotEvent{newTestBotEvent(botID, 0)})
				assert.NoError(t, err)
			}
		})
	}
	writersDone := make(chan struct{})
	go func() {
		wg.Wait()
		close(writersDone)
	}()

	received := map[string]struct{}{}
	var order []model.BotEventCursor
	var cursor model.BotEventCursor
	deadline := time.Now().Add(30 * time.Second)

	for len(received) < total && time.Now().Before(deadline) {
		events, err := ss.BotEvent().GetAfterCursor(rctx, botID, cursor, model.BotEventSettleWindowMillis, 37)
		require.NoError(t, err)
		if len(events) == 0 {
			time.Sleep(20 * time.Millisecond)
			continue
		}
		for _, e := range events {
			_, dup := received[e.Id]
			require.False(t, dup, "event %s delivered twice", e.Id)
			received[e.Id] = struct{}{}
			order = append(order, e.Cursor())
		}
		cursor = events[len(events)-1].Cursor()
	}
	<-writersDone

	assert.Len(t, received, total, "no event may be lost")
	for i := 1; i < len(order); i++ {
		assert.False(t, order[i].Less(order[i-1]), "cursors must be non-decreasing")
	}

	count, err := ss.BotEvent().CountAfterCursor(rctx, botID, cursor)
	require.NoError(t, err)
	assert.Zero(t, count, "nothing remains after the last delivered cursor")
}

func testBotEventCountAfterCursor(t *testing.T, rctx request.CTX, ss store.Store) {
	botID := model.NewId()
	events := []*model.BotEvent{newTestBotEvent(botID, 10), newTestBotEvent(botID, 20), newTestBotEvent(botID, 30), newTestBotEvent(model.NewId(), 40)}
	saveTestBotEvents(t, rctx, ss, events...)

	count, err := ss.BotEvent().CountAfterCursor(rctx, botID, model.BotEventCursor{})
	require.NoError(t, err)
	assert.Equal(t, int64(3), count)

	count, err = ss.BotEvent().CountAfterCursor(rctx, botID, events[1].Cursor())
	require.NoError(t, err)
	assert.Equal(t, int64(1), count)

	count, err = ss.BotEvent().CountAfterCursor(rctx, botID, events[2].Cursor())
	require.NoError(t, err)
	assert.Zero(t, count)
}

func testBotEventDeleteUpToCursor(t *testing.T, rctx request.CTX, ss store.Store) {
	botID := model.NewId()
	otherBot := model.NewId()

	var events []*model.BotEvent
	for i := range 5 {
		events = append(events, newTestBotEvent(botID, int64(100+i)))
	}
	other := newTestBotEvent(otherBot, 100)
	saveTestBotEvents(t, rctx, ss, append(events, other)...)

	upTo := events[4].Cursor()
	for _, want := range []int64{2, 2, 1, 0} {
		deleted, err := ss.BotEvent().DeleteUpToCursor(rctx, botID, upTo, 2)
		require.NoError(t, err)
		assert.Equal(t, want, deleted)
	}

	remaining, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Empty(t, remaining)

	otherRemaining, err := ss.BotEvent().GetAfterCursor(rctx, otherBot, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, []string{other.Id}, eventIDs(otherRemaining))

	t.Run("cursor bounds the delete inclusively", func(t *testing.T) {
		bot := model.NewId()
		var evs []*model.BotEvent
		for i := range 4 {
			evs = append(evs, newTestBotEvent(bot, int64(10+i)))
		}
		saveTestBotEvents(t, rctx, ss, evs...)

		deleted, err := ss.BotEvent().DeleteUpToCursor(rctx, bot, evs[1].Cursor(), 100)
		require.NoError(t, err)
		assert.Equal(t, int64(2), deleted)

		left, err := ss.BotEvent().GetAfterCursor(rctx, bot, model.BotEventCursor{}, 0, 100)
		require.NoError(t, err)
		assert.Equal(t, eventIDs(evs[2:]), eventIDs(left))
	})
}

func testBotEventGetBacklogCutoff(t *testing.T, rctx request.CTX, ss store.Store) {
	botID := model.NewId()
	var events []*model.BotEvent
	for i := range 5 {
		events = append(events, newTestBotEvent(botID, int64(100+i)))
	}
	saveTestBotEvents(t, rctx, ss, events...)

	for _, keep := range []int{5, 6, 10000} {
		cutoff, err := ss.BotEvent().GetBacklogCutoff(rctx, botID, keep)
		require.NoError(t, err)
		assert.Nil(t, cutoff, "keep=%d leaves nothing to drop", keep)
	}

	cutoff, err := ss.BotEvent().GetBacklogCutoff(rctx, botID, 3)
	require.NoError(t, err)
	require.NotNil(t, cutoff)
	assert.Equal(t, events[1].Cursor(), *cutoff, "the newest event to drop is the 2nd oldest")

	cutoff, err = ss.BotEvent().GetBacklogCutoff(rctx, botID, 0)
	require.NoError(t, err)
	require.NotNil(t, cutoff)
	assert.Equal(t, events[4].Cursor(), *cutoff)

	empty, err := ss.BotEvent().GetBacklogCutoff(rctx, model.NewId(), 3)
	require.NoError(t, err)
	assert.Nil(t, empty)
}

func testBotEventDeleteOlderThan(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	// DeleteOlderThan is global, so start from an empty table.
	_, err := s.GetMaster().Exec("DELETE FROM BotEvents")
	require.NoError(t, err)

	botA, botB := model.NewId(), model.NewId()
	a1, a2 := newTestBotEvent(botA, 100), newTestBotEvent(botA, 200)
	b1 := newTestBotEvent(botB, 150)
	fresh := newTestBotEvent(botA, 5000)
	saveTestBotEvents(t, rctx, ss, a1, a2, b1, fresh)

	t.Run("respects the limit", func(t *testing.T) {
		maxCursors, deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(2), deleted)
		assert.LessOrEqual(t, len(maxCursors), 2)
	})

	t.Run("returns the per bot maximum", func(t *testing.T) {
		_, err := s.GetMaster().Exec("DELETE FROM BotEvents")
		require.NoError(t, err)
		saveTestBotEvents(t, rctx, ss, a1, a2, b1, fresh)

		maxCursors, deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 100)
		require.NoError(t, err)
		assert.Equal(t, int64(3), deleted)
		require.Len(t, maxCursors, 2)
		assert.Equal(t, a2.Cursor(), maxCursors[botA])
		assert.Equal(t, b1.Cursor(), maxCursors[botB])

		left, err := ss.BotEvent().GetAfterCursor(rctx, botA, model.BotEventCursor{}, 0, 100)
		require.NoError(t, err)
		assert.Equal(t, []string{fresh.Id}, eventIDs(left))
	})

	t.Run("nothing to delete", func(t *testing.T) {
		maxCursors, deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 100)
		require.NoError(t, err)
		assert.Zero(t, deleted)
		assert.Empty(t, maxCursors)
	})
}
