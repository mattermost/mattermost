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

func TestSignalValueTypeNormalizeAndIsKnown(t *testing.T) {
	assert.Equal(t, SignalTypeText, SignalValueType("").Normalize())
	assert.Equal(t, SignalTypeInt, SignalTypeInt.Normalize())

	for _, known := range []SignalValueType{"", SignalTypeText, SignalTypeTextarea, SignalTypeBool, SignalTypeInt, SignalTypeFloat} {
		assert.True(t, known.IsKnown(), known)
	}
	assert.False(t, SignalValueType("date").IsKnown())
}

func TestSignalValueConstructorsAndNative(t *testing.T) {
	assert.Equal(t, "a", SignalTextValue("a").Native())
	assert.Equal(t, "b", SignalTextareaValue("b").Native())
	assert.Equal(t, true, SignalBoolValue(true).Native())
	assert.Equal(t, int64(3), SignalIntValue(3).Native())
	assert.Equal(t, 1.5, SignalFloatValue(1.5).Native())
	assert.Equal(t, "untyped", SignalValue{Text: "untyped"}.Native())
}

func TestSignalValueEqual(t *testing.T) {
	assert.True(t, SignalTextValue("a").Equal(SignalValue{Text: "a"}), "an omitted type is text")
	assert.True(t, SignalIntValue(0).Equal(SignalIntValue(0)))
	assert.False(t, SignalIntValue(1).Equal(SignalFloatValue(1)), "types must match")
	assert.False(t, SignalBoolValue(false).Equal(SignalBoolValue(true)))
	assert.False(t, SignalTextValue("a").Equal(SignalTextValue("b")))
}

func TestSignalValueValidate(t *testing.T) {
	t.Run("nil value", func(t *testing.T) {
		var v *SignalValue
		require.Error(t, v.Validate(SignalTypeText, SignalTextMaxRunes, false))
	})

	tests := []struct {
		name          string
		value         SignalValue
		declared      SignalValueType
		allowTextarea bool
		wantErr       string
		want          SignalValue
	}{
		{name: "text", value: SignalTextValue("hi"), declared: SignalTypeText, want: SignalTextValue("hi")},
		{name: "omitted type is text", value: SignalValue{Text: "hi"}, declared: "", want: SignalTextValue("hi")},
		{name: "text clears other members", value: SignalValue{Type: SignalTypeText, Text: "hi", Int: 4, Bool: true, Float: 2}, declared: SignalTypeText, want: SignalTextValue("hi")},
		{name: "type mismatch", value: SignalIntValue(1), declared: SignalTypeText, wantErr: "does not match"},
		{name: "unknown declared type", value: SignalValue{Type: "date"}, declared: "date", wantErr: "does not match"},
		{name: "text at the rune cap", value: SignalTextValue(strings.Repeat("é", SignalTextMaxRunes)), declared: SignalTypeText, want: SignalTextValue(strings.Repeat("é", SignalTextMaxRunes))},
		{name: "text over the rune cap", value: SignalTextValue(strings.Repeat("é", SignalTextMaxRunes+1)), declared: SignalTypeText, wantErr: "exceeds"},
		{name: "textarea rejected", value: SignalTextareaValue("long"), declared: SignalTypeTextarea, wantErr: "textarea"},
		{name: "textarea allowed and uncapped", value: SignalTextareaValue(strings.Repeat("x", 5000)), declared: SignalTypeTextarea, allowTextarea: true, want: SignalTextareaValue(strings.Repeat("x", 5000))},
		{name: "bool carrying text", value: SignalValue{Type: SignalTypeBool, Text: "true"}, declared: SignalTypeBool, wantErr: "must not carry text"},
		{name: "bool clears other members", value: SignalValue{Type: SignalTypeBool, Bool: true, Int: 3}, declared: SignalTypeBool, want: SignalBoolValue(true)},
		{name: "int carrying text", value: SignalValue{Type: SignalTypeInt, Text: "1"}, declared: SignalTypeInt, wantErr: "must not carry text"},
		{name: "int clears other members", value: SignalValue{Type: SignalTypeInt, Int: 3, Float: 1}, declared: SignalTypeInt, want: SignalIntValue(3)},
		{name: "float carrying text", value: SignalValue{Type: SignalTypeFloat, Text: "1"}, declared: SignalTypeFloat, wantErr: "must not carry text"},
		{name: "float NaN", value: SignalFloatValue(math.NaN()), declared: SignalTypeFloat, wantErr: "finite"},
		{name: "float Inf", value: SignalFloatValue(math.Inf(-1)), declared: SignalTypeFloat, wantErr: "finite"},
		{name: "float clears other members", value: SignalValue{Type: SignalTypeFloat, Float: 2.5, Bool: true}, declared: SignalTypeFloat, want: SignalFloatValue(2.5)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			v := tc.value
			err := v.Validate(tc.declared, SignalTextMaxRunes, tc.allowTextarea)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, v)
		})
	}
}

func TestSignalKeySets(t *testing.T) {
	assert.True(t, IsSignalBlockedKey("Summary"), "blocked keys are case-insensitive")
	assert.True(t, IsSignalReservedKey("ChannelId"), "reserved keys are case-insensitive")
	assert.True(t, IsSignalIdentityKey("channel_id"))
	assert.False(t, IsSignalBlockedKey("item_id"))
	assert.False(t, IsSignalReservedKey("item_id"))
	assert.False(t, IsSignalIdentityKey("count"))
}

func TestValidateSignalFields(t *testing.T) {
	tests := []struct {
		name    string
		fields  []SignalField
		wantErr string
	}{
		{name: "valid", fields: []SignalField{{Key: "item_id"}, {Key: "count", Type: SignalTypeInt}, {Key: "done", Type: SignalTypeBool}, {Key: "score", Type: SignalTypeFloat}}},
		{name: "empty key", fields: []SignalField{{Key: ""}}, wantErr: "must match"},
		{name: "key with uppercase", fields: []SignalField{{Key: "ItemId"}}, wantErr: "must match"},
		{name: "key too long", fields: []SignalField{{Key: strings.Repeat("a", 65)}}, wantErr: "must match"},
		{name: "duplicate key", fields: []SignalField{{Key: "a"}, {Key: "a", Type: SignalTypeInt}}, wantErr: "declared twice"},
		{name: "blocked key", fields: []SignalField{{Key: "message"}}, wantErr: "free-form text"},
		{name: "reserved key", fields: []SignalField{{Key: "userid"}}, wantErr: "reserved"},
		{name: "textarea", fields: []SignalField{{Key: "body", Type: SignalTypeTextarea}}, wantErr: "do not allow"},
		{name: "unknown type", fields: []SignalField{{Key: "when", Type: "date"}}, wantErr: "do not allow"},
		{name: "identity key not text", fields: []SignalField{{Key: "post_id", Type: SignalTypeInt}}, wantErr: "must be text"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSignalFields(tc.fields)
			if tc.wantErr != "" {
				require.ErrorContains(t, err, tc.wantErr)
				return
			}
			require.NoError(t, err)
		})
	}

	t.Run("normalizes omitted types to text", func(t *testing.T) {
		fields := []SignalField{{Key: "item_id"}}
		require.NoError(t, ValidateSignalFields(fields))
		assert.Equal(t, SignalTypeText, fields[0].Type)
	})
}

func TestValidateActionFields(t *testing.T) {
	require.NoError(t, ValidateActionFields([]SignalField{{Key: "title"}, {Key: "Body", Type: SignalTypeTextarea}}), "action fields allow textarea and free-form keys")
	require.ErrorContains(t, ValidateActionFields([]SignalField{{Key: " "}}), "required")
	require.ErrorContains(t, ValidateActionFields([]SignalField{{Key: "a"}, {Key: "a"}}), "declared twice")
	require.ErrorContains(t, ValidateActionFields([]SignalField{{Key: "a", Type: "date"}}), "unknown type")
}

func TestValidateSignalPayload(t *testing.T) {
	fields := []SignalField{{Key: "item_id", Type: SignalTypeText}, {Key: "count", Type: SignalTypeInt}}

	t.Run("valid payload is normalized and copied", func(t *testing.T) {
		payload := map[string]SignalValue{"item_id": {Text: "i1"}, "count": SignalIntValue(2)}
		out, err := ValidateSignalPayload(fields, payload)
		require.NoError(t, err)
		assert.Equal(t, map[string]SignalValue{"item_id": SignalTextValue("i1"), "count": SignalIntValue(2)}, out)
		assert.Equal(t, SignalValueType(""), payload["item_id"].Type, "the input is not modified")
	})

	t.Run("nil payload", func(t *testing.T) {
		out, err := ValidateSignalPayload(fields, nil)
		require.NoError(t, err)
		assert.Empty(t, out)
	})

	t.Run("undeclared key", func(t *testing.T) {
		_, err := ValidateSignalPayload(fields, map[string]SignalValue{"other": SignalTextValue("x")})
		require.ErrorContains(t, err, "not declared")
	})

	t.Run("wrong type", func(t *testing.T) {
		_, err := ValidateSignalPayload(fields, map[string]SignalValue{"count": SignalTextValue("x")})
		require.ErrorContains(t, err, `field "count"`)
	})

	t.Run("encoded payload over 16 KiB", func(t *testing.T) {
		many := make([]SignalField, 0, 200)
		payload := map[string]SignalValue{}
		for i := range 200 {
			key := fmt.Sprintf("k%d", i)
			many = append(many, SignalField{Key: key})
			payload[key] = SignalTextValue(strings.Repeat("x", SignalTextMaxRunes))
		}
		require.NoError(t, ValidateSignalFields(many))
		_, err := ValidateSignalPayload(many, payload)
		require.ErrorContains(t, err, "exceeds")
	})
}

func TestValidateActionInputs(t *testing.T) {
	fields := []SignalField{{Key: "title"}, {Key: "body", Type: SignalTypeTextarea}}

	out, err := ValidateActionInputs(fields, map[string]SignalValue{
		"title": SignalTextValue(strings.Repeat("t", ActionTextMaxRunes)),
		"body":  SignalTextareaValue(strings.Repeat("b", 10000)),
	})
	require.NoError(t, err)
	assert.Len(t, out, 2)

	_, err = ValidateActionInputs(fields, map[string]SignalValue{"title": SignalTextValue(strings.Repeat("t", ActionTextMaxRunes+1))})
	require.ErrorContains(t, err, "exceeds")

	_, err = ValidateActionInputs(fields, map[string]SignalValue{"other": SignalTextValue("x")})
	require.ErrorContains(t, err, "not declared")

	_, err = ValidateActionInputs(fields, map[string]SignalValue{"body": SignalTextareaValue(strings.Repeat("b", ActionMaxBytes))})
	require.ErrorContains(t, err, "exceeds")
}

func TestFilterActionResults(t *testing.T) {
	fields := []SignalField{{Key: "item_id"}, {Key: "count", Type: SignalTypeInt}}

	out, err := FilterActionResults(fields, map[string]SignalValue{
		"item_id":    SignalTextValue("i1"),
		"undeclared": SignalTextValue("dropped"),
	})
	require.NoError(t, err)
	assert.Equal(t, map[string]SignalValue{"item_id": SignalTextValue("i1")}, out)

	_, err = FilterActionResults(fields, map[string]SignalValue{"count": SignalTextValue("x")})
	require.Error(t, err)

	out, err = FilterActionResults(fields, nil)
	require.NoError(t, err)
	assert.Empty(t, out)
}
