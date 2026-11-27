// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package eventbus

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// emitAll emits every event registerItemEvents registers, once each.
func emitAll(t *testing.T, tb *testBus) {
	t.Helper()
	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
	require.NoError(t, tb.Emit(publisherID, "item_deleted", itemPayload("2"), "", nil))
	require.NoError(t, tb.Emit(publisherID, "other", itemPayload("3"), "", nil))
	require.NoError(t, tb.Emit(publisher2ID, "item_created", itemPayload("4"), "", nil))
}

func receivedEvents(deliveries []*model.EventDelivery) []string {
	events := []string{}
	for _, d := range nonFlush(deliveries) {
		events = append(events, d.Event)
	}
	return events
}

func TestSubscriptionPatterns(t *testing.T) {
	tests := []struct {
		pattern string
		want    []string
	}{
		{pattern: publisherID + "/item_created", want: []string{publisherID + "/item_created"}},
		{pattern: publisherID + "/items/*", want: []string{publisherID + "/item_created", publisherID + "/item_deleted"}},
		{pattern: publisherID + "/*", want: []string{publisherID + "/item_created", publisherID + "/item_deleted", publisherID + "/other"}},
		{pattern: "*", want: []string{publisherID + "/item_created", publisherID + "/item_deleted", publisherID + "/other", publisher2ID + "/item_created"}},
		{pattern: publisherID + "/missing", want: []string{}},
		{pattern: publisherID + "/missing/*", want: []string{}},
		{pattern: otherID + "/*", want: []string{}},
	}
	for _, tc := range tests {
		t.Run(tc.pattern, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerItemEvents(t)
			tb.registerFlush(t)
			require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
				{ID: "sub", Event: tc.pattern},
				flushSubscription,
			}, model.SubscriptionOptions{}))

			emitAll(t, tb)
			tb.flush(t, subscriberID)

			assert.Equal(t, tc.want, receivedEvents(tb.hooks.delivered(subscriberID)))
		})
	}
}

func TestSubscriptionVisibility(t *testing.T) {
	for _, pattern := range []string{publisherID + "/secret", publisherID + "/*", "*"} {
		t.Run(pattern, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerFlush(t)
			secret := itemEvent("secret", "")
			secret.Visibility = model.EventVisibilityAllowlist
			secret.AllowedSubscribers = []string{subscriberID}
			require.NoError(t, tb.RegisterEvent(publisherID, secret))

			subs := []model.EventSubscription{{ID: "sub", Event: pattern}, flushSubscription}
			require.NoError(t, tb.SetSubscriptions(subscriberID, subs, model.SubscriptionOptions{}))
			require.NoError(t, tb.SetSubscriptions(otherID, subs, model.SubscriptionOptions{}))

			require.NoError(t, tb.Emit(publisherID, "secret", itemPayload("1"), "", nil))
			tb.flush(t, subscriberID)
			tb.flush(t, otherID)

			assert.Equal(t, []string{publisherID + "/secret"}, receivedEvents(tb.hooks.delivered(subscriberID)))
			assert.Empty(t, receivedEvents(tb.hooks.delivered(otherID)))
		})
	}
}

func TestSubscriptionIncludeOwn(t *testing.T) {
	for _, pattern := range []string{publisherID + "/item_created", publisherID + "/items/*", publisherID + "/*", "*"} {
		t.Run(pattern, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerItemEvents(t)
			tb.registerFlush(t)

			require.NoError(t, tb.SetSubscriptions(publisherID, []model.EventSubscription{
				{ID: "sub", Event: pattern},
				flushSubscription,
			}, model.SubscriptionOptions{}))
			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
			tb.flush(t, publisherID)
			assert.Empty(t, receivedEvents(tb.hooks.delivered(publisherID)), "own events are excluded by default")

			require.NoError(t, tb.SetSubscriptions(publisherID, []model.EventSubscription{
				{ID: "sub", Event: pattern, IncludeOwn: true},
				flushSubscription,
			}, model.SubscriptionOptions{}))
			require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("2"), "", nil))
			tb.flush(t, publisherID)
			assert.Equal(t, []string{publisherID + "/item_created"}, receivedEvents(tb.hooks.delivered(publisherID)))
		})
	}
}

func TestSubscriptionFilters(t *testing.T) {
	payload := map[string]model.EventValue{
		"item_id": model.EventTextValue("i1"),
		"count":   model.EventIntValue(3),
		"urgent":  model.EventBoolValue(false),
	}
	tests := []struct {
		name    string
		event   string
		filters map[string]model.EventValue
		want    bool
	}{
		{name: "text equal", event: publisherID + "/item_created", filters: map[string]model.EventValue{"item_id": model.EventTextValue("i1")}, want: true},
		{name: "text differs", event: publisherID + "/item_created", filters: map[string]model.EventValue{"item_id": model.EventTextValue("i2")}, want: false},
		{name: "false bool equal", event: publisherID + "/item_created", filters: map[string]model.EventValue{"urgent": model.EventBoolValue(false)}, want: true},
		{name: "AND of all filters", event: publisherID + "/item_created", filters: map[string]model.EventValue{"item_id": model.EventTextValue("i1"), "count": model.EventIntValue(3)}, want: true},
		{name: "AND with one mismatch", event: publisherID + "/item_created", filters: map[string]model.EventValue{"item_id": model.EventTextValue("i1"), "count": model.EventIntValue(4)}, want: false},
		{name: "type mismatch on a pattern", event: publisherID + "/*", filters: map[string]model.EventValue{"count": model.EventTextValue("3")}, want: false},
		{name: "missing field on a pattern", event: publisherID + "/*", filters: map[string]model.EventValue{"absent": model.EventTextValue("x")}, want: false},
		{name: "matching field on a pattern", event: "*", filters: map[string]model.EventValue{"count": model.EventIntValue(3)}, want: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			tb := newTestBus(t, 0)
			tb.registerItemEvents(t)
			tb.registerFlush(t)
			require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
				{ID: "sub", Event: tc.event, Filters: tc.filters},
				flushSubscription,
			}, model.SubscriptionOptions{}))

			require.NoError(t, tb.Emit(publisherID, "item_created", payload, "", nil))
			tb.flush(t, subscriberID)

			if tc.want {
				assert.Len(t, nonFlush(tb.hooks.delivered(subscriberID)), 1)
			} else {
				assert.Empty(t, nonFlush(tb.hooks.delivered(subscriberID)))
			}
		})
	}

	t.Run("a missing payload field never matches", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		tb.registerFlush(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
			{ID: "sub", Event: publisherID + "/item_created", Filters: map[string]model.EventValue{"urgent": model.EventBoolValue(false)}},
			flushSubscription,
		}, model.SubscriptionOptions{}))

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("i1"), "", nil))
		tb.flush(t, subscriberID)
		assert.Empty(t, nonFlush(tb.hooks.delivered(subscriberID)), "a false filter doesn't match an omitted field")
	})
}

func TestSubscriptionOverlapIsDeliveredOnce(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)
	tb.registerFlush(t)
	require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
		{ID: "c-all", Event: "*"},
		{ID: "a-exact", Event: publisherID + "/item_created"},
		{ID: "b-group", Event: publisherID + "/items/*"},
		{ID: "d-filtered-out", Event: publisherID + "/*", Filters: map[string]model.EventValue{"item_id": model.EventTextValue("nope")}},
		flushSubscription,
	}, model.SubscriptionOptions{}))

	require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
	tb.flush(t, subscriberID)

	deliveries := nonFlush(tb.hooks.delivered(subscriberID))
	require.Len(t, deliveries, 1)
	assert.Equal(t, []string{"a-exact", "b-group", "c-all"}, deliveries[0].SubscriptionIDs)
}

func TestEmitDeliversToEverySubscriberOnce(t *testing.T) {
	tb := newTestBus(t, 0)
	tb.registerItemEvents(t)

	for _, id := range []string{subscriberID, otherID} {
		require.NoError(t, tb.SetSubscriptions(id, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
	}

	cause := model.EventCause("opaque-cause")
	require.NoError(t, tb.Emit(publisherID, "item_created", map[string]model.EventValue{
		"item_id": {Text: "i1"},
		"count":   model.EventIntValue(2),
	}, cause, &model.EmitOptions{OriginUserID: "user1"}))

	sub := waitForDeliveries(t, tb.hooks, subscriberID, 1)
	other := waitForDeliveries(t, tb.hooks, otherID, 1)
	require.Len(t, sub, 1)
	require.Len(t, other, 1)

	d := sub[0]
	assert.NotEmpty(t, d.EnvelopeID)
	assert.Equal(t, d.EnvelopeID+":"+subscriberID, d.ID)
	assert.Equal(t, d.EnvelopeID+":"+otherID, other[0].ID)
	assert.Equal(t, d.EnvelopeID, other[0].EnvelopeID)
	assert.Equal(t, publisherID+"/item_created", d.Event)
	assert.Equal(t, publisherID, d.PublisherID)
	assert.Equal(t, 1, d.Version)
	assert.Equal(t, map[string]model.EventValue{
		"item_id": model.EventTextValue("i1"),
		"count":   model.EventIntValue(2),
	}, d.Payload, "the payload is normalized")
	assert.Equal(t, []string{"s"}, d.SubscriptionIDs)
	assert.NotEmpty(t, d.TraceID)
	assert.Equal(t, 0, d.Hop)
	assert.Equal(t, "user1", d.OriginUserID)
	assert.Equal(t, cause, d.Cause)
	assert.Positive(t, d.EmittedAt)
}

func TestSetSubscriptionsValidation(t *testing.T) {
	t.Run("requires OnEvent", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.hooks.setMissingHook(subscriberID, plugin.OnEventID)
		err := tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrSubscriberHookMissing)
	})

	t.Run("rejects an invalid set", func(t *testing.T) {
		tb := newTestBus(t, 0)
		err := tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "bad"}}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrEventSubscriptionInvalid)
		err = tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{Workers: -1})
		require.ErrorIs(t, err, model.ErrEventSubscriptionInvalid)
	})

	t.Run("filters on a registered event must use declared fields and types", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)

		err := tb.SetSubscriptions(subscriberID, []model.EventSubscription{
			{ID: "s", Event: publisherID + "/item_created", Filters: map[string]model.EventValue{"absent": model.EventTextValue("x")}},
		}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrEventSubscriptionInvalid)
		require.ErrorContains(t, err, "undeclared field")

		err = tb.SetSubscriptions(subscriberID, []model.EventSubscription{
			{ID: "s", Event: publisherID + "/item_created", Filters: map[string]model.EventValue{"count": model.EventTextValue("3")}},
		}, model.SubscriptionOptions{})
		require.ErrorIs(t, err, model.ErrEventSubscriptionInvalid)
	})

	t.Run("filters on an unknown event are accepted", func(t *testing.T) {
		tb := newTestBus(t, 0)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{
			{ID: "s", Event: publisherID + "/not_yet_registered", Filters: map[string]model.EventValue{"anything": model.EventTextValue("x")}},
		}, model.SubscriptionOptions{}))
	})

	t.Run("a failed set keeps the previous one", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
		require.Error(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "bad"}}, model.SubscriptionOptions{}))

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
		waitForDeliveries(t, tb.hooks, subscriberID, 1)
	})

	t.Run("an empty set unsubscribes", func(t *testing.T) {
		tb := newTestBus(t, 0)
		tb.registerItemEvents(t)
		require.NoError(t, tb.SetSubscriptions(subscriberID, []model.EventSubscription{{ID: "s", Event: "*"}}, model.SubscriptionOptions{}))
		require.NoError(t, tb.SetSubscriptions(subscriberID, nil, model.SubscriptionOptions{}))

		require.NoError(t, tb.Emit(publisherID, "item_created", itemPayload("1"), "", nil))
		assert.Empty(t, tb.subs.match(&eventEnvelope{PublisherID: publisherID, Name: "item_created"}))
	})
}
