// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// A Type='W' wiki backing channel is internal and carries no chat read-state, so
// the read-state paths must skip it: a page view or page comment must never bump a
// member's LastViewedAt/MsgCount on the backing channel. The exclusion lives in the
// read-state store queries (GetChannelsWithUnreadsAndWithMentions /
// GetTeamChannelsWithUnreadAndMentions); the standard chat fetchers (GetChannel,
// GetSinglePost) already hide wiki channels and wiki posts.
func TestReadStateSkipsWikiBackingChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.SetupPagePermissions()

	rctx := th.CreateSessionContext()
	backingID := th.BasicWiki.ChannelId

	t.Run("MarkChannelsAsViewed writes no read-state for the backing channel", func(t *testing.T) {
		before, nErr := th.App.Srv().Store().Channel().GetMember(th.Context, backingID, th.BasicUser.Id)
		require.NoError(t, nErr)

		// A normal channel is included so the call is not a trivial no-op; only the
		// backing channel must be skipped.
		times, appErr := th.App.MarkChannelsAsViewed(th.Context, []string{backingID, th.BasicChannel.Id}, th.BasicUser.Id, "", true, false)
		require.Nil(t, appErr)
		require.NotContains(t, times, backingID)

		after, nErr := th.App.Srv().Store().Channel().GetMember(th.Context, backingID, th.BasicUser.Id)
		require.NoError(t, nErr)
		require.Equal(t, before.LastViewedAt, after.LastViewedAt)
	})

	t.Run("MarkTeamChannelsAndThreadsViewed excludes the backing channel", func(t *testing.T) {
		times, appErr := th.App.MarkTeamChannelsAndThreadsViewed(th.Context, th.BasicTeam.Id, th.BasicUser.Id, "", false)
		require.Nil(t, appErr)
		require.NotContains(t, times, backingID)
	})

	t.Run("MarkChannelAsUnreadFromPost cannot reach the read-state write for a page comment", func(t *testing.T) {
		page, appErr := th.App.CreateWikiPage(th.Context, th.BasicWiki.Id, "", "Read-state Page", "", th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		comment, appErr := th.App.CreatePageComment(rctx, page.Id, "a comment", nil, "", nil, nil)
		require.Nil(t, appErr)
		require.Equal(t, backingID, comment.ChannelId)

		// GetSinglePost rejects wiki post types, so the read-state write is unreachable.
		_, appErr = th.App.MarkChannelAsUnreadFromPost(th.Context, comment.Id, th.BasicUser.Id, true)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})
}
