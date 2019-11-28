// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"io"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/v5/model"
)

// MarshalConfig exposes the internal marshalConfig to tests only.
func MarshalConfig(cfg *model.Config) ([]byte, error) {
	return marshalConfig(cfg)
}

// UnmarshalConfig exposes the internal unmarshalConfig to tests only.
func UnmarshalConfig(r io.Reader, allowEnvironmentOverrides bool) (*model.Config, map[string]interface{}, error) {
	return unmarshalConfig(r, allowEnvironmentOverrides)
}

// InitializeConfigurationsTable exposes the internal initializeConfigurationsTable to test only.
func InitializeConfigurationsTable(db *sqlx.DB) error {
	return initializeConfigurationsTable(db)
}
