// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newTestService() *Service {
	return &Service{
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
}

func TestAddTask_OriginRemoteIDMerge(t *testing.T) {
	tests := []struct {
		name           string
		firstOrigin    string
		secondOrigin   string
		expectedOrigin string
	}{
		{
			name:           "same remote origin is preserved",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-A",
			expectedOrigin: "remote-A",
		},
		{
			name:           "local then remote clears origin",
			firstOrigin:    "",
			secondOrigin:   "remote-A",
			expectedOrigin: "",
		},
		{
			name:           "remote then local clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "",
			expectedOrigin: "",
		},
		{
			name:           "different remotes clears origin",
			firstOrigin:    "remote-A",
			secondOrigin:   "remote-B",
			expectedOrigin: "",
		},
		{
			name:           "both local stays empty",
			firstOrigin:    "",
			secondOrigin:   "",
			expectedOrigin: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			scs := newTestService()
			channelID := "channel-1"

			first := newSyncTask(channelID, "", "", nil, nil)
			first.originRemoteID = tc.firstOrigin
			scs.addTask(first)

			second := newSyncTask(channelID, "", "", nil, nil)
			second.originRemoteID = tc.secondOrigin
			scs.addTask(second)

			merged, ok := scs.tasks[first.id]
			require.True(t, ok, "task should exist")
			assert.Equal(t, tc.expectedOrigin, merged.originRemoteID)
		})
	}
}
