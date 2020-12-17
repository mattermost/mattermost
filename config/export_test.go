// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v5/model"
)

// MarshalConfig exposes the internal marshalConfig to tests only.
func MarshalConfig(cfg *model.Config) ([]byte, error) {
	return marshalConfig(cfg)
}

// InitializeConfigurationsTable exposes the internal initializeConfigurationsTable to test only.
func InitializeConfigurationsTable(db *sqlx.DB) error {
	return initializeConfigurationsTable(db)
}
