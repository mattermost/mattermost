// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package signalbus

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const (
	publisherID  = "com.example.publisher"
	publisher2ID = "com.example.publisher2"
	subscriberID = "com.example.subscriber"
	otherID      = "com.example.other"
)

// fakeHooks is a HookInvoker where every plugin is active and implements every hook unless told
// otherwise.
type fakeHooks struct {
	mu       sync.Mutex
	inactive map[string]bool
	starting map[string]bool
	// startingSeen counts IsStarting calls that returned true.
	startingSeen  map[string]int
	missingHooks  map[string]map[int]bool
	bots          map[string]string
	botErr        error
	inactiveUsers map[string]bool
	deliveries    map[string][]*model.SignalDelivery
	calls         map[string][]*model.ActionCall

	// onSignal, if set, runs before the delivery is recorded. It may block.
	onSignal     func(pluginID string, d *model.SignalDelivery) error
	onActionCall func(pluginID string, call *model.ActionCall) (*model.ActionResult, error)
	// onBotLookup, if set, runs at the start of BotUserID without the lock held.
	onBotLookup func()
}

func newFakeHooks() *fakeHooks {
	return &fakeHooks{
		inactive:      map[string]bool{},
		starting:      map[string]bool{},
		startingSeen:  map[string]int{},
		missingHooks:  map[string]map[int]bool{},
		bots:          map[string]string{},
		inactiveUsers: map[string]bool{},
		deliveries:    map[string][]*model.SignalDelivery{},
		calls:         map[string][]*model.ActionCall{},
	}
}

func (f *fakeHooks) IsActive(pluginID string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return !f.inactive[pluginID]
}

func (f *fakeHooks) IsStarting(pluginID string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.starting[pluginID] {
		f.startingSeen[pluginID]++
	}
	return f.starting[pluginID]
}

func (f *fakeHooks) startingObserved(pluginID string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.startingSeen[pluginID]
}

func (f *fakeHooks) setStarting(pluginID string, starting bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.starting[pluginID] = starting
}

func (f *fakeHooks) Implements(pluginID string, hookID int) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return !f.inactive[pluginID] && !f.missingHooks[pluginID][hookID]
}

func (f *fakeHooks) OnSignal(pluginID string, d *model.SignalDelivery) error {
	f.mu.Lock()
	onSignal := f.onSignal
	f.mu.Unlock()

	var err error
	if onSignal != nil {
		err = onSignal(pluginID, d)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	f.deliveries[pluginID] = append(f.deliveries[pluginID], d)
	return err
}

func (f *fakeHooks) OnActionCall(pluginID string, call *model.ActionCall) (*model.ActionResult, error) {
	f.mu.Lock()
	f.calls[pluginID] = append(f.calls[pluginID], call)
	onActionCall := f.onActionCall
	f.mu.Unlock()

	if onActionCall != nil {
		return onActionCall(pluginID, call)
	}
	return &model.ActionResult{}, nil
}

func (f *fakeHooks) BotUserID(pluginID string) (string, error) {
	if f.onBotLookup != nil {
		f.onBotLookup()
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.bots[pluginID], f.botErr
}

func (f *fakeHooks) UserIsActive(userID string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return !f.inactiveUsers[userID]
}

func (f *fakeHooks) setInactive(pluginID string, inactive bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.inactive[pluginID] = inactive
}

func (f *fakeHooks) setMissingHook(pluginID string, hookID int) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.missingHooks[pluginID] == nil {
		f.missingHooks[pluginID] = map[int]bool{}
	}
	f.missingHooks[pluginID][hookID] = true
}

func (f *fakeHooks) setOnSignal(fn func(pluginID string, d *model.SignalDelivery) error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.onSignal = fn
}

func (f *fakeHooks) delivered(pluginID string) []*model.SignalDelivery {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]*model.SignalDelivery(nil), f.deliveries[pluginID]...)
}

func (f *fakeHooks) actionCalls(pluginID string) []*model.ActionCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]*model.ActionCall(nil), f.calls[pluginID]...)
}

type testBus struct {
	*Bus
	hooks   *fakeHooks
	enabled *atomic.Bool
}

func newTestBus(t *testing.T, queueSize int) *testBus {
	t.Helper()
	hooks := newFakeHooks()
	enabled := &atomic.Bool{}
	enabled.Store(true)
	b, err := New(Options{
		Hooks:     hooks,
		Logger:    mlog.CreateConsoleTestLogger(t),
		Enabled:   enabled.Load,
		QueueSize: queueSize,
	})
	require.NoError(t, err)
	t.Cleanup(b.Close)
	return &testBus{Bus: b, hooks: hooks, enabled: enabled}
}

// registerItemSignals registers the items group with item_created and item_deleted for
// publisherID, an ungrouped publisherID/other, and publisher2ID/item_created.
func (tb *testBus) registerItemSignals(t *testing.T) {
	t.Helper()
	require.NoError(t, tb.RegisterGroup(publisherID, model.SignalGroup{Name: "items", Label: "Items"}))
	for _, name := range []string{"item_created", "item_deleted"} {
		require.NoError(t, tb.RegisterSignal(publisherID, itemSignal(name, "items")))
	}
	require.NoError(t, tb.RegisterSignal(publisherID, itemSignal("other", "")))
	require.NoError(t, tb.RegisterSignal(publisher2ID, itemSignal("item_created", "")))
}

func itemSignal(name, group string) model.SignalDescriptor {
	return model.SignalDescriptor{
		Name:    name,
		Group:   group,
		Label:   name,
		Version: 1,
		Fields: []model.SignalField{
			{Key: "item_id"},
			{Key: "count", Type: model.SignalTypeInt},
			{Key: "urgent", Type: model.SignalTypeBool},
		},
	}
}

func itemPayload(itemID string) map[string]model.SignalValue {
	return map[string]model.SignalValue{"item_id": model.SignalTextValue(itemID)}
}

// waitForDeliveries waits until pluginID has received n deliveries.
func waitForDeliveries(t *testing.T, hooks *fakeHooks, pluginID string, n int) []*model.SignalDelivery {
	t.Helper()
	require.Eventually(t, func() bool {
		return len(hooks.delivered(pluginID)) >= n
	}, 5*time.Second, 5*time.Millisecond)
	return hooks.delivered(pluginID)
}

// flush waits until every delivery queued so far for pluginID has been handled, by emitting a
// marker signal the plugin is subscribed to through flushSubscription.
func (tb *testBus) flush(t *testing.T, pluginID string) {
	t.Helper()
	marker := model.NewId()
	require.NoError(t, tb.Emit(flushPublisherID, "flush", itemPayload(marker), "", nil))
	require.Eventually(t, func() bool {
		for _, d := range tb.hooks.delivered(pluginID) {
			if d.PublisherID == flushPublisherID && d.Payload["item_id"].Text == marker {
				return true
			}
		}
		return false
	}, 5*time.Second, 5*time.Millisecond)
}

const flushPublisherID = "com.example.flush"

func (tb *testBus) registerFlush(t *testing.T) {
	t.Helper()
	require.NoError(t, tb.RegisterSignal(flushPublisherID, itemSignal("flush", "")))
}

var flushSubscription = model.SignalSubscription{ID: "flush", Signal: flushPublisherID + "/flush"}

// nonFlush filters out flush markers.
func nonFlush(deliveries []*model.SignalDelivery) []*model.SignalDelivery {
	var out []*model.SignalDelivery
	for _, d := range deliveries {
		if d.PublisherID != flushPublisherID {
			out = append(out, d)
		}
	}
	return out
}

var _ HookInvoker = (*fakeHooks)(nil)
