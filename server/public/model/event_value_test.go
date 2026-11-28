// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"math"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventValueTypeNormalizeAndIsKnown(t *testing.T) {
	assert.Equal(t, EventTypeText, EventValueType("").Normalize())
	assert.Equal(t, EventTypeInt, EventTypeInt.Normalize())

	for _, known := range []EventValueType{"", EventTypeText, EventTypeTextarea, EventTypeBool, EventTypeInt, EventTypeFloat} {
		assert.True(t, known.IsKnown(), known)
	}
	assert.False(t, EventValueType("date").IsKnown())
}

func TestEventValueConstructorsAndNative(t *testing.T) {
	assert.Equal(t, "a", EventTextValue("a").Native())
	assert.Equal(t, "b", EventTextareaValue("b").Native())
	assert.Equal(t, true, EventBoolValue(true).Native())
	assert.Equal(t, int64(3), EventIntValue(3).Native())
	assert.Equal(t, 1.5, EventFloatValue(1.5).Native())
	assert.Equal(t, "untyped", EventValue{Text: "untyped"}.Native())
}

func TestEventValueEqual(t *testing.T) {
	assert.True(t, EventTextValue("a").Equal(EventValue{Text: "a"}), "an omitted type is text")
	assert.True(t, EventIntValue(0).Equal(EventIntValue(0)))
	assert.False(t, EventIntValue(1).Equal(EventFloatValue(1)), "types must match")
	assert.False(t, EventBoolValue(false).Equal(EventBoolValue(true)))
	assert.False(t, EventTextValue("a").Equal(EventTextValue("b")))
}

func TestEventValueValidate(t *testing.T) {
	t.Run("nil value", func(t *testing.T) {
		var v *EventValue
		require.Error(t, v.Validate(EventTypeText, EventTextMaxRunes, false))
	})

	tests := []struct {
		name          string
		value         EventValue
		declared      EventValueType
		allowTextarea bool
		wantErr       string
		want          EventValue
	}{
		{name: "text", value: EventTextValue("hi"), declared: EventTypeText, want: EventTextValue("hi")},
		{name: "omitted type is text", value: EventValue{Text: "hi"}, declared: "", want: EventTextValue("hi")},
		{name: "text clears other members", value: EventValue{Type: EventTypeText, Text: "hi", Int: 4, Bool: true, Float: 2}, declared: EventTypeText, want: EventTextValue("hi")},
		{name: "type mismatch", value: EventIntValue(1), declared: EventTypeText, wantErr: "does not match"},
		{name: "unknown declared type", value: EventValue{Type: "date"}, declared: "date", wantErr: "does not match"},
		{name: "text at the rune cap", value: EventTextValue(strings.Repeat("é", EventTextMaxRunes)), declared: EventTypeText, want: EventTextValue(strings.Repeat("é", EventTextMaxRunes))},
		{name: "text over the rune cap", value: EventTextValue(strings.Repeat("é", EventTextMaxRunes+1)), declared: EventTypeText, wantErr: "exceeds"},
		{name: "textarea rejected", value: EventTextareaValue("long"), declared: EventTypeTextarea, wantErr: "textarea"},
		{name: "textarea allowed and uncapped", value: EventTextareaValue(strings.Repeat("x", 5000)), declared: EventTypeTextarea, allowTextarea: true, want: EventTextareaValue(strings.Repeat("x", 5000))},
		{name: "bool carrying text", value: EventValue{Type: EventTypeBool, Text: "true"}, declared: EventTypeBool, wantErr: "must not carry text"},
		{name: "bool clears other members", value: EventValue{Type: EventTypeBool, Bool: true, Int: 3}, declared: EventTypeBool, want: EventBoolValue(true)},
		{name: "int carrying text", value: EventValue{Type: EventTypeInt, Text: "1"}, declared: EventTypeInt, wantErr: "must not carry text"},
		{name: "int clears other members", value: EventValue{Type: EventTypeInt, Int: 3, Float: 1}, declared: EventTypeInt, want: EventIntValue(3)},
		{name: "float carrying text", value: EventValue{Type: EventTypeFloat, Text: "1"}, declared: EventTypeFloat, wantErr: "must not carry text"},
		{name: "float NaN", value: EventFloatValue(math.NaN()), declared: EventTypeFloat, wantErr: "finite"},
		{name: "float Inf", value: EventFloatValue(math.Inf(-1)), declared: EventTypeFloat, wantErr: "finite"},
		{name: "float clears other members", value: EventValue{Type: EventTypeFloat, Float: 2.5, Bool: true}, declared: EventTypeFloat, want: EventFloatValue(2.5)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.value
			err := v.Validate(tc.declared, EventTextMaxRunes, tc.allowTextarea)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, v)
		})
	}
}

func TestEventKeySets(t *testing.T) {
	assert.True(t, IsEventBlockedKey("Summary"), "blocked keys are case-insensitive")
	assert.True(t, IsEventReservedKey("ChannelId"), "reserved keys are case-insensitive")
	assert.True(t, IsEventIdentityKey("channel_id"))
	assert.False(t, IsEventBlockedKey("item_id"))
	assert.False(t, IsEventReservedKey("item_id"))
	assert.False(t, IsEventIdentityKey("count"))
}

func TestValidateEventFields(t *testing.T) {
	tests := []struct {
		name    string
		fields  []EventField
		wantErr string
	}{
		{name: "valid", fields: []EventField{{Key: "item_id"}, {Key: "count", Type: EventTypeInt}, {Key: "done", Type: EventTypeBool}, {Key: "score", Type: EventTypeFloat}}},
		{name: "empty key", fields: []EventField{{Key: ""}}, wantErr: "must match"},
		{name: "key with uppercase", fields: []EventField{{Key: "ItemId"}}, wantErr: "must match"},
		{name: "key too long", fields: []EventField{{Key: strings.Repeat("a", 65)}}, wantErr: "must match"},
		{name: "duplicate key", fields: []EventField{{Key: "a"}, {Key: "a", Type: EventTypeInt}}, wantErr: "declared twice"},
		{name: "blocked key", fields: []EventField{{Key: "message"}}, wantErr: "free-form text"},
		{name: "reserved key", fields: []EventField{{Key: "userid"}}, wantErr: "reserved"},
		{name: "textarea", fields: []EventField{{Key: "body", Type: EventTypeTextarea}}, wantErr: "do not allow"},
		{name: "unknown type", fields: []EventField{{Key: "when", Type: "date"}}, wantErr: "do not allow"},
		{name: "identity key not text", fields: []EventField{{Key: "post_id", Type: EventTypeInt}}, wantErr: "must be text"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateEventFields(tc.fields)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}

	t.Run("normalizes omitted types to text", func(t *testing.T) {
		fields := []EventField{{Key: "item_id"}}
		require.NoError(t, ValidateEventFields(fields))
		assert.Equal(t, EventTypeText, fields[0].Type)
	})
}

func TestValidateActionFields(t *testing.T) {
	require.NoError(t, ValidateActionFields([]EventField{{Key: "title"}, {Key: "Body", Type: EventTypeTextarea}}), "action fields allow textarea and free-form keys")
	require.ErrorContains(t, ValidateActionFields([]EventField{{Key: " "}}), "required")
	require.ErrorContains(t, ValidateActionFields([]EventField{{Key: "a"}, {Key: "a"}}), "declared twice")
	require.ErrorContains(t, ValidateActionFields([]EventField{{Key: "a", Type: "date"}}), "unknown type")
}

func TestValidateEventPayload(t *testing.T) {
	fields := []EventField{{Key: "item_id", Type: EventTypeText}, {Key: "count", Type: EventTypeInt}}

	t.Run("valid payload is normalized and copied", func(t *testing.T) {
		payload := map[string]EventValue{"item_id": {Text: "i1"}, "count": EventIntValue(2)}
		out, err := ValidateEventPayload(fields, payload)
		require.NoError(t, err)
		assert.Equal(t, map[string]EventValue{"item_id": EventTextValue("i1"), "count": EventIntValue(2)}, out)
		assert.Equal(t, EventValueType(""), payload["item_id"].Type, "the input is not modified")
	})

	t.Run("nil payload", func(t *testing.T) {
		out, err := ValidateEventPayload(fields, nil)
		require.NoError(t, err)
		assert.Empty(t, out)
	})

	t.Run("undeclared key", func(t *testing.T) {
		_, err := ValidateEventPayload(fields, map[string]EventValue{"other": EventTextValue("x")})
		require.ErrorContains(t, err, "not declared")
	})

	t.Run("wrong type", func(t *testing.T) {
		_, err := ValidateEventPayload(fields, map[string]EventValue{"count": EventTextValue("x")})
		require.ErrorContains(t, err, `field "count"`)
	})

	t.Run("encoded payload over 16 KiB", func(t *testing.T) {
		many := make([]EventField, 0, 200)
		payload := map[string]EventValue{}
		for i := range 200 {
			key := fmt.Sprintf("k%d", i)
			many = append(many, EventField{Key: key})
			payload[key] = EventTextValue(strings.Repeat("x", EventTextMaxRunes))
		}
		require.NoError(t, ValidateEventFields(many))
		_, err := ValidateEventPayload(many, payload)
		require.ErrorContains(t, err, "exceeds")
	})
}

func TestValidateActionInputs(t *testing.T) {
	fields := []EventField{{Key: "title"}, {Key: "body", Type: EventTypeTextarea}}

	out, err := ValidateActionInputs(fields, map[string]EventValue{
		"title": EventTextValue(strings.Repeat("t", ActionTextMaxRunes)),
		"body":  EventTextareaValue(strings.Repeat("b", 10000)),
	})
	require.NoError(t, err)
	assert.Len(t, out, 2)

	_, err = ValidateActionInputs(fields, map[string]EventValue{"title": EventTextValue(strings.Repeat("t", ActionTextMaxRunes+1))})
	require.ErrorContains(t, err, "exceeds")

	_, err = ValidateActionInputs(fields, map[string]EventValue{"other": EventTextValue("x")})
	require.ErrorContains(t, err, "not declared")

	_, err = ValidateActionInputs(fields, map[string]EventValue{"body": EventTextareaValue(strings.Repeat("b", ActionMaxBytes))})
	require.ErrorContains(t, err, "exceeds")
}

func TestFilterActionResults(t *testing.T) {
	fields := []EventField{{Key: "item_id"}, {Key: "count", Type: EventTypeInt}}

	out, err := FilterActionResults(fields, map[string]EventValue{
		"item_id":    EventTextValue("i1"),
		"undeclared": EventTextValue("dropped"),
	})
	require.NoError(t, err)
	assert.Equal(t, map[string]EventValue{"item_id": EventTextValue("i1")}, out)

	_, err = FilterActionResults(fields, map[string]EventValue{"count": EventTextValue("x")})
	require.Error(t, err)

	out, err = FilterActionResults(fields, nil)
	require.NoError(t, err)
	assert.Empty(t, out)
}
