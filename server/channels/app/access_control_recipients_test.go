// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	platform_mocks "github.com/mattermost/mattermost/server/v8/channels/app/platform/mocks"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestAccessControlRecipientCache(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("stores, hits and expires", func(t *testing.T) {
		now := time.Now()
		c := newAccessControlRecipientCache(10, time.Minute)
		c.now = func() time.Time { return now }

		key := testPostResource(model.NewId())
		_, hit := c.lookup(key)
		assert.False(t, hit)

		c.store(key, accessControlRecipientEntry{allow: map[string]struct{}{"u1": {}}})
		entry, hit := c.lookup(key)
		require.True(t, hit)
		_, ok := entry.allow["u1"]
		assert.True(t, ok)

		now = now.Add(time.Minute + time.Second)
		_, hit = c.lookup(key)
		assert.False(t, hit, "entries expire after the TTL")
		assert.Equal(t, 0, c.len())
	})

	t.Run("evicts the least recently used entry", func(t *testing.T) {
		c := newAccessControlRecipientCache(2, time.Minute)
		a, b, d := testPostResource(model.NewId()), testPostResource(model.NewId()), testPostResource(model.NewId())
		c.store(a, accessControlRecipientEntry{})
		c.store(b, accessControlRecipientEntry{})
		_, hit := c.lookup(a) // a is now most recent
		require.True(t, hit)
		c.store(d, accessControlRecipientEntry{})

		_, hit = c.lookup(b)
		assert.False(t, hit)
		_, hit = c.lookup(a)
		assert.True(t, hit)
		_, hit = c.lookup(d)
		assert.True(t, hit)
	})

	t.Run("invalidate drops every action of a resource and nothing else", func(t *testing.T) {
		c := newAccessControlRecipientCache(10, time.Minute)
		resourceID, otherID := model.NewId(), model.NewId()
		view := model.NewPostAccessControlResource(testPostPluginID, testPostResourceType, resourceID, "view")
		edit := model.NewPostAccessControlResource(testPostPluginID, testPostResourceType, resourceID, "edit")
		other := testPostResource(otherID)
		c.store(view, accessControlRecipientEntry{})
		c.store(edit, accessControlRecipientEntry{})
		c.store(other, accessControlRecipientEntry{})

		assert.Equal(t, 2, c.invalidate(resourceID))
		_, hit := c.lookup(view)
		assert.False(t, hit)
		_, hit = c.lookup(edit)
		assert.False(t, hit)
		_, hit = c.lookup(other)
		assert.True(t, hit)
		assert.Equal(t, 0, c.invalidate(model.NewId()))
	})
}

func TestAccessControlRecipientFill(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("a governed resource is filled by paging QueryUsersForResource", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		resourceID := model.NewId()
		plantPostPolicy(t, th, resourceID)
		value := testPostResource(resourceID)

		firstPage := make([]*model.User, 0, accessControlRecipientPageSize)
		for range accessControlRecipientPageSize {
			firstPage = append(firstPage, &model.User{Id: model.NewId()})
		}
		last := firstPage[len(firstPage)-1].Id
		secondPage := []*model.User{{Id: th.BasicUser.Id}}

		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.Cursor.TargetID == "" && opts.IgnoreCount && opts.Limit == accessControlRecipientPageSize
		})).Return(firstPage, int64(0), nil).Once()
		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.Cursor.TargetID == last
		})).Return(secondPage, int64(0), nil).Once()

		filter := th.App.accessControlRecipientFilter(th.Context, value)
		require.NotNil(t, filter)
		assert.True(t, filter(th.BasicUser.Id))
		assert.True(t, filter(firstPage[0].Id))
		assert.False(t, filter(th.BasicUser2.Id))
		mockACS.AssertExpectations(t)

		// A second call is served from the cache.
		filter = th.App.accessControlRecipientFilter(th.Context, value)
		require.NotNil(t, filter)
		assert.True(t, filter(th.BasicUser.Id))
		mockACS.AssertNumberOfCalls(t, "QueryUsersForResource", 2)

		assert.True(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser.Id, value))
		assert.False(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser2.Id, value))
	})

	t.Run("a resource with no policy needs no filtering", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		value := testPostResource(model.NewId())
		assert.Nil(t, th.App.accessControlRecipientFilter(th.Context, value))
		assert.True(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser2.Id, value))
		mockACS.AssertNotCalled(t, "QueryUsersForResource", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("a foreign-type row is no_policy for the marker's plugin", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		foreign := validForeignTypePolicy(model.NewId())
		savePluginPolicyRow(t, th, foreign)
		assert.Nil(t, th.App.accessControlRecipientFilter(th.Context, testPostResource(foreign.ID)))
	})

	t.Run("an unmarked post needs no filtering", func(t *testing.T) {
		assert.Nil(t, th.App.accessControlRecipientFilter(th.Context, ""))
	})

	t.Run("a failed fill is cached negatively and falls back to per-user evaluation", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		resourceID := model.NewId()
		plantPostPolicy(t, th, resourceID)
		value := testPostResource(resourceID)

		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.Anything).
			Return(nil, int64(0), model.NewAppError("QueryUsersForResource", "boom", nil, "", http.StatusInternalServerError)).Once()
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == th.BasicUser.Id && req.Resource.ID == resourceID
		})).Return(model.AccessDecision{Decision: true}, nil)
		mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
			return req.Subject.ID == th.BasicUser2.Id && req.Resource.ID == resourceID
		})).Return(model.AccessDecision{Decision: false}, nil)

		filter := th.App.accessControlRecipientFilter(th.Context, value)
		require.NotNil(t, filter)
		assert.True(t, filter(th.BasicUser.Id))
		assert.False(t, filter(th.BasicUser2.Id))

		// The negative entry keeps the query from being retried within the TTL.
		filter = th.App.accessControlRecipientFilter(th.Context, value)
		require.NotNil(t, filter)
		assert.True(t, filter(th.BasicUser.Id))
		mockACS.AssertNumberOfCalls(t, "QueryUsersForResource", 1)
	})

	t.Run("an unavailable engine is a negative entry", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		resourceID := model.NewId()
		plantPostPolicy(t, th, resourceID)
		value := testPostResource(resourceID)

		entry := th.App.accessControlRecipientEntryFor(th.Context, value)
		assert.True(t, entry.failed)
		// Per-user fallback cannot evaluate a governed policy either, so it denies.
		assert.False(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser.Id, value))
		mockACS.AssertNotCalled(t, "QueryUsersForResource", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("concurrent misses share one fill", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		resourceID := model.NewId()
		plantPostPolicy(t, th, resourceID)
		value := testPostResource(resourceID)

		var calls atomic.Int32
		release := make(chan struct{})
		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.Anything).
			Run(func(mock.Arguments) {
				calls.Add(1)
				<-release
			}).
			Return([]*model.User{{Id: th.BasicUser.Id}}, int64(0), nil)

		var wg sync.WaitGroup
		results := make([]bool, 8)
		for i := range results {
			wg.Go(func() {
				results[i] = th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser.Id, value)
			})
		}
		// Let every goroutine reach the fill before releasing it.
		require.Eventually(t, func() bool { return calls.Load() == 1 }, 2*time.Second, 5*time.Millisecond)
		time.Sleep(20 * time.Millisecond)
		close(release)
		wg.Wait()

		assert.Equal(t, int32(1), calls.Load())
		for _, allowed := range results {
			assert.True(t, allowed)
		}
	})

	t.Run("saving or deleting the policy invalidates locally", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })

		resourceID := model.NewId()
		plantPostPolicy(t, th, resourceID)
		value := testPostResource(resourceID)

		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.Anything).
			Return([]*model.User{{Id: th.BasicUser.Id}}, int64(0), nil).Once()
		require.True(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser.Id, value))
		_, hit := th.App.ch.accessControlRecipients.lookup(value)
		require.True(t, hit)

		th.App.invalidateAccessControlRecipients(resourceID)
		_, hit = th.App.ch.accessControlRecipients.lookup(value)
		assert.False(t, hit)

		// The cluster handler performs the same local drop.
		mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.Anything).
			Return([]*model.User{{Id: th.BasicUser.Id}}, int64(0), nil).Once()
		require.True(t, th.App.HasAccessToAccessControlResource(th.Context, th.BasicUser.Id, value))
		data, err := json.Marshal(accessControlRecipientInvalidation{PolicyID: resourceID})
		require.NoError(t, err)
		th.App.ch.clusterInvalidateAccessControlRecipientsHandler(&model.ClusterMessage{
			Event: model.ClusterEventInvalidateCacheForAccessControlResourceRecipients,
			Data:  data,
		})
		_, hit = th.App.ch.accessControlRecipients.lookup(value)
		assert.False(t, hit)

		// Garbage and empty IDs are ignored.
		th.App.ch.clusterInvalidateAccessControlRecipientsHandler(&model.ClusterMessage{Data: []byte("nope")})
		th.App.ch.clusterInvalidateAccessControlRecipientsHandler(&model.ClusterMessage{Data: []byte(`{"policy_id":""}`)})
	})
}

// TestPluginPolicyWritesInvalidateRecipients pins that saving or deleting a
// plugin policy drops the cached recipient entry for its resource.
func TestPluginPolicyWritesInvalidateRecipients(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)
	enablePluginAccessControl(t, th)
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	actingUserID := th.BasicUser.Id

	resourceID := model.NewId()
	value := testPostResource(resourceID)
	policy := &model.AccessControlPolicy{
		ID:      resourceID,
		Type:    testPostPolicyType,
		Name:    "Page policy",
		Version: model.AccessControlPolicyVersionV0_5,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{testPostAction},
			Expression: `user.attributes.dept == "eng"`,
		}},
	}

	// Prime an entry for the (not yet governed) resource.
	assert.Nil(t, th.App.accessControlRecipientFilter(th.Context, value))
	entry, hit := th.App.ch.accessControlRecipients.lookup(value)
	require.True(t, hit)
	require.True(t, entry.noPolicy)

	mockACS.On("GetPolicy", mock.Anything, resourceID).Return(nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound)).Once()
	mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
		Return([]*model.User{{Id: actingUserID}}, int64(1), nil).Once()
	mockACS.On("SavePolicy", mock.Anything, mock.Anything).Return(policy, nil).Once()
	_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testPostPluginID, actingUserID, policy)
	require.Nil(t, appErr)
	_, hit = th.App.ch.accessControlRecipients.lookup(value)
	assert.False(t, hit, "save drops the stale no_policy entry")

	th.App.ch.accessControlRecipients.store(value, accessControlRecipientEntry{allow: map[string]struct{}{}})
	savePluginPolicyRow(t, th, policy)
	mockACS.On("DeletePolicy", mock.Anything, resourceID).Return(nil).Once()
	appErr = th.App.DeletePluginAccessControlPolicy(th.Context, testPostPluginID, actingUserID, testPostPolicyType, resourceID)
	require.Nil(t, appErr)
	_, hit = th.App.ch.accessControlRecipients.lookup(value)
	assert.False(t, hit, "delete drops the entry")
	mockACS.AssertExpectations(t)
}

func TestPruneNotificationRecipients(t *testing.T) {
	mainHelper.Parallel(t)

	sender := &model.User{Id: model.NewId(), Username: "sender"}
	allowed := &model.User{Id: model.NewId(), Username: "allowed"}
	denied := &model.User{Id: model.NewId(), Username: "denied"}

	profileMap := map[string]*model.User{sender.Id: sender, allowed.Id: allowed, denied.Id: denied}
	notifyProps := map[string]model.StringMap{sender.Id: {}, allowed.Id: {}, denied.Id: {}}
	followers := model.StringSet{}
	followers.Add(sender.Id)
	followers.Add(allowed.Id)
	followers.Add(denied.Id)

	// The predicate rejects the sender too, to prove the sender is kept regardless.
	pruned := pruneNotificationRecipients(func(userID string) bool { return userID == allowed.Id }, sender.Id, profileMap, notifyProps, followers)

	assert.Equal(t, map[string]struct{}{"denied": {}}, pruned)
	assert.Len(t, profileMap, 2)
	assert.Contains(t, profileMap, sender.Id)
	assert.Contains(t, profileMap, allowed.Id)
	assert.NotContains(t, notifyProps, denied.Id)
	assert.Contains(t, notifyProps, sender.Id)
	assert.False(t, followers.Has(denied.Id))
	assert.True(t, followers.Has(allowed.Id))

	assert.Equal(t, []string{"someone", "else"}, dropPrunedPotentialMentions([]string{"someone", "denied", "else"}, pruned))
	assert.Equal(t, []string{"denied"}, dropPrunedPotentialMentions([]string{"denied"}, nil))
}

func TestSendNotificationsAccessControlResource(t *testing.T) {
	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPI()
	_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, th.BasicChannel, false)
	require.Nil(t, appErr)

	resourceID := model.NewId()
	plantPostPolicy(t, th, resourceID)
	value := testPostResource(resourceID)

	enablePluginAccessControl(t, th)
	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = nil })
	mockACS.On("QueryUsersForResource", mock.Anything, resourceID, testPostAction, mock.Anything).
		Return([]*model.User{{Id: th.BasicUser.Id}}, int64(0), nil)

	post := &model.Post{UserId: th.BasicUser.Id, ChannelId: th.BasicChannel.Id, Message: "@" + th.BasicUser2.Username + " can you see this?"}
	post.AddProp(model.PostPropsAccessControlResource, value)
	post, appErr = api.CreatePost(post)
	require.Nil(t, appErr)

	mentioned, err := th.App.SendNotifications(th.Context, post, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
	require.NoError(t, err)
	assert.NotContains(t, mentioned, th.BasicUser2.Id, "a denied member is not notified")

	// The same post with no marker reaches the mentioned member.
	plain := th.CreatePost(t, th.BasicChannel, func(p *model.Post) { p.Message = "@" + th.BasicUser2.Username + " and now?" })
	mentioned, err = th.App.SendNotifications(th.Context, plain, th.BasicTeam, th.BasicChannel, th.BasicUser, nil, true)
	require.NoError(t, err)
	assert.Contains(t, mentioned, th.BasicUser2.Id)
}

func TestAccessControlResourceBroadcastHook_Process(t *testing.T) {
	mainHelper.Parallel(t)
	hook := &accessControlResourceBroadcastHook{}
	userID := model.NewId()
	value := testPostResource(model.NewId())

	makeMessage := func() *platform.HookedWebSocketEvent {
		event := model.NewWebSocketEvent(model.WebsocketEventPosted, "", model.NewId(), "", nil, "")
		event.Add("post", "{}")
		return platform.MakeHookedWebSocketEvent(event)
	}

	makeWebConn := func(allowed bool, withSession bool) *platform.WebConn {
		mockSuite := &platform_mocks.SuiteIFace{}
		mockSuite.On("HasAccessToAccessControlResource", mock.Anything, userID, value).Return(allowed).Maybe()
		wc := &platform.WebConn{
			UserId:   userID,
			Platform: &platform.PlatformService{},
			Suite:    mockSuite,
		}
		if withSession {
			wc.SetSession(&model.Session{UserId: userID, Roles: model.SystemUserRoleId})
		}
		return wc
	}

	t.Run("allowed recipients receive the event", func(t *testing.T) {
		msg := makeMessage()
		require.NoError(t, hook.Process(msg, makeWebConn(true, true), map[string]any{"resource": value}))
		assert.False(t, msg.Event().IsRejected())
	})

	t.Run("denied recipients are rejected", func(t *testing.T) {
		msg := makeMessage()
		require.NoError(t, hook.Process(msg, makeWebConn(false, true), map[string]any{"resource": value}))
		assert.True(t, msg.Event().IsRejected())
	})

	t.Run("a connection without a session is rejected", func(t *testing.T) {
		msg := makeMessage()
		require.NoError(t, hook.Process(msg, makeWebConn(true, false), map[string]any{"resource": value}))
		assert.True(t, msg.Event().IsRejected())
	})

	t.Run("a missing resource argument is an error", func(t *testing.T) {
		msg := makeMessage()
		require.Error(t, hook.Process(msg, makeWebConn(true, true), map[string]any{}))
	})

	t.Run("only marked posts register the hook", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		message := model.NewWebSocketEvent(model.WebsocketEventPosted, "", "", "", nil, "")
		th.App.setupBroadcastHookForAccessControlResource(&model.Post{}, message)
		assert.Empty(t, message.GetBroadcast().BroadcastHooks)

		post := &model.Post{}
		post.AddProp(model.PostPropsAccessControlResource, value)
		th.App.setupBroadcastHookForAccessControlResource(post, message)
		require.Len(t, message.GetBroadcast().BroadcastHooks, 1)
		assert.Equal(t, broadcastAccessControlResource, message.GetBroadcast().BroadcastHooks[0])
		assert.Equal(t, value, message.GetBroadcast().BroadcastHookArgs[0]["resource"])
	})
}
