package config

import (
	"io"

	"github.com/jmoiron/sqlx"
	"github.com/mattermost/mattermost-server/model"
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

// ResolveConfigFilePath exposes the internal resolveConfigFilePath to test only.
func ResolveConfigFilePath(path string) (string, error) {
	return resolveConfigFilePath(path)
}
