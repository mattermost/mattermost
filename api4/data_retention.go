// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/audit"
	"github.com/mattermost/mattermost-server/v6/model"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Handle("/policy", api.APISessionRequired(getGlobalPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.APISessionRequired(getPolicies)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies_count", api.APISessionRequired(getPoliciesCount)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.APISessionRequired(createPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(getPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(patchPolicy)).Methods("PATCH")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.APISessionRequired(deletePolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(getTeamsForPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(addTeamsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.APISessionRequired(removeTeamsFromPolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams/search", api.APISessionRequired(searchTeamsInPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(getChannelsForPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(addChannelsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.APISessionRequired(removeChannelsFromPolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels/search", api.APISessionRequired(searchChannelsInPolicy)).Methods("POST")
	api.BaseRoutes.User.Handle("/data_retention/team_policies", api.APISessionRequired(getTeamPoliciesForUser)).Methods("GET")
	api.BaseRoutes.User.Handle("/data_retention/channel_policies", api.APISessionRequired(getChannelPoliciesForUser)).Methods("GET")
}

func getGlobalPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.

	policy, err := c.App.GetGlobalRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policy)
	if jsonErr != nil {
		c.Err = model.NewAppError("getGlobalPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func getPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	limit := c.Params.PerPage
	offset := c.Params.Page * limit

	policies, err := c.App.GetRetentionPolicies(offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policies)
	if jsonErr != nil {
		c.Err = model.NewAppError("getPolicies", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func getPoliciesCount(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	count, err := c.App.GetRetentionPoliciesCount()
	if err != nil {
		c.Err = err
		return
	}
	body := map[string]int64{"total_count": count}
	b, _ := json.Marshal(body)
	w.Write(b)
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	c.RequirePolicyId()
	policy, err := c.App.GetRetentionPolicy(c.Params.PolicyId)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policy)
	if jsonErr != nil {
		c.Err = model.NewAppError("getPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func createPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var policy model.RetentionPolicyWithTeamAndChannelIDs
	if jsonErr := json.NewDecoder(r.Body).Decode(&policy); jsonErr != nil {
		c.SetInvalidParam("policy")
		return
	}
	auditRec := c.MakeAuditRecord("createPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy", policy)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	newPolicy, err := c.App.CreateRetentionPolicy(&policy)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddMeta("policy", newPolicy) // overwrite meta
	js, jsonErr := json.Marshal(newPolicy)
	if jsonErr != nil {
		c.Err = model.NewAppError("createPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	w.Write(js)
}

func patchPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	var patch model.RetentionPolicyWithTeamAndChannelIDs
	if jsonErr := json.NewDecoder(r.Body).Decode(&patch); jsonErr != nil {
		c.SetInvalidParam("policy")
		return
	}
	c.RequirePolicyId()
	patch.ID = c.Params.PolicyId

	auditRec := c.MakeAuditRecord("patchPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("patch", patch)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	policy, err := c.App.PatchRetentionPolicy(&patch)
	if err != nil {
		c.Err = err
		return
	}
	js, jsonErr := json.Marshal(policy)
	if jsonErr != nil {
		c.Err = model.NewAppError("patchPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	auditRec.Success()
	w.Write(js)
}

func deletePolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	policyId := c.Params.PolicyId

	auditRec := c.MakeAuditRecord("deletePolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.DeleteRetentionPolicy(policyId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamsForPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	limit := c.Params.PerPage
	offset := c.Params.Page * limit

	teams, err := c.App.GetTeamsForRetentionPolicy(policyId, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(teams)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.getTeamsForPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

func searchTeamsInPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	var props model.TeamSearch
	if jsonErr := json.NewDecoder(r.Body).Decode(&props); jsonErr != nil {
		c.SetInvalidParam("team_search")
		return
	}

	props.PolicyID = model.NewString(c.Params.PolicyId)
	props.IncludePolicyID = model.NewBool(true)

	teams, _, err := c.App.SearchAllTeams(&props)
	if err != nil {
		c.Err = err
		return
	}
	c.App.SanitizeTeams(*c.AppContext.Session(), teams)

	js, jsonErr := json.Marshal(teams)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchTeamsInPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func addTeamsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	var teamIDs []string
	jsonErr := json.NewDecoder(r.Body).Decode(&teamIDs)
	if jsonErr != nil {
		c.SetInvalidParam("team_ids")
		return
	}
	auditRec := c.MakeAuditRecord("addTeamsToPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("team_ids", teamIDs)
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.AddTeamsToRetentionPolicy(policyId, teamIDs)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeTeamsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	var teamIDs []string
	jsonErr := json.NewDecoder(r.Body).Decode(&teamIDs)
	if jsonErr != nil {
		c.SetInvalidParam("team_ids")
		return
	}
	auditRec := c.MakeAuditRecord("removeTeamsFromPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("team_ids", teamIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.RemoveTeamsFromRetentionPolicy(policyId, teamIDs)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getChannelsForPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	limit := c.Params.PerPage
	offset := c.Params.Page * limit

	channels, err := c.App.GetChannelsForRetentionPolicy(policyId, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	b, jsonErr := json.Marshal(channels)
	if jsonErr != nil {
		c.Err = model.NewAppError("Api4.getChannelsForPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(b)
}

func searchChannelsInPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	var props *model.ChannelSearch
	err := json.NewDecoder(r.Body).Decode(&props)
	if err != nil {
		c.SetInvalidParam("channel_search")
		return
	}

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleReadComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleReadComplianceDataRetentionPolicy)
		return
	}

	opts := model.ChannelSearchOpts{
		PolicyID:        c.Params.PolicyId,
		IncludePolicyID: true,
		Deleted:         props.Deleted,
		IncludeDeleted:  props.IncludeDeleted,
		Public:          props.Public,
		Private:         props.Private,
		TeamIds:         props.TeamIds,
	}

	channels, _, appErr := c.App.SearchAllChannels(props.Term, opts)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channelsJSON, jsonErr := json.Marshal(channels)
	if jsonErr != nil {
		c.Err = model.NewAppError("searchChannelsInPolicy", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}

	w.Write(channelsJSON)
}

func addChannelsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	var channelIDs []string
	jsonErr := json.NewDecoder(r.Body).Decode(&channelIDs)
	if jsonErr != nil {
		c.SetInvalidParam("channel_ids")
		return
	}
	auditRec := c.MakeAuditRecord("addChannelsToPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("channel_ids", channelIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.AddChannelsToRetentionPolicy(policyId, channelIDs)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func removeChannelsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequirePolicyId()
	policyId := c.Params.PolicyId
	var channelIDs []string
	jsonErr := json.NewDecoder(r.Body).Decode(&channelIDs)
	if jsonErr != nil {
		c.SetInvalidParam("channel_ids")
		return
	}
	auditRec := c.MakeAuditRecord("removeChannelsFromPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("channel_ids", channelIDs)

	if !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionSysconsoleWriteComplianceDataRetentionPolicy) {
		c.SetPermissionError(model.PermissionSysconsoleWriteComplianceDataRetentionPolicy)
		return
	}

	err := c.App.RemoveChannelsFromRetentionPolicy(policyId, channelIDs)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	ReturnStatusOK(w)
}

func getTeamPoliciesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userID := c.Params.UserId
	limit := c.Params.PerPage
	offset := c.Params.Page * limit

	if userID != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	policies, err := c.App.GetTeamPoliciesForUser(userID, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policies)
	if jsonErr != nil {
		c.Err = model.NewAppError("getTeamPoliciesForUser", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}

func getChannelPoliciesForUser(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireUserId()
	if c.Err != nil {
		return
	}
	userID := c.Params.UserId
	limit := c.Params.PerPage
	offset := c.Params.Page * limit

	if userID != c.AppContext.Session().UserId && !c.App.SessionHasPermissionTo(*c.AppContext.Session(), model.PermissionManageSystem) {
		c.SetPermissionError(model.PermissionManageSystem)
		return
	}

	policies, err := c.App.GetChannelPoliciesForUser(userID, offset, limit)
	if err != nil {
		c.Err = err
		return
	}

	js, jsonErr := json.Marshal(policies)
	if jsonErr != nil {
		c.Err = model.NewAppError("getChannelPoliciesForUser", "api.marshal_error", nil, jsonErr.Error(), http.StatusInternalServerError)
		return
	}
	w.Write(js)
}
