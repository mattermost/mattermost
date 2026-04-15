// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/app"
)

func (api *API) InitAccessControlPolicy() {
	if !api.srv.Config().FeatureFlags.AttributeBasedAccessControl {
		return
	}
	api.BaseRoutes.AccessControlPolicies.Handle("", api.APISessionRequired(createAccessControlPolicy)).Methods(http.MethodPut)
	api.BaseRoutes.AccessControlPolicies.Handle("/search", api.APISessionRequired(searchAccessControlPolicies)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/activate", api.APISessionRequired(setActiveStatus)).Methods(http.MethodPut)

	api.BaseRoutes.AccessControlPolicies.Handle("/cel/check", api.APISessionRequired(checkExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/test", api.APISessionRequired(testExpression)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/validate_requester", api.APISessionRequired(validateExpressionAgainstRequester)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/autocomplete/fields", api.APISessionRequired(getFieldsAutocomplete)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicies.Handle("/cel/visual_ast", api.APISessionRequired(convertToVisualAST)).Methods(http.MethodPost)

	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(getAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("", api.APISessionRequired(deleteAccessControlPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/activate", api.APISessionRequired(updateActiveStatus)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/assign", api.APISessionRequired(assignAccessPolicy)).Methods(http.MethodPost)
	api.BaseRoutes.AccessControlPolicy.Handle("/unassign", api.APISessionRequired(unassignAccessPolicy)).Methods(http.MethodDelete)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels", api.APISessionRequired(getChannelsForAccessControlPolicy)).Methods(http.MethodGet)
	api.BaseRoutes.AccessControlPolicy.Handle("/resources/channels/search", api.APISessionRequired(searchChannelsForAccessControlPolicy)).Methods(http.MethodPost)
}

func createAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.AccessControlPolicy
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParamWithErr("policy", jsonErr)
		return
	}

	if policy.Type == model.AccessControlPolicyTypePermission && !c.App.Config().FeatureFlags.PermissionPolicies {
		c.Err = model.NewAppError("createAccessControlPolicy", "api.access_control_policy.permission_policies.feature_disabled", nil, "", http.StatusNotImplemented)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventCreateAccessControlPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "requested", &policy)

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
		teamID := r.URL.Query().Get("team_id")
		if !hasSystemPermission {
			if teamID == "" || !model.IsValidId(teamID) {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules) {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				return
			}
			// For updates, verify the team admin owns the policy
			if policy.ID != "" {
				owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, teamID, policy.ID)
				if appErr != nil {
					c.Err = appErr
					return
				}
				if !owned {
					c.SetPermissionError(model.PermissionManageTeamAccessRules)
					return
				}
			}
		}
		// Scope stamping: for team admins never trust the body's scope fields — always
		// override from the authenticated query param so a crafted request cannot assign
		// the policy to a different team. For system admins, inject only when the body
		// did not supply scope (preserves the existing sysadmin-sets-scope-explicitly path).
		if !hasSystemPermission {
			policy.Scope = model.AccessControlPolicyScopeTeam
			policy.ScopeID = teamID
		} else if teamID != "" && model.IsValidId(teamID) && policy.Scope == "" {
			policy.Scope = model.AccessControlPolicyScopeTeam
			policy.ScopeID = teamID
		}
	case model.AccessControlPolicyTypePermission:
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	case model.AccessControlPolicyTypeChannel:
		// Check if user has system admin permission first
		hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)

		if !hasManageSystemPermission {
			// For non-system admins, check channel-specific permission
			if !model.IsValidId(policy.ID) {
				c.SetInvalidParam("policy.id")
				return
			}

			hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, policy.ID, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}

			// Now do the full validation (channel exists, is private, etc.)
			if appErr := c.App.ValidateChannelAccessControlPolicyCreation(c.AppContext, c.AppContext.Session().UserId, &policy); appErr != nil {
				c.Err = appErr
				return
			}
		}
	default:
		c.SetInvalidParam("type")
		return
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
		c.Err = model.NewAppError("createAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	// Extract optional channelId from query parameters for context
	channelID := r.URL.Query().Get("channelId")

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// Try delegated admin permissions: channel admin first, then team admin
		channelPermErr := c.App.ValidateAccessControlPolicyPermissionWithChannelContext(c.AppContext, c.AppContext.Session().UserId, policyID, true, channelID)
		if channelPermErr != nil {
			// Try team-admin permission
			teamID := r.URL.Query().Get("team_id")
			if teamID != "" && model.IsValidId(teamID) &&
				c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules) {
				owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, teamID, policyID)
				if appErr != nil {
					c.Err = appErr
					return
				}
				if !owned {
					c.SetPermissionError(model.PermissionManageTeamAccessRules)
					return
				}
			} else {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
		}
	}

	policy, appErr := c.App.GetAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(policy)
	if err != nil {
		c.Err = model.NewAppError("getAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func deleteAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	auditRec := c.MakeAuditRecord(model.AuditEventDeleteAccessControlPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		// Try delegated admin permissions: channel admin first, then team admin
		channelPermErr := c.App.ValidateAccessControlPolicyPermission(c.AppContext, c.AppContext.Session().UserId, policyID)
		if channelPermErr != nil {
			teamID := r.URL.Query().Get("team_id")
			if teamID == "" || !model.IsValidId(teamID) {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules) {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				return
			}
			owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, teamID, policyID)
			if appErr != nil {
				c.Err = appErr
				return
			}
			if !owned {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				return
			}
		}
	}

	appErr := c.App.DeleteAccessControlPolicy(c.AppContext, policyID)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.Success()
}

func checkExpression(c *Context, w http.ResponseWriter, r *http.Request) {
	checkExpressionRequest := struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
		TeamId     string `json:"teamId,omitempty"`
	}{}
	if jsonErr := json.NewDecoder(r.Body).Decode(&checkExpressionRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	channelId := checkExpressionRequest.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		teamID := checkExpressionRequest.TeamId
		hasTeamPermission := teamID != "" && model.IsValidId(teamID) &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules)
		if !hasTeamPermission {
			if channelId == "" {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}
		}
	}

	errs, appErr := c.App.CheckExpression(c.AppContext, checkExpressionRequest.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(errs)
	if err != nil {
		c.Err = model.NewAppError("checkExpression", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func testExpression(c *Context, w http.ResponseWriter, r *http.Request) {
	var checkExpressionRequest model.QueryExpressionParams
	if jsonErr := json.NewDecoder(r.Body).Decode(&checkExpressionRequest); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	channelId := checkExpressionRequest.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	teamID := checkExpressionRequest.TeamId
	if teamID != "" && !model.IsValidId(teamID) {
		c.SetInvalidParam("teamId")
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	hasTeamPermission := !hasSystemPermission && teamID != "" &&
		c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules)

	if !hasSystemPermission && !hasTeamPermission {
		if channelId == "" {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
		hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
		if !hasChannelPermission {
			c.SetPermissionError(model.PermissionManageChannelAccessRules)
			return
		}
	}

	var users []*model.User
	var count int64
	var appErr *model.AppError

	searchOpts := model.SubjectSearchOptions{
		Term:  checkExpressionRequest.Term,
		Limit: checkExpressionRequest.Limit,
		Cursor: model.SubjectCursor{
			TargetID: checkExpressionRequest.After,
		},
	}

	// Only system admins see ALL matching users (unrestricted).
	// Delegated admins (team and channel) see only users matching expressions with attributes they possess.
	if hasSystemPermission {
		users, count, appErr = c.App.TestExpression(c.AppContext, checkExpressionRequest.Expression, searchOpts)
	} else {
		users, count, appErr = c.App.TestExpressionWithChannelContext(c.AppContext, checkExpressionRequest.Expression, searchOpts)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	for _, user := range users {
		c.App.SanitizeProfile(user, hasSystemPermission)
	}

	resp := model.AccessControlPolicyTestResponse{
		Users: users,
		Total: count,
	}

	js, err := json.Marshal(resp)
	if err != nil {
		c.Err = model.NewAppError("checkExpression", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func validateExpressionAgainstRequester(c *Context, w http.ResponseWriter, r *http.Request) {
	var request struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
		TeamId     string `json:"teamId,omitempty"`
	}

	if jsonErr := json.NewDecoder(r.Body).Decode(&request); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	channelId := request.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	teamID := request.TeamId
	if teamID != "" && !model.IsValidId(teamID) {
		c.SetInvalidParam("teamId")
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		hasTeamPermission := teamID != "" &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules)
		if !hasTeamPermission {
			if channelId == "" {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}
		}
	}

	// Direct validation against requester
	matches, appErr := c.App.ValidateExpressionAgainstRequester(c.AppContext, request.Expression, c.AppContext.Session().UserId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	response := struct {
		RequesterMatches bool `json:"requester_matches"`
	}{
		RequesterMatches: matches,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchAccessControlPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	var props *model.AccessControlPolicySearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("access_control_policy_search", err)
		return
	}

	permissionPoliciesEnabled := c.App.Config().FeatureFlags.PermissionPolicies
	var policies []*model.AccessControlPolicy
	var total int64
	var appErr *model.AppError

	if props.TeamID != "" {
		// Team-scoped search: requires manage_team_access_rules (system admins have this implicitly)
		if !model.IsValidId(props.TeamID) {
			c.SetInvalidParam("team_id")
			return
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), props.TeamID, model.PermissionManageTeamAccessRules) {
			c.SetPermissionError(model.PermissionManageTeamAccessRules)
			return
		}
		requesterID := c.AppContext.Session().UserId
		policies, total, appErr = c.App.SearchTeamAccessPolicies(c.AppContext, props.TeamID, requesterID, *props)
	} else {
		if props.Type == model.AccessControlPolicyTypePermission && !permissionPoliciesEnabled {
			c.Err = model.NewAppError("searchAccessControlPolicies", "api.access_control_policy.permission_policies.feature_disabled", nil, "", http.StatusNotImplemented)
			return
		}

		// System-wide search: requires system permission
		if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
		policies, total, appErr = c.App.SearchAccessControlPolicies(c.AppContext, *props)
	}

	if appErr != nil {
		c.Err = appErr
		return
	}

	if !permissionPoliciesEnabled && props.Type == "" {
		filtered := make([]*model.AccessControlPolicy, 0, len(policies))
		for _, p := range policies {
			if p.Type != model.AccessControlPolicyTypePermission {
				filtered = append(filtered, p)
			}
		}
		total -= int64(len(policies) - len(filtered))
		policies = filtered
	}

	result := model.AccessControlPoliciesWithCount{
		Policies: policies,
		Total:    total,
	}

	js, err := json.Marshal(result)
	if err != nil {
		c.Err = model.NewAppError("searchAccessControlPolicies", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

// updateActiveStatus updates the active status of a single access control policy.
//
// Deprecated: This endpoint is deprecated and will be removed in a future release.
// Use PUT /api/v4/access_control/policies/activate instead, which supports batch updates.
func updateActiveStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

	// CSRF barrier: only allow header-based auth (reject cookie sessions)
	token, tokenLocation := app.ParseAuthTokenFromRequest(r)
	if token == "" || tokenLocation == app.TokenLocationCookie {
		c.Err = model.NewAppError("updateActiveStatus", "api.context.session_cookie_not_allowed.app_error", nil,
			"This endpoint requires header-based authentication", http.StatusUnauthorized)
		return
	}

	policyID := c.Params.PolicyId

	// Check if user has system admin permission OR channel-specific permission for this policy
	hasManageSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasManageSystemPermission {
		// For non-system admins, validate policy access permission
		if appErr := c.App.ValidateAccessControlPolicyPermission(c.AppContext, c.AppContext.Session().UserId, policyID); appErr != nil {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUpdateActiveStatus, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)

	active := r.URL.Query().Get("active")
	if active != "true" && active != "false" {
		c.SetInvalidParam("active")
		return
	}
	activeBool, err := strconv.ParseBool(active)
	if err != nil {
		c.SetInvalidParamWithErr("active", err)
		return
	}
	model.AddEventParameterToAuditRec(auditRec, "active", activeBool)

	// Wrap single update in slice to use the batch update method
	updates := []model.AccessControlPolicyActiveUpdate{
		{ID: policyID, Active: activeBool},
	}
	_, appErr := c.App.UpdateAccessControlPoliciesActive(c.AppContext, updates)
	if appErr != nil {
		c.Err = appErr
		return
	}

	auditRec.Success()

	// Return success response
	response := map[string]any{
		"status": "OK",
	}

	// Set deprecation header to inform clients
	w.Header().Set("Deprecation", "true")
	w.Header().Set("Link", "</api/v4/access_control/policies/activate>; rel=\"successor-version\"")
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func setActiveStatus(c *Context, w http.ResponseWriter, r *http.Request) {
	var list model.AccessControlPolicyActiveUpdateRequest
	if jsonErr := json.NewDecoder(r.Body).Decode(&list); jsonErr != nil {
		c.SetInvalidParamWithErr("request", jsonErr)
		return
	}

	auditRec := c.MakeAuditRecord(model.AuditEventSetActiveStatus, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterAuditableToAuditRec(auditRec, "requested", &list)

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		for _, entry := range list.Entries {
			// Try delegated admin permissions: channel admin first, then team admin
			channelPermErr := c.App.ValidateAccessControlPolicyPermission(c.AppContext, c.AppContext.Session().UserId, entry.ID)
			if channelPermErr != nil {
				// Try team-admin permission via team_id in request
				if list.TeamID != "" && model.IsValidId(list.TeamID) &&
					c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), list.TeamID, model.PermissionManageTeamAccessRules) {
					owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, list.TeamID, entry.ID)
					if appErr != nil {
						c.Err = appErr
						return
					}
					if !owned {
						c.SetPermissionError(model.PermissionManageTeamAccessRules)
						return
					}
				} else {
					c.SetPermissionError(model.PermissionManageChannelAccessRules)
					return
				}
			}
		}
	}

	policies, appErr := c.App.UpdateAccessControlPoliciesActive(c.AppContext, list.Entries)
	if appErr != nil {
		c.Err = appErr
		return
	}
	auditRec.Success()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(policies); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func assignAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	var assignments struct {
		ChannelIds []string `json:"channel_ids"`
		TeamID     string   `json:"team_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&assignments)
	if err != nil {
		c.SetInvalidParamWithErr("assignments", err)
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		if assignments.TeamID == "" || !model.IsValidId(assignments.TeamID) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), assignments.TeamID, model.PermissionManageTeamAccessRules) {
			c.SetPermissionError(model.PermissionManageTeamAccessRules)
			return
		}
		// Policy must be team-scoped to this team. Channel validation below ensures all
		// channels belong to the requesting team regardless.
		owned, ownershipErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, assignments.TeamID, policyID)
		if ownershipErr != nil {
			c.Err = ownershipErr
			return
		}
		if !owned {
			c.SetPermissionError(model.PermissionManageTeamAccessRules)
			return
		}
		if appErr := c.App.ValidateTeamScopePolicyChannelAssignment(c.AppContext, assignments.TeamID, assignments.ChannelIds); appErr != nil {
			c.Err = appErr
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventAssignAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIds)

	if len(assignments.ChannelIds) != 0 {
		_, appErr := c.App.AssignAccessControlPolicyToChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	// Reconcile team scope: if all channels now belong to one team, set scope;
	// if channels span multiple teams (e.g. system admin added cross-team), clear scope.
	if appErr := c.App.ReconcilePolicyTeamScope(c.AppContext, policyID); appErr != nil {
		c.Logger.Warn("Failed to reconcile policy team scope after assign", mlog.String("policy_id", policyID), mlog.Err(appErr))
	}

	auditRec.Success()
}

func unassignAccessPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	var assignments struct {
		ChannelIds []string `json:"channel_ids"`
		TeamID     string   `json:"team_id"`
	}

	err := json.NewDecoder(r.Body).Decode(&assignments)
	if err != nil {
		c.SetInvalidParamWithErr("assignments", err)
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		if assignments.TeamID == "" || !model.IsValidId(assignments.TeamID) {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
		if !c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), assignments.TeamID, model.PermissionManageTeamAccessRules) {
			c.SetPermissionError(model.PermissionManageTeamAccessRules)
			return
		}
		owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, assignments.TeamID, policyID)
		if appErr != nil {
			c.Err = appErr
			return
		}
		if !owned {
			c.SetPermissionError(model.PermissionManageTeamAccessRules)
			return
		}
	}

	auditRec := c.MakeAuditRecord(model.AuditEventUnassignAccessPolicy, model.AuditStatusFail)
	defer c.LogAuditRec(auditRec)
	model.AddEventParameterToAuditRec(auditRec, "id", policyID)
	model.AddEventParameterToAuditRec(auditRec, "channel_ids", assignments.ChannelIds)

	// Pre-flight: ensure scope is set before removing channels. This handles
	// pre-scope policies (created before the scope field existed) by capturing
	// the team from current channels before they are removed. Without this,
	// unassigning all channels would leave the policy with no scope and no
	// channels, making it unmanageable by team admins.
	if appErr := c.App.ReconcilePolicyTeamScope(c.AppContext, policyID); appErr != nil {
		c.Logger.Warn("Failed to reconcile policy team scope before unassign", mlog.String("policy_id", policyID), mlog.Err(appErr))
	}

	if len(assignments.ChannelIds) != 0 {
		appErr := c.App.UnassignPoliciesFromChannels(c.AppContext, policyID, assignments.ChannelIds)
		if appErr != nil {
			c.Err = appErr
			return
		}
	}

	// Post-unassign reconcile: update scope based on remaining channels.
	// If channels remain in one team → scope set. Multiple teams → scope cleared.
	// No channels remain → no-op (scope preserved from pre-flight or creation).
	if appErr := c.App.ReconcilePolicyTeamScope(c.AppContext, policyID); appErr != nil {
		c.Logger.Warn("Failed to reconcile policy team scope after unassign", mlog.String("policy_id", policyID), mlog.Err(appErr))
	}

	auditRec.Success()
}

func getChannelsForAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}
	policyID := c.Params.PolicyId

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		teamID := r.URL.Query().Get("team_id")
		if teamID != "" && model.IsValidId(teamID) &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules) {
			owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, teamID, policyID)
			if appErr != nil {
				c.Err = appErr
				return
			}
			if !owned {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				return
			}
		} else {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	afterID := r.URL.Query().Get("after")
	if afterID != "" && !model.IsValidId(afterID) {
		c.SetInvalidParam("after")
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.Err = model.NewAppError("getChannelsForAccessControlPolicy", "api.access_control_policy.get_channels.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
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
		c.Err = model.NewAppError("getChannelsForAccessControlPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func searchChannelsForAccessControlPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	if c.Err != nil {
		return
	}

	var authorizedTeamID string
	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		authorizedTeamID = r.URL.Query().Get("team_id")
		if authorizedTeamID != "" && model.IsValidId(authorizedTeamID) &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), authorizedTeamID, model.PermissionManageTeamAccessRules) {
			owned, appErr := c.App.ValidateTeamAdminPolicyOwnership(c.AppContext, authorizedTeamID, c.Params.PolicyId)
			if appErr != nil {
				c.Err = appErr
				return
			}
			if !owned {
				c.SetPermissionError(model.PermissionManageTeamAccessRules)
				return
			}
		} else {
			c.SetPermissionError(model.PermissionManageSystem)
			return
		}
	}

	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil || props == nil {
		c.SetInvalidParamWithErr("channel_search", err)
		return
	}

	policyID := c.Params.PolicyId

	// For non-system-admins, force the search to only the authorized team
	teamIds := props.TeamIds
	if !hasSystemPermission && authorizedTeamID != "" {
		teamIds = []string{authorizedTeamID}
	}

	opts := model.ChannelSearchOpts{
		Deleted:                     props.Deleted,
		IncludeDeleted:              props.IncludeDeleted,
		Private:                     true,
		ExcludeGroupConstrained:     true,
		TeamIds:                     teamIds,
		ParentAccessControlPolicyId: policyID,
	}

	channels, total, appErr := c.App.SearchAllChannels(c.AppContext, props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	data := model.ChannelsWithCount{Channels: channels, TotalCount: total}

	channelsJSON, jsonErr := json.Marshal(data)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchChannelsInPolicy", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(jsonErr)
		return
	}

	if _, err := w.Write(channelsJSON); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func getFieldsAutocomplete(c *Context, w http.ResponseWriter, r *http.Request) {
	channelId := r.URL.Query().Get("channelId")
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	teamID := r.URL.Query().Get("team_id")

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		hasTeamPermission := teamID != "" && model.IsValidId(teamID) &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules)
		if !hasTeamPermission {
			if channelId == "" {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}

			hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}
		}
	}

	after := r.URL.Query().Get("after")
	if after != "" && !model.IsValidId(after) {
		c.SetInvalidParam("after")
		return
	} else if after == "" {
		after = strings.Repeat("0", 26)
	}

	limitStr := r.URL.Query().Get("limit")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.Err = model.NewAppError("getFieldsAutocomplete", "api.access_control_policy.get_fields.limit.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		return
	}
	if limit <= 0 || limit > 100 {
		c.Err = model.NewAppError("getFieldsAutocomplete", "api.access_control_policy.get_fields.limit.app_error", nil, "", http.StatusBadRequest)
		return
	}

	var ac []*model.PropertyField
	var appErr *model.AppError

	ac, appErr = c.App.GetAccessControlFieldsAutocomplete(c.AppContext, after, limit, c.AppContext.Session().UserId)

	if appErr != nil {
		c.Err = appErr
		return
	}

	js, err := json.Marshal(ac)
	if err != nil {
		c.Err = model.NewAppError("getExpressionAutocomplete", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	if _, err := w.Write(js); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}

func convertToVisualAST(c *Context, w http.ResponseWriter, r *http.Request) {
	var cel struct {
		Expression string `json:"expression"`
		ChannelId  string `json:"channelId,omitempty"`
		TeamId     string `json:"teamId,omitempty"`
	}
	if jsonErr := json.NewDecoder(r.Body).Decode(&cel); jsonErr != nil {
		c.SetInvalidParamWithErr("user", jsonErr)
		return
	}

	channelId := cel.ChannelId
	if channelId != "" && !model.IsValidId(channelId) {
		c.SetInvalidParam("channelId")
		return
	}

	hasSystemPermission := c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem)
	if !hasSystemPermission {
		teamID := cel.TeamId
		hasTeamPermission := teamID != "" && model.IsValidId(teamID) &&
			c.App.SessionHasPermissionToTeam(*c.AppContext.Session(), teamID, model.PermissionManageTeamAccessRules)
		if !hasTeamPermission {
			if channelId == "" {
				c.SetPermissionError(model.PermissionManageSystem)
				return
			}
			hasChannelPermission, _ := c.App.HasPermissionToChannel(c.AppContext, c.AppContext.Session().UserId, channelId, model.PermissionManageChannelAccessRules)
			if !hasChannelPermission {
				c.SetPermissionError(model.PermissionManageChannelAccessRules)
				return
			}
		}
	}
	visualAST, appErr := c.App.ExpressionToVisualAST(c.AppContext, cel.Expression)
	if appErr != nil {
		c.Err = appErr
		return
	}

	b, err := json.Marshal(visualAST)
	if err != nil {
		c.Err = model.NewAppError("convertToVisualAST", "api.marshal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := w.Write(b); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
