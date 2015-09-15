// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"encoding/json"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"strconv"
)

func InitConfig(r *mux.Router) {
	l4g.Debug("Initializing config api routes")

	sr := r.PathPrefix("/config").Subrouter()
	sr.Handle("/get_all", ApiAppHandler(getConfig)).Methods("GET")
}

func getConfig(c *Context, w http.ResponseWriter, r *http.Request) {
	settings := make(map[string]string)

	settings["ByPassEmail"] = strconv.FormatBool(utils.Cfg.EmailSettings.ByPassEmail)
	settings["EnableOAuthServiceProvider"] = strconv.FormatBool(utils.Cfg.ServiceSettings.EnableOAuthServiceProvider)

	if bytes, err := json.Marshal(settings); err != nil {
		c.Err = model.NewAppError("getConfig", "Unable to marshall configuration data", err.Error())
		return
	} else {
		w.Write(bytes)
	}
}
