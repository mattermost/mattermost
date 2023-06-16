package pluginapi

import (
	"bytes"
	"encoding/json"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/v8/config"
	"github.com/pkg/errors"
)

// ConfigurationService exposes methods to manipulate the server and plugin configuration.
type ConfigurationService struct {
	api plugin.API
}

// LoadPluginConfiguration loads the plugin's configuration. dest should be a pointer to a
// struct to which the configuration JSON can be unmarshalled.
//
// Minimum server version: 5.2
func (c *ConfigurationService) LoadPluginConfiguration(dest interface{}) error {
	// TODO: Isn't this method redundant given GetPluginConfig() and even GetConfig()?
	return c.api.LoadPluginConfiguration(dest)
}

// GetConfig fetches the currently persisted config.
//
// Minimum server version: 5.2
func (c *ConfigurationService) GetConfig() *model.Config {
	return c.api.GetConfig()
}

// GetUnsanitizedConfig fetches the currently persisted config without removing secrets.
//
// Minimum server version: 5.16
func (c *ConfigurationService) GetUnsanitizedConfig() *model.Config {
	return c.api.GetUnsanitizedConfig()
}

// SaveConfig sets the given config and persists the changes
//
// Minimum server version: 5.2
func (c *ConfigurationService) SaveConfig(cfg *model.Config) error {
	return normalizeAppErr(c.api.SaveConfig(cfg))
}

// GetPluginConfig fetches the currently persisted config of plugin
//
// Minimum server version: 5.6
func (c *ConfigurationService) GetPluginConfig() map[string]interface{} {
	return c.api.GetPluginConfig()
}

// SavePluginConfig sets the given config for plugin and persists the changes
//
// Minimum server version: 5.6
func (c *ConfigurationService) SavePluginConfig(cfg map[string]interface{}) error {
	return normalizeAppErr(c.api.SavePluginConfig(cfg))
}

// CheckRequiredServerConfiguration checks if the server is configured according to
// plugin requirements.
//
// Minimum server version: 5.2
func (c *ConfigurationService) CheckRequiredServerConfiguration(req *model.Config) (bool, error) {
	if req == nil {
		return true, nil
	}

	cfg := c.api.GetConfig()

	mergedCfg, err := config.Merge(cfg, req, nil)
	if err != nil {
		return false, errors.Wrap(err, "could not merge configurations")
	}

	mergedCfgJSON, err := json.Marshal(mergedCfg)
	if err != nil {
		return false, errors.Wrap(err, "failed to marshal merged config")
	}

	cjfJSON, err := json.Marshal(cfg)
	if err != nil {
		return false, errors.Wrap(err, "failed to marshal config")
	}

	if !bytes.Equal(mergedCfgJSON, cjfJSON) {
		return false, nil
	}

	return true, nil
}
