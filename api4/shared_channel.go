// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
)

func (api *API) InitSharedChannels() {
	api.BaseRoutes.SharedChannels.Handle("/getremote/{remote_id:[A-Za-z0-9]+}", api.ApiSessionRequired(getRemoteClusterById)).Methods("GET")
}

func getRemoteClusterById(c *Context, w http.ResponseWriter, r *http.Request) {
	// make sure remote cluster service is enabled.
	if _, appErr := c.App.GetRemoteClusterService(); appErr != nil {
		c.Err = appErr
		return
	}

	c.RequireRemoteId()
	if c.Err != nil {
		return
	}

	// GetRemoteClusterForUser will only return a remote if the user is a member of at
	// least one channel shared by the remote. All other cases return error.
	rc, err := c.App.GetRemoteClusterForUser(c.Params.RemoteId, c.App.Session().UserId)
	if err != nil {
		c.SetRemoteIdNotFoundError(c.Params.RemoteId)
		return
	}

	remoteInfo := rc.ToRemoteClusterInfo()

	b, err := json.Marshal(remoteInfo)
	if err != nil {
		c.SetJSONEncodingError()
		return
	}
	w.Write(b)
}
