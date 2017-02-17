// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/utils"
)

func InitSystem() {
	l4g.Debug(utils.T("api.system.init.debug"))

	BaseRoutes.System.Handle("/ping", ApiHandler(getSystemPing)).Methods("GET")
}

func getSystemPing(c *Context, w http.ResponseWriter, r *http.Request) {
	ReturnStatusOK(w)
}
