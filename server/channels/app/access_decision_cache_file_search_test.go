// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// TestAccessDecisionCacheFileSearchSharesEntries checks that file search and the file endpoints
// read and fill the same download_file_attachment entries.
func TestAccessDecisionCacheFileSearchSharesEntries(t *testing.T) {
	h := setupActionCacheTest(t, cachedDownload)
	decides(h.acs, true)
	rctx := h.th.Context.WithSession(h.session)
	userID, channelID := h.th.BasicUser.Id, h.th.BasicChannel.Id

	searchAllows := func() bool {
		t.Helper()
		subject, appErr := h.th.App.buildFileDownloadSubject(rctx, userID)
		require.Nil(t, appErr)
		require.NotNil(t, subject)
		return h.th.App.hasFileDownloadPermission(rctx, userID, channelID, subject)
	}

	require.True(t, h.check(), "the endpoint check fills the entry")
	require.Equal(t, 1, h.evaluations())
	require.True(t, searchAllows())
	require.Equal(t, 1, h.evaluations(), "file search hits the endpoint's entry")

	h.th.App.invalidateAccessDecisionsForResources([]string{channelID})
	require.True(t, searchAllows())
	require.Equal(t, 2, h.evaluations(), "file search misses after an invalidation")
	require.True(t, h.check())
	require.Equal(t, 2, h.evaluations(), "the endpoint hits the entry file search filled")
}
