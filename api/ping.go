// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
	"net/http"
	"strconv"
	"time"
)

func InitPing(r *mux.Router) {
	l4g.Debug(utils.T("api.ping.init.debug"))

	sr := r.PathPrefix("/ping").Subrouter()
	sr.Handle("/", ApiAppHandler(getPing)).Methods("GET")
}

func getPing(c *Context, w http.ResponseWriter, r *http.Request) {
	now := time.Now().Unix()
	response := map[string]string{}
	response["version"] = model.CurrentVersion
	response["timestamp"] = strconv.FormatInt(now, 10)

	w.Write([]byte(model.MapToJson(response)))
}
