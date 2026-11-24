// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"errors"
	"strconv"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// blockFirst makes pluginID's delivery of item "block" wait until release is closed. started is
// closed once that delivery is in progress, so the worker holds no queued entry.
func blockFirst(tb *testBus, pluginID string) (started, release chan struct{}) {
	started = make(chan struct{})
	release = make(chan struct{})
	tb.hooks.setOnSignal(func(id string, d *model.SignalDelivery) error {
		if id == pluginID && d.Payload["item_id"].Text == "block" {
			close(started)
			<-release
		}
		return nil
	})
	return started, release
}

func waitClosed(t *testing.T, ch chan struct{}) {
	t.Helper()
	select {
	case <-ch:
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out")
	}
}

func itemIDs(deliveries []*model.SignalDelivery) []string {
	ids := []string{}
	for _, d := range nonFlush(deliveries) {
		ids = append(ids, d.Payload["item_id"].Text)
	}
	return ids
}

func TestQueueDeliversInOrder(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))

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
	tb.registerItemSignals(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
	started, release := blockFirst(tb, subscriberID)

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)
	for _, id := range []string{"queued1", "queued2", "dropped"} {
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload(id), "", nil), "emit never fails because a queue is full")
	}
	close(release)

	waitForDeliveries(t, tb.hooks, subscriberID, 3)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, []string{"block", "queued1", "queued2"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestSlowSubscriberDoesNotBlockEmitOrOthers(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	for _, id := range []string{subscriberID, otherID} {
		require.NoError(t, tb.SetSubscriptions(id, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
	}
	started, release := blockFirst(tb, subscriberID)
	defer close(release)

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
		replace []model.SignalSubscription
		wantIDs [][]string
	}{
		{
			name:    "removed subscription drops the delivery",
			replace: []model.SignalSubscription{{ID: "b", Signal: publisherID + "/other"}},
			wantIDs: nil,
		},
		{
			name:    "changed subscription under the same ID drops the delivery",
			replace: []model.SignalSubscription{{ID: "a", Signal: "*", Filters: map[string]model.SignalValue{"item_id": model.SignalTextValue("queued")}}},
			wantIDs: nil,
		},
		{
			name:    "identical set keeps the delivery",
			replace: []model.SignalSubscription{{ID: "a", Signal: "*"}, {ID: "b", Signal: publisherID + "/items/*"}},
			wantIDs: [][]string{{"a", "b"}},
		},
		{
			name:    "partially removed set keeps the remaining IDs",
			replace: []model.SignalSubscription{{ID: "b", Signal: publisherID + "/items/*"}},
			wantIDs: [][]string{{"b"}},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerItemSignals(t)
			tb.registerFlush(t)
			require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{
				{ID: "a", Signal: "*"},
				{ID: "b", Signal: publisherID + "/items/*"},
				flushSubscription,
			}, model.SubscriptionOptions{}))
			started, release := blockFirst(tb, subscriberID)

			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
			waitClosed(t, started)
			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("queued"), "", nil))

			require.NoError(t, tb.SetSubscriptions(subscriberID, append(tc.replace, flushSubscription), model.SubscriptionOptions{}))
			close(release)
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
		tb.registerItemSignals(t)
		require.NoError(t, tb.RegisterAction(publisherID, createItemAction()))

		tb.DropPlugin(publisherID)

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Empty(t, catalog.Groups)
		assert.Empty(t, catalog.Actions)
		require.Len(t, catalog.Signals, 1)
		assert.Equal(t, publisher2ID, catalog.Signals[0].PublisherID)
		require.ErrorIs(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil), model.ErrSignalNotRegistered)
	})

	t.Run("drops subscriptions and pending deliveries", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemSignals(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
		started, release := blockFirst(tb, subscriberID)

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
		waitClosed(t, started)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("pending"), "", nil))

		tb.DropPlugin(subscriberID)
		close(release)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("after"), "", nil))

		time.Sleep(50 * time.Millisecond)
		assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
		assert.Empty(t, tb.subs.match(&signalEnvelope{PublisherID: publisherID, Name: "item_created"}))
	})

	t.Run("runs while the bus is disabled", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemSignals(t)
		tb.enabled.Store(false)
		tb.DropPlugin(publisherID)
		tb.enabled.Store(true)

		catalog, err := tb.Catalog()
		require.NoError(t, err)
		assert.Len(t, catalog.Signals, 1)
	})
}

func TestDeliveryToInactiveSubscriberIsDropped(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	tb.registerFlush(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
	require.NoError(t, tb.SetSubscriptions(otherID, []model.SignalSubscription{{ID: "s", Signal: publisherID + "/*"}, flushSubscription}, model.SubscriptionOptions{}))
	started, release := blockFirst(tb, subscriberID)

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("pending"), "", nil))
	tb.hooks.setInactive(subscriberID, true)
	close(release)

	tb.flush(t, otherID)
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestOnSignalErrorDoesNotStopTheQueue(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
	tb.hooks.setOnSignal(func(string, *model.SignalDelivery) error { return errors.New("rpc failed") })

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("2"), "", nil))
	waitForDeliveries(t, tb.hooks, subscriberID, 2)
}

func TestDisabledBus(t *testing.T) {
	t.Run("every operation returns ErrSignalBusDisabled", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.enabled.Store(false)

		require.ErrorIs(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Items"}), model.ErrSignalBusDisabled)
		require.ErrorIs(t, tb.RegisterSignal(publisherID, itemSignal("item_created", "")), model.ErrSignalBusDisabled)
		require.ErrorIs(t, tb.RegisterAction(publisherID, createItemAction()), model.ErrSignalBusDisabled)
		require.ErrorIs(t, tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{}), model.ErrSignalBusDisabled)
		require.ErrorIs(t, tb.Emit(publisherID, "item_created", nil, "", nil), model.ErrSignalBusDisabled)
		_, err := tb.ExecuteAction(subscriberID, &model.ActionRequest{PluginID: publisherID, Action: "create_item"}, "")
		require.ErrorIs(t, err, model.ErrSignalBusDisabled)
		_, err = tb.Catalog()
		require.ErrorIs(t, err, model.ErrSignalBusDisabled)

		assert.Empty(t, tb.hooks.actionCalls(publisherID))
	})

	t.Run("queued deliveries are not delivered after the bus turns off", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemSignals(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: "*"}}, model.SubscriptionOptions{}))
		started, release := blockFirst(tb, subscriberID)

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
		waitClosed(t, started)
		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("queued"), "", nil))
		tb.enabled.Store(false)
		close(release)

		time.Sleep(50 * time.Millisecond)
		assert.Equal(t, []string{"block"}, itemIDs(tb.hooks.delivered(subscriberID)))
	})
}

func TestEmitValidation(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)

	require.ErrorIs(t, tb.Emit(publisherID, "missing", nil, "", nil), model.ErrSignalNotRegistered)
	require.ErrorIs(t, tb.Emit(subscriberID, "item_created", nil, "", nil), model.ErrSignalNotRegistered, "a plugin can only emit its own signals")
	require.ErrorIs(t, tb.Emit(publisherID, "item_created", map[string]model.SignalValue{"undeclared": model.SignalTextValue("x")}, "", nil), model.ErrSignalPayloadInvalid)
	require.ErrorIs(t, tb.Emit(publisherID, "item_created", map[string]model.SignalValue{"count": model.SignalTextValue("x")}, "", nil), model.ErrSignalPayloadInvalid)
	require.NoError(t, tb.Emit(publisherID, "item_created", nil, "", nil))
}

func TestDeliveryWaitsForSubscriberToFinishStarting(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	tb.hooks.setStarting(subscriberID, true)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: publisherID + "/item_created"}}, model.SubscriptionOptions{}))

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("early"), "", nil))
	time.Sleep(3 * startingPollInterval)
	assert.Empty(t, tb.hooks.delivered(subscriberID), "nothing is delivered while OnActivate runs")

	tb.hooks.setStarting(subscriberID, false)
	waitForDeliveries(t, tb.hooks, subscriberID, 1)
	assert.Equal(t, []string{"early"}, itemIDs(tb.hooks.delivered(subscriberID)))
}

func TestDropPluginWhileStartingStopsTheWait(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	tb.hooks.setStarting(subscriberID, true)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.SignalSubscription{{ID: "s", Signal: publisherID + "/item_created"}}, model.SubscriptionOptions{}))
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("early"), "", nil))

	tb.subs.mu.RLock()
	q := tb.subs.subscribers[subscriberID].queue
	tb.subs.mu.RUnlock()
	tb.DropPlugin(subscriberID)
	waitClosed(t, q.done)
	assert.Empty(t, tb.hooks.delivered(subscriberID))
}

func TestResubscribingDoesNotOverlapDeliveries(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemSignals(t)
	subs := []model.SignalSubscription{{ID: "s", Signal: publisherID + "/item_created"}}
	require.NoError(t, tb.SetSubscriptions(subscriberID, subs, model.SubscriptionOptions{}))

	var inFlight, maxInFlight atomic.Int32
	started := make(chan struct{})
	release := make(chan struct{})
	tb.hooks.setOnSignal(func(id string, d *model.SignalDelivery) error {
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
			<-release
		}
		return nil
	})

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("block"), "", nil))
	waitClosed(t, started)

	// Clear and restore the subscriptions while the old worker is mid-delivery.
	require.NoError(t, tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{}))
	require.NoError(t, tb.SetSubscriptions(subscriberID, subs, model.SubscriptionOptions{}))
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("after"), "", nil))

	time.Sleep(50 * time.Millisecond)
	assert.Len(t, tb.hooks.delivered(subscriberID), 0, "the new worker waits for the old delivery")
	close(release)

	waitForDeliveries(t, tb.hooks, subscriberID, 2)
	assert.Equal(t, []string{"block", "after"}, itemIDs(tb.hooks.delivered(subscriberID)))
	assert.EqualValues(t, 1, maxInFlight.Load())
}
