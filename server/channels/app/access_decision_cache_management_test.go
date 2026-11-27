// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "testing"

// TestAccessDecisionCacheChannelManagementAccess covers caching of channel_management_access, answered by channelManagementAccessDecision: the
// decision is cached, and every invalidation source it depends on drops it.
func TestAccessDecisionCacheChannelManagementAccess(t *testing.T) {
	testCachedActionInvalidation(t, cachedManagementAccess)
}
