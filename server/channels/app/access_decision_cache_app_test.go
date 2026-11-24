// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

type accessDecisionCacheHarness struct {
	*channelReadAccessHarness
	acs     *eMocks.AccessControlServiceInterface
	session *model.Session
}

// setupAccessDecisionCacheTest governs channel read access with a system policy whose PDP
// always allows, so each test counts how often the PDP is actually asked.
func setupAccessDecisionCacheTest(t *testing.T) *accessDecisionCacheHarness {
	t.Helper()
	h := setupChannelReadAccessTest(t)
	acs := h.mockACS(t)
	governed(acs)
	channelPolicyGoverns(acs, h.th.BasicChannel.Id, false)
	return &accessDecisionCacheHarness{channelReadAccessHarness: h, acs: acs, session: h.rctx.Session()}
}

// check runs a read-access check in a fresh request, so the per-request memo never answers.
func (h *accessDecisionCacheHarness) check(t *testing.T) bool {
	t.Helper()
	return h.th.App.HasChannelReadAccess(h.th.Context.WithSession(h.session), h.th.BasicUser.Id, h.th.BasicChannel)
}

func (h *accessDecisionCacheHarness) evaluations() int {
	n := 0
	for _, call := range h.acs.Calls {
		if call.Method == "AccessEvaluation" {
			n++
		}
	}
	return n
}

func TestAccessDecisionCacheChannelReadAccess(t *testing.T) {
	t.Run("a second check is served from the cache", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)

		require.True(t, h.check(t))
		require.True(t, h.check(t))
		require.Equal(t, 1, h.evaluations())
	})

	t.Run("denies are cached", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, false)

		require.False(t, h.check(t))
		require.False(t, h.check(t))
		require.Equal(t, 1, h.evaluations())
	})

	t.Run("an evaluation error is not cached", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).
			Return(model.AccessDecision{}, model.NewAppError("test", "app.pdp.access_evaluation.app_error", nil, "", http.StatusInternalServerError)).Once()
		decides(h.acs, true)

		require.False(t, h.check(t), "an error denies")
		require.True(t, h.check(t), "and is asked again")
		require.Equal(t, 2, h.evaluations())
	})

	t.Run("another session of the same user is a separate decision", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)
		require.True(t, h.check(t))

		other, appErr := h.th.App.CreateSession(h.th.Context, &model.Session{UserId: h.th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		require.True(t, h.th.App.HasChannelReadAccess(h.th.Context.WithSession(other), h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, 2, h.evaluations())
	})

	t.Run("checks on another user's behalf are cached under that user", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)

		rctx := h.th.Context.WithSession(h.session)
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser2.Id, h.th.BasicChannel))
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser2.Id, h.th.BasicChannel))
		require.Equal(t, 1, h.evaluations())

		// The session's own user is a different subject.
		require.True(t, h.check(t))
		require.Equal(t, 2, h.evaluations())
	})

	t.Run("a session without an ID is cached as the user", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)

		// Background jobs such as recaps build a stand-in with only the user ID.
		standIn := &model.Session{UserId: h.th.BasicUser.Id}
		rctx := h.th.Context.WithSession(standIn)
		require.Equal(t, accessSubjectRef{kind: accessSubjectUser, subjectID: h.th.BasicUser.Id, userID: h.th.BasicUser.Id},
			accessSubjectRefFor(rctx, h.th.BasicUser.Id))
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, 1, h.evaluations())

		// The same entry serves a check made on the user's behalf by someone else.
		other := h.th.Context.WithSession(&model.Session{Id: model.NewId(), UserId: h.th.BasicUser2.Id})
		require.True(t, h.th.App.HasChannelReadAccess(other, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, 1, h.evaluations())
	})

	t.Run("write access is not cached yet", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		h.acs.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).Return(true, nil)
		h.acs.On("ResourcePolicyGovernsAction", mock.Anything, h.th.BasicChannel.Id, model.AccessControlPolicyActionChannelWriteAccess).Return(false, nil)
		decides(h.acs, true)

		rctx := h.th.Context.WithSession(h.session)
		ref := accessSubjectRefFor(rctx, h.th.BasicUser.Id)
		require.True(t, h.th.App.evaluateChannelAccess(rctx, ref, h.th.BasicChannel, model.AccessControlPolicyActionChannelWriteAccess))
		require.True(t, h.th.App.evaluateChannelAccess(rctx, ref, h.th.BasicChannel, model.AccessControlPolicyActionChannelWriteAccess))
		require.Equal(t, 2, h.evaluations())
	})
}

// TestAccessDecisionCacheInvalidationSources checks that each source in the invalidation
// inventory makes the next read-access check ask the PDP again.
func TestAccessDecisionCacheInvalidationSources(t *testing.T) {
	cases := []struct {
		name       string
		invalidate func(t *testing.T, h *accessDecisionCacheHarness)
	}{
		{"user record changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser.Id)
		}},
		{"session roles change", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.Srv().Platform().ClearUserSessionCache(h.th.BasicUser.Id)
		}},
		{"all sessions cleared", func(t *testing.T, h *accessDecisionCacheHarness) {
			require.NoError(t, h.th.App.Srv().Platform().ClearAllUsersSessionCache())
		}},
		{"user attribute values change", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, h.th.BasicUser.Id)
		}},
		{"user attribute values change in bulk", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
				{TargetType: model.PropertyFieldObjectTypeUser, TargetID: h.th.BasicUser.Id},
			})
		}},
		{"channel attribute values change", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
				{TargetType: model.PropertyFieldObjectTypeChannel, TargetID: h.th.BasicChannel.Id},
			})
		}},
		{"a channel attribute value is deleted", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, h.th.BasicChannel.Id)
		}},
		{"every user's attributes change", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateAllUserAttributeCaches()
		}},
		{"session attributes change", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.invalidateAccessDecisionsForSession(h.session.Id)
		}},
		{"session attributes are invalidated by platform", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.Srv().Channels().InvalidateAccessDecisionsForSession(h.session.Id, true)
		}},
		{"a peer's changed session attributes arrive", func(t *testing.T, h *accessDecisionCacheHarness) {
			clusterUpdateSessionAttributes(t, h, true)
		}},
		{"a session attribute field changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			group, err := h.th.App.Srv().propertyService.Group(model.SessionAttributesPropertyGroupName)
			require.NoError(t, err)
			h.th.App.invalidateAccessDecisionsForSessionAttributeFields(group.ID)
		}},
		{"the channel role changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			_, appErr := h.th.App.UpdateChannelMemberSchemeRoles(h.th.Context, h.th.BasicChannel.Id, h.th.BasicUser.Id, false, true, true)
			require.Nil(t, appErr)
		}},
		{"the user leaves and rejoins the channel", func(t *testing.T, h *accessDecisionCacheHarness) {
			require.NoError(t, h.th.App.Srv().Store().Channel().RemoveMember(h.th.Context, h.th.BasicChannel.Id, h.th.BasicUser.Id))
			_, err := h.th.App.Srv().Store().Channel().SaveMember(h.th.Context, &model.ChannelMember{
				ChannelId: h.th.BasicChannel.Id, UserId: h.th.BasicUser.Id, NotifyProps: model.GetDefaultChannelNotifyProps(), SchemeUser: true,
			})
			require.NoError(t, err)
		}},
		{"the user is promoted from guest", func(t *testing.T, h *accessDecisionCacheHarness) {
			require.NoError(t, h.th.App.Srv().Store().User().PromoteGuestToUser(h.th.Context, h.th.BasicUser.Id))
		}},
		{"the channel's deactivated members are removed", func(t *testing.T, h *accessDecisionCacheHarness) {
			require.NoError(t, h.th.App.Srv().Store().Channel().RemoveAllDeactivatedMembers(h.th.Context, h.th.BasicChannel.Id))
		}},
		{"the decision max age changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.DecisionCacheMaxAgeSeconds = 30 })
		}},
		{"a policy changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.InvalidateAccessDecisionsForPolicyChange()
		}},
		{"ABAC is turned off and on", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false })
			h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true })
		}},
		{"the license changes", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		}},
		{"another node invalidates the user", func(t *testing.T, h *accessDecisionCacheHarness) {
			data, err := json.Marshal(accessDecisionInvalidation{Users: []string{h.th.BasicUser.Id}})
			require.NoError(t, err)
			h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{
				Event: model.ClusterEventInvalidateAccessDecisions,
				Data:  data,
			})
		}},
		{"another node invalidates everything", func(t *testing.T, h *accessDecisionCacheHarness) {
			data, err := json.Marshal(accessDecisionInvalidation{Global: true})
			require.NoError(t, err)
			h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: data})
		}},
		{"a malformed cluster message invalidates everything", func(t *testing.T, h *accessDecisionCacheHarness) {
			h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: []byte("{")})
		}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := setupAccessDecisionCacheTest(t)
			decides(h.acs, true)

			require.True(t, h.check(t))
			require.True(t, h.check(t))
			require.Equal(t, 1, h.evaluations(), "cached before the change")

			tc.invalidate(t, h)

			require.True(t, h.check(t))
			require.Equal(t, 2, h.evaluations(), "asked again after the change")
		})
	}
}

// A peer's role eviction is best-effort, so its decision invalidation also drops this node's
// cached roles for the memberships it changed. Otherwise the next check could read the old role
// and cache a decision built from it under the new versions.
func TestAccessDecisionCachePeerInvalidationEvictsMembershipRoles(t *testing.T) {
	cases := []struct {
		name    string
		inv     func(userID, channelID string) accessDecisionInvalidation
		evicted bool
	}{
		{"a changed membership", func(userID, channelID string) accessDecisionInvalidation {
			return accessDecisionInvalidation{UserResources: [][2]string{{userID, channelID}}}
		}, true},
		{"a change to any of the user's memberships", func(userID, _ string) accessDecisionInvalidation {
			return accessDecisionInvalidation{Users: []string{userID}, PurgeRoles: true}
		}, true},
		{"a change to every membership", func(_, _ string) accessDecisionInvalidation {
			return accessDecisionInvalidation{Global: true, PurgeRoles: true}
		}, true},
		{"a user change unrelated to memberships", func(userID, _ string) accessDecisionInvalidation {
			return accessDecisionInvalidation{Users: []string{userID}}
		}, false},
		{"another membership", func(userID, _ string) accessDecisionInvalidation {
			return accessDecisionInvalidation{UserResources: [][2]string{{userID, model.NewId()}}}
		}, false},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h := setupAccessDecisionCacheTest(t)
			userID, channelID := h.th.BasicUser.Id, h.th.BasicChannel.Id
			cachedRoles := func() store.ChannelMemberRoles {
				t.Helper()
				roles, err := h.th.App.Srv().Store().Channel().GetChannelMemberRoles(h.th.Context, userID, []string{channelID}, true)
				require.NoError(t, err)
				return roles[channelID]
			}
			wasAdmin := cachedRoles().SchemeAdmin

			// The peer's write reaches the database, but not its eviction of this node's cache.
			member, err := h.th.GetSqlStore().Channel().GetMember(h.th.Context, channelID, userID)
			require.NoError(t, err)
			member.SchemeAdmin = !wasAdmin
			_, err = h.th.GetSqlStore().Channel().UpdateMember(h.th.Context, member)
			require.NoError(t, err)
			require.Equal(t, wasAdmin, cachedRoles().SchemeAdmin, "the old role is still cached")

			data, err := json.Marshal(tc.inv(userID, channelID))
			require.NoError(t, err)
			h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{Data: data})

			assert.Equal(t, tc.evicted, cachedRoles().SchemeAdmin != wasAdmin)
		})
	}
}

func TestAccessDecisionCacheUnrelatedChangesKeepEntries(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, true)
	require.True(t, h.check(t))

	h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser2.Id)
	h.th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, model.NewId())
	h.th.App.invalidateAccessDecisionsForSession(model.NewId())
	h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL = "http://example.com" })

	require.True(t, h.check(t))
	require.Equal(t, 1, h.evaluations())
}

// Membership writes scoped to one user or one channel drop only that user's or that channel's
// decisions, not every decision on every node.
func TestAccessDecisionCacheScopedMembershipWritesKeepOtherEntries(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, true)
	require.True(t, h.check(t))

	ss := h.th.App.Srv().Store()
	otherUser := h.th.BasicUser2.Id
	otherChannel := h.th.CreateChannel(t, h.th.BasicTeam).Id

	require.NoError(t, ss.User().PromoteGuestToUser(h.th.Context, otherUser))
	_, err := ss.User().DemoteUserToGuest(h.th.Context, otherUser)
	require.NoError(t, err)
	require.NoError(t, ss.Channel().PermanentDeleteMembersByUser(h.th.Context, otherUser))
	require.NoError(t, ss.Channel().RemoveAllDeactivatedMembers(h.th.Context, otherChannel))
	require.NoError(t, ss.Channel().PermanentDeleteMembersByChannel(h.th.Context, otherChannel))

	require.True(t, h.check(t))
	require.Equal(t, 1, h.evaluations())
}

func TestAccessDecisionCacheAppliesSettingChanges(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, true)
	require.True(t, h.check(t))
	c := h.th.App.Srv().Channels().accessDecisions

	h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.DecisionCacheSize = 2_000_000 })
	assert.Equal(t, 2_000_000/accessDecisionLRUShards, c.shards[0].limit)
	require.True(t, h.check(t))
	assert.Equal(t, 1, h.evaluations(), "growing the cache keeps its entries")

	h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.DecisionCacheMaxAgeSeconds = 30 })
	assert.Equal(t, int64(30*time.Second), c.maxAge.Load())
}

func TestAccessDecisionCacheBroadcastsInvalidations(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	// Only the explicit flushes below send, so both invalidations land in one batch however
	// slowly the test runs.
	broadcaster := h.th.App.Srv().Channels().accessDecisionBroadcaster
	broadcaster.mu.Lock()
	broadcaster.delay = time.Hour
	broadcaster.mu.Unlock()
	broadcaster.flush()
	cluster := &testlib.FakeClusterInterface{}
	h.th.Server.Platform().SetCluster(cluster)

	h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser.Id)
	h.th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeChannel, h.th.BasicChannel.Id)
	h.th.App.Srv().Channels().accessDecisionBroadcaster.flush()

	msgs := cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventInvalidateAccessDecisions
	})
	require.Len(t, msgs, 1, "both invalidations go out in one batch")
	assert.Equal(t, model.ClusterSendReliable, msgs[0].SendType)

	var inv accessDecisionInvalidation
	require.NoError(t, json.Unmarshal(msgs[0].Data, &inv))
	assert.Contains(t, inv.Users, h.th.BasicUser.Id)
	assert.Equal(t, []string{h.th.BasicChannel.Id}, inv.Resources)

	// Policy changes and config flips run on every node, so they aren't broadcast.
	cluster.ClearMessages()
	h.th.App.InvalidateAccessDecisionsForPolicyChange()
	h.th.App.Srv().Channels().accessDecisionBroadcaster.flush()
	assert.Empty(t, cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventInvalidateAccessDecisions
	}))
}

func TestAccessDecisionCacheSkipsInvalidationsWhileABACIsOff(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	cluster := &testlib.FakeClusterInterface{}
	h.th.Server.Platform().SetCluster(cluster)
	h.th.App.UpdateConfig(func(cfg *model.Config) { *cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false })

	h.th.App.Srv().Platform().InvalidateCacheForUser(h.th.BasicUser.Id)
	h.th.App.Srv().Channels().accessDecisionBroadcaster.flush()
	assert.Empty(t, cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
		return msg.Event == model.ClusterEventInvalidateAccessDecisions
	}))
}

func TestEvaluateAccessCachedBuildError(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, true)

	ref := accessSubjectRefFor(h.th.Context.WithSession(h.session), h.th.BasicUser.Id)
	resource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id}
	buildErr := model.NewAppError("test", "app.access_control.build_subject.get_subject.app_error", nil, "", http.StatusInternalServerError).Wrap(errors.New("boom"))

	var rctx request.CTX = h.th.Context.WithSession(h.session)
	_, appErr := h.th.App.evaluateAccessCached(rctx, ref, resource, model.AccessControlPolicyActionChannelReadAccess, func() (model.Subject, error) {
		return model.Subject{}, buildErr
	})
	require.Equal(t, buildErr, appErr)
	require.Equal(t, 0, h.evaluations())

	decision, appErr := h.th.App.evaluateAccessCached(rctx, ref, resource, model.AccessControlPolicyActionChannelReadAccess, func() (model.Subject, error) {
		return model.Subject{ID: h.th.BasicUser.Id}, nil
	})
	require.NoError(t, appErr)
	require.True(t, decision.Decision)
	require.Equal(t, 1, h.evaluations(), "a failed build left nothing in the cache")
}

func TestEvaluateAccessCachedSessionAttributeExpiry(t *testing.T) {
	const attr = "device_compliant"

	// setup returns a run func that evaluates read access for a session subject whose attr goes
	// stale 5s from now, with the PDP answering decision.
	setup := func(t *testing.T, decision model.AccessDecision) (*accessDecisionCacheHarness, *fakeAccessClock, func() bool) {
		h := setupAccessDecisionCacheTest(t)
		h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(decision, nil)

		clock := &fakeAccessClock{now: time.Unix(1_700_000_000, 0).UnixNano()}
		h.th.App.Srv().Channels().accessDecisions.now = clock.get
		h.th.App.Srv().Channels().accessDecisions.wallNow = clock.get
		expiresAt := clock.now/int64(time.Millisecond) + 5_000

		var rctx request.CTX = h.th.Context.WithSession(h.session)
		ref := accessSubjectRefFor(rctx, h.th.BasicUser.Id)
		require.Equal(t, accessSubjectSession, ref.kind)
		resource := model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id}

		run := func() bool {
			got, appErr := h.th.App.evaluateAccessCached(rctx, ref, resource, model.AccessControlPolicyActionChannelReadAccess, func() (model.Subject, error) {
				return model.Subject{
					ID:               h.th.BasicUser.Id,
					Session:          map[string]any{attr: "true"},
					SessionExpiresAt: map[string]int64{attr: expiresAt},
				}, nil
			})
			require.NoError(t, appErr)
			return got.Decision
		}
		return h, clock, run
	}

	t.Run("a decision that read an attribute ends when it goes stale", func(t *testing.T) {
		h, clock, run := setup(t, model.AccessDecision{Decision: true, SessionAttributeRefs: []string{attr}, SessionAttributeRefsReported: true})

		require.True(t, run())
		clock.advance(4 * time.Second)
		require.True(t, run())
		require.Equal(t, 1, h.evaluations())

		clock.advance(time.Second)
		require.True(t, run())
		require.Equal(t, 2, h.evaluations(), "re-evaluated once the attribute expired")
	})

	t.Run("a decision that read no session attribute keeps the max age", func(t *testing.T) {
		h, clock, run := setup(t, model.AccessDecision{Decision: true, SessionAttributeRefsReported: true})

		require.True(t, run())
		clock.advance(30 * time.Second)
		require.True(t, run())
		require.Equal(t, 1, h.evaluations())
	})

	t.Run("a decision that doesn't say what it read ends with the session's attributes", func(t *testing.T) {
		h, clock, run := setup(t, model.AccessDecision{Decision: true})

		require.True(t, run())
		clock.advance(5 * time.Second)
		require.True(t, run())
		require.Equal(t, 2, h.evaluations())
	})
}

// TestAccessDecisionCacheSessionAttributeChange changes a session attribute through a real
// refresh request. That invalidates the session's cached decisions, but only the ones whose rules
// read a session attribute; the rest keep serving from the cache.
func TestAccessDecisionCacheSessionAttributeChange(t *testing.T) {
	ipName := model.SessionAttributesPropertyFieldIPAddress

	refresh := func(t *testing.T, h *accessDecisionCacheHarness, remoteAddr string) {
		t.Helper()
		h.th.App.ProcessSessionAttributesRequest(h.th.Context.WithSession(h.session), newSessionAttributesRequest(t, testUserAgentChrome, remoteAddr))
	}

	// run caches a decision under the first IP, moves the session to a second IP, checks again
	// and returns how many times the PDP was asked.
	run := func(t *testing.T, decision model.AccessDecision) int {
		t.Helper()
		h := setupAccessDecisionCacheTest(t)
		// Enabling session attributes edits their property fields, which notifies the PDP.
		h.acs.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return()
		enableSessionAttributesCollection(t, h.th)
		h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).Return(decision, nil)

		refresh(t, h, "192.0.2.10:1234")
		require.Equal(t, "192.0.2.10", sessionAttributeValuesByFieldName(t, h.th, h.session.Id)[ipName])
		require.True(t, h.check(t))
		require.Equal(t, 1, h.evaluations())

		refresh(t, h, "192.0.2.20:1234")
		require.Equal(t, "192.0.2.20", sessionAttributeValuesByFieldName(t, h.th, h.session.Id)[ipName], "the session attribute changed")
		require.True(t, h.check(t))
		return h.evaluations()
	}

	t.Run("a decision whose rules read no session attribute is still served from the cache", func(t *testing.T) {
		evaluations := run(t, model.AccessDecision{Decision: true, SessionAttributeRefsReported: true})
		require.Equal(t, 1, evaluations)
	})

	t.Run("a decision whose rules read the changed attribute is evaluated again", func(t *testing.T) {
		evaluations := run(t, model.AccessDecision{Decision: true, SessionAttributeRefs: []string{ipName}, SessionAttributeRefsReported: true})
		require.Equal(t, 2, evaluations)
	})

	t.Run("a decision that doesn't say what it read is evaluated again", func(t *testing.T) {
		evaluations := run(t, model.AccessDecision{Decision: true})
		require.Equal(t, 2, evaluations)
	})
}

// clusterUpdateSessionAttributes delivers a peer's session attribute refresh for h's session.
func clusterUpdateSessionAttributes(t *testing.T, h *accessDecisionCacheHarness, visiblyChanged bool) {
	t.Helper()
	data, err := json.Marshal(model.SessionAttributesClusterPayload{
		SessionID:      h.session.Id,
		Attrs:          map[string]any{model.SessionAttributesPropertyFieldIPAddress: "192.0.2.30"},
		Timestamp:      model.GetMillis(),
		VisiblyChanged: visiblyChanged,
	})
	require.NoError(t, err)
	h.th.App.Srv().Platform().ClusterUpdateSessionAttributesHandler(&model.ClusterMessage{
		Event: model.ClusterEventUpdateSessionAttributes,
		Data:  data,
	})
}

// TestAccessDecisionCachePeerSessionAttributeRefresh covers the receiving side of a session
// attribute change. The sender's invalidation is a separate message that can arrive first, so a
// decision cached in between from the old values must still be dropped once the new ones land.
func TestAccessDecisionCachePeerSessionAttributeRefresh(t *testing.T) {
	t.Run("a visible change arriving after the invalidation drops the re-cached decision", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)
		cluster := &testlib.FakeClusterInterface{}
		h.th.Server.Platform().SetCluster(cluster)

		// The sender's invalidation arrives first, and a check re-caches from the old values.
		h.th.App.Srv().Channels().clusterInvalidateAccessDecisionsHandler(&model.ClusterMessage{
			Data: []byte(`{"s":["` + h.session.Id + `"]}`),
		})
		require.True(t, h.check(t))
		require.Equal(t, 1, h.evaluations())

		clusterUpdateSessionAttributes(t, h, true)
		require.True(t, h.check(t))
		require.Equal(t, 2, h.evaluations(), "the decision built from the old values was dropped")

		h.th.App.Srv().Channels().accessDecisionBroadcaster.flush()
		assert.Empty(t, cluster.SelectMessages(func(msg *model.ClusterMessage) bool {
			return msg.Event == model.ClusterEventInvalidateAccessDecisions
		}), "every node gets the attributes, so the receiver doesn't re-broadcast")
	})

	t.Run("a refresh that changes nothing visible keeps the decision", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)

		require.True(t, h.check(t))
		clusterUpdateSessionAttributes(t, h, false)
		require.True(t, h.check(t))
		require.Equal(t, 1, h.evaluations())
	})
}

// A policy bakes in the ranks and hierarchy of the options it names, but which options a change
// touched is never looked at: any change to a rank or graph field's options drops every decision.
// Each case changes only options a policy naming Secret, or Air, would not name.
func TestAccessDecisionCacheRankAndHierarchyChanges(t *testing.T) {
	setup := func(t *testing.T) (*accessDecisionCacheHarness, string) {
		t.Helper()
		h := setupAccessDecisionCacheTest(t)
		h.acs.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return()
		decides(h.acs, true)

		h.th.ConfigStore.SetReadOnlyFF(false)
		h.th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.PropertyFieldRank = true
			cfg.FeatureFlags.PropertyFieldGraph = true
		})

		group, appErr := h.th.App.GetPropertyGroup(h.th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)
		return h, group.ID
	}

	createField := func(t *testing.T, h *accessDecisionCacheHarness, field *model.PropertyField) *model.PropertyField {
		t.Helper()
		created, appErr := h.th.App.CreatePropertyField(h.th.Context, field, false, "")
		require.Nil(t, appErr)
		return created
	}

	clearanceOptions := []any{
		map[string]any{"name": "Unclassified", "rank": 1},
		map[string]any{"name": "Confidential", "rank": 2},
		map[string]any{"name": "Secret", "rank": 3},
	}

	// reRank swaps the ranks of Unclassified and Confidential, leaving Secret where it was.
	reRank := func(t *testing.T, h *accessDecisionCacheHarness, field *model.PropertyField) {
		t.Helper()
		options, ok := field.Attrs[model.PropertyFieldAttributeOptions].([]any)
		require.True(t, ok)
		swapped := map[string]int{"Unclassified": 2, "Confidential": 1, "Secret": 3}
		reRanked := make([]any, 0, len(options))
		for _, o := range options {
			option := o.(map[string]any)
			name := option["name"].(string)
			reRanked = append(reRanked, map[string]any{"id": option["id"], "name": name, "rank": swapped[name]})
		}
		field.Attrs[model.PropertyFieldAttributeOptions] = reRanked
		_, _, appErr := h.th.App.UpdatePropertyFields(h.th.Context, field.GroupID, []*model.PropertyField{field}, false, "")
		require.Nil(t, appErr)
	}

	// notifications counts how often the PDP was told about fieldID's options changing.
	notifications := func(h *accessDecisionCacheHarness, fieldID string) int {
		n := 0
		for _, call := range h.acs.Calls {
			if call.Method == "OnPropertyFieldOptionsChanged" && call.Arguments.Get(1) == fieldID {
				n++
			}
		}
		return n
	}

	// requireReEvaluated caches a decision, runs change, and checks the PDP is asked again and
	// told about the field the policy reads. Setup can notify for that field too, so only a
	// notification from change counts.
	requireReEvaluated := func(t *testing.T, h *accessDecisionCacheHarness, policyFieldID string, change func()) {
		t.Helper()
		require.True(t, h.check(t))
		require.True(t, h.check(t))
		require.Equal(t, 1, h.evaluations(), "cached before the change")
		before := notifications(h, policyFieldID)

		change()

		require.Greater(t, notifications(h, policyFieldID), before, "the change notifies the field the policy reads")
		require.True(t, h.check(t))
		require.Equal(t, 2, h.evaluations(), "asked again after the change")
	}

	t.Run("re-ranking options the policy doesn't name", func(t *testing.T) {
		h, groupID := setup(t)
		clearance := createField(t, h, &model.PropertyField{
			GroupID:    groupID,
			Name:       "clearance_" + model.NewId(),
			Type:       model.PropertyFieldTypeRank,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			ObjectType: model.PropertyFieldObjectTypeUser,
			Attrs:      model.StringInterface{model.PropertyFieldAttributeOptions: clearanceOptions},
		})

		requireReEvaluated(t, h, clearance.ID, func() { reRank(t, h, clearance) })
	})

	t.Run("re-ranking options the policy doesn't name on the template the field links to", func(t *testing.T) {
		h, groupID := setup(t)
		memberLevel := model.PermissionLevelMember
		template := createField(t, h, &model.PropertyField{
			GroupID:           groupID,
			Name:              "clearance_template_" + model.NewId(),
			Type:              model.PropertyFieldTypeRank,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			PermissionOptions: &memberLevel,
			Attrs:             model.StringInterface{model.PropertyFieldAttributeOptions: clearanceOptions},
		})
		clearance := createField(t, h, &model.PropertyField{
			GroupID:       groupID,
			Name:          "clearance_" + model.NewId(),
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			ObjectType:    model.PropertyFieldObjectTypeUser,
			LinkedFieldID: &template.ID,
		})

		requireReEvaluated(t, h, clearance.ID, func() { reRank(t, h, template) })
	})

	t.Run("re-parenting an option outside the subtree the policy names", func(t *testing.T) {
		h, groupID := setup(t)
		memberLevel := model.PermissionLevelMember
		template := createField(t, h, &model.PropertyField{
			GroupID:           groupID,
			Name:              "programs_template_" + model.NewId(),
			Type:              model.PropertyFieldTypeGraph,
			TargetType:        string(model.PropertyFieldTargetLevelSystem),
			ObjectType:        model.PropertyFieldObjectTypeTemplate,
			PermissionOptions: &memberLevel,
		})
		programs := createField(t, h, &model.PropertyField{
			GroupID:       groupID,
			Name:          "programs_" + model.NewId(),
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			ObjectType:    model.PropertyFieldObjectTypeUser,
			LinkedFieldID: &template.ID,
		})

		created, appErr := h.th.App.CreatePropertyFieldOptions(h.th.Context, groupID, template.ID, []*model.PropertyFieldOption{
			{Name: "Air"}, {Name: "Fighter"}, {Name: "Sea"}, {Name: "Submarine"},
		}, "")
		require.Nil(t, appErr)
		require.Len(t, created, 4)
		fighter, submarine := created[1], created[3]
		_, _, appErr = h.th.App.UpdatePropertyFieldOptions(h.th.Context, groupID, template.ID, []*model.PropertyFieldOption{
			{ID: fighter.ID, Name: fighter.Name, Parents: &[]string{"Air"}},
		}, "")
		require.Nil(t, appErr)

		requireReEvaluated(t, h, programs.ID, func() {
			_, _, appErr := h.th.App.UpdatePropertyFieldOptions(h.th.Context, groupID, template.ID, []*model.PropertyFieldOption{
				{ID: submarine.ID, Name: submarine.Name, Parents: &[]string{"Sea"}},
			}, "")
			require.Nil(t, appErr)
		})
	})
}

func TestAccessDecisionCachePrepareSkipsCachedChannels(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, false)
	userID := h.th.BasicUser.Id
	channel := h.th.CreateChannel(t, h.th.BasicTeam)
	channel.PolicyEnforced = true
	channelPolicyGoverns(h.acs, channel.Id, true)
	roleKey := channelRoleKey{userID: userID, channelID: channel.Id}

	cold := WithChannelAccessMemo(h.th.Context.WithSession(h.session))
	h.th.App.PrepareChannelReadAccess(cold, userID, []*model.Channel{channel})
	_, fetched := getChannelAccessMemo(cold).getChannelRole(roleKey)
	require.True(t, fetched, "a cold cache fetches the role")
	require.Zero(t, h.th.App.ch.accessDecisions.stats().misses, "a peek doesn't count a miss")
	require.False(t, h.th.App.HasChannelReadAccess(cold, userID, channel))
	require.Equal(t, 1, h.evaluations())

	warm := WithChannelAccessMemo(h.th.Context.WithSession(h.session))
	h.th.App.PrepareChannelReadAccess(warm, userID, []*model.Channel{channel})
	memo := getChannelAccessMemo(warm)
	_, fetched = memo.getChannelRole(roleKey)
	require.False(t, fetched, "a cached decision needs no role")
	allowed, decided := memo.get(channelAccessKey{
		subject:   accessSubjectRefFor(warm, userID),
		channelID: channel.Id,
		action:    model.AccessControlPolicyActionChannelReadAccess,
	})
	require.True(t, decided)
	require.False(t, allowed)
	require.False(t, h.th.App.HasChannelReadAccess(warm, userID, channel))
	require.Equal(t, 1, h.evaluations())
}

func TestChannelAccessMemoIsKeyedBySubject(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, true)
	userID := h.th.BasicUser.Id

	rctx := WithChannelAccessMemo(h.th.Context.WithSession(h.session))
	require.True(t, h.th.App.HasChannelReadAccess(rctx, userID, h.th.BasicChannel))

	// The memo outlives a session switch. The stand-in is the user kind, a different subject,
	// so the session's memoised answer and subject must not serve it.
	switched := rctx.WithSession(&model.Session{UserId: userID})
	require.Same(t, getChannelAccessMemo(rctx), getChannelAccessMemo(switched))
	require.True(t, h.th.App.HasChannelReadAccess(switched, userID, h.th.BasicChannel))
	require.Equal(t, 2, h.evaluations())

	memo := getChannelAccessMemo(rctx)
	require.NotNil(t, memo.getSubject(accessSubjectRefFor(rctx, userID)))
	require.NotNil(t, memo.getSubject(accessSubjectRefFor(switched, userID)))
}

func TestHasPermissionToChannelActionReadAccess(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
	decides(h.acs, false)
	userID := h.th.BasicUser.Id
	rctx := h.th.Context.WithSession(h.session)
	check := func(channelID string) bool {
		return h.th.App.HasPermissionToChannelAction(rctx, userID, h.session.Roles, channelID, model.AccessControlPolicyActionChannelReadAccess)
	}

	dm := h.th.CreateDmChannel(t, h.th.BasicUser2)
	require.True(t, check(dm.Id), "DMs are exempt, as in enforcement")
	require.Zero(t, h.evaluations())

	require.False(t, check(h.th.BasicChannel.Id))
	require.False(t, check(h.th.BasicChannel.Id))
	require.Equal(t, 1, h.evaluations(), "the second check is served from the cache")

	h.th.App.invalidateAccessDecisionsForSession(h.session.Id)
	require.False(t, check(h.th.BasicChannel.Id))
	require.Equal(t, 2, h.evaluations())
}
