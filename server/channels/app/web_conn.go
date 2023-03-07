// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost-server/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost-server/server/v8/model"
)

// PopulateWebConnConfig checks if the connection id already exists in the hub,
// and if so, accordingly populates the other fields of the webconn.
func (a *App) PopulateWebConnConfig(s *model.Session, cfg *platform.WebConnConfig, seqVal string) (*platform.WebConnConfig, error) {
	return a.Srv().Platform().PopulateWebConnConfig(s, cfg, seqVal)
}

// NewWebConn returns a new WebConn instance.
func (a *App) NewWebConn(cfg *platform.WebConnConfig) *platform.WebConn {
	return a.Srv().Platform().NewWebConn(cfg, a, a.ch)
}
