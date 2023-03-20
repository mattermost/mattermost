// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/playbooks"
)

// const npsPluginID = "com.mattermost.nps"

// ServiceImpl holds access to the plugin's Configuration.
type ServiceImpl struct {
	api playbooks.ServicesAPI

	// configChangeListeners will be notified when the OnConfigurationChange event has been called.
	configChangeListeners map[string]func()
}

// NewConfigService Creates a new ServiceImpl struct.
func NewConfigService(api playbooks.ServicesAPI) *ServiceImpl {
	c := &ServiceImpl{}
	c.api = api
	c.configChangeListeners = make(map[string]func())

	return c
}

// RegisterConfigChangeListener registers a function that will called when the config might have
// been changed. Returns an id which can be used to unregister the listener.
func (c *ServiceImpl) RegisterConfigChangeListener(listener func()) string {
	if c.configChangeListeners == nil {
		c.configChangeListeners = make(map[string]func())
	}

	id := model.NewId()
	c.configChangeListeners[id] = listener
	return id
}

// UnregisterConfigChangeListener unregisters the listener function identified by id.
func (c *ServiceImpl) UnregisterConfigChangeListener(id string) {
	delete(c.configChangeListeners, id)
}

// OnConfigurationChange is invoked when configuration changes may have been made.
// This method satisfies the interface expected by the server. Embed config.Config in the plugin.
func (c *ServiceImpl) OnConfigurationChange() error {
	// Have we been setup by OnActivate?
	if c.api == nil {
		return nil
	}

	for _, f := range c.configChangeListeners {
		f()
	}

	return nil
}

// IsConfiguredForDevelopmentAndTesting returns true when the server has `EnableDeveloper` and
// `EnableTesting` configuration settings enabled.
func (c *ServiceImpl) IsConfiguredForDevelopmentAndTesting() bool {
	config := c.api.GetConfig()

	return config != nil &&
		config.ServiceSettings.EnableTesting != nil &&
		*config.ServiceSettings.EnableTesting &&
		config.ServiceSettings.EnableDeveloper != nil &&
		*config.ServiceSettings.EnableDeveloper
}

// IsCloud returns true when the server is on cloud, and false otherwise
func (c *ServiceImpl) IsCloud() bool {
	license := c.api.GetLicense()
	if license == nil || license.Features == nil || license.Features.Cloud == nil {
		return false
	}

	return *license.Features.Cloud
}

// SupportsGivingFeedback returns nil when the nps plugin is installed and enabled, thus enabling giving feedback.
func (c *ServiceImpl) SupportsGivingFeedback() error {
	//TODO: Do we need this functions?
	// pluginState := c.pluginAPIAdapter.GetConfig().PluginSettings.PluginStates[npsPluginID]

	// if pluginState == nil || !pluginState.Enable {
	// 	return errors.New("nps plugin not enabled")
	// }

	// pluginStatus, err := c.api.Plugin.GetPluginStatus(npsPluginID)
	// if err != nil {
	// 	return fmt.Errorf("failed to query nps plugin status: %w", err)
	// }

	// if pluginStatus == nil {
	// 	return errors.New("nps plugin not running")
	// }

	return errors.New("can't get nps plugin status")
}
