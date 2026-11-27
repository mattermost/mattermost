// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// cachedChannelAction is one of the channel actions the decision cache holds, with the
// enforcement function that answers it.
type cachedChannelAction struct {
	action string
	// govern sets up whatever the action's gate asks before it evaluates.
	govern func(acs *eMocks.AccessControlServiceInterface, channelID string)
	// check runs the action's enforcement for userID in rctx.
	check func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool
}

// governedBySystemPolicy makes a system policy, and not the channel's own, govern action.
func governedBySystemPolicy(action string) func(acs *eMocks.AccessControlServiceInterface, channelID string) {
	return func(acs *eMocks.AccessControlServiceInterface, channelID string) {
		acs.On("ActionHasPermissionPolicy", mock.Anything, action).Return(true, nil)
		acs.On("ResourcePolicyGovernsAction", mock.Anything, channelID, action).Return(false, nil)
	}
}

// channelPermissionActionCheck answers a file or burn-on-read action through
// HasPermissionToChannelAction, with the roles its callers pass.
func channelPermissionActionCheck(action string) func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool {
	return func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool {
		roles := rctx.Session().Roles
		if rctx.Session().UserId != userID {
			// A user who can't be loaded is still checked, with no roles.
			roles = ""
			if user, appErr := a.GetUser(rctx, userID); appErr == nil {
				roles = user.Roles
			}
		}
		return a.HasPermissionToChannelAction(rctx, userID, roles, channel.Id, action)
	}
}

var (
	cachedReadAccess = cachedChannelAction{
		action: model.AccessControlPolicyActionChannelReadAccess,
		govern: governedBySystemPolicy(model.AccessControlPolicyActionChannelReadAccess),
		check: func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool {
			return a.HasChannelReadAccess(rctx, userID, channel)
		},
	}
	cachedWriteAccess = cachedChannelAction{
		action: model.AccessControlPolicyActionChannelWriteAccess,
		govern: governedBySystemPolicy(model.AccessControlPolicyActionChannelWriteAccess),
		check: func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool {
			return a.channelWriteAccessDecision(rctx, userID, channel)
		},
	}
	cachedManagementAccess = cachedChannelAction{
		action: model.AccessControlPolicyActionChannelManagementAccess,
		govern: governedBySystemPolicy(model.AccessControlPolicyActionChannelManagementAccess),
		check: func(a *App, rctx request.CTX, userID string, channel *model.Channel) bool {
			return a.channelManagementAccessDecision(rctx, userID, channel)
		},
	}
	cachedUpload = cachedChannelAction{
		action: model.AccessControlPolicyActionUploadFileAttachment,
		govern: func(*eMocks.AccessControlServiceInterface, string) {},
		check:  channelPermissionActionCheck(model.AccessControlPolicyActionUploadFileAttachment),
	}
	cachedDownload = cachedChannelAction{
		action: model.AccessControlPolicyActionDownloadFileAttachment,
		govern: func(*eMocks.AccessControlServiceInterface, string) {},
		check:  channelPermissionActionCheck(model.AccessControlPolicyActionDownloadFileAttachment),
	}
	cachedBurnOnRead = cachedChannelAction{
		action: model.AccessControlPolicyActionCreateBurnOnReadPost,
		govern: func(*eMocks.AccessControlServiceInterface, string) {},
		check:  channelPermissionActionCheck(model.AccessControlPolicyActionCreateBurnOnReadPost),
	}

	cachedChannelActions = []cachedChannelAction{
		cachedReadAccess, cachedWriteAccess, cachedManagementAccess, cachedUpload, cachedDownload, cachedBurnOnRead,
	}
)

// clearAccessDecisionCache drops every cached decision on th's node, for tests that swap the PDP
// without a license under which invalidations apply.
func clearAccessDecisionCache(th *TestHelper) {
	if c := th.App.Srv().ch.accessDecisions; c != nil {
		c.invalidateAll()
	}
}

// actionCacheHarness counts the PDP evaluations of one cached action.
type actionCacheHarness struct {
	*accessDecisionCacheHarness
	action cachedChannelAction
}

func setupActionCacheTest(t *testing.T, action cachedChannelAction) *actionCacheHarness {
	t.Helper()
	return newActionCacheHarness(t, setupChannelReadAccessTest(t), action)
}

func newActionCacheHarness(t *testing.T, h *channelReadAccessHarness, action cachedChannelAction) *actionCacheHarness {
	t.Helper()
	acs := h.mockACS(t)
	action.govern(acs, h.th.BasicChannel.Id)
	return &actionCacheHarness{
		accessDecisionCacheHarness: &accessDecisionCacheHarness{channelReadAccessHarness: h, acs: acs, session: h.rctx.Session()},
		action:                     action,
	}
}

// check runs the action's enforcement in a fresh request, so the per-request memo never answers.
func (h *actionCacheHarness) check() bool {
	return h.action.check(h.th.App, h.th.Context.WithSession(h.session), h.th.BasicUser.Id, h.th.BasicChannel)
}

// cached reports whether the cache holds a decision for the session in the basic channel.
func (h *actionCacheHarness) cached() bool {
	ref := accessSubjectRefFor(h.th.Context.WithSession(h.session), h.th.BasicUser.Id)
	_, hit := h.th.App.peekAccessDecision(ref, model.AccessControlPolicyTypeChannel, h.th.BasicChannel.Id, h.action.action)
	return hit
}

// testCachedActionInvalidation checks that a decision for action is cached, and that each
// invalidation source a decision depends on makes the next check ask the PDP again.
func testCachedActionInvalidation(t *testing.T, action cachedChannelAction) {
	t.Run("a second check is served from the cache", func(t *testing.T) {
		h := setupActionCacheTest(t, action)
		decides(h.acs, true)

		require.True(t, h.check())
		require.True(t, h.check())
		require.Equal(t, 1, h.evaluations())
	})

	t.Run("denies are cached", func(t *testing.T) {
		h := setupActionCacheTest(t, action)
		decides(h.acs, false)

		require.False(t, h.check())
		require.False(t, h.check())
		require.Equal(t, 1, h.evaluations())
	})

	sources := []struct {
		name       string
		invalidate func(t *testing.T, h *actionCacheHarness)
	}{
		{"user attribute values change", func(t *testing.T, h *actionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
				{TargetType: model.PropertyFieldObjectTypeUser, TargetID: h.th.BasicUser.Id},
			})
		}},
		{"session attributes change", func(t *testing.T, h *actionCacheHarness) {
			h.th.App.invalidateAccessDecisionsForSession(h.session.Id)
		}},
		{"channel attribute values change", func(t *testing.T, h *actionCacheHarness) {
			h.th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
				{TargetType: model.PropertyFieldObjectTypeChannel, TargetID: h.th.BasicChannel.Id},
			})
		}},
		{"the user leaves and rejoins the channel", func(t *testing.T, h *actionCacheHarness) {
			require.NoError(t, h.th.App.Srv().Store().Channel().RemoveMember(h.th.Context, h.th.BasicChannel.Id, h.th.BasicUser.Id))
			_, err := h.th.App.Srv().Store().Channel().SaveMember(h.th.Context, &model.ChannelMember{
				ChannelId: h.th.BasicChannel.Id, UserId: h.th.BasicUser.Id, NotifyProps: model.GetDefaultChannelNotifyProps(), SchemeUser: true,
			})
			require.NoError(t, err)
		}},
		{"the channel role changes", func(t *testing.T, h *actionCacheHarness) {
			_, appErr := h.th.App.UpdateChannelMemberSchemeRoles(h.th.Context, h.th.BasicChannel.Id, h.th.BasicUser.Id, false, true, true)
			require.Nil(t, appErr)
		}},
		{"a policy changes", func(t *testing.T, h *actionCacheHarness) {
			h.th.App.InvalidateAccessDecisionsForPolicyChange()
		}},
	}
	for _, source := range sources {
		t.Run("invalidated when "+source.name, func(t *testing.T) {
			h := setupActionCacheTest(t, action)
			decides(h.acs, true)

			require.True(t, h.check())
			require.True(t, h.check())
			require.Equal(t, 1, h.evaluations(), "cached before the change")

			source.invalidate(t, h)
			require.False(t, h.cached(), "the change drops the cached decision")

			require.True(t, h.check())
			require.Equal(t, 2, h.evaluations(), "asked again after the change")
		})
	}
}

// TestAccessDecisionCacheUncachedActions checks that only the allowlisted actions are cached,
// whatever ref the caller passes.
func TestAccessDecisionCacheUncachedActions(t *testing.T) {
	for _, tc := range []struct {
		name     string
		resource func(h *accessDecisionCacheHarness) model.Resource
		action   string
	}{
		{"team membership", func(h *accessDecisionCacheHarness) model.Resource {
			return model.Resource{Type: model.AccessControlPolicyTypeTeam, ID: h.th.BasicTeam.Id}
		}, model.AccessControlPolicyActionMembership},
		{"a plugin action", func(h *accessDecisionCacheHarness) model.Resource {
			return model.Resource{Type: model.AccessControlPolicyTypeChannel, ID: h.th.BasicChannel.Id}
		}, "myplugin_export"},
	} {
		t.Run(tc.name+" is never cached, even with a ref", func(t *testing.T) {
			h := setupAccessDecisionCacheTest(t)
			decides(h.acs, true)
			rctx := h.th.Context.WithSession(h.session)
			ref := accessSubjectRefFor(rctx, h.th.BasicUser.Id)
			resource := tc.resource(h)

			for range 2 {
				decision, err := h.th.App.evaluateAccessCached(rctx, ref, resource, tc.action, func() (model.Subject, error) {
					return model.Subject{ID: h.th.BasicUser.Id, Type: "user"}, nil
				})
				require.NoError(t, err)
				require.True(t, decision.Decision)
			}
			require.Equal(t, 2, h.evaluations())
			_, hit := h.th.App.peekAccessDecision(ref, resource.Type, resource.ID, tc.action)
			require.False(t, hit)
		})
	}

	t.Run("a plugin action checked through HasPermissionToChannelAction is never cached", func(t *testing.T) {
		h := setupAccessDecisionCacheTest(t)
		decides(h.acs, true)
		check := channelPermissionActionCheck("myplugin_export")

		require.True(t, check(h.th.App, h.th.Context.WithSession(h.session), h.th.BasicUser.Id, h.th.BasicChannel))
		require.True(t, check(h.th.App, h.th.Context.WithSession(h.session), h.th.BasicUser.Id, h.th.BasicChannel))
		require.Equal(t, 2, h.evaluations())
	})
}

// TestAccessDecisionCacheErrorsDenyAndAreNotCached covers every cached action: a PDP error or a
// subject that can't be built denies, and the next check asks again.
func TestAccessDecisionCacheErrorsDenyAndAreNotCached(t *testing.T) {
	for _, action := range cachedChannelActions {
		t.Run(action.action+": a PDP error denies and is not cached", func(t *testing.T) {
			h := setupActionCacheTest(t, action)
			h.acs.On("AccessEvaluation", mock.Anything, mock.Anything).
				Return(model.AccessDecision{}, model.NewAppError("test", "app.pdp.access_evaluation.app_error", nil, "", http.StatusInternalServerError)).Once()
			decides(h.acs, true)

			require.False(t, h.check(), "an error denies")
			require.False(t, h.cached())
			require.True(t, h.check(), "and is asked again")
			require.Equal(t, 2, h.evaluations())
		})

		t.Run(action.action+": a subject that can't be built denies and is not cached", func(t *testing.T) {
			h := setupActionCacheTest(t, action)
			decides(h.acs, true)
			// A check on behalf of a user who doesn't exist: the subject build can't load them.
			missingUserID := model.NewId()
			rctx := h.th.Context.WithSession(h.session)
			ref := accessSubjectRefFor(rctx, missingUserID)

			for range 2 {
				require.False(t, action.check(h.th.App, rctx, missingUserID, h.th.BasicChannel))
			}
			require.Zero(t, h.evaluations())
			_, hit := h.th.App.peekAccessDecision(ref, model.AccessControlPolicyTypeChannel, h.th.BasicChannel.Id, action.action)
			require.False(t, hit)
		})
	}
}

// TestHasPermissionToChannelActionBypassesCacheWhenInactive checks that the gates in front of the
// cache still allow without evaluating or caching anything.
func TestHasPermissionToChannelActionBypassesCacheWhenInactive(t *testing.T) {
	fileActions := []cachedChannelAction{cachedUpload, cachedDownload, cachedBurnOnRead}

	t.Run("ABAC off", func(t *testing.T) {
		for _, action := range fileActions {
			h := setupActionCacheTest(t, action)
			decides(h.acs, false)
			h.th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
			})

			require.True(t, h.check(), action.action)
			require.True(t, h.check(), action.action)
			require.Zero(t, h.evaluations(), action.action)
			require.False(t, h.cached(), action.action)
		}
	})

	t.Run("PermissionPolicies flag off", func(t *testing.T) {
		for _, action := range fileActions {
			h := newActionCacheHarness(t, setupChannelReadAccessTestWithConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.PermissionPolicies = false
			}), action)
			decides(h.acs, false)

			require.True(t, h.check(), action.action)
			require.True(t, h.check(), action.action)
			require.Zero(t, h.evaluations(), action.action)
			require.False(t, h.cached(), action.action)
		}
	})
}

// TestAccessDecisionCacheSwitchedOffAllActions checks that with EnableDecisionCache off every
// cached action asks the PDP on every check.
func TestAccessDecisionCacheSwitchedOffAllActions(t *testing.T) {
	for _, action := range cachedChannelActions {
		t.Run(action.action, func(t *testing.T) {
			h := newActionCacheHarness(t, setupChannelReadAccessTestWithConfig(t, func(cfg *model.Config) {
				*cfg.AccessControlSettings.EnableDecisionCache = false
			}), action)
			decides(h.acs, true)

			for range 3 {
				require.True(t, h.check())
			}
			require.Equal(t, 3, h.evaluations())
		})
	}
}
