// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

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
		ok, isMember := th.App.SessionHasPermissionToReadPost(th.Context, session, chatPost.Id)
		assert.True(t, ok)
		assert.True(t, isMember, "the rejection must not cost a chat post its membership signal")
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
	mainHelper.Parallel(t)

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
		// Re-homing is attempted only against a post that already belongs to a page: the same
		// rewrite on a chat post would name a channel and a root that do not exist, so the
		// create would fail on the ids rather than on the clamp.
		if post.GetProp("page_id") != nil {
			replacement.ChannelId = model.NewId()
			replacement.RootId = model.NewId()
		}
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
		assert.Equal(t, space.Id, created.ChannelId, "a hook cannot move the post to another channel")
		assert.Empty(t, created.RootId, "a hook cannot re-parent the post into a thread")

		stored, appErr := th.App.GetSinglePost(th.Context, created.Id, false)
		require.Nil(t, appErr)
		assert.Equal(t, space.Id, stored.ChannelId, "the clamp holds in the stored row, not just the return value")
		assert.Empty(t, stored.RootId)
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

// TestPostsPageCommentPartialIndexCatalog pins the shape of the page-comment partial index from
// the catalog: the predicate is what keeps ordinary chat posts out of it entirely, which is the
// property the write-path cost argument rests on, and a predicate edit silently destroys it
// while every read test stays green.
func TestPostsPageCommentPartialIndexCatalog(t *testing.T) {
	mainHelper.Parallel(t)

	Setup(t)
	sqlStore := mainHelper.GetSQLStore()

	var predicate string
	err := sqlStore.GetMaster().Get(&predicate, `
		SELECT pg_get_expr(pg_index.indpred, pg_index.indrelid)
		FROM pg_index
		JOIN pg_class ON pg_class.oid = pg_index.indexrelid
		WHERE pg_class.relname = 'idx_posts_page_comment_page_id'`)
	require.NoError(t, err, "the partial index must exist after migrations")
	assert.Contains(t, predicate, "custom_page_comment")
	assert.Contains(t, predicate, "(rootid)::text = ''::text")
	assert.Contains(t, predicate, "(originalid)::text = ''::text")

	var expression string
	err = sqlStore.GetMaster().Get(&expression, `
		SELECT pg_get_expr(pg_index.indexprs, pg_index.indrelid)
		FROM pg_index
		JOIN pg_class ON pg_class.oid = pg_index.indexrelid
		WHERE pg_class.relname = 'idx_posts_page_comment_page_id'`)
	require.NoError(t, err)
	assert.Contains(t, expression, "page_id")

	var definition string
	err = sqlStore.GetMaster().Get(&definition, `
		SELECT pg_get_indexdef(pg_class.oid)
		FROM pg_class
		WHERE pg_class.relname = 'idx_posts_page_comment_page_id'`)
	require.NoError(t, err)
	assert.Regexp(t, `(?i)page_id.*,[[:space:]]*id\)`, definition,
		"Id must be the second index key so each bounded repair page can be read in keyset order")
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
		select {
		case err := <-results:
			require.NoError(t, err)
		case <-time.After(30 * time.Second):
			require.FailNow(t, "a concurrent move did not finish: the row locks are taken in conflicting orders")
		}
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

// TestBackingChannelBroadcastSuppression pins the effect the backing-channel guards on the post
// broadcast paths exist to produce: a space's posts never reach a chat client's websocket. Each
// case drives the suppressed path first and the equivalent chat path second, then asserts the
// first event off the wire carries the chat post. The chat event is a sentinel — it can only
// arrive after a suppressed one would have, so a restored broadcast fails the assertion without
// the test having to wait on a timeout. The listening user is a member of both channels, so
// absence is a decision by the guard rather than a broadcast that had no recipient.
func TestBackingChannelBroadcastSuppression(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	space := createSpaceChannelWithMember(t, th, th.BasicUser.Id)

	newSpacePost := func(t *testing.T) *model.Post {
		t.Helper()
		post, appErr := api.CreatePost(&model.Post{
			ChannelId: space.Id,
			UserId:    th.BasicUser.Id,
			Message:   "space comment",
		})
		require.Nil(t, appErr)
		return post
	}

	receivedPostID := func(t *testing.T, event *model.WebSocketEvent) string {
		t.Helper()
		payload, ok := event.GetData()["post"].(string)
		require.True(t, ok, "the event must carry a post payload")
		var post model.Post
		require.NoError(t, json.Unmarshal([]byte(payload), &post))
		return post.Id
	}

	t.Run("editing a backing-channel post publishes no post_edited event", func(t *testing.T) {
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventPostEdited})
		defer closeWS()

		spacePost := newSpacePost(t)
		spacePost.Message = "edited space comment"
		_, appErr := api.UpdatePost(spacePost)
		require.Nil(t, appErr)

		chatPost := th.CreatePost(t, th.BasicChannel)
		chatPost.Message = "edited chat post"
		_, _, appErr = th.App.UpdatePost(th.Context, chatPost, nil)
		require.Nil(t, appErr)

		var received *model.WebSocketEvent
		select {
		case received = <-messages:
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for the chat post's websocket event")
		}
		require.Equal(t, model.WebsocketEventPostEdited, received.EventType())
		assert.Equal(t, chatPost.Id, receivedPostID(t, received), "the only post_edited event must be the chat one")
	})

	t.Run("deleting a backing-channel post publishes no post_deleted event", func(t *testing.T) {
		messages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{model.WebsocketEventPostDeleted})
		defer closeWS()

		spacePost := newSpacePost(t)
		require.Nil(t, api.DeletePost(spacePost.Id))

		chatPost := th.CreatePost(t, th.BasicChannel)
		_, appErr := th.App.DeletePost(th.Context, chatPost.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		var received *model.WebSocketEvent
		select {
		case received = <-messages:
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for the chat post's websocket event")
		}
		require.Equal(t, model.WebsocketEventPostDeleted, received.EventType())
		assert.Equal(t, chatPost.Id, receivedPostID(t, received), "the only post_deleted event must be the chat one")
	})
}
