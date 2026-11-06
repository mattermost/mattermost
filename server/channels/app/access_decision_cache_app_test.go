// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
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

	t.Run("a session without an ID is not cached", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)

		standIn := &model.Session{UserId: h.th.BasicUser.Id, Roles: model.SystemUserRoleId}
		rctx := h.th.Context.WithSession(standIn)
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.True(t, h.th.App.HasChannelReadAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, 2, h.evaluations())
	})

	t.Run("write access is not cached yet", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		h.acs.On("ActionHasPermissionPolicy", mock.Anything, model.AccessControlPolicyActionChannelWriteAccess).Return(true, nil)
		h.acs.On("ResourcePolicyGovernsAction", mock.Anything, h.th.BasicChannel.Id, model.AccessControlPolicyActionChannelWriteAccess).Return(false, nil)
		decides(h.acs, true)

		rctx := h.th.Context.WithSession(h.session)
		require.True(t, h.th.App.evaluateChannelAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel, model.AccessControlPolicyActionChannelWriteAccess))
		require.True(t, h.th.App.evaluateChannelAccess(rctx, h.th.BasicUser.Id, h.th.BasicChannel, model.AccessControlPolicyActionChannelWriteAccess))
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
			h.th.App.Srv().Channels().InvalidateAccessDecisionsForSession(h.session.Id)
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

func TestAccessDecisionCacheBroadcastsInvalidations(t *testing.T) {
	h := setupAccessDecisionCacheTest(t)
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
	_, appErr := h.th.App.evaluateAccessCached(rctx, ref, resource, model.AccessControlPolicyActionChannelReadAccess, func() (model.Subject, *model.AppError) {
		return model.Subject{}, buildErr
	})
	require.Equal(t, buildErr, appErr)
	require.Equal(t, 0, h.evaluations())

	decision, appErr := h.th.App.evaluateAccessCached(rctx, ref, resource, model.AccessControlPolicyActionChannelReadAccess, func() (model.Subject, *model.AppError) {
		return model.Subject{ID: h.th.BasicUser.Id}, nil
	})
	require.Nil(t, appErr)
	require.True(t, decision.Decision)
	require.Equal(t, 1, h.evaluations(), "a failed build left nothing in the cache")
}
