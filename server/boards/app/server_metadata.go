// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"runtime"

	"github.com/mattermost/mattermost-server/v6/server/boards/model"
)

type ServerMetadata struct {
	Version     string `json:"version"`
	BuildNumber string `json:"build_number"`
	BuildDate   string `json:"build_date"`
	Commit      string `json:"commit"`
	Edition     string `json:"edition"`
	DBType      string `json:"db_type"`
	DBVersion   string `json:"db_version"`
	OSType      string `json:"os_type"`
	OSArch      string `json:"os_arch"`
	SKU         string `json:"sku"`
}

func (a *App) GetServerMetadata() *ServerMetadata {
	var dbType string
	var dbVersion string
	if a != nil && a.store != nil {
		dbType = a.store.DBType()
		dbVersion = a.store.DBVersion()
	}

	return &ServerMetadata{
		Version:     model.CurrentVersion,
		BuildNumber: model.BuildNumber,
		BuildDate:   model.BuildDate,
		Commit:      model.BuildHash,
		Edition:     model.Edition,
		DBType:      dbType,
		DBVersion:   dbVersion,
		OSType:      runtime.GOOS,
		OSArch:      runtime.GOARCH,
		SKU:         "personal_server",
	}
}
