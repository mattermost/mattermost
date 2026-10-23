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
	t.Run("DeleteAcked", func(t *testing.T) { testBotEventDeleteAcked(t, rctx, ss, s) })
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
	require.NoError(t, ss.BotEvent().Save(rctx, events))
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
		require.NoError(t, ss.BotEvent().Save(rctx, nil))
	})

	t.Run("create at defaults to the database clock", func(t *testing.T) {
		before := botEventDBNow(t, s)
		saveTestBotEvents(t, rctx, ss, newTestBotEvent(botID, 0), newTestBotEvent(botID, 0))
		after := botEventDBNow(t, s)

		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 10)
		require.NoError(t, err)
		require.Len(t, got, 2)
		for _, e := range got {
			assert.GreaterOrEqual(t, e.CreateAt, before-1)
			assert.LessOrEqual(t, e.CreateAt, after+1)
		}
	})

	t.Run("explicit create at is honoured", func(t *testing.T) {
		e := newTestBotEvent(botID, 1234)
		saveTestBotEvents(t, rctx, ss, e)

		got, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{CreateAt: 1233}, 0, 1)
		require.NoError(t, err)
		require.Len(t, got, 1)
		assert.Equal(t, e.Id, got[0].Id)
		assert.Equal(t, int64(1234), got[0].CreateAt)
	})

	t.Run("invalid id is rejected", func(t *testing.T) {
		e := newTestBotEvent(botID, 0)
		e.Id = "bad"
		err := ss.BotEvent().Save(rctx, []*model.BotEvent{e})
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

// A writer whose transaction commits late must not be skipped. Row A gets its CreateAt
// first but commits after row B; a reader without a settle window would see B alone and
// move past A, while the settle window keeps both hidden until A is visible.
func testBotEventLateCommitOrdering(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	botID := model.NewId()
	a := newTestBotEvent(botID, 0)
	b := newTestBotEvent(botID, 0)

	tx, err := s.BeginMaster()
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()
	_, err = tx.Exec(
		"INSERT INTO BotEvents (Id, BotUserId, Type, CreateAt, Payload) VALUES (?, ?, 'post_dm', (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint, '{}')",
		a.Id, botID)
	require.NoError(t, err)

	saveTestBotEvents(t, rctx, ss, b)

	onlyB, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, 0, 10)
	require.NoError(t, err)
	require.Equal(t, []string{b.Id}, eventIDs(onlyB), "without a settle window B is visible while A is still uncommitted")

	settled, err := ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, model.BotEventSettleWindowMillis, 10)
	require.NoError(t, err)
	assert.Empty(t, settled, "inside the settle window nothing is readable")

	require.NoError(t, tx.Commit())

	var got []*model.BotEvent
	require.Eventually(t, func() bool {
		got, err = ss.BotEvent().GetAfterCursor(rctx, botID, model.BotEventCursor{}, model.BotEventSettleWindowMillis, 10)
		if len(got) > 0 {
			assert.Equal(t, a.Id, got[0].Id, "A is delivered before B even though B committed first")
		}
		return err == nil && len(got) == 2
	}, 5*time.Second, 20*time.Millisecond)
	assert.Equal(t, []string{a.Id, b.Id}, eventIDs(got))
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
				assert.NoError(t, ss.BotEvent().Save(rctx, []*model.BotEvent{newTestBotEvent(botID, 0)}))
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

func testBotEventDeleteAcked(t *testing.T, rctx request.CTX, ss store.Store, s SqlStore) {
	// DeleteAcked is global, so start from an empty table.
	_, execErr := s.GetMaster().Exec("DELETE FROM BotEvents")
	require.NoError(t, execErr)

	seed := func(n int, ackIndex int) (*model.BotEventSubscription, []*model.BotEvent) {
		sub := saveTestBotEventSubscription(t, rctx, ss)
		events := make([]*model.BotEvent, n)
		for i := range events {
			events[i] = newTestBotEvent(sub.BotUserId, int64(100+i))
		}
		saveTestBotEvents(t, rctx, ss, events...)
		if ackIndex >= 0 {
			_, ackErr := ss.BotEventSubscription().AdvanceAckCursor(rctx, sub.BotUserId, events[ackIndex].Cursor(), 1)
			require.NoError(t, ackErr)
		}
		return sub, events
	}

	acked, ackedEvents := seed(5, 3)
	unacked, unackedEvents := seed(3, -1)
	orphan := newTestBotEvent(model.NewId(), 100)
	saveTestBotEvents(t, rctx, ss, orphan)

	for _, want := range []int64{2, 2, 0} {
		deleted, err := ss.BotEvent().DeleteAcked(rctx, 2)
		require.NoError(t, err)
		assert.Equal(t, want, deleted, "batches of at most the limit")
	}

	left, err := ss.BotEvent().GetAfterCursor(rctx, acked.BotUserId, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, []string{ackedEvents[4].Id}, eventIDs(left), "events up to and including the ack cursor are deleted")

	left, err = ss.BotEvent().GetAfterCursor(rctx, unacked.BotUserId, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, eventIDs(unackedEvents), eventIDs(left), "nothing is deleted without an acknowledgement")

	left, err = ss.BotEvent().GetAfterCursor(rctx, orphan.BotUserId, model.BotEventCursor{}, 0, 100)
	require.NoError(t, err)
	assert.Equal(t, []string{orphan.Id}, eventIDs(left), "events without a subscription are left to the age sweep")
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
		deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 2)
		require.NoError(t, err)
		assert.Equal(t, int64(2), deleted)
	})

	t.Run("deletes every old event of every bot", func(t *testing.T) {
		_, err := s.GetMaster().Exec("DELETE FROM BotEvents")
		require.NoError(t, err)
		saveTestBotEvents(t, rctx, ss, a1, a2, b1, fresh)

		deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 100)
		require.NoError(t, err)
		assert.Equal(t, int64(3), deleted)

		left, err := ss.BotEvent().GetAfterCursor(rctx, botA, model.BotEventCursor{}, 0, 100)
		require.NoError(t, err)
		assert.Equal(t, []string{fresh.Id}, eventIDs(left))
		left, err = ss.BotEvent().GetAfterCursor(rctx, botB, model.BotEventCursor{}, 0, 100)
		require.NoError(t, err)
		assert.Empty(t, left)
	})

	t.Run("nothing to delete", func(t *testing.T) {
		deleted, err := ss.BotEvent().DeleteOlderThan(rctx, 1000, 100)
		require.NoError(t, err)
		assert.Zero(t, deleted)
	})
}
