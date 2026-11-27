// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "testing"

// TestAccessDecisionCacheChannelWriteAccess covers caching of channel_write_access, answered by channelWriteAccessDecision: the
// decision is cached, and every invalidation source it depends on drops it.
func TestAccessDecisionCacheChannelWriteAccess(t *testing.T) {
	testCachedActionInvalidation(t, cachedWriteAccess)
}
