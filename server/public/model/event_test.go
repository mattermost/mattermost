// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventBusError(t *testing.T) {
	wrapped := ErrEventNotRegistered.Wrapf("pub/%s", "missing")
	assert.Equal(t, "event is not registered: pub/missing", wrapped.Error())
	assert.ErrorIs(t, wrapped, ErrEventNotRegistered)
	assert.ErrorIs(t, fmt.Errorf("outer: %w", wrapped), ErrEventNotRegistered)
	assert.NotErrorIs(t, wrapped, ErrActionNotFound)
	assert.NotErrorIs(t, errors.New(ErrEventNotRegistered.Message), ErrEventNotRegistered)
	assert.Equal(t, "event is not registered", ErrEventNotRegistered.Message, "Wrapf does not modify the sentinel")
}

func TestEventGroupIsValid(t *testing.T) {
	require.NoError(t, (&EventGroup{Name: "items", Label: "Items"}).IsValid())
	require.ErrorIs(t, (&EventGroup{Name: "Items", Label: "Items"}).IsValid(), ErrEventDescriptorInvalid)
	require.ErrorIs(t, (&EventGroup{Name: "items", Label: " "}).IsValid(), ErrEventDescriptorInvalid)
}

func validEventDescriptor() EventDescriptor {
	return EventDescriptor{
		Name:    "item_created",
		Label:   "Item created",
		Version: 1,
		Fields:  []EventField{{Key: "item_id"}},
	}
}

func TestEventDescriptorValidate(t *testing.T) {
	t.Run("defaults visibility to any", func(t *testing.T) {
		d := validEventDescriptor()
		require.NoError(t, d.Validate())
		assert.Equal(t, EventVisibilityAny, d.Visibility)
		assert.Equal(t, EventTypeText, d.Fields[0].Type)
	})

	tests := []struct {
		name    string
		modify  func(d *EventDescriptor)
		wantErr string
	}{
		{name: "invalid name", modify: func(d *EventDescriptor) { d.Name = "item-created" }, wantErr: "event name"},
		{name: "invalid group", modify: func(d *EventDescriptor) { d.Group = "Items" }, wantErr: "invalid group"},
		{name: "missing label", modify: func(d *EventDescriptor) { d.Label = "" }, wantErr: "requires a label"},
		{name: "version zero", modify: func(d *EventDescriptor) { d.Version = 0 }, wantErr: "version"},
		{name: "unknown visibility", modify: func(d *EventDescriptor) { d.Visibility = "private" }, wantErr: "unknown visibility"},
		{name: "invalid allowed subscriber", modify: func(d *EventDescriptor) { d.AllowedSubscribers = []string{"a/b"} }, wantErr: "invalid subscriber"},
		{name: "invalid field", modify: func(d *EventDescriptor) { d.Fields = []EventField{{Key: "summary"}} }, wantErr: "summary"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			d := validEventDescriptor()
			tc.modify(&d)
			err := d.Validate()
			require.ErrorIs(t, err, ErrEventDescriptorInvalid)
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}

func TestEventDescriptorIsVisibleTo(t *testing.T) {
	public := EventDescriptor{Visibility: EventVisibilityAny}
	assert.True(t, public.IsVisibleTo("someone"))

	allowlist := EventDescriptor{Visibility: EventVisibilityAllowlist, AllowedSubscribers: []string{"allowed"}}
	assert.True(t, allowlist.IsVisibleTo("allowed"))
	assert.False(t, allowlist.IsVisibleTo("someone"))

	assert.Equal(t, "pub/item_created", (&EventDescriptor{PublisherID: "pub", Name: "item_created"}).FullName())
}

func validActionDescriptor() ActionDescriptor {
	return ActionDescriptor{
		Type:    "create_item",
		Label:   "Create item",
		Fields:  []EventField{{Key: "title"}},
		Results: []EventField{{Key: "item_id"}},
	}
}

func TestActionDescriptorValidate(t *testing.T) {
	d := validActionDescriptor()
	require.NoError(t, d.Validate())
	assert.Equal(t, EventTypeText, d.Results[0].Type)

	tests := []struct {
		name    string
		modify  func(d *ActionDescriptor)
		wantErr string
	}{
		{name: "invalid type", modify: func(d *ActionDescriptor) { d.Type = "Create" }, wantErr: "action type"},
		{name: "invalid group", modify: func(d *ActionDescriptor) { d.Group = "a b" }, wantErr: "invalid group"},
		{name: "missing label", modify: func(d *ActionDescriptor) { d.Label = "" }, wantErr: "requires a label"},
		{name: "negative timeout", modify: func(d *ActionDescriptor) { d.TimeoutSeconds = -1 }, wantErr: "timeout"},
		{name: "invalid emits", modify: func(d *ActionDescriptor) { d.Emits = []string{""} }, wantErr: "emits"},
		{name: "invalid allowed caller", modify: func(d *ActionDescriptor) { d.AllowedCallers = []string{"no spaces"} }, wantErr: "invalid caller"},
		{name: "duplicate field", modify: func(d *ActionDescriptor) { d.Fields = []EventField{{Key: "a"}, {Key: "a"}} }, wantErr: "fields"},
		{name: "unknown result type", modify: func(d *ActionDescriptor) { d.Results = []EventField{{Key: "a", Type: "date"}} }, wantErr: "results"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			d := validActionDescriptor()
			tc.modify(&d)
			err := d.Validate()
			require.ErrorIs(t, err, ErrEventDescriptorInvalid)
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}

func TestActionDescriptorIsCallerAllowed(t *testing.T) {
	assert.True(t, (&ActionDescriptor{}).IsCallerAllowed("anyone"))
	restricted := &ActionDescriptor{AllowedCallers: []string{"weave"}}
	assert.True(t, restricted.IsCallerAllowed("weave"))
	assert.False(t, restricted.IsCallerAllowed("other"))
}

func TestParseEventPattern(t *testing.T) {
	tests := []struct {
		pattern string
		want    EventPattern
		wantErr bool
	}{
		{pattern: "*", want: EventPattern{Kind: EventPatternAll}},
		{pattern: "com.example.pub/*", want: EventPattern{Kind: EventPatternPublisher, Publisher: "com.example.pub"}},
		{pattern: "com.example.pub/items/*", want: EventPattern{Kind: EventPatternGroup, Publisher: "com.example.pub", Group: "items"}},
		{pattern: "com.example.pub/item_created", want: EventPattern{Kind: EventPatternExact, Publisher: "com.example.pub", Name: "item_created"}},
		{pattern: "", wantErr: true},
		{pattern: "item_created", wantErr: true},
		{pattern: "*/item_created", wantErr: true},
		{pattern: "com.example.pub/", wantErr: true},
		{pattern: "com.example.pub/Item", wantErr: true},
		{pattern: "com.example.pub/items/item_created", wantErr: true},
		{pattern: "com.example.pub/*/*", wantErr: true},
		{pattern: "com.example.pub/items/*/x", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.pattern, func(t *testing.T) {
			got, err := ParseEventPattern(tc.pattern)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestValidateEventSubscriptions(t *testing.T) {
	require.NoError(t, ValidateEventSubscriptions(nil))
	require.NoError(t, ValidateEventSubscriptions([]EventSubscription{
		{ID: "a", Event: "pub/item_created", Filters: map[string]EventValue{"item_id": EventTextValue("i1")}},
		{ID: "b", Event: "*"},
	}))

	tests := []struct {
		name    string
		subs    []EventSubscription
		wantErr string
	}{
		{name: "missing ID", subs: []EventSubscription{{Event: "*"}}, wantErr: "requires an ID"},
		{name: "duplicate ID", subs: []EventSubscription{{ID: "a", Event: "*"}, {ID: "a", Event: "pub/*"}}, wantErr: "used twice"},
		{name: "invalid pattern", subs: []EventSubscription{{ID: "a", Event: "pub"}}, wantErr: "event pattern"},
		{name: "invalid filter key", subs: []EventSubscription{{ID: "a", Event: "*", Filters: map[string]EventValue{"Bad": EventTextValue("x")}}}, wantErr: "invalid key"},
		{name: "textarea filter", subs: []EventSubscription{{ID: "a", Event: "*", Filters: map[string]EventValue{"k": EventTextareaValue("x")}}}, wantErr: "textarea"},
		{name: "unknown filter type", subs: []EventSubscription{{ID: "a", Event: "*", Filters: map[string]EventValue{"k": {Type: "date"}}}}, wantErr: "filter"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateEventSubscriptions(tc.subs)
			require.ErrorIs(t, err, ErrEventSubscriptionInvalid)
			require.ErrorContains(t, err, tc.wantErr)
		})
	}

	t.Run("at most 256 subscriptions", func(t *testing.T) {
		subs := make([]EventSubscription, MaxEventSubscriptions+1)
		for i := range subs {
			subs[i] = EventSubscription{ID: fmt.Sprintf("s%d", i), Event: "*"}
		}
		require.NoError(t, ValidateEventSubscriptions(subs[:MaxEventSubscriptions]))
		err := ValidateEventSubscriptions(subs)
		require.ErrorIs(t, err, ErrEventSubscriptionInvalid)
		require.ErrorContains(t, err, "at most 256")
	})
}

func TestEventSubscriptionEqual(t *testing.T) {
	base := EventSubscription{ID: "a", Event: "pub/x", Filters: map[string]EventValue{"k": EventIntValue(1)}}

	same := base
	same.Filters = map[string]EventValue{"k": EventIntValue(1)}
	assert.True(t, base.Equal(&same))

	for name, other := range map[string]EventSubscription{
		"id":          {ID: "b", Event: "pub/x", Filters: base.Filters},
		"event":       {ID: "a", Event: "pub/y", Filters: base.Filters},
		"include own": {ID: "a", Event: "pub/x", Filters: base.Filters, IncludeOwn: true},
		"filter":      {ID: "a", Event: "pub/x", Filters: map[string]EventValue{"k": EventIntValue(2)}},
		"filter key":  {ID: "a", Event: "pub/x", Filters: map[string]EventValue{"j": EventIntValue(1)}},
		"no filters":  {ID: "a", Event: "pub/x"},
	} {
		t.Run(name, func(t *testing.T) {
			assert.False(t, base.Equal(&other))
		})
	}
}
