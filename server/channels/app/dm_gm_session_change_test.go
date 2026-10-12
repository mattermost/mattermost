// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// setupDMGMSessionChangeTest collects the mdm_enrolled and os_version session attributes and
// saves a permission policy whose dm_gm_read_access rule is expression. The PDP allows reading
// conversations exactly when the session reports mdm_enrolled "true".
func setupDMGMSessionChangeTest(t *testing.T, expression string) (*channelReadAccessHarness, *eMocks.AccessControlServiceInterface) {
	t.Helper()

	h := setupChannelReadAccessTest(t)
	h.th.ConfigStore.SetReadOnlyFF(false)
	h.th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SessionAttributes = true })
	h.th.ConfigStore.SetReadOnlyFF(true)
	enableSessionAttributeFields(t, h.th,
		model.SessionAttributesPropertyFieldMDMEnrolled, model.SessionAttributesPropertyFieldOSVersion)

	policy, err := h.th.App.Srv().Store().AccessControlPolicy().Save(h.rctx, &model.AccessControlPolicy{
		ID:       model.NewId(),
		Type:     model.AccessControlPolicyTypePermission,
		Name:     "dm-gm-read",
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Roles:    []string{model.SystemUserRoleId},
		Rules: []model.AccessControlPolicyRule{
			{Actions: []string{model.AccessControlPolicyActionDMGMReadAccess}, Expression: expression},
		},
	})
	require.NoError(t, err)
	t.Cleanup(func() { _ = h.th.App.Srv().Store().AccessControlPolicy().Delete(h.rctx, policy.ID) })
	h.th.App.Srv().Store().AccessControlPolicy().ClearEtagCache()

	mockACS := h.mockACS(t)
	dmGmReadGoverned(mockACS)
	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(isDMGMRequest(model.AccessControlPolicyActionDMGMReadAccess))).
		Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
			return model.AccessDecision{Decision: req.Subject.Session[model.SessionAttributesPropertyFieldMDMEnrolled] == "true"}
		}, nil)
	return h, mockACS
}

// reportSessionAttributes runs a request from the desktop app carrying attrs, and returns the
// permission_policy_updated events it published.
func reportSessionAttributes(t *testing.T, h *channelReadAccessHarness, attrs map[string]any) []*model.WebSocketEvent {
	t.Helper()

	r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
	r.Header.Set(model.SessionAttributeHeaderClientAttributes, encodeClientSessionAttributesHeader(t, attrs))

	var updates []*model.WebSocketEvent
	for _, event := range captureWebSocketEvents(t, h.th, func() { h.th.App.ProcessSessionAttributesRequest(h.rctx, r) }) {
		if event.EventType() == model.WebsocketEventPermissionPolicyUpdated {
			updates = append(updates, event)
		}
	}
	return updates
}

func TestDMGMSessionChange(t *testing.T) {
	const referencesSession = `user.session.mdm_enrolled == "true"`

	requireSessionUpdate := func(t *testing.T, h *channelReadAccessHarness, updates []*model.WebSocketEvent) {
		t.Helper()
		require.Len(t, updates, 1)
		broadcast := updates[0].GetBroadcast()
		require.Equal(t, h.th.BasicUser.Id, broadcast.UserId)
		require.Equal(t, []string{broadcastOnlySession}, broadcast.BroadcastHooks)
		require.Equal(t, []map[string]any{{"session_id": h.rctx.Session().Id}}, broadcast.BroadcastHookArgs)
	}

	t.Run("a flip notifies the session, in both directions", func(t *testing.T) {
		h, _ := setupDMGMSessionChangeTest(t, referencesSession)

		requireSessionUpdate(t, h, reportSessionAttributes(t, h, map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "true"}))
		requireSessionUpdate(t, h, reportSessionAttributes(t, h, map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "false"}))
		requireSessionUpdate(t, h, reportSessionAttributes(t, h, map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "true"}))
	})

	t.Run("a change that flips nothing publishes nothing", func(t *testing.T) {
		h, mockACS := setupDMGMSessionChangeTest(t, referencesSession)
		requireSessionUpdate(t, h, reportSessionAttributes(t, h, map[string]any{
			model.SessionAttributesPropertyFieldMDMEnrolled: "true",
			model.SessionAttributesPropertyFieldOSVersion:   "14.1",
		}))
		mockACS.Calls = nil

		require.Empty(t, reportSessionAttributes(t, h, map[string]any{
			model.SessionAttributesPropertyFieldMDMEnrolled: "true",
			model.SessionAttributesPropertyFieldOSVersion:   "14.2",
		}))
		mockACS.AssertNumberOfCalls(t, "AccessEvaluation", 2)
	})

	t.Run("the same attributes again evaluate nothing", func(t *testing.T) {
		h, mockACS := setupDMGMSessionChangeTest(t, referencesSession)
		attrs := map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "true"}
		requireSessionUpdate(t, h, reportSessionAttributes(t, h, attrs))
		mockACS.Calls = nil

		require.Empty(t, reportSessionAttributes(t, h, attrs))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("a policy that doesn't reference the session evaluates nothing", func(t *testing.T) {
		h, mockACS := setupDMGMSessionChangeTest(t, `user.attributes.team == "engineering"`)

		require.Empty(t, reportSessionAttributes(t, h, map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "true"}))
		require.Empty(t, reportSessionAttributes(t, h, map[string]any{model.SessionAttributesPropertyFieldMDMEnrolled: "false"}))
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})
}

func TestDMGMPoliciesReferenceSessionAttributes(t *testing.T) {
	setup := func(t *testing.T) (*TestHelper, *storemocks.AccessControlPolicyStore) {
		t.Helper()
		th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
			cfg.FeatureFlags.PermissionPolicies = true
			cfg.FeatureFlags.SessionAttributes = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		})
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		th.App.Srv().ch.AccessControl = &eMocks.AccessControlServiceInterface{}

		mockACP := &storemocks.AccessControlPolicyStore{}
		th.App.Srv().Store().(*storemocks.Store).On("AccessControlPolicy").Return(mockACP)
		return th, mockACP
	}
	policies := func(n int, expression string) []*model.AccessControlPolicy {
		page := make([]*model.AccessControlPolicy, n)
		for i := range page {
			page[i] = &model.AccessControlPolicy{
				ID:    fmt.Sprintf("policy%04d", i),
				Type:  model.AccessControlPolicyTypePermission,
				Rules: []model.AccessControlPolicyRule{{Actions: []string{model.AccessControlPolicyActionDMGMWriteAccess}, Expression: expression}},
			}
		}
		return page
	}
	search := func(cursor string) any {
		return mock.MatchedBy(func(opts model.AccessControlPolicySearch) bool {
			return opts.Type == model.AccessControlPolicyTypePermission &&
				opts.Limit == dmGmPolicySearchPageSize &&
				opts.Cursor.ID == cursor
		})
	}

	t.Run("pages past a full page, and caches the answer per epoch", func(t *testing.T) {
		th, mockACP := setup(t)
		first := policies(dmGmPolicySearchPageSize, `user.attributes.team == "engineering"`)
		mockACP.On("GetEtagEpoch", mock.Anything, "").Return("1-1001", nil)
		mockACP.On("SearchPolicies", mock.Anything, search("")).Return(first, int64(1001), nil).Once()
		mockACP.On("SearchPolicies", mock.Anything, search(first[len(first)-1].ID)).
			Return(policies(1, `user.session.mdm_enrolled == "true"`), int64(1001), nil).Once()

		require.True(t, th.App.dmGmPoliciesReferenceSessionAttributes(th.Context))
		require.True(t, th.App.dmGmPoliciesReferenceSessionAttributes(th.Context))
		mockACP.AssertNumberOfCalls(t, "SearchPolicies", 2)
	})

	t.Run("searches again once the epoch moves", func(t *testing.T) {
		th, mockACP := setup(t)
		mockACP.On("GetEtagEpoch", mock.Anything, "").Return("1-1", nil).Once()
		mockACP.On("GetEtagEpoch", mock.Anything, "").Return("2-1", nil).Once()
		mockACP.On("SearchPolicies", mock.Anything, search("")).
			Return(policies(1, `user.attributes.team == "engineering"`), int64(1), nil).Once()
		mockACP.On("SearchPolicies", mock.Anything, search("")).
			Return(policies(1, `user.session.mdm_enrolled == "true"`), int64(1), nil).Once()

		require.False(t, th.App.dmGmPoliciesReferenceSessionAttributes(th.Context))
		require.True(t, th.App.dmGmPoliciesReferenceSessionAttributes(th.Context))
	})

	t.Run("assumes a reference when the epoch can't be read", func(t *testing.T) {
		th, mockACP := setup(t)
		mockACP.On("GetEtagEpoch", mock.Anything, "").Return("", fmt.Errorf("boom"))

		require.True(t, th.App.dmGmPoliciesReferenceSessionAttributes(th.Context))
		mockACP.AssertNotCalled(t, "SearchPolicies", mock.Anything, mock.Anything)
	})
}
