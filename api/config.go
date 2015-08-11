// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/utils"
	"net/http"
	"strconv"
)

func InitConfig(r *mux.Router) {
	l4g.Debug("Initializing config api routes")

	sr := r.PathPrefix("/config").Subrouter()
	sr.Handle("/get/bypass_email", ApiAppHandler(getBypassEmail)).Methods("GET")
}

func getBypassEmail(c *Context, w http.ResponseWriter, r *http.Request) {
	w.Write([]byte(strconv.FormatBool(utils.Cfg.EmailSettings.ByPassEmail)))
}
