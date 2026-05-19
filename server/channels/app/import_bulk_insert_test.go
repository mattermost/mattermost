// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

// TestImportBulkInsertChunking reads a pre-generated JSONL fixture through
// BulkImport that exceeds the default INSERT parameter threshold (50,000
// params — 76% of PostgreSQL's 65,535 hard limit). A single worker is used
// so that the import batches are large enough to trigger multi-chunk INSERTs.
//
// The fixture contains placeholder tokens that are replaced with unique
// names here so parallel test runs do not collide.
//
// Overflow thresholds exercised:
//
//	Posts (replies):      18 cols → chunk at 2,777 rows  (2,778 generated)
//	Thread memberships:   6 cols → chunk at 8,333 rows  (9,000 generated)
func TestImportBulkInsertChunking(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	// server/tests/bulk_insert_chunk_test.jsonl — 1,015-line, 535 KB file containing:
	// - 1 team, 2 channels, 10 users
	// - 1,000 root posts each with 9 thread followers (9,000 memberships; threshold is 8,333)
	// - 1 root post with 2,778 replies (threshold is 2,777)
	testsDir, _ := fileutils.FindDir("tests")
	raw, err := os.ReadFile(testsDir + "/bulk_insert_chunk_test.jsonl")
	require.NoError(t, err)

	// Replace placeholders with unique names for this test run.
	teamName := model.NewRandomTeamName()
	chanThreads := NewTestId()
	chanReplies := NewTestId()

	usernames := make([]string, 10)
	oldNew := []string{
		"__TEAM__", teamName,
		"__CHAN_THREADS__", chanThreads,
		"__CHAN_REPLIES__", chanReplies,
	}
	for i := range 10 {
		usernames[i] = model.NewUsername()
		oldNew = append(oldNew,
			fmt.Sprintf("__USER%d__", i), usernames[i],
		)
	}
	jsonl := strings.NewReplacer(oldNew...).Replace(string(raw))

	line, appErr := th.App.BulkImport(th.Context, strings.NewReader(jsonl), nil, false, 1)
	require.Nil(t, appErr, "BulkImport failed at line %d", line)
	require.Equal(t, 0, line)

	team, gErr := th.App.GetTeamByName(teamName)
	require.Nil(t, gErr)

	t.Run("thread memberships were chunked across parameter limit", func(t *testing.T) {
		channel, cErr := th.App.GetChannelByName(th.Context, chanThreads, team.Id, false)
		require.Nil(t, cErr)

		followerIDs := make([]string, 9)
		for i := range 9 {
			u, uErr := th.App.GetUserByUsername(usernames[i+1])
			require.Nil(t, uErr)
			followerIDs[i] = u.Id
		}

		// Spot-check thread followers on the first and last posts.
		const (
			baseTime     = 1700000000000
			numRootPosts = 1000
		)

		firstPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, baseTime)
		require.NoError(t, nErr)
		require.Len(t, firstPosts, 1)
		firstFollowers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(firstPosts[0].Id, true)
		require.NoError(t, nErr)
		assert.ElementsMatch(t, followerIDs, firstFollowers)

		lastPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, baseTime+numRootPosts-1)
		require.NoError(t, nErr)
		require.Len(t, lastPosts, 1)
		lastFollowers, nErr := th.App.Srv().Store().Thread().GetThreadFollowers(lastPosts[0].Id, true)
		require.NoError(t, nErr)
		assert.ElementsMatch(t, followerIDs, lastFollowers)
	})

	t.Run("replies were chunked across parameter limit", func(t *testing.T) {
		channel, cErr := th.App.GetChannelByName(th.Context, chanReplies, team.Id, false)
		require.Nil(t, cErr)

		const (
			replyBaseTime = 1700001000000
			numReplies    = 2778
		)

		rootPosts, nErr := th.App.Srv().Store().Post().GetPostsCreatedAt(channel.Id, replyBaseTime)
		require.NoError(t, nErr)
		require.Len(t, rootPosts, 1)

		thread, nErr := th.App.Srv().Store().Thread().Get(rootPosts[0].Id)
		require.NoError(t, nErr)
		require.NotNil(t, thread)
		assert.Equal(t, int64(numReplies), thread.ReplyCount)
	})
}
