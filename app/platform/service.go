// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
)

// PlatformService is the service for the platform related tasks. It is
// responsible for non-entity related functionalities that are required
// by a product such as database access, configuration access, licensing etc.
type PlatformService struct {
	serviceConfig ServiceConfig
	configStore   *config.Store

	metrics *platformMetrics

	cluster einterfaces.ClusterInterface
}

// New creates a new PlatformService.
func New(sc ServiceConfig) (*PlatformService, error) {
	if err := sc.validate(); err != nil {
		return nil, err
	}

	ps := &PlatformService{
		serviceConfig: sc,
		configStore:   sc.ConfigStore,
		cluster:       sc.Cluster,
	}

	ps.metrics = newPlatformMetrics(sc.Metrics, ps.configStore.Get)

	return ps, nil
}

func (ps *PlatformService) ShutdownMetrics() {
	if ps.metrics != nil {
		ps.metrics.stopMetricsServer()
	}
}
