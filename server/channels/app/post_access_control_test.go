// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

const (
	// testPostPluginID matches the manifest SetupPluginAPI uses.
	testPostPluginID     = "pluginid"
	testPostResourceType = "page"
	testPostPolicyType   = testPostPluginID + ":" + testPostResourceType
	testPostAction       = "view"
)

func enablePostAccessControlResource(cfg *model.Config) {
	cfg.FeatureFlags.PostAccessControlResource = true
}

func testPostResource(resourceID string) string {
	return model.NewPostAccessControlResource(testPostPluginID, testPostResourceType, resourceID, testPostAction)
}

// plantPostPolicy stores a plugin policy row of the test type so the resource
// is governed rather than no_policy.
func plantPostPolicy(t *testing.T, th *TestHelper, resourceID string) {
	t.Helper()
	savePluginPolicyRow(t, th, &model.AccessControlPolicy{
		ID:      resourceID,
		Type:    testPostPolicyType,
		Name:    "Page policy",
		Version: model.AccessControlPolicyVersionV0_5,
		Active:  true,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{testPostAction},
			Expression: `user.attributes.dept == "eng"`,
		}},
	})
}

// mockPostPolicyDecisions arranges the engine to allow the listed users and
// deny everyone else for every evaluation.
func mockPostPolicyDecisions(t *testing.T, th *TestHelper, allowed ...string) *mocks.AccessControlServiceInterface {
	t.Helper()
	enablePluginAccessControl(t, th)
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	allowedSet := map[string]bool{}
	for _, id := range allowed {
		allowedSet[id] = true
	}
	mockACS.On("AccessEvaluation", mock.Anything, mock.AnythingOfType("model.AccessRequest")).
		Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
			return model.AccessDecision{Decision: allowedSet[req.Subject.ID]}
		}, nil).Maybe()
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
	return mockACS
}

func TestPluginAPICreatePostAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	api := th.SetupPluginAPI()

	t.Run("a marker naming the plugin is kept", func(t *testing.T) {
		value := testPostResource(model.NewId())
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "marked"}
		post.AddProp(model.PostPropsAccessControlResource, value)

		created, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		assert.Equal(t, value, created.GetAccessControlResource())

		stored, appErr := th.App.GetSinglePost(th.Context, created.Id, false)
		require.Nil(t, appErr)
		assert.Equal(t, value, stored.GetAccessControlResource())
	})

	t.Run("a marker naming another plugin is stripped", func(t *testing.T) {
		value := model.NewPostAccessControlResource("other-plugin", testPostResourceType, model.NewId(), testPostAction)
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "foreign"}
		post.AddProp(model.PostPropsAccessControlResource, value)

		created, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		assert.Empty(t, created.GetAccessControlResource())
	})

	t.Run("a malformed marker is stripped", func(t *testing.T) {
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "malformed"}
		post.AddProp(model.PostPropsAccessControlResource, testPostPluginID+":page:short:view")

		created, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		assert.Empty(t, created.GetAccessControlResource())
	})

	t.Run("a client-supplied marker is stripped by App.CreatePost", func(t *testing.T) {
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "client"}
		post.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))

		created, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		assert.Empty(t, created.GetAccessControlResource())
	})
}

func TestCreatePostAccessControlResourceReply(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	api := th.SetupPluginAPI()

	createMarkedRoot := func(t *testing.T) (*model.Post, string) {
		t.Helper()
		resourceID := model.NewId()
		value := testPostResource(resourceID)
		root := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "root"}
		root.AddProp(model.PostPropsAccessControlResource, value)
		root, appErr := api.CreatePost(root)
		require.Nil(t, appErr)
		return root, resourceID
	}

	t.Run("a reply inherits the root marker and an allowed poster may reply", func(t *testing.T) {
		root, resourceID := createMarkedRoot(t)
		plantPostPolicy(t, th, resourceID)
		mockPostPolicyDecisions(t, th, th.BasicUser2.Id)

		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "reply"}
		created, _, appErr := th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		assert.Equal(t, root.GetAccessControlResource(), created.GetAccessControlResource())
	})

	t.Run("a denied poster cannot reply", func(t *testing.T) {
		root, resourceID := createMarkedRoot(t)
		plantPostPolicy(t, th, resourceID)
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "reply"}
		created, _, appErr := th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{})
		require.NotNil(t, appErr)
		assert.Nil(t, created)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		assert.Equal(t, "api.post.access_control_resource.denied.app_error", appErr.Id)
	})

	t.Run("an evaluation failure denies the reply", func(t *testing.T) {
		root, resourceID := createMarkedRoot(t)
		plantPostPolicy(t, th, resourceID)
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "reply"}
		_, _, appErr := th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("a root with no policy accepts replies from anyone", func(t *testing.T) {
		root, _ := createMarkedRoot(t)
		// With the engine unavailable the existence probe resolves the
		// unplanted resource to no_policy, which allows.
		th.App.Srv().ch.AccessControl = nil

		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "reply"}
		created, _, appErr := th.App.CreatePost(th.Context, reply, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		assert.Equal(t, root.GetAccessControlResource(), created.GetAccessControlResource())
	})

	t.Run("a plugin reply is not evaluated", func(t *testing.T) {
		root, resourceID := createMarkedRoot(t)
		plantPostPolicy(t, th, resourceID)
		mockACS := mockPostPolicyDecisions(t, th)

		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "bot reply"}
		created, appErr := api.CreatePost(reply)
		require.Nil(t, appErr)
		assert.Equal(t, root.GetAccessControlResource(), created.GetAccessControlResource())
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}

func TestUpdatePostAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	api := th.SetupPluginAPI()

	createMarked := func(t *testing.T) (*model.Post, string) {
		t.Helper()
		value := testPostResource(model.NewId())
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "root"}
		post.AddProp(model.PostPropsAccessControlResource, value)
		post, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		return post, value
	}

	t.Run("a regular edit keeps the marker", func(t *testing.T) {
		post, value := createMarked(t)
		edit := post.Clone()
		edit.Message = "edited"
		edit.DelProp(model.PostPropsAccessControlResource)

		updated, _, appErr := th.App.UpdatePost(th.Context, edit, nil)
		require.Nil(t, appErr)
		assert.Equal(t, value, updated.GetAccessControlResource())
	})

	t.Run("a regular edit cannot replace the marker", func(t *testing.T) {
		post, value := createMarked(t)
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))

		updated, _, appErr := th.App.UpdatePost(th.Context, edit, nil)
		require.Nil(t, appErr)
		assert.Equal(t, value, updated.GetAccessControlResource())
	})

	t.Run("a regular edit cannot add a marker", func(t *testing.T) {
		post := th.CreatePost(t, th.BasicChannel)
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))

		updated, _, appErr := th.App.UpdatePost(th.Context, edit, nil)
		require.Nil(t, appErr)
		assert.Empty(t, updated.GetAccessControlResource())
	})

	t.Run("the owning plugin can replace the marker", func(t *testing.T) {
		post, _ := createMarked(t)
		replacement := testPostResource(model.NewId())
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, replacement)

		updated, appErr := api.UpdatePost(edit)
		require.Nil(t, appErr)
		assert.Equal(t, replacement, updated.GetAccessControlResource())
	})

	t.Run("the owning plugin can add a marker to an existing post", func(t *testing.T) {
		post := th.CreatePost(t, th.BasicChannel)
		value := testPostResource(model.NewId())
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, value)

		updated, appErr := api.UpdatePostWithOptions(edit, &model.UpdatePostOptions{})
		require.Nil(t, appErr)
		assert.Equal(t, value, updated.GetAccessControlResource())
	})

	t.Run("a plugin cannot write another plugin's marker even when it asks for the grant", func(t *testing.T) {
		post, value := createMarked(t)
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, model.NewPostAccessControlResource("other-plugin", testPostResourceType, model.NewId(), testPostAction))

		updated, appErr := api.UpdatePostWithOptions(edit, &model.UpdatePostOptions{AllowAccessControlResourceUpdate: true})
		require.Nil(t, appErr)
		assert.Equal(t, value, updated.GetAccessControlResource())
	})

	t.Run("a second plugin cannot replace the marker of the first", func(t *testing.T) {
		post, value := createMarked(t)
		otherAPI := NewPluginAPI(th.App, th.Context, &model.Manifest{Id: "other-plugin"})
		edit := post.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, model.NewPostAccessControlResource("other-plugin", testPostResourceType, model.NewId(), testPostAction))

		updated, appErr := otherAPI.UpdatePost(edit)
		require.Nil(t, appErr)
		assert.Equal(t, value, updated.GetAccessControlResource())

		replacement := testPostResource(model.NewId())
		edit = updated.Clone()
		edit.AddProp(model.PostPropsAccessControlResource, replacement)
		updated, appErr = api.UpdatePost(edit)
		require.Nil(t, appErr)
		assert.Equal(t, replacement, updated.GetAccessControlResource())
	})
}

func TestFilterPostsByAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	api := th.SetupPluginAPI()

	resourceID := model.NewId()
	value := testPostResource(resourceID)
	plantPostPolicy(t, th, resourceID)

	plain := th.CreatePost(t, th.BasicChannel)
	marked := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "marked"}
	marked.AddProp(model.PostPropsAccessControlResource, value)
	marked, appErr := api.CreatePost(marked)
	require.Nil(t, appErr)

	allowedCtx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser.Id, Roles: model.SystemUserRoleId})
	deniedCtx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id, Roles: model.SystemUserRoleId})

	t.Run("denied users do not see marked posts in channel pages", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		list, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		_, hasMarked := list.Posts[marked.Id]
		_, hasPlain := list.Posts[plain.Id]
		assert.False(t, hasMarked)
		assert.True(t, hasPlain)
		assert.NotContains(t, list.Order, marked.Id)

		list, appErr = th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser.Id})
		require.Nil(t, appErr)
		_, hasMarked = list.Posts[marked.Id]
		assert.True(t, hasMarked)
	})

	t.Run("the thread of a denied post is refused", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		_, appErr := th.App.GetPostThread(th.Context, marked.Id, model.GetPostsOptions{}, th.BasicUser2.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		list, appErr := th.App.GetPostThread(th.Context, marked.Id, model.GetPostsOptions{}, th.BasicUser.Id)
		require.Nil(t, appErr)
		_, ok := list.Posts[marked.Id]
		assert.True(t, ok)
	})

	t.Run("single-post authorization and read permission follow the policy", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		_, appErr, _ := th.App.GetPostIfAuthorized(deniedCtx, marked.Id, deniedCtx.Session(), false)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		post, appErr, _ := th.App.GetPostIfAuthorized(allowedCtx, marked.Id, allowedCtx.Session(), false)
		require.Nil(t, appErr)
		assert.Equal(t, marked.Id, post.Id)

		ok, _ := th.App.SessionHasPermissionToReadPost(deniedCtx, *deniedCtx.Session(), marked.Id)
		assert.False(t, ok)
		ok, _ = th.App.SessionHasPermissionToReadPost(allowedCtx, *allowedCtx.Session(), marked.Id)
		assert.True(t, ok)
		ok, _ = th.App.SessionHasPermissionToReadPost(deniedCtx, *deniedCtx.Session(), plain.Id)
		assert.True(t, ok, "unmarked posts are unaffected")
	})

	t.Run("reactions and acknowledgements are refused for denied users", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		_, appErr := th.App.SaveReactionForPost(deniedCtx, &model.Reaction{UserId: th.BasicUser2.Id, PostId: marked.Id, EmojiName: "smile"})
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)

		_, appErr = th.App.SaveAcknowledgementForPost(deniedCtx, marked.Id, th.BasicUser2.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	t.Run("an evaluation failure denies", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		list, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser.Id})
		require.Nil(t, appErr)
		_, hasMarked := list.Posts[marked.Id]
		assert.False(t, hasMarked)
	})

	t.Run("a governed post whose policy cannot be evaluated is hidden", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil

		list, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser.Id})
		require.Nil(t, appErr)
		_, hasMarked := list.Posts[marked.Id]
		assert.False(t, hasMarked)
	})

	t.Run("a marker with no policy is visible to everyone", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		unplanted := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "no policy"}
		unplanted.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))
		unplanted, appErr := api.CreatePost(unplanted)
		require.Nil(t, appErr)

		list, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		_, ok := list.Posts[unplanted.Id]
		assert.True(t, ok)
	})

	t.Run("an empty user id leaves the list untouched", func(t *testing.T) {
		list := model.NewPostList()
		list.AddPost(marked)
		list.AddOrder(marked.Id)
		th.App.filterPostsByAccessControlResource(th.Context, "", list)
		assert.Len(t, list.Posts, 1)
	})

	t.Run("thread responses are filtered by their root", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)
		threads := []*model.ThreadResponse{
			{PostId: marked.Id, Post: marked},
			{PostId: plain.Id, Post: plain},
		}
		kept := th.App.filterThreadsByAccessControlResource(th.Context, th.BasicUser2.Id, threads)
		require.Len(t, kept, 1)
		assert.Equal(t, plain.Id, kept[0].PostId)
	})
}

// followedThreadForUser saves a root post in the basic channel, replies to it as
// BasicUser, and makes viewer follow it with one unread mention. The marker is
// written through the store so the test does not depend on the create path.
func followedThreadForUser(t *testing.T, th *TestHelper, viewerID, marker string) *model.Post {
	t.Helper()
	root := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "root"}
	if marker != "" {
		root.AddProp(model.PostPropsAccessControlResource, marker)
	}
	root, err := th.App.Srv().Store().Post().Save(th.Context, root)
	require.NoError(t, err)
	_, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
		UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, RootId: root.Id, Message: "reply",
	})
	require.NoError(t, err)
	_, err = th.App.Srv().Store().Thread().MaintainMembership(viewerID, root.Id, store.ThreadMembershipOpts{
		Following:         true,
		IncrementMentions: true,
		UpdateFollowing:   true,
	})
	require.NoError(t, err)
	return root
}

func TestGetThreadsForUserAccessControlResourceTotals(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	viewer := th.BasicUser2

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	plain := followedThreadForUser(t, th, viewer.Id, "")
	marked := followedThreadForUser(t, th, viewer.Id, testPostResource(resourceID))

	threadIDs := func(threads *model.Threads) []string {
		ids := []string{}
		for _, thread := range threads.Threads {
			ids = append(ids, thread.PostId)
		}
		return ids
	}

	t.Run("an allowed user counts every thread", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, viewer.Id)

		threads, appErr := th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, int64(2), threads.Total)
		assert.Equal(t, int64(2), threads.TotalUnreadThreads)
		assert.Equal(t, int64(2), threads.TotalUnreadMentions)
		assert.ElementsMatch(t, []string{plain.Id, marked.Id}, threadIDs(threads))
	})

	t.Run("a denied thread is left out of the page and every total", func(t *testing.T) {
		mockPostPolicyDecisions(t, th, th.BasicUser.Id)

		threads, appErr := th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), threads.Total)
		assert.Equal(t, int64(1), threads.TotalUnreadThreads)
		assert.Equal(t, int64(1), threads.TotalUnreadMentions)
		assert.Equal(t, []string{plain.Id}, threadIDs(threads))

		threads, appErr = th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{Unread: true})
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), threads.Total)

		threads, appErr = th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{TotalsOnly: true})
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), threads.Total)
		assert.Empty(t, threads.Threads)

		threads, appErr = th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{ThreadsOnly: true})
		require.Nil(t, appErr)
		assert.Equal(t, []string{plain.Id}, threadIDs(threads))
	})

	t.Run("a denied thread is left out of the team unread counts", func(t *testing.T) {
		teamUnread := func(t *testing.T) *model.TeamUnread {
			t.Helper()
			unreads, appErr := th.App.GetTeamsUnreadForUser(th.Context, "", viewer.Id, true)
			require.Nil(t, appErr)
			for _, unread := range unreads {
				if unread.TeamId == th.BasicTeam.Id {
					return unread
				}
			}
			require.Fail(t, "team unread not found")
			return nil
		}

		mockPostPolicyDecisions(t, th, viewer.Id)
		unread := teamUnread(t)
		assert.Equal(t, int64(2), unread.ThreadCount)
		assert.Equal(t, int64(2), unread.ThreadMentionCount)

		mockPostPolicyDecisions(t, th, th.BasicUser.Id)
		unread = teamUnread(t)
		assert.Equal(t, int64(1), unread.ThreadCount)
		assert.Equal(t, int64(1), unread.ThreadMentionCount)
	})

	t.Run("an evaluation failure denies the thread", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "boom", nil, "", http.StatusInternalServerError))

		threads, appErr := th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, int64(1), threads.Total)
		assert.Equal(t, int64(1), threads.TotalUnreadMentions)
	})
}

func TestGetThreadsForUserAccessControlResourceFlagOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	require.False(t, th.App.Config().FeatureFlags.PostAccessControlResource)
	viewer := th.BasicUser2

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	mockACS := mockPostPolicyDecisions(t, th, th.BasicUser.Id)
	followedThreadForUser(t, th, viewer.Id, "")
	followedThreadForUser(t, th, viewer.Id, testPostResource(resourceID))

	threads, appErr := th.App.GetThreadsForUser(th.Context, viewer.Id, th.BasicTeam.Id, model.GetUserThreadsOpts{})
	require.Nil(t, appErr)
	assert.Equal(t, int64(2), threads.Total)
	assert.Equal(t, int64(2), threads.TotalUnreadThreads)
	assert.Equal(t, int64(2), threads.TotalUnreadMentions)
	assert.Len(t, threads.Threads, 2)

	unreads, appErr := th.App.GetTeamsUnreadForUser(th.Context, "", viewer.Id, true)
	require.Nil(t, appErr)
	require.Len(t, unreads, 1)
	assert.Equal(t, int64(2), unreads[0].ThreadCount)
	assert.Equal(t, int64(2), unreads[0].ThreadMentionCount)
	mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
}

func TestMoveThreadRefusesAccessControlResource(t *testing.T) {
	th := SetupConfig(t, enablePostAccessControlResource).InitBasic(t)
	api := th.SetupPluginAPI()
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.WranglerSettings.MoveThreadFromPrivateChannelEnable = true
		*cfg.WranglerSettings.MoveThreadFromDirectMessageChannelEnable = true
		*cfg.WranglerSettings.MoveThreadFromGroupMessageChannelEnable = true
	})

	root := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "root"}
	root.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))
	root, appErr := api.CreatePost(root)
	require.Nil(t, appErr)

	target := th.CreateChannel(t, th.BasicTeam)
	appErr = th.App.MoveThread(th.Context, root.Id, th.BasicChannel.Id, target.Id, th.BasicUser)
	require.NotNil(t, appErr)
	assert.Equal(t, "api.post.move_thread.access_control_resource.app_error", appErr.Id)

	unmarkedRoot := th.CreatePost(t, th.BasicChannel)
	reply := th.CreatePostReply(t, unmarkedRoot)
	require.Empty(t, reply.GetAccessControlResource())
	stamp := unmarkedRoot.Clone()
	stamp.AddProp(model.PostPropsAccessControlResource, testPostResource(model.NewId()))
	_, appErr = api.UpdatePost(stamp)
	require.Nil(t, appErr)

	appErr = th.App.MoveThread(th.Context, reply.Id, th.BasicChannel.Id, target.Id, th.BasicUser)
	require.NotNil(t, appErr)
	assert.Equal(t, "api.post.move_thread.access_control_resource.app_error", appErr.Id)
}

// TestPostAccessControlResourceFlagOff pins that with the feature flag off a
// post's access_control_resource is neither granted to plugins nor enforced.
func TestPostAccessControlResourceFlagOff(t *testing.T) {
	th := Setup(t).InitBasic(t)
	require.False(t, th.App.Config().FeatureFlags.PostAccessControlResource)
	api := th.SetupPluginAPI()

	resourceID := model.NewId()
	value := testPostResource(resourceID)
	plantPostPolicy(t, th, resourceID)
	mockPostPolicyDecisions(t, th, th.BasicUser.Id)

	t.Run("a plugin marker is stripped", func(t *testing.T) {
		post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "marked"}
		post.AddProp(model.PostPropsAccessControlResource, value)

		created, appErr := api.CreatePost(post)
		require.Nil(t, appErr)
		assert.Empty(t, created.GetAccessControlResource())

		update := created.Clone()
		update.AddProp(model.PostPropsAccessControlResource, value)
		updated, appErr := api.UpdatePost(update)
		require.Nil(t, appErr)
		assert.Empty(t, updated.GetAccessControlResource())
	})

	marked := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "marked in the store"}
	marked.AddProp(model.PostPropsAccessControlResource, value)
	marked, err := th.App.Srv().Store().Post().Save(th.Context, marked)
	require.NoError(t, err)

	deniedCtx := request.TestContext(t).WithSession(&model.Session{UserId: th.BasicUser2.Id, Roles: model.SystemUserRoleId})

	t.Run("a marked post is readable by a user the policy denies", func(t *testing.T) {
		list, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: th.BasicChannel.Id, Page: 0, PerPage: 60, UserId: th.BasicUser2.Id})
		require.Nil(t, appErr)
		assert.Contains(t, list.Posts, marked.Id)

		_, appErr = th.App.GetPostThread(th.Context, marked.Id, model.GetPostsOptions{}, th.BasicUser2.Id)
		require.Nil(t, appErr)

		_, appErr, _ = th.App.GetPostIfAuthorized(deniedCtx, marked.Id, deniedCtx.Session(), false)
		require.Nil(t, appErr)

		hasPermission, _ := th.App.SessionHasPermissionToReadPost(deniedCtx, *deniedCtx.Session(), marked.Id)
		assert.True(t, hasPermission)

		assert.True(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser2.Id, value))
		assert.Nil(t, th.App.accessControlRecipientFilter(th.Context, value))
		assert.Zero(t, th.App.ch.accessControlRecipients.len())
	})

	t.Run("a reply does not inherit the marker", func(t *testing.T) {
		reply := &model.Post{UserId: th.BasicUser2.Id, ChannelId: th.BasicChannel.Id, RootId: marked.Id, Message: "reply"}
		created, _, appErr := th.App.CreatePost(deniedCtx, reply, th.BasicChannel, model.CreatePostFlags{})
		require.Nil(t, appErr)
		assert.Empty(t, created.GetAccessControlResource())
	})

	t.Run("the websocket hook is not registered", func(t *testing.T) {
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		th.App.setupBroadcastHookForAccessControlResource(marked, message)
		assert.Empty(t, message.GetBroadcast().BroadcastHooks)
	})
}
