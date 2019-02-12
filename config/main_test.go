package config

import (
	"io"

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
