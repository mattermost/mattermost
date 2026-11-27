// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"errors"
	"strconv"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// blockFirst makes pluginID's delivery of item "block" wait until release is called. started is
// closed once that delivery is in progress, so the worker holds no queued entry. The test's
// cleanup releases it too, so a failed assertion doesn't leave the worker blocked.
func blockFirst(t *testing.T, tb *testBus, pluginID string) (started chan struct{}, release func()) {
	started = make(chan struct{})
	block, release := newRelease(t)
	tb.hooks.setOnEvent(func(id string, d *model.EventDelivery) error {
		if id == pluginID && d.Payload["item_id"].Text == "block" {
			close(started)
			<-block
		}
		return nil
	})
	return started, release
}

// newRelease returns a channel and an idempotent function that closes it, also run on cleanup.
func newRelease(t *testing.T) (<-chan struct{}, func()) {
	ch := make(chan struct{})
	var once sync.Once
	release := func() { once.Do(func() { close(ch) }) }
	t.Cleanup(release)
	return ch, release
}

func subscriberQueue(t *testing.T, tb *testBus, pluginID string) *queue {
	t.Helper()
	tb.subs.mu.RLock()
	defer tb.subs.mu.RUnlock()
	existing := tb.subs.subscribers[pluginID]
	require.NotNil(t, existing)
	return existing.queue
}

func waitClosed(t *testing.T, ch chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out")
	}
}

func itemIDs(deliveries []*model.EventDelivery) []string {
	ids := []string{}
	for _, d := range nonFlush(deliveries) {
		ids = append(ids, d.Payload["item_id"].Text)
	}
	return ids
}

func TestQueueDeliversInOrder(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))

	want := []string{}
	for i := range 50 {
		id := strconv.Itoa(i)
		want = append(want, id)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload(id), "", nil))
	}
	waitForDeliveries(t, tb.hooks, subscriberID, 50)
	assert.Equal(t, want, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestQueueFullDropsDeliveries(t *testing.T) {
	tb := newTestBus(t, 2)
	tb.registerItemEvents(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
	started, release := blockFirst(t, tb, subscriberID)

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)
	for _, id := range []string{"queued1", "queued2", "dropped"} {
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload(id), "", nil), "emit never fails because a queue is full")
	}
	release()

	waitForDeliveries(t, tb.hooks, subscriberID, 3)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, []string{"block", "queued1", "queued2"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestSlowSubscriberDoesNotBlockEmitOrOthers(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	for _, id := range []string{subscriberID, otherID} {
		require.NoError(t, tb.SetSubscriptions(id, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
	}
	started, _ := blockFirst(t, tb, subscriberID)

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)

	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := range 10 {
			assert.NoError(t, tb.Emit(publisherID, "item_created", itemPayload(strconv.Itoa(i)), "", nil))
		}
	}()
	waitClosed(t, done)

	waitForDeliveries(t, tb.hooks, otherID, 11)
}

func TestSetSubscriptionsAppliesToQueuedDeliveries(t *testing.T) {
	tests := []struct {
		name    string
		replace []model.EventSubscription
		// restore, if set, is applied after replace.
		restore []model.EventSubscription
		wantIDs [][]string
	}{
		{
			name:    "removed subscription drops the delivery",
			replace: []model.EventSubscription{{ID: "b", Event: publisherID + "/other"}},
			wantIDs: nil,
		},
		{
			name:    "changed subscription under the same ID drops the delivery",
			replace: []model.EventSubscription{{ID: "a", Event: "*", Filters: map[string]model.EventValue{"item_id": model.EventTextValue("queued")}}},
			wantIDs: nil,
		},
		{
			name:    "identical set keeps the delivery",
			replace: []model.EventSubscription{{ID: "a", Event: "*"}, {ID: "b", Event: publisherID + "/items/*"}},
			wantIDs: [][]string{{"a", "b"}},
		},
		{
			name:    "partially removed set keeps the remaining IDs",
			replace: []model.EventSubscription{{ID: "b", Event: publisherID + "/items/*"}},
			wantIDs: [][]string{{"b"}},
		},
		{
			name:    "removed and restored subscription drops its ID",
			replace: []model.EventSubscription{{ID: "b", Event: publisherID + "/items/*"}},
			restore: []model.EventSubscription{{ID: "a", Event: "*"}, {ID: "b", Event: publisherID + "/items/*"}},
			wantIDs: [][]string{{"b"}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerItemEvents(t)
			tb.registerFlush(t)
			require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
				{ID: "a", Event: "*"},
				{ID: "b", Event: publisherID + "/items/*"},
				flushSubscription,
			}, model.SubscriptionOptions{}))
			started, release := blockFirst(t, tb, subscriberID)

			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
			waitClosed(t, started)
			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("queued"), "", nil))

			require.NoError(t, tb.SetSubscriptions(subscriberID, append(tc.replace, flushSubscription), model.SubscriptionOptions{}))
			if tc.restore != nil {
				require.NoError(t, tb.SetSubscriptions(subscriberID, append(tc.restore, flushSubscription), model.SubscriptionOptions{}))
			}
			release()
			tb.flush(t, subscriberID)

			var gotIDs [][]string
			for _, d := range nonFlush(tb.hooks.delivered(subscriberID)) {
				if d.Payload["item_id"].Text == "queued" {
					gotIDs = append(gotIDs, d.SubscriptionIDs)
				}
			}
			assert.Equal(t, tc.wantIDs, gotIDs)
		})
	}
}

func TestDropPlugin(t *testing.T) {
	t.Run("clears the publisher's registry entries", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		require.NoError(t, tb.RegisterAction(publisherID, createItemAction()))

		tb.DropPlugin(publisherID)

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Empty(t, catalog.Groups)
		assert.Empty(t, catalog.Actions)
		require.Len(t, catalog.Events, 1)
		assert.Equal(t, publisher2ID, catalog.Events[0].PublisherID)
		require.ErrorIs(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil), model.ErrEventNotRegistered)
	})

	t.Run("drops subscriptions and pending deliveries", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
		started, release := blockFirst(t, tb, subscriberID)

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
		waitClosed(t, started)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("pending"), "", nil))

		q := subscriberQueue(t, tb, subscriberID)
		tb.DropPlugin(subscriberID)
		release()
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("after"), "", nil))

		waitClosed(t, q.done)
		assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
		assert.False(t, q.enqueue(&queuedDelivery{}), "a retired queue accepts nothing")
		assert.Empty(t, tb.subs.match(&eventEnvelope{PublisherID: publisherID, Name: "item_created"}))
	})

	t.Run("runs while the bus is disabled", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		tb.enabled.Store(false)
		tb.DropPlugin(publisherID)
		tb.enabled.Store(true)

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Len(t, catalog.Events, 1)
	})
}

func TestDeliveryToInactiveSubscriberIsDropped(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	tb.registerFlush(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
	require.NoError(t, tb.SetSubscriptions(otherID, []model.EventSubscription{{ID: "s", Event: publisherID + "/*"}, flushSubscription}, model.SubscriptionOptions{}))
	started, release := blockFirst(t, tb, subscriberID)

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("pending"), "", nil))
	tb.hooks.setInactive(subscriberID, true)
	release()

	tb.flush(t, otherID)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestOnEventErrorDoesNotStopTheQueue(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
	tb.hooks.setOnEvent(func(string, *model.EventDelivery) error { return errors.New("rpc failed") })

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("2"), "", nil))
	waitForDeliveries(t, tb.hooks, subscriberID, 2)
}

func TestDisabledBus(t *testing.T) {
	t.Run("every operation returns ErrEventBusDisabled", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.enabled.Store(false)

		require.ErrorIs(t, tb.RegisterGroup(publisherID, model.EventGroup{Name: "items", Label: "Items"}), model.ErrEventBusDisabled)
		require.ErrorIs(t, tb.RegisterEvent(publisherID, itemEvent("item_created", "")), model.ErrEventBusDisabled)
		require.ErrorIs(t, tb.RegisterAction(publisherID, createItemAction()), model.ErrEventBusDisabled)
		require.ErrorIs(t, tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{}), model.ErrEventBusDisabled)
		require.ErrorIs(t, tb.Emit(publisherID, "item_created", nil, "", nil), model.ErrEventBusDisabled)
		_, err := tb.ExecuteAction(subscriberID, &model.ActionRequest{PluginID: publisherID, Action: "create_item"}, "")
		require.ErrorIs(t, err, model.ErrEventBusDisabled)
		_, err = tb.Catalog()
		require.ErrorIs(t, err, model.ErrEventBusDisabled)

		assert.Empty(t, tb.hooks.actionCalls(publisherID))
	})

	t.Run("queued deliveries are not delivered after the bus turns off", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
		started, release := blockFirst(t, tb, subscriberID)

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
		waitClosed(t, started)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("queued"), "", nil))
		tb.enabled.Store(false)
		release()

		time.Sleep(50 * time.Millisecond)
		assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
	})
}

func TestEmitValidation(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)

	require.ErrorIs(t, tb.Emit(publisherID, "missing", nil, "", nil), model.ErrEventNotRegistered)
	require.ErrorIs(t, tb.Emit(subscriberID, "item_created", nil, "", nil), model.ErrEventNotRegistered, "a plugin can only emit its own events")
	require.ErrorIs(t, tb.Emit(publisherID, "item_created", map[string]model.EventValue{"undeclared": model.EventTextValue("x")}, "", nil), model.ErrEventPayloadInvalid)
	require.ErrorIs(t, tb.Emit(publisherID, "item_created", map[string]model.EventValue{"count": model.EventTextValue("x")}, "", nil), model.ErrEventPayloadInvalid)
	require.NoError(t, tb.Emit(publisherID, "item_created", nil, "", nil))
}

func TestDeliveryWaitsForSubscriberToFinishStarting(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	tb.hooks.setStarting(subscriberID, true)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: publisherID + "/item_created"}}, model.SubscriptionOptions{}))

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("early"), "", nil))
	time.Sleep(3 * startingPollInterval)
	assert.Empty(t, tb.hooks.delivered(subscriberID), "nothing is delivered while OnActivate runs")

	tb.hooks.setStarting(subscriberID, false)
	waitForDeliveries(t, tb.hooks, subscriberID, 1)
	assert.Equal(t, []string{"early"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestDropPluginWhileStartingStopsTheWait(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	tb.hooks.setStarting(subscriberID, true)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: publisherID + "/item_created"}}, model.SubscriptionOptions{}))
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("early"), "", nil))

	q := subscriberQueue(t, tb, subscriberID)
	require.Eventually(t, func() bool { return tb.hooks.startingObserved(subscriberID) > 0 }, 5*time.Second, 5*time.Millisecond,
		"the worker is waiting for OnActivate")
	tb.DropPlugin(subscriberID)
	waitClosed(t, q.done)
	assert.Empty(t, tb.hooks.delivered(subscriberID))
}

func TestBusDisabledWhileSubscriberStartsDropsTheDelivery(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	tb.hooks.setStarting(subscriberID, true)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: publisherID + "/item_created"}}, model.SubscriptionOptions{}))

	// Run the delivery directly so the test can wait for it to finish.
	q := subscriberQueue(t, tb, subscriberID)
	tb.subs.mu.RLock()
	sub := tb.subs.subscribers[subscriberID].byID["s"]
	tb.subs.mu.RUnlock()
	qd := &queuedDelivery{
		delivery: &model.EventDelivery{ID: "early", Event: publisherID + "/item_created", Payload: itemPayload("early")},
		matched:  []*model.EventSubscription{sub},
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		tb.deliver(q, qd)
	}()

	require.Eventually(t, func() bool { return tb.hooks.startingObserved(subscriberID) > 0 }, 5*time.Second, 5*time.Millisecond,
		"the delivery is waiting for OnActivate")
	tb.enabled.Store(false)
	tb.hooks.setStarting(subscriberID, false)

	waitClosed(t, done)
	assert.Empty(t, tb.hooks.delivered(subscriberID))
}

func TestResubscribingDoesNotOverlapDeliveries(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	subs := []model.EventSubscription{{ID: "s", Event: publisherID + "/item_created"}}
	require.NoError(t, tb.SetSubscriptions(subscriberID, subs, model.SubscriptionOptions{}))

	var inFlight, maxInFlight atomic.Int32
	started := make(chan struct{})
	block, release := newRelease(t)
	tb.hooks.setOnEvent(func(id string, d *model.EventDelivery) error {
		n := inFlight.Add(1)
		defer inFlight.Add(-1)
		for {
			m := maxInFlight.Load()
			if n <= m || maxInFlight.CompareAndSwap(m, n) {
				break
			}
		}
		if d.Payload["item_id"].Text == "block" {
			close(started)
			<-block
		}
		return nil
	})

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)

	// Clear and restore the subscriptions twice while the old worker is mid-delivery, so the
	// second queue is closed while it is still waiting.
	for range 2 {
		require.NoError(t, tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{}))
		require.NoError(t, tb.SetSubscriptions(subscriberID, subs, model.SubscriptionOptions{}))
	}
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("after"), "", nil))

	time.Sleep(50 * time.Millisecond)
	assert.Len(t, tb.hooks.delivered(subscriberID), 0, "the new worker waits for the old delivery")
	release()

	waitForDeliveries(t, tb.hooks, subscriberID, 2)
	assert.Equal(t, []string{"block", "after"}, itemIDs(tb.hooks.delivered(subscriberID)))
	assert.EqualValues(t, 1, maxInFlight.Load())
}
