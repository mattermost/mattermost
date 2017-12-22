// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
)

func (api *API) InitWebrtc() {
	api.BaseRoutes.Webrtc.Handle("/token", api.ApiSessionRequired(webrtcToken)).Methods("GET")
}

func webrtcToken(c *Context, w http.ResponseWriter, r *http.Request) {
	result, err := c.App.GetWebrtcInfoForSession(c.Session.Id)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(result.ToJson()))
}
