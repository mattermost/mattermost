// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package server

import (
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/boards/model"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/config"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/notify"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/permissions"
	"github.com/mattermost/mattermost-server/server/v8/boards/services/store"
	"github.com/mattermost/mattermost-server/server/v8/boards/ws"

	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

type Params struct {
	Cfg                *config.Configuration
	SingleUserToken    string
	DBStore            store.Store
	Logger             mlog.LoggerIFace
	ServerID           string
	WSAdapter          ws.Adapter
	NotifyBackends     []notify.Backend
	PermissionsService permissions.PermissionsService
	ServicesAPI        model.ServicesAPI
	IsPlugin           bool
}

func (p Params) CheckValid() error {
	if p.Cfg == nil {
		return ErrServerParam{name: "Cfg", issue: "cannot be nil"}
	}

	if p.DBStore == nil {
		return ErrServerParam{name: "DbStore", issue: "cannot be nil"}
	}

	if p.Logger == nil {
		return ErrServerParam{name: "Logger", issue: "cannot be nil"}
	}

	if p.PermissionsService == nil {
		return ErrServerParam{name: "Permissions", issue: "cannot be nil"}
	}
	return nil
}

type ErrServerParam struct {
	name  string
	issue string
}

func (e ErrServerParam) Error() string {
	return fmt.Sprintf("invalid server params: %s %s", e.name, e.issue)
}
