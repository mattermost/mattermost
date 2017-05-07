// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/app"
	"github.com/mattermost/platform/utils"
)

func InitWebrtc() {
	l4g.Debug(utils.T("api.webrtc.init.debug"))

	BaseRoutes.Webrtc.Handle("/token", ApiUserRequired(webrtcToken)).Methods("POST")
}

func webrtcToken(c *Context, w http.ResponseWriter, r *http.Request) {
	result, err := app.GetWebrtcInfoForSession(c.Session.Id)

	if err != nil {
		c.Err = err
		return
	}

	w.Write([]byte(result.ToJson()))
}
