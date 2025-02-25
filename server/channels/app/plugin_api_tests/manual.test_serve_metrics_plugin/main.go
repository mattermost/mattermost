// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type Plugin struct {
	plugin.MattermostPlugin
}

func (p *Plugin) ServeMetrics(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/subpath" {
		_, err := w.Write([]byte("METRICS SUBPATH"))
		if err != nil {
			mlog.Error("Failed to write response", mlog.Err(err))
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		return
	}

	_, err := w.Write([]byte("METRICS"))
	if err != nil {
		mlog.Error("Failed to write response", mlog.Err(err))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
}

func main() {
	plugin.ClientMain(&Plugin{})
}
