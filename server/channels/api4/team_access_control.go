// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// InitTeamAccessControlPolicy registers team-scoped ABAC policy management routes.
// These endpoints allow Team Admins to create and manage access control policies
// for private channels within their teams.
func (api *API) InitTeamAccessControlPolicy() {
	if !api.srv.Config().FeatureFlags.AttributeBasedAccessControl {
		return
	}

	// Policy CRUD operations
	api.BaseRoutes.Team.Handle("/access_policies/search",
		api.APISessionRequired(searchTeamAccessPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.Team.Handle("/access_policies",
		api.APISessionRequired(createTeamAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}",
		api.APISessionRequired(getTeamAccessPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}",
		api.APISessionRequired(updateTeamAccessPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}",
		api.APISessionRequired(deleteTeamAccessPolicy)).Methods(http.MethodDelete)

	// Channel assignment operations
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}/assign",
		api.APISessionRequired(assignChannelsToTeamPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}/unassign",
		api.APISessionRequired(unassignChannelsFromTeamPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.Team.Handle("/access_policies/{policy_id:[A-Za-z0-9]+}/channels",
		api.APISessionRequired(getTeamPolicyChannels)).Methods(http.MethodGet)

	// Sync operations
	api.BaseRoutes.Team.Handle("/access_policies/sync",
		api.APISessionRequired(triggerTeamPolicySync)).Methods(http.MethodPost)
	api.BaseRoutes.Team.Handle("/access_policies/sync/status",
		api.APISessionRequired(getTeamPolicySyncStatus)).Methods(http.MethodGet)
}

// requireTeamPolicyPermission checks the three-part permission gate:
//  1. ABAC globally enabled (guaranteed by route registration, but config can change)
//  2. EnableTeamAdminPolicyManagement config ON
//  3. User has PermissionManageTeam for this team
//
// System Admins bypass the config gate and team permission check.
func requireTeamPolicyPermission(c *Context, teamID string) bool {
	if c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		return true
	}

	if c.App.Config().AccessControlSettings.EnableTeamAdminPolicyManagement == nil ||
		!*c.App.Config().AccessControlSettings.EnableTeamAdminPolicyManagement {
		c.Err = model.NewAppError("requireTeamPolicyPermission",
			"api.team.access_policies.disabled.app_error",
			nil, "", http.StatusNotImplemented)
		return false
	}

	if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeam) {
		c.SetPermissionError(model.PermissionManageTeam)
		return false
	}

	return true
}

func searchTeamAccessPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	var props *model.AccessControlPolicySearch
	if jsonErr := json.NewDecoder(r.Body).Decode(&props); jsonErr != nil || props == nil {
		c.SetInvalidParamWithErr("access_control_policy_search", jsonErr)
		return
	}

	policies, total, appErr := c.App.SearchTeamAccessPolicies(c.AppContext, teamID, c.AppContext.Session().UserId, *props)
	if appErr != nil {
		c.Err = appErr
		return
	}

	result := model.AccessControlPoliciesWithCount{
		Policies: policies,
		Total:    total,
	}

	js, err := json.Marshal(result)
	if err != nil {
		c.Err = model.NewAppError("searchTeamAccessPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func createTeamAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	var req struct {
		Policy     model.AccessControlPolicy `json:"policy"`
		ChannelIDs []string                  `json:"channel_ids"`
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&req); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateTeamAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "requested", &req.Policy)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)

	req.Policy.Type = model.AccessControlPolicyTypeParent

	// Team policies must be assigned to at least one channel
	if len(req.ChannelIDs) == 0 {
		c.Err = model.NewAppError("createTeamAccessPolicy",
			"api.team.access_policies.channels_required.app_error",
			nil, "at least one channel is required for team policies", http.StatusBadRequest)
		return
	}

	// Validate channels are private and belong to team
	if appErr := c.App.ValidateTeamPolicyChannelAssignment(c.AppContext, teamID, req.ChannelIDs); appErr != nil {
		c.Err = appErr
		return
	}

	// Prevent Team Admins from creating policies that would exclude themselves
	if len(req.Policy.Rules) > 0 {
		expression := req.Policy.Rules[0].Expression
		if appErr := c.App.ValidateTeamAdminSelfInclusion(c.AppContext, c.AppContext.Session().UserId, expression); appErr != nil {
			c.Err = appErr
			return
		}
	}

	np, appErr := c.App.CreateOrUpdateAccessControlPolicy(c.AppContext, &req.Policy)
	if appErr != nil {
		c.Err = appErr
		return
	}

	// Assign policy to channels (rollback policy if assignment fails)
	_, appErr = c.App.AssignAccessControlPolicyToChannels(c.AppContext, np.ID, req.ChannelIDs)
	if appErr != nil {
		if deleteErr := c.App.DeleteAccessControlPolicy(c.AppContext, np.ID); deleteErr != nil {
			c.Logger.Warn("Failed to rollback policy after channel assignment failure",
				mlog.String("policy_id", np.ID), mlog.Err(deleteErr))
		}
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("access_control_policy")
	auditRec.AddEventResultState(np)

	js, err := json.Marshal(np)
	if err != nil {
		c.Err = model.NewAppError("createTeamAccessPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getTeamAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team (all its channels are in the team)
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("getTeamAccessPolicy",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	policy, appErr := c.App.GetAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("getTeamAccessPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func updateTeamAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team before allowing updates
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("updateTeamAccessPolicy",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	var policy model.AccessControlPolicy
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateTeamAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)

	policy.ID = policyID
	policy.Type = model.AccessControlPolicyTypeParent

	// Prevent Team Admins from updating policies that would exclude themselves
	if len(policy.Rules) > 0 {
		expression := policy.Rules[0].Expression
		if appErr := c.App.ValidateTeamAdminSelfInclusion(c.AppContext, c.AppContext.Session().UserId, expression); appErr != nil {
			c.Err = appErr
			return
		}
	}

	np, appErr := c.App.CreateOrUpdateAccessControlPolicy(c.AppContext, &policy)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()
	auditRec.AddEventObjectType("access_control_policy")
	auditRec.AddEventResultState(np)

	js, err := json.Marshal(np)
	if err != nil {
		c.Err = model.NewAppError("updateTeamAccessPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// deleteTeamAccessPolicy handles DELETE /api/v4/teams/{team_id}/access_policies/{policy_id}
// Deletes a team-scoped policy and all its channel assignments.
// Returns 404 if the policy doesn't belong to the team (scope enforcement).
func deleteTeamAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team before allowing deletion
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("deleteTeamAccessPolicy",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteTeamAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)

	appErr = c.App.DeleteAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"OK"}`)) //nolint:errcheck
}

func assignChannelsToTeamPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team before allowing channel assignment
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("assignChannelsToTeamPolicy",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	var assignments struct {
		ChannelIDs []string `json:"channel_ids"`
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&assignments); jsonErr != nil {
		c.SetInvalidParamWithErr("assignments", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAssignTeamAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIDs)

	if appErr := c.App.ValidateTeamPolicyChannelAssignment(c.AppContext, teamID, assignments.ChannelIDs); appErr != nil {
		c.Err = appErr
		return
	}

	_, appErr = c.App.AssignAccessControlPolicyToChannels(c.AppContext, policyID, assignments.ChannelIDs)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"OK"}`)) //nolint:errcheck
}

func unassignChannelsFromTeamPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team before allowing channel unassignment
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("unassignChannelsFromTeamPolicy",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	var assignments struct {
		ChannelIDs []string `json:"channel_ids"`
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&assignments); jsonErr != nil {
		c.SetInvalidParamWithErr("assignments", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUnassignTeamAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIDs)

	if len(assignments.ChannelIDs) > 0 {
		appErr = c.App.UnassignPoliciesFromChannels(c.AppContext, policyID, assignments.ChannelIDs)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"OK"}`)) //nolint:errcheck
}

func getTeamPolicyChannels(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId
	policyID := c.Params.PolicyId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Verify policy belongs to this team before returning its channels
	isTeamScoped, appErr := c.App.IsPolicyTeamScoped(c.AppContext, policyID, teamID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	if !isTeamScoped {
		c.Err = model.NewAppError("getTeamPolicyChannels",
			"api.team.access_policies.not_team_scoped.app_error",
			nil, "", http.StatusNotFound)
		return
	}

	// Parse pagination parameters
	afterID := r.URL.Query().Get("after")
	if afterID != "" && !model.IsValidId(afterID) {
		c.SetInvalidParam("after")
		return
	}

	limit := 60
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		var err error
		limit, err = strconv.Atoi(limitStr)
		if err != nil || limit <= 0 || limit > 200 {
			c.Err = model.NewAppError("getTeamPolicyChannels",
				"api.access_control_policy.get_channels.limit.app_error",
				nil, "", http.StatusBadRequest)
			return
		}
	}

	channels, total, appErr := c.App.GetChannelsForPolicy(c.AppContext, policyID, model.AccessControlPolicyCursor{
		ID: afterID,
	}, limit)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data := model.ChannelsWithCount{Channels: channels, TotalCount: total}

	js, err := json.Marshal(data)
	if err != nil {
		c.Err = model.NewAppError("getTeamPolicyChannels", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func triggerTeamPolicySync(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventTriggerTeamPolicySync, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "team_id", teamID)

	_, appErr := c.App.CreateJob(c.AppContext, &model.Job{
		Type: model.JobTypeAccessControlSync,
		Data: map[string]string{
			"team_id": teamID,
		},
	})
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"status":"OK"}`)) //nolint:errcheck
}

func getTeamPolicySyncStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireTeamId()
	if c.Err != nil {
		return
	}
	teamID := c.Params.TeamId

	if !requireTeamPolicyPermission(c, teamID) {
		return
	}

	// Look through recent sync jobs to find the last successful one for this team
	jobs, appErr := c.App.GetJobsByTypePage(c.AppContext, model.JobTypeAccessControlSync, 0, 10)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var lastSyncedAt int64
	for _, job := range jobs {
		if job.Status == model.JobStatusSuccess && job.Data["team_id"] == teamID {
			lastSyncedAt = job.LastActivityAt
			break
		}
	}

	response := struct {
		LastSyncedAt int64 `json:"last_synced_at"`
	}{
		LastSyncedAt: lastSyncedAt,
	}

	js, err := json.Marshal(response)
	if err != nil {
		c.Err = model.NewAppError("getTeamPolicySyncStatus", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
