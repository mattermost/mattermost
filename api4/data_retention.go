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
	api.BaseRoutes.DataRetention.Handle("/policy", api.ApiSessionRequired(getGlobalPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.ApiSessionRequired(getPolicies)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies_count", api.ApiSessionRequired(getPoliciesCount)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.ApiSessionRequired(createPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.ApiSessionRequired(patchPolicy)).Methods("PATCH")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}", api.ApiSessionRequired(deletePolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.ApiSessionRequired(getTeamsForPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.ApiSessionRequired(addTeamsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams", api.ApiSessionRequired(removeTeamsFromPolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/teams/search", api.ApiSessionRequired(searchTeamsInPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequired(getChannelsForPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequired(addChannelsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels", api.ApiSessionRequired(removeChannelsFromPolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id:[A-Za-z0-9]+}/channels/search", api.ApiSessionRequired(searchChannelsInPolicy)).Methods("POST")
	api.BaseRoutes.User.Handle("/data_retention/team_policies", api.ApiSessionRequired(getTeamPoliciesForUser)).Methods("GET")
	api.BaseRoutes.User.Handle("/data_retention/channel_policies", api.ApiSessionRequired(getChannelPoliciesForUser)).Methods("GET")
}

func getGlobalPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.

	policy, err := c.App.GetGlobalRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	w.Write(policy.ToJson())
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

	w.Write(policies.ToJson())
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
	w.Write(policy.ToJson())
}

func createPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policy, jsonErr := model.RetentionPolicyWithTeamAndChannelIdsFromJson(r.Body)
	if jsonErr != nil {
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

	newPolicy, err := c.App.CreateRetentionPolicy(policy)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddMeta("policy", newPolicy) // overwrite meta
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	w.Write(newPolicy.ToJson())
}

func patchPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	patch, jsonErr := model.RetentionPolicyWithTeamAndChannelIdsFromJson(r.Body)
	if jsonErr != nil {
		c.SetInvalidParam("policy")
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

	policy, err := c.App.PatchRetentionPolicy(patch)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	w.Write(policy.ToJson())
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

	props := model.TeamSearchFromJson(r.Body)
	if props == nil {
		c.SetInvalidParam("team_search")
		return
	}
	props.PolicyID = model.NewString(c.Params.PolicyId)
	props.IncludePolicyID = model.NewBool(true)

	teams, _, err := c.App.SearchAllTeams(props)
	if err != nil {
		c.Err = err
		return
	}
	c.App.SanitizeTeams(*c.AppContext.Session(), teams)

	payload := []byte(model.TeamListToJson(teams))
	w.Write(payload)
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

	payload := []byte(channels.ToJson())
	w.Write(payload)
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

	w.Write(policies.ToJson())
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

	w.Write(policies.ToJson())
}
