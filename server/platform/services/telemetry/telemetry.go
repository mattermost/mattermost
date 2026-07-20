// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package telemetry

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const (
	DBAccessAttempts    = 3
	DBAccessTimeoutSecs = 10
)

type ServerIface interface {
	Config() *model.Config
	IsLeader() bool
}

type TelemetryService struct {
	srv      ServerIface
	dbStore  store.Store
	log      *mlog.Logger
	ServerID string
}

func New(srv ServerIface, dbStore store.Store, log *mlog.Logger) (*TelemetryService, error) {
	service := &TelemetryService{
		srv:     srv,
		dbStore: dbStore,
		log:     log,
	}

	if err := service.ensureServerID(); err != nil {
		return nil, fmt.Errorf("unable to ensure telemetry ID: %w", err)
	}

	return service, nil
}

func (ts *TelemetryService) ensureServerID() error {
	if ts.ServerID != "" {
		return nil
	}

	id := model.NewId()
	var err error

	for range DBAccessAttempts {
		ts.log.Info("Ensuring the telemetry ID..")
		systemID := &model.System{Name: model.SystemServerId, Value: id}
		systemID, err = ts.dbStore.System().InsertIfExists(systemID)
		if err != nil {
			ts.log.Info("Unable to get/set the telemetry ID", mlog.Err(err))
			time.Sleep(DBAccessTimeoutSecs * time.Second)
			continue
		}

		ts.ServerID = systemID.Value
		ts.log.Info("server ID is set", mlog.String("id", ts.ServerID))
		return nil
	}

	return fmt.Errorf("unable to get the server ID: %w", err)
}
