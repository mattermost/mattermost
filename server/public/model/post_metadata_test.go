// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

// Copy() enumerates PostMetadata's fields by hand and has already silently dropped
// two of them (ExpireAt, Recipients). The hydration fields must not join them.
func TestPostMetadataCopy_PropertyValues(t *testing.T) {
	original := &PostMetadata{
		PropertyValues: []*PropertyValue{
			{
				ID:         NewId(),
				TargetID:   NewId(),
				TargetType: "post",
				GroupID:    NewId(),
				FieldID:    NewId(),
				Value:      json.RawMessage(`"confidential"`),
			},
		},
		PropertyValuesUnavailable: NewPointer(true),
	}

	copied := original.Copy()

	require.Equal(t, original.PropertyValues, copied.PropertyValues)
	require.NotNil(t, copied.PropertyValuesUnavailable)
	require.True(t, *copied.PropertyValuesUnavailable)
}

// A shared pointer would let a change to one post's flag leak into its copy.
func TestPostMetadataCopy_PropertyValuesUnavailableIndependent(t *testing.T) {
	original := &PostMetadata{PropertyValuesUnavailable: NewPointer(true)}

	copied := original.Copy()
	require.NotSame(t, original.PropertyValuesUnavailable, copied.PropertyValuesUnavailable)

	*original.PropertyValuesUnavailable = false
	require.True(t, *copied.PropertyValuesUnavailable)

	t.Run("nil stays nil", func(t *testing.T) {
		require.Nil(t, (&PostMetadata{}).Copy().PropertyValuesUnavailable)
	})
}

// The unavailable flag has three states and a client tells them apart by the key alone:
// absent means hydration was not requested, so the client keeps what it stored. A plain
// bool would drop false on the wire and make a successful hydration look unrequested, so
// pin that nil omits the key while false and true both send it.
func TestPostMetadataJSON_PropertyValuesOmittedWhenUnset(t *testing.T) {
	b, err := json.Marshal(&PostMetadata{})
	require.NoError(t, err)

	var raw map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(b, &raw))
	require.NotContains(t, raw, "property_values")
	require.NotContains(t, raw, "property_values_unavailable")

	t.Run("present when set", func(t *testing.T) {
		b, err := json.Marshal(&PostMetadata{
			PropertyValues:            []*PropertyValue{{ID: NewId()}},
			PropertyValuesUnavailable: NewPointer(true),
		})
		require.NoError(t, err)

		var raw map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(b, &raw))
		require.Contains(t, raw, "property_values")
		require.Contains(t, raw, "property_values_unavailable")
	})

	for name, tc := range map[string]struct {
		value    *bool
		expected string
	}{
		"false is sent": {value: NewPointer(false), expected: "false"},
		"true is sent":  {value: NewPointer(true), expected: "true"},
	} {
		t.Run(name, func(t *testing.T) {
			b, err := json.Marshal(&PostMetadata{PropertyValuesUnavailable: tc.value})
			require.NoError(t, err)

			var raw map[string]json.RawMessage
			require.NoError(t, json.Unmarshal(b, &raw))
			require.Contains(t, raw, "property_values_unavailable")
			require.JSONEq(t, tc.expected, string(raw["property_values_unavailable"]))
		})
	}
}

func TestPostMetadataAuditable_PropertyValues(t *testing.T) {
	values := []*PropertyValue{{ID: NewId(), Value: json.RawMessage(`"confidential"`)}}
	p := &PostMetadata{PropertyValues: values}

	require.Equal(t, values, p.Auditable()["property_values"])
}
