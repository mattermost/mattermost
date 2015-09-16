// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"bufio"
	"net/http"
	"os"

	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func InitAdmin(r *mux.Router) {
	l4g.Debug("Initializing admin api routes")

	sr := r.PathPrefix("/admin").Subrouter()
	sr.Handle("/logs", ApiUserRequired(getLogs)).Methods("GET")
	sr.Handle("/client_props", ApiAppHandler(getClientProperties)).Methods("GET")
}

func getLogs(c *Context, w http.ResponseWriter, r *http.Request) {

	if !c.HasSystemAdminPermissions("getLogs") {
		return
	}

	var lines []string

	if utils.Cfg.LogSettings.FileEnable {

		file, err := os.Open(utils.Cfg.LogSettings.FileLocation)
		if err != nil {
			c.Err = model.NewAppError("getLogs", "Error reading log file", err.Error())
		}

		defer file.Close()

		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
	} else {
		lines = append(lines, "")
	}

	w.Write([]byte(model.ArrayToJson(lines)))
}

func getClientProperties(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(model.MapToJson(utils.ClientProperties)))
}
