// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestWebsocketSubjectIDIsValid(t *testing.T) {
	tests := map[string]struct {
		input  string
		expect bool
	}{
		"blank":                                     {input: "", expect: false},
		"activity feed":                             {input: "activity_feed", expect: true},
		"activity feed, leader space":               {input: " activity_feed", expect: false},
		"activity feed, trailing space":             {input: "activity_feed ", expect: false},
		"activity feed, mixed case":                 {input: "aCtivity_feed ", expect: false},
		"channel typing":                            {input: "channels/hig4dexcdjr7uyjmfcwbwubkie/typing ", expect: true},
		"channel typing, mixed case":                {input: "channels/hig4dexcdjr7uyjmfcwbwubkie/Typing ", expect: false},
		"channel typing, mixed case ID":             {input: "channels/Hig4dexcdjr7uyjmfcwbwubkie/Typing ", expect: false},
		"channel typing, wrong length ID too short": {input: "channels/hig4dexcdjr7uyjmfcwbwubkie/Typing ", expect: false},
		"channel typing, wrong length ID too long":  {input: "channels/hig4dexcdjr7uyjmfcwbwubkiee/Typing ", expect: false},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			actual := WebsocketSubjectID(tc.input).IsValid()
			require.Equal(t, tc.expect, actual)
		})
	}
}
