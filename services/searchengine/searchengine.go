// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/mattermost/mattermost-server/v5/services/searchengine/bleveengine"
)

func NewBroker(cfg *model.Config, jobServer *jobs.JobServer) (*Broker, error) {
	broker := &Broker{
		cfg:       cfg,
		jobServer: jobServer,
	}

	if *cfg.BleveSettings.EnableIndexing && *cfg.BleveSettings.IndexDir != "" {
		bleveEngine, err := bleveengine.NewBleveEngine(cfg, jobServer)
		if err != nil {
			return nil, err
		}
		broker.BleveEngine = bleveEngine
	}

	return broker, nil
}

func (seb *Broker) RegisterElasticsearchEngine(es SearchEngineInterface) {
	seb.ElasticsearchEngine = es
}

type Broker struct {
	cfg                 *model.Config
	jobServer           *jobs.JobServer
	ElasticsearchEngine SearchEngineInterface
	BleveEngine         SearchEngineInterface
}

func (seb *Broker) UpdateConfig(cfg *model.Config) *model.AppError {
	seb.cfg = cfg
	if seb.ElasticsearchEngine != nil {
		seb.ElasticsearchEngine.UpdateConfig(cfg)
	}

	if seb.BleveEngine == nil && *cfg.BleveSettings.EnableIndexing && *cfg.BleveSettings.IndexDir != "" {
		bleveEngine, err := bleveengine.NewBleveEngine(cfg, seb.jobServer)
		if err != nil {
			// ToDo: should this log an eror if the newbroker doesn't?
			// ToDo: how is the NewBroker initialising error handled?
			mlog.Error("Error initializing Bleve Search Engine as a result of a config update", mlog.Err(err))
		}
		seb.BleveEngine = bleveEngine
	}

	if seb.BleveEngine != nil {
		seb.BleveEngine.UpdateConfig(cfg)
	}

	return nil
}

func (seb *Broker) GetActiveEngines() []SearchEngineInterface {
	engines := []SearchEngineInterface{}
	if seb.ElasticsearchEngine != nil && seb.ElasticsearchEngine.IsActive() {
		engines = append(engines, seb.ElasticsearchEngine)
	}
	if seb.BleveEngine != nil && seb.BleveEngine.IsActive() {
		engines = append(engines, seb.BleveEngine)
	}
	return engines
}
