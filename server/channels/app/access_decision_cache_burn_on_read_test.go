// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "testing"

// TestAccessDecisionCacheCreateBurnOnReadPost covers caching of create_burn_on_read_post, answered by HasPermissionToChannelAction: the
// decision is cached, and every invalidation source it depends on drops it.
func TestAccessDecisionCacheCreateBurnOnReadPost(t *testing.T) {
	testCachedActionInvalidation(t, cachedBurnOnRead)
}
