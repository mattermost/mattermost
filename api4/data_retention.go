// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Handle("/policy", api.ApiSessionRequired(getPolicy)).Methods("GET")
	api.BaseRoutes.DataRetention.Handle("/policies", api.ApiSessionRequired(getPolicies)).Methods("GET")
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.

	policy, err := c.App.GetGlobalRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(policy.ToJson()))
}

func getPolicies(c *Context, w http.ResponseWriter, r *http.Request) {
	policies, err := c.App.GetRetentionPolicies()
	if err != nil {
		c.Err = err
		return
	}
	body := map[string]interface{}{
		"policies":    policies,
		"total_count": len(policies),
	}
	b, _ := json.Marshal(body)
	w.Write(b)
}
