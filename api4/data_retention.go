// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/v5/audit"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Handle("/policy", api.ApiSessionRequired(getGlobalPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.ApiSessionRequired(getPolicies)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.ApiSessionRequired(createPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}", api.ApiSessionRequired(getPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}", api.ApiSessionRequired(patchPolicy)).Methods("PATCH")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}", api.ApiSessionRequired(updatePolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}", api.ApiSessionRequired(deletePolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}/teams", api.ApiSessionRequired(addTeamsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}/teams", api.ApiSessionRequired(removeTeamsFromPolicy)).Methods("DELETE")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}/channels", api.ApiSessionRequired(addChannelsToPolicy)).Methods("POST")
	api.BaseRoutes.DataRetention.Handle("/policies/{policy_id}/channels", api.ApiSessionRequired(removeChannelsFromPolicy)).Methods("DELETE")
}

type teamIdsList struct {
	TeamIds []string `json:"team_ids"`
}

type channelIdsList struct {
	ChannelIds []string `json:"channel_ids"`
}

func getGlobalPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.

	policy, err := c.App.GetGlobalRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(policy.ToJson()))
}

func getPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	sCountsOnly := r.URL.Query().Get("counts_only")
	bCountsOnly := false
	var err error
	var body map[string]interface{}
	if sCountsOnly != "" {
		bCountsOnly, err = strconv.ParseBool(sCountsOnly)
		if err != nil {
			mlog.Warn("Failed to parse counts_only URL query parameter from getPolicies request", mlog.Err(err))
		}
	}
	if bCountsOnly {
		policies, err := c.App.GetRetentionPoliciesWithCounts()
		if err != nil {
			c.Err = err
			return
		}
		body = map[string]interface{}{
			"policies":    policies,
			"total_count": len(policies),
		}
	} else {
		policies, err := c.App.GetRetentionPolicies()
		if err != nil {
			c.Err = err
			return
		}
		body = map[string]interface{}{
			"policies":    policies,
			"total_count": len(policies),
		}
	}
	b, _ := json.Marshal(body)
	w.Write(b)
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]
	policy, err := c.App.GetRetentionPolicy(policyId)
	if err != nil {
		c.Err = err
		return
	}
	w.Write(policy.ToJsonBytes())
}

func createPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policy, jsonErr := model.RetentionPolicyFromJson(r.Body)
	if jsonErr != nil {
		c.SetInvalidParam("policy")
		return
	}
	auditRec := c.MakeAuditRecord("createPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy", policy)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	policy, err := c.App.CreateRetentionPolicy(policy)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.AddMeta("policy", policy) // overwrite meta
	auditRec.Success()
	w.WriteHeader(http.StatusCreated)
	w.Write(policy.ToJsonBytes())
}

func patchPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	patch, jsonErr := model.RetentionPolicyUpdateFromJson(r.Body)
	if jsonErr != nil {
		c.SetInvalidParam("policy")
	}
	patch.Id = mux.Vars(r)["policy_id"]

	auditRec := c.MakeAuditRecord("patchPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("patch", patch)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	policy, err := c.App.PatchRetentionPolicy(patch)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	w.Write(policy.ToJsonBytes())
}

func updatePolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	update, jsonErr := model.RetentionPolicyUpdateFromJson(r.Body)
	if jsonErr != nil {
		c.SetInvalidParam("policy")
	}
	update.Id = mux.Vars(r)["policy_id"]

	auditRec := c.MakeAuditRecord("updatePolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("update", update)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	policy, err := c.App.UpdateRetentionPolicy(update)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	w.Write(policy.ToJsonBytes())
}

func deletePolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]

	auditRec := c.MakeAuditRecord("deletePolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.DeleteRetentionPolicy(policyId)
	if err != nil {
		c.Err = err
		return
	}
	auditRec.Success()
	w.WriteHeader(http.StatusNoContent)
}

func addTeamsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]
	var lst teamIdsList
	jsonErr := json.NewDecoder(r.Body).Decode(&lst)
	if jsonErr != nil {
		c.SetInvalidParam("team_ids")
		return
	}
	auditRec := c.MakeAuditRecord("addTeamsToPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("team_ids", lst.TeamIds)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.AddTeamsToRetentionPolicy(policyId, lst.TeamIds)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	w.WriteHeader(http.StatusNoContent)
}

func removeTeamsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]
	var lst teamIdsList
	jsonErr := json.NewDecoder(r.Body).Decode(&lst)
	if jsonErr != nil {
		c.SetInvalidParam("team_ids")
		return
	}
	auditRec := c.MakeAuditRecord("removeTeamsFromPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("team_ids", lst.TeamIds)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.RemoveTeamsFromRetentionPolicy(policyId, lst.TeamIds)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	w.WriteHeader(http.StatusNoContent)
}

func addChannelsToPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]
	var lst channelIdsList
	jsonErr := json.NewDecoder(r.Body).Decode(&lst)
	if jsonErr != nil {
		c.SetInvalidParam("channel_ids")
		return
	}
	auditRec := c.MakeAuditRecord("addChannelsToPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("channel_ids", lst.ChannelIds)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.AddChannelsToRetentionPolicy(policyId, lst.ChannelIds)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	w.WriteHeader(http.StatusNoContent)
}

func removeChannelsFromPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	policyId := mux.Vars(r)["policy_id"]
	var lst channelIdsList
	jsonErr := json.NewDecoder(r.Body).Decode(&lst)
	if jsonErr != nil {
		c.SetInvalidParam("channel_ids")
		return
	}
	auditRec := c.MakeAuditRecord("removeChannelsFromPolicy", audit.Fail)
	defer c.LogAuditRec(auditRec)
	auditRec.AddMeta("policy_id", policyId)
	auditRec.AddMeta("channel_ids", lst.ChannelIds)
	if !c.IsSystemAdmin() {
		c.SetPermissionError(model.PERMISSION_MANAGE_SYSTEM)
		return
	}

	err := c.App.RemoveChannelsFromRetentionPolicy(policyId, lst.ChannelIds)
	if err != nil {
		c.Err = err
		return
	}

	auditRec.Success()
	w.WriteHeader(http.StatusNoContent)
}
