// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"fmt"
	"net/http"
	"strings"

	l4g "github.com/alecthomas/log4go"

	"github.com/mattermost/mattermost-server/app"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/utils"
)

func InitGeneral() {
	l4g.Debug(utils.T("api.general.init.debug"))

	BaseRoutes.General.Handle("/client_props", ApiAppHandler(getClientConfig)).Methods("GET")
	BaseRoutes.General.Handle("/log_client", ApiAppHandler(logClient)).Methods("POST")
	BaseRoutes.General.Handle("/ping", ApiAppHandler(ping)).Methods("GET")
}

func getClientConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(model.MapToJson(utils.ClientCfg)))
}

func logClient(c *Context, w http.ResponseWriter, r *http.Request) {
	forceToDebug := false

	if !*utils.Cfg.ServiceSettings.EnableDeveloper {
		if c.Session.UserId == "" {
			c.Err = model.NewAppError("Permissions", "api.context.permissions.app_error", nil, "", http.StatusForbidden)
			return
		}

		if !app.SessionHasPermissionTo(c.Session, model.PERMISSION_MANAGE_SYSTEM) {
			forceToDebug = true
		}
	}

	m := model.MapFromJson(r.Body)

	lvl := m["level"]
	msg := m["message"]

	// filter out javascript errors from franz that are poluting the log files
	if strings.Contains(msg, "/franz") {
		forceToDebug = true
	}

	if len(msg) > 400 {
		msg = msg[0:399]
	}

	if lvl == "ERROR" {
		err := &model.AppError{}
		err.Message = msg
		err.Id = msg
		err.Where = "client"

		if forceToDebug {
			c.LogDebug(err)
		} else {
			c.LogError(err)
		}
	}

	ReturnStatusOK(w)
}

func ping(c *Context, w http.ResponseWriter, r *http.Request) {
	m := make(map[string]string)
	m["version"] = model.CurrentVersion
	m["server_time"] = fmt.Sprintf("%v", model.GetMillis())
	w.Write([]byte(model.MapToJson(m)))
}
