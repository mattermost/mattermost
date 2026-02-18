// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/stretchr/testify/require"
)

// setupTeamABACTest creates a test environment with ABAC enabled, an enterprise license,
// a team admin on BasicTeam, and the team policy management config enabled.
func setupTeamABACTest(t *testing.T) (*TestHelper, *model.Client4) {
	t.Helper()
	os.Setenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL", "true")
	t.Cleanup(func() {
		os.Unsetenv("MM_FEATUREFLAGS_ATTRIBUTEBASEDACCESSCONTROL")
	})
	th := Setup(t).InitBasic(t)

	ok := th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.True(t, ok, "SetLicense should return true")

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = model.NewPointer(true)
		cfg.AccessControlSettings.EnableTeamAdminPolicyManagement = model.NewPointer(true)
	})

	th.LinkUserToTeam(t, th.TeamAdminUser, th.BasicTeam)
	_, appErr := th.App.UpdateTeamMemberRoles(th.Context, th.BasicTeam.Id, th.TeamAdminUser.Id, "team_user team_admin")
	require.Nil(t, appErr)

	teamAdminClient := th.CreateClient()
	th.LoginTeamAdminWithClient(t, teamAdminClient)

	return th, teamAdminClient
}

// createTeamScopedPolicy saves a real parent policy + child channel policy in the DB
// and sets up the AccessControl mock so GetPolicy returns the parent.
// This is required because IsPolicyTeamScoped -> GetChannelsForPolicy hits the real store.
func createTeamScopedPolicy(
	t *testing.T,
	th *TestHelper,
	channel *model.Channel,
) (*model.AccessControlPolicy, *mocks.AccessControlServiceInterface) {
	t.Helper()

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "Team Policy",
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Expression: "true", Actions: []string{"*"}},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)

	child := &model.AccessControlPolicy{
		ID:       channel.Id,
		Type:     model.AccessControlPolicyTypeChannel,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
	}
	appErr := child.Inherit(parentPolicy)
	require.Nil(t, appErr)
	_, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
	require.NoError(t, err)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = mockACS
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(parentPolicy, nil)

	return parentPolicy, mockACS
}

// createSystemScopedPolicy saves a parent policy with NO children (system-scoped).
func createSystemScopedPolicy(
	t *testing.T,
	th *TestHelper,
) (*model.AccessControlPolicy, *mocks.AccessControlServiceInterface) {
	t.Helper()

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "System Policy",
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Expression: "true", Actions: []string{"*"}},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = mockACS
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(parentPolicy, nil)

	return parentPolicy, mockACS
}

// createCrossTeamPolicy saves a parent policy with children in TWO different teams.
// This simulates a policy that has channels but spans multiple teams, so it should NOT
// be accessible via any single team's endpoint.
func createCrossTeamPolicy(
	t *testing.T,
	th *TestHelper,
	channelA *model.Channel,
	channelB *model.Channel,
) (*model.AccessControlPolicy, *mocks.AccessControlServiceInterface) {
	t.Helper()

	parentPolicy := &model.AccessControlPolicy{
		ID:       model.NewId(),
		Name:     "Cross-Team Policy",
		Type:     model.AccessControlPolicyTypeParent,
		Version:  model.AccessControlPolicyVersionV0_2,
		Revision: 1,
		Rules: []model.AccessControlPolicyRule{
			{Expression: "true", Actions: []string{"*"}},
		},
	}
	var err error
	parentPolicy, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, parentPolicy)
	require.NoError(t, err)

	for _, ch := range []*model.Channel{channelA, channelB} {
		child := &model.AccessControlPolicy{
			ID:       ch.Id,
			Type:     model.AccessControlPolicyTypeChannel,
			Version:  model.AccessControlPolicyVersionV0_2,
			Revision: 1,
		}
		appErr := child.Inherit(parentPolicy)
		require.Nil(t, appErr)
		_, err = th.App.Srv().Store().AccessControlPolicy().Save(th.Context, child)
		require.NoError(t, err)
	}

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = mockACS
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(parentPolicy, nil)

	return parentPolicy, mockACS
}

func teamPoliciesURL(teamID string) string {
	return fmt.Sprintf("/teams/%s/access_policies", teamID)
}

func teamPolicyURL(teamID, policyID string) string {
	return fmt.Sprintf("/teams/%s/access_policies/%s", teamID, policyID)
}

// -------------------------------------------------------
// Permission tests
// -------------------------------------------------------

func TestTeamAccessPolicies_ConfigDisabled(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableTeamAdminPolicyManagement = model.NewPointer(false)
	})

	t.Run("search returns 501 when config disabled", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/search",
			model.AccessControlPolicySearch{})
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})

	t.Run("create returns 501 when config disabled", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy":      model.AccessControlPolicy{Name: "test"},
				"channel_ids": []string{model.NewId()},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestTeamAccessPolicies_RegularMemberDenied(t *testing.T) {
	th, _ := setupTeamABACTest(t)

	t.Run("search returns 403 for regular member", func(t *testing.T) {
		resp, err := th.Client.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/search",
			model.AccessControlPolicySearch{})
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("create returns 403 for regular member", func(t *testing.T) {
		resp, err := th.Client.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy":      model.AccessControlPolicy{Name: "test"},
				"channel_ids": []string{model.NewId()},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestTeamAccessPolicies_SystemAdminBypassesConfig(t *testing.T) {
	th, _ := setupTeamABACTest(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.EnableTeamAdminPolicyManagement = model.NewPointer(false)
	})

	mockACS := &mocks.AccessControlServiceInterface{}
	th.App.Srv().Channels().AccessControl = mockACS
	// NormalizePolicy may be called if the real store has any parent policies
	mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
		Return(nil, model.NewAppError("test", "test.skip", nil, "", http.StatusInternalServerError)).Maybe()
	// GetPolicy catch-all for IsPolicyTeamScoped calls on any discovered policies
	mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
		Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.not_found", nil, "", http.StatusNotFound)).Maybe()

	t.Run("search succeeds for system admin even with config disabled", func(t *testing.T) {
		resp, err := th.SystemAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/search",
			model.AccessControlPolicySearch{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

func TestTeamAccessPolicies_WrongTeamDenied(t *testing.T) {
	th, _ := setupTeamABACTest(t)

	otherTeam := th.CreateTeam(t)

	teamAdminClient := th.CreateClient()
	th.LoginTeamAdminWithClient(t, teamAdminClient)

	t.Run("search returns 403 for admin of different team", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(otherTeam.Id)+"/search",
			model.AccessControlPolicySearch{})
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Create policy tests
// -------------------------------------------------------

func TestCreateTeamAccessPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("create without channels returns 400", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:  "Empty Channels Policy",
					Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create with public channel returns 400", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:  "Public Channel Policy",
					Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{th.BasicChannel.Id},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create with channel from another team returns 400", func(t *testing.T) {
		otherTeam := th.CreateTeam(t)
		otherChannel := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:  "Cross-Team Policy",
					Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{otherChannel.Id},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("create with valid private channel succeeds", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)

		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockACS

		createdPolicy := &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Valid Team Policy",
			Type:    model.AccessControlPolicyTypeParent,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules:   []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
		}

		childAfterInherit := &model.AccessControlPolicy{
			ID:      privateChannel.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Imports: []string{createdPolicy.ID},
		}

		// Self-inclusion: ValidateTeamAdminSelfInclusion -> QueryUsersForExpression
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.TeamAdminUser}, int64(1), nil)

		// CreateOrUpdateAccessControlPolicy -> SavePolicy (parent)
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Type == model.AccessControlPolicyTypeParent
		})).Return(createdPolicy, nil).Once()

		// AssignAccessControlPolicyToChannels -> GetPolicy (parent)
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), createdPolicy.ID).Return(createdPolicy, nil)

		// AssignAccessControlPolicyToChannels -> GetPolicy (child channel — not found yet)
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), privateChannel.Id).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("", "", nil, "", http.StatusNotFound))

		// AssignAccessControlPolicyToChannels -> SavePolicy (child)
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.MatchedBy(func(p *model.AccessControlPolicy) bool {
			return p.Type == model.AccessControlPolicyTypeChannel
		})).Return(childAfterInherit, nil).Once()

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:    "Valid Team Policy",
					Version: model.AccessControlPolicyVersionV0_2,
					Rules:   []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{privateChannel.Id},
			})
		require.NoError(t, err)
		require.Equal(t, http.StatusCreated, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Get policy tests
// -------------------------------------------------------

func TestGetTeamAccessPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("get team-scoped policy succeeds", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		parentPolicy, _ := createTeamScopedPolicy(t, th, privateChannel)

		resp, err := teamAdminClient.DoAPIGet(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID), "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.AccessControlPolicy
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		resp.Body.Close()
		require.Equal(t, parentPolicy.ID, result.ID)
	})

	t.Run("get system-scoped policy returns 404", func(t *testing.T) {
		parentPolicy, _ := createSystemScopedPolicy(t, th)

		resp, err := teamAdminClient.DoAPIGet(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID), "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("get cross-team policy returns 404", func(t *testing.T) {
		channelA := th.CreatePrivateChannel(t)
		otherTeam := th.CreateTeam(t)
		channelB := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)

		parentPolicy, _ := createCrossTeamPolicy(t, th, channelA, channelB)

		resp, err := teamAdminClient.DoAPIGet(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID), "")
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Update policy tests
// -------------------------------------------------------

func TestUpdateTeamAccessPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("update team-scoped policy succeeds", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		parentPolicy, mockACS := createTeamScopedPolicy(t, th, privateChannel)

		updatedPolicy := &model.AccessControlPolicy{
			ID:      parentPolicy.ID,
			Name:    "Updated Name",
			Type:    model.AccessControlPolicyTypeParent,
			Version: model.AccessControlPolicyVersionV0_2,
			Rules:   []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
		}
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(updatedPolicy, nil)
		mockACS.On("QueryUsersForExpression", mock.AnythingOfType("*request.Context"), "true", mock.Anything).
			Return([]*model.User{th.TeamAdminUser}, int64(1), nil)

		resp, err := teamAdminClient.DoAPIPutJSON(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID),
			updatedPolicy)
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.AccessControlPolicy
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		resp.Body.Close()
		require.Equal(t, "Updated Name", result.Name)
	})

	t.Run("update cross-team policy returns 404", func(t *testing.T) {
		channelA := th.CreatePrivateChannel(t)
		otherTeam := th.CreateTeam(t)
		channelB := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)

		parentPolicy, _ := createCrossTeamPolicy(t, th, channelA, channelB)

		resp, err := teamAdminClient.DoAPIPutJSON(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID),
			&model.AccessControlPolicy{
				ID:    parentPolicy.ID,
				Name:  "Should Not Work",
				Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Delete policy tests
// -------------------------------------------------------

func TestDeleteTeamAccessPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("delete team-scoped policy succeeds", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		parentPolicy, mockACS := createTeamScopedPolicy(t, th, privateChannel)

		mockACS.On("DeletePolicy", mock.AnythingOfType("*request.Context"), parentPolicy.ID).Return(nil)

		resp, err := teamAdminClient.DoAPIDelete(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("delete system-scoped policy returns 404", func(t *testing.T) {
		parentPolicy, _ := createSystemScopedPolicy(t, th)

		resp, err := teamAdminClient.DoAPIDelete(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID))
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("delete cross-team policy returns 404", func(t *testing.T) {
		channelA := th.CreatePrivateChannel(t)
		otherTeam := th.CreateTeam(t)
		channelB := th.CreateChannelWithClientAndTeam(t, th.SystemAdminClient, model.ChannelTypePrivate, otherTeam.Id)

		parentPolicy, _ := createCrossTeamPolicy(t, th, channelA, channelB)

		resp, err := teamAdminClient.DoAPIDelete(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID))
		require.Error(t, err)
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Assign channels tests
// -------------------------------------------------------

func TestAssignChannelsToTeamPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("assign valid private channel succeeds", func(t *testing.T) {
		existingChannel := th.CreatePrivateChannel(t)
		parentPolicy, mockACS := createTeamScopedPolicy(t, th, existingChannel)

		newChannel := th.CreatePrivateChannel(t)
		newChild := &model.AccessControlPolicy{
			ID:      newChannel.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Imports: []string{parentPolicy.ID},
		}

		// AssignAccessControlPolicyToChannels -> GetPolicy (child — not found)
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), newChannel.Id).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("", "", nil, "", http.StatusNotFound))
		mockACS.On("SavePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).Return(newChild, nil)

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID)+"/assign",
			map[string]any{"channel_ids": []string{newChannel.Id}})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("assign public channel returns 400", func(t *testing.T) {
		existingChannel := th.CreatePrivateChannel(t)
		parentPolicy, _ := createTeamScopedPolicy(t, th, existingChannel)

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID)+"/assign",
			map[string]any{"channel_ids": []string{th.BasicChannel.Id}})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

// -------------------------------------------------------
// Unassign channels tests
// -------------------------------------------------------

func TestUnassignChannelsFromTeamPolicy(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("unassign channel succeeds", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		parentPolicy, mockACS := createTeamScopedPolicy(t, th, privateChannel)

		childPolicy := &model.AccessControlPolicy{
			ID:      privateChannel.Id,
			Type:    model.AccessControlPolicyTypeChannel,
			Version: model.AccessControlPolicyVersionV0_2,
			Imports: []string{parentPolicy.ID},
		}

		// UnassignPoliciesFromChannels uses real store for SearchPolicies (child is in DB),
		// then calls acs.GetPolicy for the child channel and acs.DeletePolicy to remove it.
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), privateChannel.Id).Return(childPolicy, nil)
		mockACS.On("DeletePolicy", mock.AnythingOfType("*request.Context"), privateChannel.Id).Return(nil)

		resp, err := teamAdminClient.DoAPIDeleteJSON(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID)+"/unassign",
			map[string]any{"channel_ids": []string{privateChannel.Id}})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})
}

// -------------------------------------------------------
// List channels tests
// -------------------------------------------------------

func TestGetTeamPolicyChannels(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("list channels for team-scoped policy", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		parentPolicy, _ := createTeamScopedPolicy(t, th, privateChannel)

		resp, err := teamAdminClient.DoAPIGet(context.Background(),
			teamPolicyURL(th.BasicTeam.Id, parentPolicy.ID)+"/channels", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.ChannelsWithCount
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		resp.Body.Close()
		require.Equal(t, int64(1), result.TotalCount)
	})
}

// -------------------------------------------------------
// Sync tests
// -------------------------------------------------------

func TestTriggerTeamPolicySync(t *testing.T) {
	th, _ := setupTeamABACTest(t)

	t.Run("regular member cannot trigger sync", func(t *testing.T) {
		resp, err := th.Client.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/sync", nil)
		require.Error(t, err)
		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})
}

func TestGetTeamPolicySyncStatus(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("sync status returns timestamp", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIGet(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/sync/status", "")
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result struct {
			LastSyncedAt int64 `json:"last_synced_at"`
		}
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		resp.Body.Close()
		require.Equal(t, int64(0), result.LastSyncedAt)
	})
}

// -------------------------------------------------------
// Search tests
// -------------------------------------------------------

func TestSearchTeamAccessPolicies(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("search returns results from store", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		th.App.Srv().Channels().AccessControl = mockACS
		// NormalizePolicy + GetPolicy catch-alls for any policies found in the shared store
		mockACS.On("NormalizePolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("*model.AccessControlPolicy")).
			Return(nil, model.NewAppError("test", "test.skip", nil, "", http.StatusInternalServerError)).Maybe()
		mockACS.On("GetPolicy", mock.AnythingOfType("*request.Context"), mock.AnythingOfType("string")).
			Return((*model.AccessControlPolicy)(nil), model.NewAppError("test", "test.not_found", nil, "", http.StatusNotFound)).Maybe()

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id)+"/search",
			model.AccessControlPolicySearch{})
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		var result model.AccessControlPoliciesWithCount
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&result))
		resp.Body.Close()
		// Result may be empty or contain policies depending on store state
		require.NotNil(t, result.Policies)
	})
}

// -------------------------------------------------------
// Channel validation edge cases
// -------------------------------------------------------

func TestTeamAccessPolicy_ChannelValidation(t *testing.T) {
	th, teamAdminClient := setupTeamABACTest(t)

	t.Run("create with nonexistent channel returns error", func(t *testing.T) {
		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:  "Bad Channel Policy",
					Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{model.NewId()},
			})
		require.Error(t, err)
		// GetChannels returns 404 for nonexistent channel IDs
		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("create with group-constrained channel returns 400", func(t *testing.T) {
		privateChannel := th.CreatePrivateChannel(t)
		privateChannel.GroupConstrained = model.NewPointer(true)
		_, appErr := th.App.UpdateChannel(th.Context, privateChannel)
		require.Nil(t, appErr)

		resp, err := teamAdminClient.DoAPIPostJSON(context.Background(),
			teamPoliciesURL(th.BasicTeam.Id),
			map[string]any{
				"policy": model.AccessControlPolicy{
					Name:  "Group Synced Policy",
					Rules: []model.AccessControlPolicyRule{{Expression: "true", Actions: []string{"*"}}},
				},
				"channel_ids": []string{privateChannel.Id},
			})
		require.Error(t, err)
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}
