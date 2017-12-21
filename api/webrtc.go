// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"
)

func (api *API) InitWebrtc() {
	api.BaseRoutes.Webrtc.Handle("/token", api.ApiUserRequired(webrtcToken)).Methods("POST")
}

func webrtcToken(c *Context, w http.ResponseWriter, r *http.Request) {
	result, err := c.App.GetWebrtcInfoForSession(c.Session.Id)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(result.ToJson()))
}
