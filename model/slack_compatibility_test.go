// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSlackCompatibleBool_UnmarshalJSON_True(t *testing.T) {
	cases := []struct {
		name    string
		payload string
	}{
		{name: "literal", payload: `{"title": "Foo", "value": "Bar", "short": true}`},
		{name: "stringLower", payload: `{"title": "Foo", "value": "Bar", "short": "true"}`},
		{name: "stringMixed", payload: `{"title": "Foo", "value": "Bar", "short": "True"}`},
		{name: "stringUpper", payload: `{"title": "Foo", "value": "Bar", "short": "TRUE"}`},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			field := &SlackAttachmentField{}

			err := json.Unmarshal([]byte(tt.payload), field)

			require.NoError(t, err)
			require.True(t, bool(field.Short))
		})
	}
}

func TestSlackCompatibleBool_UnmarshalJSON_False(t *testing.T) {
	cases := []struct {
		name    string
		payload string
	}{
		{name: "literal", payload: `{"title": "Foo", "value": "Bar", "short": false}`},
		{name: "stringLower", payload: `{"title": "Foo", "value": "Bar", "short": "false"}`},
		{name: "stringMixed", payload: `{"title": "Foo", "value": "Bar", "short": "False"}`},
		{name: "stringUpper", payload: `{"title": "Foo", "value": "Bar", "short": "FALSE"}`},
	}

	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			field := &SlackAttachmentField{}

			err := json.Unmarshal([]byte(tt.payload), field)

			require.NoError(t, err)
			require.False(t, bool(field.Short))
		})
	}
}
