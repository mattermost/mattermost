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

func TestSignalBusError(t *testing.T) {
	wrapped := ErrSignalNotRegistered.Wrapf("pub/%s", "missing")
	assert.Equal(t, "signal is not registered: pub/missing", wrapped.Error())
	assert.ErrorIs(t, wrapped, ErrSignalNotRegistered)
	assert.ErrorIs(t, fmt.Errorf("outer: %w", wrapped), ErrSignalNotRegistered)
	assert.NotErrorIs(t, wrapped, ErrActionNotFound)
	assert.NotErrorIs(t, errors.New(ErrSignalNotRegistered.Message), ErrSignalNotRegistered)
	assert.Equal(t, "signal is not registered", ErrSignalNotRegistered.Message, "Wrapf does not modify the sentinel")
}

func TestSignalGroupIsValid(t *testing.T) {
	require.NoError(t, (&SignalGroup{Name: "items", Label: "Items"}).IsValid())
	require.ErrorIs(t, (&SignalGroup{Name: "Items", Label: "Items"}).IsValid(), ErrSignalDescriptorInvalid)
	require.ErrorIs(t, (&SignalGroup{Name: "items", Label: " "}).IsValid(), ErrSignalDescriptorInvalid)
}

func validSignalDescriptor() SignalDescriptor {
	return SignalDescriptor{
		Name:    "item_created",
		Label:   "Item created",
		Version: 1,
		Fields:  []SignalField{{Key: "item_id"}},
	}
}

func TestSignalDescriptorValidate(t *testing.T) {
	t.Run("defaults visibility to any", func(t *testing.T) {
		d := validSignalDescriptor()
		require.NoError(t, d.Validate())
		assert.Equal(t, SignalVisibilityAny, d.Visibility)
		assert.Equal(t, SignalTypeText, d.Fields[0].Type)
	})

	tests := []struct {
		name    string
		modify  func(d *SignalDescriptor)
		wantErr string
	}{
		{name: "invalid name", modify: func(d *SignalDescriptor) { d.Name = "item-created" }, wantErr: "signal name"},
		{name: "invalid group", modify: func(d *SignalDescriptor) { d.Group = "Items" }, wantErr: "invalid group"},
		{name: "missing label", modify: func(d *SignalDescriptor) { d.Label = "" }, wantErr: "requires a label"},
		{name: "version zero", modify: func(d *SignalDescriptor) { d.Version = 0 }, wantErr: "version"},
		{name: "unknown visibility", modify: func(d *SignalDescriptor) { d.Visibility = "private" }, wantErr: "unknown visibility"},
		{name: "invalid allowed subscriber", modify: func(d *SignalDescriptor) { d.AllowedSubscribers = []string{"a/b"} }, wantErr: "invalid subscriber"},
		{name: "invalid field", modify: func(d *SignalDescriptor) { d.Fields = []SignalField{{Key: "summary"}} }, wantErr: "summary"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			d := validSignalDescriptor()
			tc.modify(&d)
			err := d.Validate()
			require.ErrorIs(t, err, ErrSignalDescriptorInvalid)
			require.ErrorContains(t, err, tc.wantErr)
		})
	}
}

func TestSignalDescriptorIsVisibleTo(t *testing.T) {
	public := SignalDescriptor{Visibility: SignalVisibilityAny}
	assert.True(t, public.IsVisibleTo("someone"))

	allowlist := SignalDescriptor{Visibility: SignalVisibilityAllowlist, AllowedSubscribers: []string{"allowed"}}
	assert.True(t, allowlist.IsVisibleTo("allowed"))
	assert.False(t, allowlist.IsVisibleTo("someone"))

	assert.Equal(t, "pub/item_created", (&SignalDescriptor{PublisherID: "pub", Name: "item_created"}).FullName())
}

func validActionDescriptor() ActionDescriptor {
	return ActionDescriptor{
		Type:    "create_item",
		Label:   "Create item",
		Fields:  []SignalField{{Key: "title"}},
		Results: []SignalField{{Key: "item_id"}},
	}
}

func TestActionDescriptorValidate(t *testing.T) {
	d := validActionDescriptor()
	require.NoError(t, d.Validate())
	assert.Equal(t, SignalTypeText, d.Results[0].Type)

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
		{name: "duplicate field", modify: func(d *ActionDescriptor) { d.Fields = []SignalField{{Key: "a"}, {Key: "a"}} }, wantErr: "fields"},
		{name: "unknown result type", modify: func(d *ActionDescriptor) { d.Results = []SignalField{{Key: "a", Type: "date"}} }, wantErr: "results"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			d := validActionDescriptor()
			tc.modify(&d)
			err := d.Validate()
			require.ErrorIs(t, err, ErrSignalDescriptorInvalid)
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

func TestParseSignalPattern(t *testing.T) {
	tests := []struct {
		pattern string
		want    SignalPattern
		wantErr bool
	}{
		{pattern: "*", want: SignalPattern{Kind: SignalPatternAll}},
		{pattern: "com.example.pub/*", want: SignalPattern{Kind: SignalPatternPublisher, Publisher: "com.example.pub"}},
		{pattern: "com.example.pub/items/*", want: SignalPattern{Kind: SignalPatternGroup, Publisher: "com.example.pub", Group: "items"}},
		{pattern: "com.example.pub/item_created", want: SignalPattern{Kind: SignalPatternExact, Publisher: "com.example.pub", Name: "item_created"}},
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
			got, err := ParseSignalPattern(tc.pattern)
			if tc.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestValidateSignalSubscriptions(t *testing.T) {
	require.NoError(t, ValidateSignalSubscriptions(nil))
	require.NoError(t, ValidateSignalSubscriptions([]SignalSubscription{
		{ID: "a", Signal: "pub/item_created", Filters: map[string]SignalValue{"item_id": SignalTextValue("i1")}},
		{ID: "b", Signal: "*"},
	}))

	tests := []struct {
		name    string
		subs    []SignalSubscription
		wantErr string
	}{
		{name: "missing ID", subs: []SignalSubscription{{Signal: "*"}}, wantErr: "requires an ID"},
		{name: "duplicate ID", subs: []SignalSubscription{{ID: "a", Signal: "*"}, {ID: "a", Signal: "pub/*"}}, wantErr: "used twice"},
		{name: "invalid pattern", subs: []SignalSubscription{{ID: "a", Signal: "pub"}}, wantErr: "signal pattern"},
		{name: "invalid filter key", subs: []SignalSubscription{{ID: "a", Signal: "*", Filters: map[string]SignalValue{"Bad": SignalTextValue("x")}}}, wantErr: "invalid key"},
		{name: "textarea filter", subs: []SignalSubscription{{ID: "a", Signal: "*", Filters: map[string]SignalValue{"k": SignalTextareaValue("x")}}}, wantErr: "textarea"},
		{name: "unknown filter type", subs: []SignalSubscription{{ID: "a", Signal: "*", Filters: map[string]SignalValue{"k": {Type: "date"}}}}, wantErr: "filter"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSignalSubscriptions(tc.subs)
			require.ErrorIs(t, err, ErrSignalSubscriptionInvalid)
			require.ErrorContains(t, err, tc.wantErr)
		})
	}

	t.Run("at most 256 subscriptions", func(t *testing.T) {
		subs := make([]SignalSubscription, MaxSignalSubscriptions+1)
		for i := range subs {
			subs[i] = SignalSubscription{ID: fmt.Sprintf("s%d", i), Signal: "*"}
		}
		require.NoError(t, ValidateSignalSubscriptions(subs[:MaxSignalSubscriptions]))
		err := ValidateSignalSubscriptions(subs)
		require.ErrorIs(t, err, ErrSignalSubscriptionInvalid)
		require.ErrorContains(t, err, "at most 256")
	})
}

func TestSignalSubscriptionEqual(t *testing.T) {
	base := SignalSubscription{ID: "a", Signal: "pub/x", Filters: map[string]SignalValue{"k": SignalIntValue(1)}}

	same := base
	same.Filters = map[string]SignalValue{"k": SignalIntValue(1)}
	assert.True(t, base.Equal(&same))

	for name, other := range map[string]SignalSubscription{
		"id":          {ID: "b", Signal: "pub/x", Filters: base.Filters},
		"signal":      {ID: "a", Signal: "pub/y", Filters: base.Filters},
		"include own": {ID: "a", Signal: "pub/x", Filters: base.Filters, IncludeOwn: true},
		"filter":      {ID: "a", Signal: "pub/x", Filters: map[string]SignalValue{"k": SignalIntValue(2)}},
		"filter key":  {ID: "a", Signal: "pub/x", Filters: map[string]SignalValue{"j": SignalIntValue(1)}},
		"no filters":  {ID: "a", Signal: "pub/x"},
	} {
		t.Run(name, func(t *testing.T) {
			assert.False(t, base.Equal(&other))
		})
	}
}
