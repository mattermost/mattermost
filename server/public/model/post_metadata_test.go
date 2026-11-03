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
		PropertyValuesUnavailable: true,
	}

	copied := original.Copy()

	require.Equal(t, original.PropertyValues, copied.PropertyValues)
	require.True(t, copied.PropertyValuesUnavailable)
}

// omitempty on a nil slice and a bool is easy to get right and easy to regress by
// switching either to a pointer, so pin the absence of both keys when unset.
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
			PropertyValuesUnavailable: true,
		})
		require.NoError(t, err)

		var raw map[string]json.RawMessage
		require.NoError(t, json.Unmarshal(b, &raw))
		require.Contains(t, raw, "property_values")
		require.Contains(t, raw, "property_values_unavailable")
	})
}

func TestPostMetadataAuditable_PropertyValues(t *testing.T) {
	values := []*PropertyValue{{ID: NewId(), Value: json.RawMessage(`"confidential"`)}}
	p := &PostMetadata{PropertyValues: values}

	require.Equal(t, values, p.Auditable()["property_values"])
}
