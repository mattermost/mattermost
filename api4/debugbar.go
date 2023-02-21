// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"
	"runtime"

	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

func (api *API) InitDebugBar() {
	api.BaseRoutes.DebugBar.Handle("/systeminfo", api.APISessionRequired(getSystemInfo)).Methods("GET")
}

type SystemInfo struct {
	Goroutines int
	Cpus       int
	CgoCalls   int64
	GoVersion  string
	GoMemStats runtime.MemStats
}

func getSystemInfo(c *Context, w http.ResponseWriter, r *http.Request) {
	// TODO: Add the check if the DEBUGBAR is enabled
	info := SystemInfo{
		GoVersion:  runtime.Version(),
		Goroutines: runtime.NumGoroutine(),
		Cpus:       runtime.NumCPU(),
		CgoCalls:   runtime.NumCgoCall(),
	}

	runtime.ReadMemStats(&info.GoMemStats)

	if err := json.NewEncoder(w).Encode(info); err != nil {
		c.Logger.Warn("Error while writing response", mlog.Err(err))
	}
}
