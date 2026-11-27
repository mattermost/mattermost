// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import "testing"

// TestAccessDecisionCacheDownloadFileAttachment covers caching of download_file_attachment, answered by HasPermissionToChannelAction: the
// decision is cached, and every invalidation source it depends on drops it.
func TestAccessDecisionCacheDownloadFileAttachment(t *testing.T) {
	testCachedActionInvalidation(t, cachedDownload)
}
