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
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

type pluginPolicyMode struct {
	name       string
	available  bool
	conditions bool
}

// The engine's answer for a policy type: not served, people-list rules only,
// or attribute conditions too.
var pluginPolicyModes = []pluginPolicyMode{
	{"unavailable", false, false},
	{"people-only", true, false},
	{"conditions", true, true},
}

func (m pluginPolicyMode) mock() *mocks.AccessControlServiceInterface {
	return pluginModeMock(m.available, m.conditions)
}

func pluginNotFound(where string) *model.AppError {
	return model.NewAppError(where, "app.pap.plugin.policy_not_found", nil, "", http.StatusNotFound)
}

// TestPluginAccessControlModeMatrix runs every plugin proxy under each engine
// mode. Unavailable keeps the pre-existing behaviour (existence fallback for
// evaluation, store fallbacks for get and delete, 501 elsewhere); available
// calls the engine's plugin methods.
func TestPluginAccessControlModeMatrix(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)

	userID := th.BasicUser.Id
	adminID := th.SystemAdminUser.Id
	resourceType := testAgentResourceType
	action := testAgentAction
	expression := `user.attributes.dept == "eng"`

	for _, mode := range pluginPolicyModes {
		t.Run(mode.name, func(t *testing.T) {
			t.Run("Evaluate", func(t *testing.T) {
				resourceID := model.NewId()
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				if mode.available {
					mockACS.On("EvaluatePluginResource", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
						return req.Resource.ID == resourceID && req.Resource.Type == resourceType && req.Subject.ID == userID
					})).Return(model.AccessDecision{Decision: false}, nil).Once()
				}

				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, userID, resourceType, resourceID, action)
				require.Nil(t, appErr)
				if mode.available {
					assert.False(t, decision.Decision, "the engine's deny must pass through")
					assert.False(t, decision.IsNoPolicy())
					mockACS.AssertExpectations(t)
				} else {
					assert.True(t, decision.IsNoPolicy(), "no stored policy, so the fallback reports no_policy")
					mockACS.AssertNotCalled(t, "EvaluatePluginResource", mock.Anything, mock.Anything)
				}
			})

			t.Run("Evaluate with a stored policy and no usable engine denies", func(t *testing.T) {
				policy := validPluginPolicy(model.NewId())
				savePluginPolicyRow(t, th, policy)
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				if mode.available {
					mockACS.On("EvaluatePluginResource", mock.Anything, mock.Anything).
						Return(model.AccessDecision{}, model.NewAppError("EvaluatePluginResource", "app.pdp.access_evaluation.app_error", nil, "boom", http.StatusInternalServerError)).Once()
				}

				decision, appErr := th.App.EvaluatePluginAccessRequest(th.Context, testAgentsPluginID, userID, resourceType, policy.ID, action)
				require.Nil(t, decision)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.access_control.plugin.evaluation_unavailable.app_error", appErr.Id)
				assert.Equal(t, http.StatusServiceUnavailable, appErr.StatusCode)
			})

			t.Run("Batch", func(t *testing.T) {
				allowID, gated := model.NewId(), validPluginPolicy(model.NewId())
				savePluginPolicyRow(t, th, gated)
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				if mode.available {
					mockACS.On("EvaluatePluginResource", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool { return req.Resource.ID == allowID })).
						Return(model.AccessDecision{Decision: true}, nil).Once()
					mockACS.On("EvaluatePluginResource", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool { return req.Resource.ID == gated.ID })).
						Return(model.AccessDecision{}, model.NewAppError("EvaluatePluginResource", "app.pdp.access_evaluation.app_error", nil, "boom", http.StatusInternalServerError)).Once()
				}

				decisions, err := th.App.EvaluatePluginAccessRequestBatch(th.Context, testAgentsPluginID, userID, resourceType, action, []string{allowID, gated.ID})
				require.NoError(t, err)
				_, present := decisions[gated.ID]
				assert.False(t, present, "a governed ID the engine could not evaluate is omitted, which the caller reads as deny")
				require.Contains(t, decisions, allowID)
				if mode.available {
					assert.True(t, decisions[allowID].Decision)
					assert.False(t, decisions[allowID].IsNoPolicy())
					mockACS.AssertExpectations(t)
				} else {
					assert.True(t, decisions[allowID].IsNoPolicy())
					mockACS.AssertNotCalled(t, "EvaluatePluginResource", mock.Anything, mock.Anything)
				}
			})

			t.Run("Save", func(t *testing.T) {
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				policy := validPluginPolicy(model.NewId())
				if !mode.conditions {
					policy.Rules[0].Expression = `user.id in ["` + userID + `"]`
				}

				if mode.available {
					mockACS.On("GetPluginPolicy", mock.Anything, resourceType, policy.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()
					mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
						Return([]*model.User{{Id: userID}}, int64(1), nil).Once()
					mockACS.On("SavePluginPolicy", mock.MatchedBy(func(c request.CTX) bool {
						return c.Session() != nil && c.Session().UserId == userID
					}), mock.MatchedBy(func(saved *model.AccessControlPolicy) bool {
						return saved.ID == policy.ID && saved.Active && saved.Version == model.AccessControlPolicyVersionV0_5
					})).Return(policy, nil).Once()
				}

				saved, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, policy)
				if !mode.available {
					require.NotNil(t, appErr)
					assert.Equal(t, "app.pap.plugin.unavailable", appErr.Id)
					assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
					mockACS.AssertNotCalled(t, "GetPluginPolicy", mock.Anything, mock.Anything, mock.Anything)
					mockACS.AssertNotCalled(t, "SavePluginPolicy", mock.Anything, mock.Anything)
					return
				}
				require.Nil(t, appErr)
				require.Equal(t, policy, saved)
				mockACS.AssertExpectations(t)
			})

			t.Run("Get", func(t *testing.T) {
				stored := validPluginPolicy(model.NewId())
				savePluginPolicyRow(t, th, stored)
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				normalized := validPluginPolicy(stored.ID)
				normalized.Name = "normalized"
				if mode.available {
					mockACS.On("GetPluginPolicy", mock.Anything, resourceType, stored.ID).Return(normalized, nil).Once()
				}

				got, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, stored.ID)
				require.Nil(t, appErr)
				if mode.available {
					assert.Equal(t, "normalized", got.Name)
					mockACS.AssertExpectations(t)
				} else {
					assert.Equal(t, stored.Name, got.Name, "the stored policy is returned as-is")
					mockACS.AssertNotCalled(t, "GetPluginPolicy", mock.Anything, mock.Anything, mock.Anything)
				}
			})

			t.Run("Delete", func(t *testing.T) {
				stored := validPluginPolicy(model.NewId())
				_, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, stored)
				require.NoError(t, err)
				t.Cleanup(func() { _ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, stored.ID) })

				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				if mode.available {
					mockACS.On("DeletePluginPolicy", mock.Anything, resourceType, stored.ID).Return(nil).Once()
				} else {
					mockACS.On("InvalidateAllPolicyCaches", mock.Anything).Return().Once()
				}

				require.Nil(t, th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, resourceType, stored.ID))
				mockACS.AssertExpectations(t)
				if !mode.available {
					_, err = th.App.Srv().Store().AccessControlPolicy().Get(th.Context, stored.ID)
					require.Error(t, err, "the row is deleted straight from the store")
				}
			})

			t.Run("Check", func(t *testing.T) {
				for _, forSearch := range []bool{false, true} {
					mockACS := mode.mock()
					th.App.Srv().ch.AccessControl = mockACS
					want := []model.CELExpressionError{{Message: "bad"}}
					if mode.available {
						mockACS.On("CheckPluginExpression", mock.MatchedBy(func(c request.CTX) bool {
							return c.Session() != nil && c.Session().UserId == userID
						}), resourceType, expression, forSearch).Return(want, nil).Once()
					}

					var errs []model.CELExpressionError
					var appErr *model.AppError
					if forSearch {
						var err error
						errs, err = th.App.CheckPluginAccessControlExpressionForSearch(th.Context, testAgentsPluginID, userID, resourceType, expression)
						appErr = model.AsAppError(err)
					} else {
						errs, appErr = th.App.CheckPluginAccessControlExpression(th.Context, testAgentsPluginID, userID, resourceType, expression)
					}

					if !mode.available {
						require.NotNil(t, appErr, "forSearch=%v", forSearch)
						assert.Equal(t, "app.pap.plugin.unavailable", appErr.Id)
						assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
						mockACS.AssertNotCalled(t, "CheckPluginExpression", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
						continue
					}
					require.Nil(t, appErr, "forSearch=%v", forSearch)
					assert.Equal(t, want, errs)
					mockACS.AssertExpectations(t)
				}
			})

			t.Run("Check surfaces engine errors", func(t *testing.T) {
				if !mode.available {
					t.Skip("the engine is not called")
				}
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				mockACS.On("CheckPluginExpression", mock.Anything, resourceType, expression, false).
					Return(nil, model.NewAppError("CheckPluginExpression", "app.pap.plugin.conditions_require_license", nil, "", http.StatusNotImplemented)).Once()

				errs, appErr := th.App.CheckPluginAccessControlExpression(th.Context, testAgentsPluginID, userID, resourceType, expression)
				require.NotNil(t, appErr)
				assert.Nil(t, errs)
				assert.Equal(t, "app.pap.plugin.conditions_require_license", appErr.Id)
			})

			t.Run("QueryUsers", func(t *testing.T) {
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				users := []*model.User{th.BasicUser}
				if mode.available {
					mockACS.On("QueryUsersForPluginExpression", mock.MatchedBy(func(c request.CTX) bool {
						return c.Session() != nil && c.Session().UserId == userID
					}), resourceType, expression, mock.MatchedBy(func(opts model.SubjectSearchOptions) bool {
						return opts.Limit == pluginAccessControlQueryLimitMax
					})).Return(users, int64(1), nil).Once()
				}

				resp, appErr := th.App.QueryUsersForPluginAccessControlExpression(th.Context, testAgentsPluginID, userID, resourceType, expression, "", "", 10000)
				if !mode.available {
					require.NotNil(t, appErr)
					assert.Equal(t, "app.pap.plugin.unavailable", appErr.Id)
					assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
					mockACS.AssertNotCalled(t, "QueryUsersForPluginExpression", mock.Anything, mock.Anything, mock.Anything, mock.Anything)
					return
				}
				require.Nil(t, appErr)
				assert.Equal(t, users, resp.Users)
				mockACS.AssertExpectations(t)
			})

			t.Run("Autocomplete and VisualAST follow the license, not the plugin mode", func(t *testing.T) {
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS
				mockACS.On("ExpressionToVisualAST", mock.Anything, expression).Return(&model.VisualExpression{}, nil).Maybe()

				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
				})
				_, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, userID, "", 10)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.pap.plugin.conditions_require_license", appErr.Id)
				assert.Equal(t, http.StatusNotImplemented, appErr.StatusCode)
				_, appErr = th.App.GetPluginAccessControlVisualAST(th.Context, testAgentsPluginID, userID, resourceType, expression)
				require.NotNil(t, appErr)
				assert.Equal(t, "app.pap.plugin.conditions_require_license", appErr.Id)
				mockACS.AssertNotCalled(t, "ExpressionToVisualAST", mock.Anything, mock.Anything)

				enablePluginAccessControl(t, th)
				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = false
				})
				_, appErr = th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, userID, "", 10)
				require.NotNil(t, appErr, "the config setting is part of the requirement")
				assert.Equal(t, "app.pap.plugin.conditions_require_license", appErr.Id)

				enablePluginAccessControl(t, th)
				fields, appErr := th.App.GetPluginAccessControlFieldsAutocomplete(th.Context, testAgentsPluginID, userID, "", 10)
				require.Nil(t, appErr)
				assert.NotEmpty(t, fields)
				ast, appErr := th.App.GetPluginAccessControlVisualAST(th.Context, testAgentsPluginID, userID, resourceType, expression)
				require.Nil(t, appErr)
				assert.NotNil(t, ast)
			})

			t.Run("Capabilities", func(t *testing.T) {
				mockACS := mode.mock()
				th.App.Srv().ch.AccessControl = mockACS

				caps := th.App.GetPluginAccessControlCapabilities(th.Context, testAgentsPluginID)
				require.NotNil(t, caps)
				assert.Equal(t, mode.available, caps.PoliciesAvailable)
				assert.Equal(t, mode.available && mode.conditions, caps.ConditionsAvailable)
				mockACS.AssertExpectations(t)
			})
		})
	}

	t.Run("Save: engine errors are returned and nothing is saved", func(t *testing.T) {
		mockACS := pluginPolicyModes[1].mock()
		th.App.Srv().ch.AccessControl = mockACS
		policy := validPluginPolicy(model.NewId())
		policy.Rules[0].Expression = "true"
		mockACS.On("GetPluginPolicy", mock.Anything, resourceType, policy.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()
		mockACS.On("SavePluginPolicy", mock.Anything, mock.Anything).
			Return(nil, model.NewAppError("SavePluginPolicy", "app.pap.plugin.conditions_require_license", nil, "", http.StatusNotImplemented)).Once()

		saved, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, adminID, policy)
		require.Nil(t, saved)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.plugin.conditions_require_license", appErr.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("Delete: an engine 404 collapses into the uniform not-found error", func(t *testing.T) {
		stored := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, stored)
		mockACS := pluginPolicyModes[2].mock()
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("DeletePluginPolicy", mock.Anything, resourceType, stored.ID).Return(pluginNotFound("DeletePluginPolicy")).Once()

		appErr := th.App.DeletePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, resourceType, stored.ID)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
		assert.Equal(t, http.StatusNotFound, appErr.StatusCode)
	})

	t.Run("Get: an engine 404 collapses into the uniform not-found error", func(t *testing.T) {
		stored := validPluginPolicy(model.NewId())
		savePluginPolicyRow(t, th, stored)
		mockACS := pluginPolicyModes[1].mock()
		th.App.Srv().ch.AccessControl = mockACS
		mockACS.On("GetPluginPolicy", mock.Anything, resourceType, stored.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()

		got, appErr := th.App.GetPluginAccessControlPolicy(th.Context, testAgentsPluginID, stored.ID)
		require.Nil(t, got)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.access_control.plugin.policy_not_found.app_error", appErr.Id)
	})

	t.Run("Capabilities: no engine reports nothing available", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = nil
		caps := th.App.GetPluginAccessControlCapabilities(th.Context, testAgentsPluginID)
		require.NotNil(t, caps)
		assert.Equal(t, model.PluginAccessControlCapabilities{}, *caps)
	})

	t.Run("Capabilities: the probed type is a valid policy type of the plugin", func(t *testing.T) {
		for _, pluginID := range []string{testAgentsPluginID, "com.mattermost.conflux", "a.b-c_d"} {
			mockACS := &mocks.AccessControlServiceInterface{}
			th.App.Srv().ch.AccessControl = mockACS
			mockACS.On("PluginPolicyMode", mock.Anything, mock.MatchedBy(func(policyType string) bool {
				return model.IsPluginAccessControlPolicyType(policyType) && model.PluginOwnsAccessControlPolicyType(pluginID, policyType)
			})).Return(true, false).Once()

			caps := th.App.GetPluginAccessControlCapabilities(th.Context, pluginID)
			assert.Equal(t, model.PluginAccessControlCapabilities{PoliciesAvailable: true}, *caps, pluginID)
			mockACS.AssertExpectations(t)
		}
	})
}

// TestSavePluginAccessControlPolicyMasking pins that the masking guards run
// only when attribute conditions are allowed: a people-list policy has no
// attribute values to validate, and the masking lookups need the full license.
func TestSavePluginAccessControlPolicyMasking(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = true
	}).InitBasic(t)
	userID := th.BasicUser.Id

	for _, mode := range pluginPolicyModes[1:] {
		t.Run(mode.name, func(t *testing.T) {
			mockACS := mode.mock()
			th.App.Srv().ch.AccessControl = mockACS

			policy := validPluginPolicy(model.NewId())
			policy.Rules[0].Expression = `user.id in ["` + userID + `"]`

			mockACS.On("GetPluginPolicy", mock.Anything, testAgentResourceType, policy.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()
			mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
				Return([]*model.User{{Id: userID}}, int64(1), nil).Once()
			mockACS.On("SavePluginPolicy", mock.Anything, mock.Anything).Return(policy, nil).Once()
			if mode.conditions {
				mockACS.On("ValidateExpressionValuesForCaller", mock.Anything, policy.Rules[0].Expression, mock.Anything).Return(nil).Once()
			}

			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, policy)
			require.Nil(t, appErr)
			mockACS.AssertExpectations(t)
			if !mode.conditions {
				mockACS.AssertNotCalled(t, "ValidateExpressionValuesForCaller", mock.Anything, mock.Anything, mock.Anything)
			}
		})
	}

	t.Run("self-inclusion still applies without conditions", func(t *testing.T) {
		mockACS := pluginPolicyModes[1].mock()
		th.App.Srv().ch.AccessControl = mockACS

		policy := validPluginPolicy(model.NewId())
		policy.Rules[0].Expression = `user.id in ["` + model.NewId() + `"]`
		mockACS.On("GetPluginPolicy", mock.Anything, testAgentResourceType, policy.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()
		mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
			Return([]*model.User{}, int64(0), nil).Once()

		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, policy)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.pap.save_policy.self_exclusion", appErr.Id)
		mockACS.AssertNotCalled(t, "SavePluginPolicy", mock.Anything, mock.Anything)
	})
}

func TestPluginAccessControlAuditEngineMode(t *testing.T) {
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
	}).InitBasic(t)
	capture := startPluginAuditCapture(t, th)
	userID := th.BasicUser.Id

	for _, tc := range []struct {
		mode       pluginPolicyMode
		wantEngine any
	}{
		{pluginPolicyModes[1], "plugin"},
		{pluginPolicyModes[2], "licensed"},
	} {
		t.Run(tc.mode.name, func(t *testing.T) {
			mockACS := tc.mode.mock()
			th.App.Srv().ch.AccessControl = mockACS
			policy := validPluginPolicy(model.NewId())
			policy.Rules[0].Expression = `user.id in ["` + userID + `"]`
			mockACS.On("GetPluginPolicy", mock.Anything, testAgentResourceType, policy.ID).Return(nil, pluginNotFound("GetPluginPolicy")).Once()
			mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).
				Return([]*model.User{{Id: userID}}, int64(1), nil).Once()
			mockACS.On("SavePluginPolicy", mock.Anything, mock.Anything).Return(policy, nil).Once()

			before := len(capture.recordsFor(model.AuditEventSavePluginAccessControlPolicy))
			_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, policy)
			require.Nil(t, appErr)

			records := capture.recordsFor(model.AuditEventSavePluginAccessControlPolicy)
			require.Len(t, records, before+1)
			rec := records[len(records)-1]
			assert.Equal(t, model.AuditStatusSuccess, rec[model.AuditKeyStatus])
			assert.Equal(t, tc.wantEngine, auditParam(t, rec, "engine_mode"))
			assert.Equal(t, testAgentsPluginID, auditParam(t, rec, "plugin_id"))
			assert.Equal(t, "create", auditParam(t, rec, "operation"))
		})
	}

	t.Run("unavailable saves audit as fail without an engine mode", func(t *testing.T) {
		th.App.Srv().ch.AccessControl = pluginPolicyModes[0].mock()
		before := len(capture.recordsFor(model.AuditEventSavePluginAccessControlPolicy))
		_, appErr := th.App.SavePluginAccessControlPolicy(th.Context, testAgentsPluginID, userID, validPluginPolicy(model.NewId()))
		require.NotNil(t, appErr)

		records := capture.recordsFor(model.AuditEventSavePluginAccessControlPolicy)
		require.Len(t, records, before+1)
		assert.Equal(t, model.AuditStatusFail, records[len(records)-1][model.AuditKeyStatus])
		assert.Nil(t, auditParam(t, records[len(records)-1], "engine_mode"))
	})
}

func TestPluginAPIGetAccessControlCapabilities(t *testing.T) {
	th := Setup(t).InitBasic(t)
	api := th.SetupPluginAPIWithPluginContext(t)

	for _, mode := range pluginPolicyModes {
		t.Run(mode.name, func(t *testing.T) {
			mockACS := &mocks.AccessControlServiceInterface{}
			th.App.Srv().ch.AccessControl = mockACS
			mockACS.On("PluginPolicyMode", mock.Anything, mock.MatchedBy(func(policyType string) bool {
				return model.PluginOwnsAccessControlPolicyType(api.manifest.Id, policyType)
			})).Return(mode.available, mode.conditions).Once()

			caps := api.GetAccessControlCapabilities()
			require.NotNil(t, caps)
			assert.Equal(t, mode.available, caps.PoliciesAvailable)
			assert.Equal(t, mode.available && mode.conditions, caps.ConditionsAvailable)
			mockACS.AssertExpectations(t)
		})
	}
}
