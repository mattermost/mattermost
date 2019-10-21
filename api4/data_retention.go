// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"github.com/mattermost/mattermost-server/services/tracing"
	"net/http"
)

func (api *API) InitDataRetention() {
	api.BaseRoutes.DataRetention.Handle("/policy", api.ApiSessionRequired(getPolicy)).Methods("GET")
}

func getPolicy(c *Context, w http.ResponseWriter, r *http.Request) {
	span,
		// No permission check required.
		ctx := tracing.StartSpanWithParentByContext(c.App.Context, "api4:data_retention:getPolicy")
	c.App.Context = ctx
	defer span.Finish()

	policy, err := c.App.GetDataRetentionPolicy()
	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(policy.ToJson()))
}
