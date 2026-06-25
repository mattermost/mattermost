// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHubFlushPostDeliveries(t *testing.T) {
	t.Run("hands a fresh, deduped slice to the recorder", func(t *testing.T) {
		var gotPostID string
		var gotUserIDs []string
		h := &Hub{platform: &PlatformService{
			postDeliveryRecorder: func(postID string, userIDs []string) {
				gotPostID = postID
				gotUserIDs = userIDs
			},
		}}

		recorded := map[string]struct{}{"u1": {}, "u2": {}, "u3": {}}
		h.flushPostDeliveries("post1", recorded)

		require.Equal(t, "post1", gotPostID)
		require.ElementsMatch(t, []string{"u1", "u2", "u3"}, gotUserIDs)

		// The slice handed off must NOT alias the reusable dedup map's storage:
		// mutating the map afterwards must not affect what the recorder received.
		clear(recorded)
		require.Len(t, gotUserIDs, 3, "recorder's slice must be owned by the record, not the reused map")
	})

	t.Run("does not call the recorder for an empty set", func(t *testing.T) {
		called := false
		h := &Hub{platform: &PlatformService{
			postDeliveryRecorder: func(string, []string) { called = true },
		}}
		h.flushPostDeliveries("post1", map[string]struct{}{})
		require.False(t, called)
	})
}
