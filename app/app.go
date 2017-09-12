// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"net/http"

	"github.com/mattermost/mattermost-server/plugin/pluginenv"
)

type App struct {
	Srv                    *Server
	PluginEnv              *pluginenv.Environment
	PluginConfigListenerId string
}

var globalApp App

func Global() *App {
	return &globalApp
}

func CloseBody(r *http.Response) {
	if r.Body != nil {
		ioutil.ReadAll(r.Body)
		r.Body.Close()
	}
}
