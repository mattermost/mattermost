// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Handle("/policy", api.ApiSessionRequired(getPolicy)).Methods("GET")
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	// No permission check required.

	policy, err := c.App.GetDataRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(policy.ToJson()))
}
