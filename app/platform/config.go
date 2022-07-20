// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/config"
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
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

func (ps *PlatformService) Config() *model.Config {
	return ps.configStore.Get()
}

func (ps *PlatformService) AddConfigListener(listener func(*model.Config, *model.Config)) string {
	return ps.configStore.AddListener(listener)
}

func (ps *PlatformService) RemoveConfigListener(id string) {
	ps.configStore.RemoveListener(id)
}

func (ps *PlatformService) UpdateConfig(f func(*model.Config)) {
	if ps.configStore.IsReadOnly() {
		return
	}
	old := ps.Config()
	updated := old.Clone()
	f(updated)
	if _, _, err := ps.configStore.Set(updated); err != nil {
		mlog.Error("Failed to update config", mlog.Err(err))
	}
}

func (ps *PlatformService) SaveConfig(newCfg *model.Config, sendConfigChangeClusterMessage bool) (*model.Config, *model.Config, *model.AppError) {
	oldCfg, newCfg, err := ps.configStore.Set(newCfg)
	if errors.Is(err, config.ErrReadOnlyConfiguration) {
		return nil, nil, model.NewAppError("saveConfig", "ent.cluster.save_config.error", nil, err.Error(), http.StatusForbidden)
	} else if err != nil {
		return nil, nil, model.NewAppError("saveConfig", "app.save_config.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if ps.serviceConfig.StartMetrics && *ps.Config().MetricsSettings.Enable {
		if ps.metrics.metricsImpl != nil {
			ps.metrics.metricsImpl.Register()
		}
		ps.metrics = newPlatformMetrics(ps.serviceConfig.Metrics, ps.configStore.Get)
	} else {
		ps.metrics.stopMetricsServer()
	}

	if ps.cluster != nil {
		err := ps.cluster.ConfigChanged(ps.configStore.RemoveEnvironmentOverrides(oldCfg),
			ps.configStore.RemoveEnvironmentOverrides(newCfg), sendConfigChangeClusterMessage)
		if err != nil {
			return nil, nil, err
		}
	}

	return oldCfg, newCfg, nil
}

func (ps *PlatformService) ReloadConfig() error {
	if err := ps.configStore.Load(); err != nil {
		return err
	}
	return nil
}
