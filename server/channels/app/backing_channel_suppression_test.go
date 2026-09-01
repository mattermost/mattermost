// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// TestBackingChannelThreadSuppression pins the two halves of the backing-channel thread posture
// together: the ThreadMemberships/Threads rows are still written (they carry per-user thread
// state the owning feature reads), while every chat thread surface — the list, the counts, the
// single-thread read, read-state moves, and team-wide mark-all-read — excludes them. A
// single-sided test would pass under either mistake.
func TestBackingChannelThreadSuppression(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	space := createSpaceChannelWithMember(t, th, th.BasicUser.Id)
	_, nErr := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   space.Id,
		UserId:      th.BasicUser2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeUser:  true,
	})
	require.NoError(t, nErr)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	// A backing-channel thread: root by user 1, reply by user 2 auto-follows both.
	root, appErr := api.CreatePost(&model.Post{ChannelId: space.Id, UserId: th.BasicUser.Id, Message: "root"})
	require.Nil(t, appErr)
	_, appErr = api.CreatePost(&model.Post{ChannelId: space.Id, RootId: root.Id, UserId: th.BasicUser2.Id, Message: "reply"})
	require.Nil(t, appErr)

	membership, appErr := th.App.GetThreadMembershipForUser(th.BasicUser2.Id, root.Id)
	require.Nil(t, appErr)
	require.True(t, membership.Following, "the auto-follow write is kept")
	spaceLastViewed := membership.LastViewed

	threadStore := th.App.Srv().Store().Thread()

	t.Run("the chat thread surfaces exclude the backing-channel thread", func(t *testing.T) {
		total, err := threadStore.GetTotalThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		assert.Zero(t, total)

		unread, err := threadStore.GetTotalUnreadThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		assert.Zero(t, unread)

		list, err := threadStore.GetThreadsForUser(th.Context, th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		assert.Empty(t, list)

		_, appErr := th.App.GetThreadForUser(th.Context, membership, false)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

		_, appErr = th.App.UpdateThreadReadForUser(th.Context, "", th.BasicUser2.Id, th.BasicTeam.Id, root.Id, model.GetMillis())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)

		after, appErr := th.App.GetThreadMembershipForUser(th.BasicUser2.Id, root.Id)
		require.Nil(t, appErr)
		assert.Equal(t, spaceLastViewed, after.LastViewed, "a refused read-state move must not mutate")
	})

	t.Run("an ordinary chat thread still counts, and mark-all-read reaches only it", func(t *testing.T) {
		chatRoot := th.CreatePost(t, th.BasicChannel)
		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			RootId:    chatRoot.Id,
			UserId:    th.BasicUser2.Id,
			Message:   "chat reply",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)

		total, err := threadStore.GetTotalThreads(th.BasicUser2.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.NoError(t, err)
		assert.EqualValues(t, 1, total, "the exclusion must not reach chat threads")

		require.Nil(t, th.App.UpdateThreadsReadForUser(th.BasicUser2.Id, th.BasicTeam.Id))

		after, appErr := th.App.GetThreadMembershipForUser(th.BasicUser2.Id, root.Id)
		require.Nil(t, appErr)
		assert.Equal(t, spaceLastViewed, after.LastViewed, "team-wide mark-all-read must not clear backing-channel thread state")
	})

	t.Run("a membership whose Threads row is gone is treated exactly as before", func(t *testing.T) {
		// Retention's batch delete leaves memberships without Threads rows. Such rows are
		// already outside the counts (the channel-membership predicate cannot match a NULL
		// join), and the exclusion is a null-safe NOT EXISTS so it cannot change how they are
		// treated — a Channels join or bare NOT IN would evaluate differently against NULL.
		before, err := threadStore.GetTotalThreads(th.BasicUser2.Id, "", model.GetUserThreadsOpts{})
		require.NoError(t, err)

		orphanID := model.NewId()
		_, err = threadStore.MaintainMembership(th.BasicUser2.Id, orphanID, store.ThreadMembershipOpts{
			Following:       true,
			UpdateFollowing: true,
		})
		require.NoError(t, err)

		after, err := threadStore.GetTotalThreads(th.BasicUser2.Id, "", model.GetUserThreadsOpts{})
		require.NoError(t, err)
		assert.Equal(t, before, after)
	})
}

// TestBackingChannelPostIDGates pins the authorization boundary: the two post-id gate functions
// refuse a backing-channel post before the membership question, closing every store-direct post
// route at once, while the unfollow variant deliberately stays open so a stale follow can be
// cleared.
func TestBackingChannelPostIDGates(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	space := createSpaceChannelWithMember(t, th, th.BasicUser.Id)

	root, appErr := api.CreatePost(&model.Post{ChannelId: space.Id, UserId: th.BasicUser.Id, Message: "root"})
	require.Nil(t, appErr)
	chatPost := th.CreatePost(t, th.BasicChannel)

	session := model.Session{UserId: th.BasicUser.Id}

	t.Run("a member is refused on a backing-channel post", func(t *testing.T) {
		ok, isMember := th.App.SessionHasPermissionToReadPost(th.Context, session, root.Id)
		assert.False(t, ok)
		assert.False(t, isMember)

		assert.False(t, th.App.SessionHasPermissionToChannelByPost(session, root.Id, model.PermissionAddReaction))
	})

	t.Run("the same member passes on a chat post", func(t *testing.T) {
		ok, _ := th.App.SessionHasPermissionToReadPost(th.Context, session, chatPost.Id)
		assert.True(t, ok)
	})

	t.Run("the unfollow variant skips the backing rejection", func(t *testing.T) {
		ok, _ := th.App.SessionHasPermissionToReadPostAllowBacking(th.Context, session, root.Id)
		assert.True(t, ok, "a member already following must be able to unfollow")
	})
}

// TestBackingChannelHookClamp pins the hook hardening: on a backing channel a
// MessageWillBePosted replacement may change the message and nothing else — the caller-supplied
// id and the props tying the post to its owning feature survive — while chat channels keep the
// hook's full replacement power.
func TestBackingChannelHookClamp(t *testing.T) {
	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	space := createSpaceChannelWithMember(t, th, th.BasicUser.Id)

	pluginCode := `
	package main

	import (
		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
		replacement := post.Clone()
		replacement.Id = ""
		replacement.Message = post.Message + " [rewritten]"
		replacement.AddProp("page_id", "hijacked")
		return replacement, ""
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
	`
	tearDown, ids, errs := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
	defer tearDown()
	require.NoError(t, errs[0])
	require.Len(t, ids, 1)

	t.Run("a backing-channel post keeps its id and props and takes only the message", func(t *testing.T) {
		post := &model.Post{
			Id:        model.NewId(),
			ChannelId: space.Id,
			UserId:    th.BasicUser.Id,
			Message:   "comment",
		}
		post.AddProp("page_id", "the-real-page")

		created, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		assert.Equal(t, post.Id, created.Id, "the caller-supplied id is load-bearing for the failure probe")
		assert.Equal(t, "comment [rewritten]", created.Message, "the hook keeps its message rewrite")
		assert.Equal(t, "the-real-page", created.GetProp("page_id"), "a hook cannot re-home the post")
	})

	t.Run("a chat post keeps the hook's full replacement", func(t *testing.T) {
		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "chat",
		}, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		assert.Equal(t, "chat [rewritten]", created.Message)
		assert.Equal(t, "hijacked", created.GetProp("page_id"), "the clamp must not reach chat channels")
	})
}

// TestBackingChannelPostIDGateCoverage pins the boundary by count: every api4 route that
// authorizes by post id goes through one of the two gate functions carrying the backing-channel
// rejection, and exactly one route — thread unfollow — uses the variant without it. A route
// added later moves a count and fails here, forcing a decision about which side of the boundary
// it belongs on instead of silently joining or bypassing the sweep.
func TestBackingChannelPostIDGateCoverage(t *testing.T) {
	mainHelper.Parallel(t)

	files, err := filepath.Glob(filepath.Join(server.GetPackagePath(), "channels", "api4", "*.go"))
	require.NoError(t, err)
	require.NotEmpty(t, files)

	counts := map[string]int{}
	for _, file := range files {
		if strings.HasSuffix(file, "_test.go") {
			continue
		}
		src, readErr := os.ReadFile(file)
		require.NoError(t, readErr)
		for _, gate := range []string{
			"SessionHasPermissionToReadPost(",
			"SessionHasPermissionToReadPostAllowBacking(",
			"SessionHasPermissionToChannelByPost(",
		} {
			counts[gate] += strings.Count(string(src), gate)
		}
	}

	assert.Equal(t, 11, counts["SessionHasPermissionToReadPost("], "post-id routes behind the backing-channel rejection")
	assert.Equal(t, 1, counts["SessionHasPermissionToReadPostAllowBacking("], "the unfollow carve-out is the only exemption")
	assert.Equal(t, 2, counts["SessionHasPermissionToChannelByPost("], "the two reaction writes")
}

// TestBackingChannelNotificationSuppression pins that a mention in a backing-channel post reaches
// no chat notification surface. Websocket delivery was already excluded; email, push, and the
// mention-count and mention-driven autofollow writes are the halves that a channel-scoped payload
// check further down the function could not cover, because they are dispatched before it.
func TestBackingChannelNotificationSuppression(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	space := createSpaceChannelWithMember(t, th, th.BasicUser.Id)
	_, nErr := th.App.Srv().Store().Channel().SaveMember(th.Context, &model.ChannelMember{
		ChannelId:   space.Id,
		UserId:      th.BasicUser2.Id,
		NotifyProps: model.GetDefaultChannelNotifyProps(),
		SchemeUser:  true,
	})
	require.NoError(t, nErr)
	th.AddUserToChannel(t, th.BasicUser2, th.BasicChannel)

	mention := "@" + th.BasicUser2.Username

	t.Run("a mention in a backing channel notifies nobody and moves no mention state", func(t *testing.T) {
		post, appErr := api.CreatePost(&model.Post{ChannelId: space.Id, UserId: th.BasicUser.Id, Message: mention})
		require.Nil(t, appErr)

		mentioned, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, space, th.BasicUser, nil, true)
		require.NoError(t, err)
		assert.Empty(t, mentioned, "no recipient may be resolved for a backing-channel post")

		member, err := th.App.Srv().Store().Channel().GetMember(th.Context, space.Id, th.BasicUser2.Id)
		require.NoError(t, err)
		assert.Zero(t, member.MentionCount, "a backing-channel mention must not raise a chat mention count")
		assert.Zero(t, member.MentionCountRoot)
	})

	t.Run("the same mention in a chat channel still notifies", func(t *testing.T) {
		post, appErr := api.CreatePost(&model.Post{ChannelId: th.BasicChannel.Id, UserId: th.BasicUser.Id, Message: mention})
		require.Nil(t, appErr)

		mentioned, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
		require.NoError(t, err)
		assert.Contains(t, mentioned, th.BasicUser2.Id, "the suppression must be scoped to backing channels only")
	})
}

// TestMoveThreadsToChannelConcurrentCounters pins that two overlapping moves of the same threads
// cannot corrupt the channel counters. Deriving the per-source deltas before locking the rows lets
// both transactions count the posts in the same source, so both subtract it while only one target
// ends up holding the rows. Two concurrent moves over one space's comments are reachable in
// practice: a page move re-homes comments with a space-wide sweep, so two page moves in one space
// cover overlapping sets.
func TestMoveThreadsToChannelConcurrentCounters(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	source := createSpaceChannelWithMember(t, th, th.BasicUser.Id)
	targetB := createSpaceChannelWithMember(t, th, th.BasicUser.Id)
	targetC := createSpaceChannelWithMember(t, th, th.BasicUser.Id)

	rootIDs := make([]string, 0, 3)
	for range 3 {
		root, appErr := api.CreatePost(&model.Post{ChannelId: source.Id, UserId: th.BasicUser.Id, Message: "root"})
		require.Nil(t, appErr)
		_, appErr = api.CreatePost(&model.Post{ChannelId: source.Id, RootId: root.Id, UserId: th.BasicUser.Id, Message: "reply"})
		require.Nil(t, appErr)
		rootIDs = append(rootIDs, root.Id)
	}

	postStore := th.App.Srv().Store().Post()
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, target := range []string{targetB.Id, targetC.Id} {
		go func() {
			<-start
			_, err := postStore.MoveThreadsToChannel(th.Context, rootIDs, target, th.BasicTeam.Id)
			results <- err
		}()
	}
	close(start)
	for range 2 {
		require.NoError(t, <-results)
	}

	// Whichever move committed last holds every row. Each channel's counter must equal the rows
	// it actually holds, so the six posts are counted exactly once rather than subtracted twice
	// from the source. The counters are read with SQL because Channel().Get() filters space
	// channels out by type.
	db := th.GetSqlStore().GetMaster()
	total := int64(0)
	for _, id := range []string{source.Id, targetB.Id, targetC.Id} {
		var counter, held int64
		require.NoError(t, db.Get(&counter, `SELECT TotalMsgCount FROM Channels WHERE Id = $1`, id))
		require.NoError(t, db.Get(&held,
			`SELECT COUNT(*) FROM Posts WHERE ChannelId = $1 AND OriginalId = '' AND DeleteAt = 0`, id))
		assert.Equal(t, held, counter, "channel %s counter must match the rows it holds", id)
		total += counter
	}
	assert.Equal(t, int64(6), total, "the six posts must be counted exactly once across the three channels")
}
