// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/app/properties"
	storemocks "github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

const (
	testAgentsPluginID = "mattermost-ai"
	// Plugin-owned policy types are keyed "<pluginID>:<resourceType>".
	testAgentResourceType = testAgentsPluginID + ":agent"
	testAgentAction       = "use"
)

// enablePluginAccessControl licenses and configures the server so
// pluginAccessControlAvailable() is true.
func enablePluginAccessControl(t *testing.T, th *TestHelper) {
	t.Helper()
	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})
}

func validPluginPolicy(id string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		ID:      id,
		Type:    testAgentResourceType,
		Name:    "Agent policy",
		Version: model.AccessControlPolicyVersionV0_5,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{testAgentAction},
			Expression: `user.attributes.dept == "eng"`,
		}},
	}
}

// savePluginPolicyRow plants a row directly in the open-core store, which is
// what the app layer's raw ownership read consults.
func savePluginPolicyRow(t *testing.T, th *TestHelper, policy *model.AccessControlPolicy) {
	t.Helper()
	_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, policy.ID))
	})
}

// validForeignTypePolicy is a valid v0.3 channel policy used to plant a
// foreign-type row under a plugin resource ID.
func validForeignTypePolicy(id string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		ID:       id,
		Name:     "Channel policy " + id,
		Type:     model.AccessControlPolicyTypeChannel,
		Active:   true,
		Revision: 1,
		Version:  model.AccessControlPolicyVersionV0_3,
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.AccessControlPolicyActionMembership},
			Expression: "true",
		}},
	}
}

// TestEvaluatePluginAccessRequest pins the fail-closed contract: a request is
// reported as unregulated (no_policy) only when no policy of the requested type
// exists, and any condition that leaves a governing policy unevaluated is an
// AppError the caller must treat as a deny — never an allow.
func TestEvaluatePluginAccessRequest(t *testing.T) {
	th := Setup(t).InitBasic(t)

	userID := th.BasicUser.Id
	resourceType := testAgentResourceType
	action := testAgentAction

	savePolicyRow := func(t *testing.T, policy *model.AccessControlPolicy) {
		t.Helper()
		savePluginPolicyRow(t, th, policy)
	}

	t.Run("programming errors return AppErrors", func(t *testing.T) {
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		resourceID := model.NewId()
		tests := []struct {
			name           string
			pluginID       string
			userID         string
			resourceType   string
			resourceID     string
			action         string
			expectedStatus int
			expectedID     string
		}{
			{"unprefixed resource type", testAgentsPluginID, userID, "bogus.type", resourceID, action, http.StatusBadRequest, "app.access_control.plugin.invalid_resource_type.app_error"},
			{"foreign plugin", "other-plugin", userID, resourceType, resourceID, action, http.StatusForbidden, "app.access_control.plugin.resource_type_forbidden.app_error"},
			{"malformed action", testAgentsPluginID, userID, resourceType, resourceID, "*", http.StatusBadRequest, "app.access_control.plugin.invalid_action.app_error"},
			{"invalid user id", testAgentsPluginID, "short", resourceType, resourceID, action, http.StatusBadRequest, "app.access_control.plugin.invalid_id.app_error"},
			{"invalid resource id", testAgentsPluginID, userID, resourceType, "short", action, http.StatusBadRequest, "app.access_control.plugin.invalid_id.app_error"},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, tc.pluginID, tc.userID, tc.resourceType, tc.resourceID, tc.action)
				require.NotNil(t, appErr)
				assert.Equal(t, tc.expectedStatus, appErr.StatusCode)
				assert.Equal(t, tc.expectedID, appErr.Id)
				assert.Nil(t, decision)
			})
		}
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	// Each branch is split: no stored row → no_policy; matching-type row → AppError.
	t.Run("evaluation-impossible branches resolve policy existence", func(t *testing.T) {
		branches := []struct {
			name string
			// arrange returns the userID to evaluate with and the mock ACS
			// (nil when the service is nil).
			arrange func(t *testing.T) (string, *mocks.AccessControlServiceInterface)
		}{
			{"service nil", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				th.App.Srv().ch.AccessControl = nil
				return userID, nil
			}},
			{"insufficient license", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS
				ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
				require.True(t, ok)
				return userID, mockACS
			}},
			{"disabled config flag", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
				})
				return userID, mockACS
			}},
			{"unknown user", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS
				return model.NewId(), mockACS
			}},
			{"subject build failure", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS

				// Break the CPA property-group lookup so
				// BuildAccessControlSubject fails; the fallback existence
				// read uses a different store and is unaffected.
				mockGroupStore := &storemocks.PropertyGroupStore{}
				mockGroupStore.
					On("Get", model.AccessControlPropertyGroupName).
					Return((*model.PropertyGroup)(nil), errors.New("simulated store failure"))
				ps, err := properties.New(properties.ServiceConfig{
					PropertyGroupStore: mockGroupStore,
					PropertyFieldStore: &storemocks.PropertyFieldStore{},
					PropertyValueStore: &storemocks.PropertyValueStore{},
					CallerIDExtractor:  func(rctx request.CTX) string { return "" },
				})
				require.NoError(t, err)
				originalPS := th.App.Srv().propertyService
				th.App.Srv().propertyService = ps
				t.Cleanup(func() { th.App.Srv().propertyService = originalPS })
				return userID, mockACS
			}},
			{"evaluator AppError", func(t *testing.T) (string, *mocks.AccessControlServiceInterface) {
				enablePluginAccessControl(t, th)
				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS
				mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
					Return(model.AccessDecision{}, model.NewAppError("AccessEvaluation", "app.pdp.access_evaluation.app_error", nil, "boom", http.StatusInternalServerError)).Once()
				return userID, mockACS
			}},
		}

		// Branches that must never reach the evaluator.
		evaluatorNeverCalled := map[string]bool{
			"insufficient license":  true,
			"disabled config flag":  true,
			"unknown user":          true,
			"subject build failure": true,
		}

		for _, br := range branches {
			t.Run(br.name+", no row → no_policy", func(t *testing.T) {
				evalUserID, mockACS := br.arrange(t)
				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, evalUserID, resourceType, model.NewId(), action)
				require.Nil(t, appErr)
				require.True(t, decision.Decision)
				require.True(t, decision.IsNoPolicy())
				if mockACS != nil {
					if evaluatorNeverCalled[br.name] {
						mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
					} else {
						mockACS.AssertExpectations(t)
					}
				}
			})

			t.Run(br.name+", matching-type row → AppError", func(t *testing.T) {
				evalUserID, mockACS := br.arrange(t)
				resourceID := model.NewId()
				savePolicyRow(t, validPluginPolicy(resourceID))
				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, evalUserID, resourceType, resourceID, action)
				require.Nil(t, decision)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.access_control.plugin.evaluation_unavailable.app_error", appErr.Id)
				assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
				if mockACS != nil {
					if evaluatorNeverCalled[br.name] {
						mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
					} else {
						mockACS.AssertExpectations(t)
					}
				}
			})

			t.Run(br.name+", foreign-type row → no_policy", func(t *testing.T) {
				evalUserID, mockACS := br.arrange(t)
				resourceID := model.NewId()
				savePolicyRow(t, validForeignTypePolicy(resourceID))
				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, evalUserID, resourceType, resourceID, action)
				require.Nil(t, appErr)
				require.True(t, decision.Decision)
				require.True(t, decision.IsNoPolicy())
				if mockACS != nil {
					if evaluatorNeverCalled[br.name] {
						mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
					} else {
						mockACS.AssertExpectations(t)
					}
				}
			})
		}
	})

	t.Run("foreign-type row with ABAC off returns no_policy", func(t *testing.T) {
		// A colliding foreign row can never be this plugin's policy, so the
		// resource is unregulated and the caller may apply its own default.
		// Denying instead would let any plugin grief another's resource IDs.
		enablePluginAccessControl(t, th)
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
		})

		resourceID := model.NewId()
		savePolicyRow(t, validForeignTypePolicy(resourceID))

		decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, userID, resourceType, resourceID, action)
		require.Nil(t, appErr)
		require.True(t, decision.Decision)
		require.True(t, decision.IsNoPolicy())
		mockACS.AssertNotCalled(t, "AccessEvaluation", mock.Anything, mock.Anything)
	})

	t.Run("evaluator decisions pass through without a fallback read", func(t *testing.T) {
		enablePluginAccessControl(t, th)

		tests := []struct {
			name     string
			decision model.AccessDecision
			// saveRow plants a matching-type row to pin that the fallback
			// existence read never runs on the happy path.
			saveRow      bool
			wantAllow    bool
			wantNoPolicy bool
		}{
			{"no_policy (with a stored row — fallback must not run)", model.NewNoPolicyAccessDecision(), true, true, true},
			{"deny", model.AccessDecision{Decision: false}, false, false, false},
			{"allow", model.AccessDecision{Decision: true}, false, true, false},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				resourceID := model.NewId()
				if tc.saveRow {
					savePolicyRow(t, validPluginPolicy(resourceID))
				}

				mockACS := &mocks.AccessControlServiceInterface{}
				th.App.Srv().ch.AccessControl = mockACS
				mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
					return req.Resource.ID == resourceID &&
						req.Resource.Type == resourceType &&
						req.Action == action &&
						req.Subject.ID == userID &&
						req.Subject.RoleForScope(model.AccessControlSubjectScopeChannel) == ""
				})).Return(tc.decision, nil).Once()

				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, userID, resourceType, resourceID, action)
				require.Nil(t, appErr)
				require.Equal(t, tc.wantAllow, decision.Decision)
				require.Equal(t, tc.wantNoPolicy, decision.IsNoPolicy())
				mockACS.AssertExpectations(t)
			})
		}
	})
}

// TestEvaluatePluginAccessRequestStoreError pins that when the fallback store
// read itself fails, the caller gets an error rather than a no-policy allow.
// Uses the store-mock helper because a read error cannot be arranged on the
// real store.
func TestEvaluatePluginAccessRequestStoreError(t *testing.T) {
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	mockACPStore := &storemocks.AccessControlPolicyStore{}
	mockACPStore.On("Get", mock.Anything, mock.AnythingOfType("string")).
		Return(nil, errors.New("simulated store failure"))
	mockStore.On("AccessControlPolicy").Return(mockACPStore)

	// No license here, so pluginAccessControlAvailable() is false and the
	// fallback read runs.
	require.Nil(t, th.App.Srv().ch.AccessControl)

	// Programming errors return before the fallback read.
	_, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, model.NewId(), testAgentResourceType, "short", testAgentAction)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.access_control.plugin.invalid_id.app_error", appErr.Id)
	mockACPStore.AssertNotCalled(t, "Get", mock.Anything, mock.Anything)

	decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, model.NewId(), testAgentResourceType, model.NewId(), testAgentAction)
	require.Nil(t, decision)
	require.NotNil(t, appErr)
	assert.Equal(t, "app.access_control.plugin.evaluation_unavailable.app_error", appErr.Id)
	mockACPStore.AssertExpectations(t)
}

func TestSavePluginAccessControlPolicy(t *testing.T) {
	th := Setup(t).InitBasic(t)
	actingUserID := th.BasicUser.Id

	notFoundErr := model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound)

	t.Run("service nil returns 501", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, validPluginPolicy(model.NewId()))
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("nil policy and missing ID rejected", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_id.app_error", appErr.Id)

		p := validPluginPolicy("")
		_, appErr = th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_id.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("scope check failures", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		p.Type = model.AccessControlPolicyTypeChannel
		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_resource_type.app_error", appErr.Id)

		_, appErr = th.App.SavePluginAccessControlPolicy(th.Context, "other-plugin", actingUserID, validPluginPolicy(model.NewId()))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.resource_type_forbidden.app_error", appErr.Id)
		assert.Equal(t, http.StatusForbidden, appErr.StatusCode)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("acting user validation", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, "short", validPluginPolicy(model.NewId()))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_acting_user.app_error", appErr.Id)

		_, appErr = th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, model.NewId(), validPluginPolicy(model.NewId()))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_acting_user.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("create path forces v0.5 and Active, threads acting user session, passes rules verbatim", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		p.Version = "v0.3" // caller-supplied version must be overridden
		p.Active = false
		expression := p.Rules[0].Expression

		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()
		mockACS.On("SavePolicy", mock.MatchedBy(func(c request.CTX) bool {
			return c.Session() != nil && c.Session().UserId == actingUserID
		}), mock.MatchedBy(func(saved *model.AccessControlPolicy) bool {
			return saved.Version == model.AccessControlPolicyVersionV0_5 &&
				saved.Active &&
				len(saved.Rules) == 1 &&
				len(saved.Rules[0].Actions) == 1 &&
				saved.Rules[0].Actions[0] == testAgentAction &&
				saved.Rules[0].Expression == expression
		})).Return(p, nil).Once()

		saved, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.Nil(t, appErr)
		require.NotNil(t, saved)
		mockACS.AssertExpectations(t)
	})

	t.Run("update path saves when stored type matches", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		existing := validPluginPolicy(p.ID)
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(existing, nil).Once()
		mockACS.On("SavePolicy", mock.Anything, mock.Anything).Return(p, nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.Nil(t, appErr)
		mockACS.AssertExpectations(t)
	})

	t.Run("cross-type ID collision rejected", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		channelPolicy := &model.AccessControlPolicy{ID: p.ID, Type: model.AccessControlPolicyTypeChannel}
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(channelPolicy, nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.type_conflict.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("validator failures surface and skip SavePolicy", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		p.Imports = []string{model.NewId()}
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, "model.access_policy.is_valid.imports.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("wildcard action rejected, never rewritten", func(t *testing.T) {
		// The legacy "*"→membership rewrite must not apply to the plugin path.
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		p.Rules[0].Actions = []string{"*"}
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, notFoundErr).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, "model.access_policy.is_valid.actions.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})

	t.Run("existence probe infra error propagates", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		infraErr := model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusInternalServerError)
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(nil, infraErr).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		mockACS.AssertNotCalled(t, "SavePolicy", mock.Anything, mock.Anything)
	})
}

func TestGetPluginAccessControlPolicy(t *testing.T) {
	th := Setup(t).InitBasic(t)

	t.Run("service nil returns 501", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		_, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("invalid id returns 400", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		_, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, "short")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_id.app_error", appErr.Id)
	})

	t.Run("type owned by the caller returns the normalized policy", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)

		// Ownership comes from the raw row; the returned policy comes from the
		// enterprise read, which is the only one that normalizes.
		normalized := validPluginPolicy(p.ID)
		normalized.Rules[0].Expression = `user.attributes.dept == "eng" /* normalized */`
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(normalized, nil).Once()

		policy, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, p.ID)
		require.Nil(t, appErr)
		require.Equal(t, normalized, policy)
		mockACS.AssertExpectations(t)
	})

	t.Run("a policy that turned foreign between the two reads is not disclosed", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		// The raw gate sees the caller's own type, so ownership passes.
		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)

		// The normalized read is independent: simulate the row having been
		// deleted and re-created under a foreign type in between.
		recreated := validPluginPolicy(p.ID)
		recreated.Type = "other-plugin:agent"
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(recreated, nil).Once()

		policy, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, p.ID)
		require.Nil(t, policy, "a foreign policy must never be returned, even if the raw gate passed")
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("absent and foreign-type policy return the same byte-identical 404", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		absentID := model.NewId()

		// A channel policy and another plugin's policy both sit outside the
		// caller's type namespace.
		channelPolicy := validForeignTypePolicy(model.NewId())
		savePluginPolicyRow(t, th, channelPolicy)

		foreignPlugin := validPluginPolicy(model.NewId())
		foreignPlugin.Type = "other-plugin:agent"
		savePluginPolicyRow(t, th, foreignPlugin)

		var errs []*model.AppError
		for _, id := range []string{absentID, channelPolicy.ID, foreignPlugin.ID} {
			policy, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, id)
			require.Nil(t, policy, "a policy outside the caller's namespace must never be returned")
			require.NotNil(t, appErr)
			assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
			assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
			errs = append(errs, appErr)
		}
		assert.Equal(t, errs[0].Error(), errs[1].Error())
		assert.Equal(t, errs[0].Error(), errs[2].Error())
		// The ownership gate runs on the raw row, so a foreign policy is never
		// handed to the normalizer — whose failures would otherwise be
		// distinguishable from this 404.
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("foreign policy that would fail to normalize still returns the uniform 404", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		foreign := validPluginPolicy(model.NewId())
		foreign.Type = "other-plugin:agent"
		savePluginPolicyRow(t, th, foreign)

		// Any call into the normalizer would leak that the row exists.
		mockACS.On("GetPolicy", mock.Anything, foreign.ID).
			Return(nil, model.NewAppError("GetPolicy", "app.pap.rehydrate_rank.app_error", nil, "cannot normalize", http.StatusInternalServerError)).Maybe()

		policy, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, foreign.ID)
		require.Nil(t, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("non-owner plugin cannot read an owned policy", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)

		policy, appErr := th.App.GetPluginAccessControlPolicy(th.Context, "other-plugin", p.ID)
		require.Nil(t, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	})

	t.Run("normalized read error propagates once ownership passes", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)

		mockACS.On("GetPolicy", mock.Anything, p.ID).
			Return(nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "db down", http.StatusInternalServerError)).Once()

		_, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, p.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		mockACS.AssertExpectations(t)
	})
}

func TestDeletePluginAccessControlPolicy(t *testing.T) {
	th := Setup(t).InitBasic(t)
	actingUserID := th.BasicUser.Id
	resourceType := testAgentResourceType

	t.Run("service nil returns 501", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("programming errors", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, "bogus.type", model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_resource_type.app_error", appErr.Id)

		appErr = th.App.DeletePluginAccessControlPolicy(th.Context, "other-plugin", actingUserID, resourceType, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.resource_type_forbidden.app_error", appErr.Id)

		appErr = th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, "short", resourceType, model.NewId())
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_acting_user.app_error", appErr.Id)

		appErr = th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, "short")
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_id.app_error", appErr.Id)

		mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "DeletePolicy", mock.Anything, mock.Anything)
	})

	t.Run("absent and stored-type mismatch return the same byte-identical 404", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		absentID := model.NewId()
		mismatch := validForeignTypePolicy(model.NewId())
		savePluginPolicyRow(t, th, mismatch)

		absentErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, absentID)
		mismatchErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, mismatch.ID)

		require.NotNil(t, absentErr)
		require.NotNil(t, mismatchErr)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", absentErr.Id)
		assert.Equal(t, absentErr.Error(), mismatchErr.Error())
		// A foreign-type policy must never reach the delete.
		mockACS.AssertNotCalled(t, "DeletePolicy", mock.Anything, mock.Anything)
	})

	t.Run("happy path deletes after the stored-type check", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)
		mockACS.On("DeletePolicy", mock.Anything, p.ID).Return(nil).Once()

		appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, p.ID)
		require.Nil(t, appErr)
		mockACS.AssertExpectations(t)
	})

	t.Run("delete error propagates", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)
		mockACS.On("DeletePolicy", mock.Anything, p.ID).
			Return(model.NewAppError("DeletePolicy", "app.pap.delete_policy.app_error", nil, "db down", http.StatusInternalServerError)).Once()

		appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, p.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
		mockACS.AssertExpectations(t)
	})
}

// TestPluginAccessControlPolicyReadStoreError pins that a failing ownership
// read propagates as a 500 and never reaches the normalizer. Uses the
// store-mock helper because a read error cannot be arranged on the real store.
// The delete path resolves ownership through the same readStoredPolicyType
// helper, so it inherits this behaviour.
func TestPluginAccessControlPolicyReadStoreError(t *testing.T) {
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*storemocks.Store)
	mockACPStore := &storemocks.AccessControlPolicyStore{}
	mockACPStore.On("Get", mock.Anything, mock.AnythingOfType("string")).
		Return(nil, errors.New("simulated store failure"))
	mockStore.On("AccessControlPolicy").Return(mockACPStore)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().ch.AccessControl = mockACS

	_, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, model.NewId())
	require.NotNil(t, appErr)
	assert.Equal(t, http.StatusInternalServerError, appErr.StatusCode)

	mockACS.AssertNotCalled(t, "GetPolicy", mock.Anything, mock.Anything)
	mockACPStore.AssertExpectations(t)
}

func TestPluginAccessControlCELProxies(t *testing.T) {
	th := Setup(t).InitBasic(t)
	actingUserID := th.BasicUser.Id
	resourceType := testAgentResourceType
	expression := `user.attributes.dept == "eng"`

	t.Run("scope check enforced on check/test/visual_ast", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		_, appErr := th.App.CheckPluginAccessControlExpression(th.Context, "other-plugin", actingUserID, resourceType, expression)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.resource_type_forbidden.app_error", appErr.Id)

		_, appErr = th.App.QueryUsersForPluginAccessControlExpression(th.Context, testAgentsPluginID, actingUserID, "bogus.type", expression, "", "", 10)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_resource_type.app_error", appErr.Id)

		_, appErr = th.App.GetPluginAccessControlVisualAST(th.Context, "other-plugin", actingUserID, resourceType, expression)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.resource_type_forbidden.app_error", appErr.Id)

		mockACS.AssertNotCalled(t, "CheckExpression", mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything)
		mockACS.AssertNotCalled(t, "ExpressionToVisualAST", mock.Anything, mock.Anything)
	})

	t.Run("check expression threads acting user session", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("CheckExpression", mock.MatchedBy(func(c request.CTX) bool {
			return c.Session() != nil && c.Session().UserId == actingUserID
		}), expression).Return([]model.CELExpressionError{}, nil).Once()

		errs, appErr := th.App.CheckPluginAccessControlExpression(th.Context, testAgentsPluginID, actingUserID, resourceType, expression)
		require.Nil(t, appErr)
		require.Empty(t, errs)
		mockACS.AssertExpectations(t)
	})

	t.Run("query users wraps response and clamps limit", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		cursorID := model.NewId()
		users := []*model.User{th.BasicUser}
		mockACS.On("QueryUsersForExpression", mock.MatchedBy(func(c request.CTX) bool {
			return c.Session() != nil && c.Session().UserId == actingUserID
		}), expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.Term == "ali" &&
				opts.Limit == pluginAccessControlQueryLimitMax &&
				opts.Cursor.TargetID == cursorID
		})).Return(users, int64(1), nil).Once()

		resp, appErr := th.App.QueryUsersForPluginAccessControlExpression(th.Context, testAgentsPluginID, actingUserID, resourceType, expression, "ali", cursorID, 10000)
		require.Nil(t, appErr)
		require.Equal(t, users, resp.Users)
		require.Equal(t, int64(1), resp.Total)
		mockACS.AssertExpectations(t)

		mockACS.On("QueryUsersForExpression", mock.Anything, expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
			return opts.Limit == pluginAccessControlQueryLimitDefault
		})).Return(users, int64(1), nil).Once()
		_, appErr = th.App.QueryUsersForPluginAccessControlExpression(th.Context, testAgentsPluginID, actingUserID, resourceType, expression, "", "", 0)
		require.Nil(t, appErr)
		mockACS.AssertExpectations(t)
	})

	t.Run("autocomplete requires only a valid acting user", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		_, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, model.NewId(), "", 10)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.invalid_acting_user.app_error", appErr.Id)

		fields, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, actingUserID, "", 10)
		require.Nil(t, appErr)
		require.NotEmpty(t, fields, "native attribute fields expected on the first page")
	})

	t.Run("autocomplete gates on missing service", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		_, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, actingUserID, "", 10)
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
	})

	t.Run("visual AST proxies to the service", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		visual := &model.VisualExpression{}
		mockACS.On("ExpressionToVisualAST", mock.Anything, expression).Return(visual, nil).Once()

		ast, appErr := th.App.GetPluginAccessControlVisualAST(th.Context, testAgentsPluginID, actingUserID, resourceType, expression)
		require.Nil(t, appErr)
		require.Equal(t, visual, ast)
		mockACS.AssertExpectations(t)
	})
}

// pluginAuditCapture routes the test server's audit logger to a temp file so
// tests can assert on emitted audit records.
type pluginAuditCapture struct {
	t    *testing.T
	th   *TestHelper
	path string
}

func startPluginAuditCapture(t *testing.T, th *TestHelper) *pluginAuditCapture {
	t.Helper()
	path := filepath.Join(t.TempDir(), "audit.log")
	cfg, err := config.MloggerConfigFromAuditConfig(model.ExperimentalAuditSettings{
		FileEnabled: model.NewPointer(true),
		FileName:    model.NewPointer(path),
	}, nil)
	require.NoError(t, err)
	require.NoError(t, th.App.Srv().Audit.Configure(cfg))
	return &pluginAuditCapture{t: t, th: th, path: path}
}

// recordsFor returns all audit records logged so far for the given event.
func (c *pluginAuditCapture) recordsFor(event string) []map[string]any {
	c.t.Helper()
	require.NoError(c.t, c.th.App.Srv().Audit.Flush())
	data, err := os.ReadFile(c.path)
	if errors.Is(err, os.ErrNotExist) {
		// The file target creates the log lazily on first write.
		return nil
	}
	require.NoError(c.t, err)

	var out []map[string]any
	for line := range bytesLines(data) {
		var rec map[string]any
		require.NoError(c.t, json.Unmarshal(line, &rec))
		if rec[model.AuditKeyEventName] == event {
			out = append(out, rec)
		}
	}
	return out
}

// bytesLines yields non-empty newline-separated chunks of data.
func bytesLines(data []byte) func(func([]byte) bool) {
	return func(yield func([]byte) bool) {
		start := 0
		for i := range data {
			if data[i] != '\n' {
				continue
			}
			if i > start && !yield(data[start:i]) {
				return
			}
			start = i + 1
		}
		if start < len(data) {
			yield(data[start:])
		}
	}
}

func auditParam(t *testing.T, rec map[string]any, key string) any {
	t.Helper()
	event, ok := rec[model.AuditKeyEvent].(map[string]any)
	require.True(t, ok, "audit record has no event data")
	params, ok := event["parameters"].(map[string]any)
	require.True(t, ok, "audit record has no event parameters")
	return params[key]
}

// TestPluginAccessControlAudit pins that Save/Delete audit every attempt,
// including precondition failures. Save stamps operation="create_or_update"
// from entry and refines it to "create"/"update" once the existence probe
// resolves; Delete stamps "delete".
func TestPluginAccessControlAudit(t *testing.T) {
	th := Setup(t).InitBasic(t)
	capture := startPluginAuditCapture(t, th)

	actingUserID := th.BasicUser.Id
	resourceType := testAgentResourceType

	// assertNextRecord runs fn and returns the single new audit record for event.
	assertNextRecord := func(t *testing.T, event, wantStatus string, fn func()) map[string]any {
		t.Helper()
		before := len(capture.recordsFor(event))
		fn()
		records := capture.recordsFor(event)
		require.Len(t, records, before+1, "expected exactly one new %s audit record", event)
		rec := records[len(records)-1]
		assert.Equal(t, wantStatus, rec[model.AuditKeyStatus])
		return rec
	}

	t.Run("save: service unavailable still audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, validPluginPolicy(model.NewId()))
			require.NotNil(t, appErr)
		})
		assert.Equal(t, testAgentsPluginID, auditParam(t, rec, "plugin_id"))
		assert.Equal(t, actingUserID, auditParam(t, rec, "actor"))
		assert.Equal(t, resourceType, auditParam(t, rec, "resource_type"))
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
	})

	t.Run("save: invalid (nil) policy audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, nil)
			require.NotNil(t, appErr)
		})
		assert.Equal(t, testAgentsPluginID, auditParam(t, rec, "plugin_id"))
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
	})

	t.Run("save: ownership failure audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, "other-plugin", actingUserID, validPluginPolicy(model.NewId()))
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "other-plugin", auditParam(t, rec, "plugin_id"))
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
	})

	t.Run("save: invalid acting user audits as fail with operation", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, "short", validPluginPolicy(model.NewId()))
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
	})

	t.Run("save: existence-probe error audits as fail with operation", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		mockACS.On("GetPolicy", mock.Anything, p.ID).
			Return(nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "db down", http.StatusInternalServerError)).Once()

		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
		mockACS.AssertExpectations(t)
	})

	t.Run("save: cross-type conflict audits as fail with operation", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		stored := validPluginPolicy(p.ID)
		stored.Type = model.AccessControlPolicyTypeChannel
		mockACS.On("GetPolicy", mock.Anything, p.ID).Return(stored, nil).Once()

		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "create_or_update", auditParam(t, rec, "operation"))
		mockACS.AssertExpectations(t)
	})

	t.Run("save: success audits as success with operation", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		mockACS.On("GetPolicy", mock.Anything, p.ID).
			Return(nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound)).Once()
		mockACS.On("SavePolicy", mock.Anything, mock.Anything).Return(p, nil).Once()

		rec := assertNextRecord(t, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusSuccess, func() {
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, p)
			require.Nil(t, appErr)
		})
		assert.Equal(t, "create", auditParam(t, rec, "operation"))
		mockACS.AssertExpectations(t)
	})

	t.Run("delete: service unavailable still audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		rec := assertNextRecord(t, model.AuditEventDeletePluginAccessControlPolicy, model.AuditStatusFail, func() {
			appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, model.NewId())
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "delete", auditParam(t, rec, "operation"))
		assert.Equal(t, actingUserID, auditParam(t, rec, "actor"))
	})

	t.Run("delete: malformed policy ID audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		rec := assertNextRecord(t, model.AuditEventDeletePluginAccessControlPolicy, model.AuditStatusFail, func() {
			appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, "short")
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "short", auditParam(t, rec, "policy_id"))
		assert.Equal(t, "delete", auditParam(t, rec, "operation"))
	})

	t.Run("delete: ownership failure audits as fail", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = &mocks.AccessControlServiceInterface{}
		rec := assertNextRecord(t, model.AuditEventDeletePluginAccessControlPolicy, model.AuditStatusFail, func() {
			appErr := th.App.DeletePluginAccessControlPolicy(th.Context, "other-plugin", actingUserID, resourceType, model.NewId())
			require.NotNil(t, appErr)
		})
		assert.Equal(t, "other-plugin", auditParam(t, rec, "plugin_id"))
		assert.Equal(t, "delete", auditParam(t, rec, "operation"))
	})

	t.Run("delete: success audits as success", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().ch.AccessControl = mockACS

		p := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, p)
		mockACS.On("DeletePolicy", mock.Anything, p.ID).Return(nil).Once()

		rec := assertNextRecord(t, model.AuditEventDeletePluginAccessControlPolicy, model.AuditStatusSuccess, func() {
			appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, actingUserID, resourceType, p.ID)
			require.Nil(t, appErr)
		})
		assert.Equal(t, p.ID, auditParam(t, rec, "policy_id"))
		assert.Equal(t, "delete", auditParam(t, rec, "operation"))
		mockACS.AssertExpectations(t)
	})
}
