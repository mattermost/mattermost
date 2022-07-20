// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
)

// ServiceConfig is used to initialize the PlatformService.
// The mandatory fields will be checked during the initialization of the service.
type ServiceConfig struct {
	// Mandatory fields
	ConfigStore  *config.Store
	StartMetrics bool // TODO: find an elegant way to start/stop metrics server by default
	// Optional fields
	Metrics einterfaces.MetricsInterface
	Cluster einterfaces.ClusterInterface
}

func (c *ServiceConfig) validate() error {
	// Mandatory fields need to be checked here
	if c.ConfigStore == nil {
		return errors.New("ConfigStore is required")
	}
	return nil
}
