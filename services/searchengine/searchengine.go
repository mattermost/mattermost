// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"github.com/mattermost/mattermost-server/v5/jobs"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine/nullengine"
)

func NewSearchEngineBroker(cfg *model.Config, jobServer *jobs.JobServer) (*SearchEngineBroker, error) {
	broker := &SearchEngineBroker{
		cfg:       cfg,
		jobServer: jobServer,
	}

	nullEngine, err := nullengine.NewNullEngine()
	if err != nil {
		return nil, err
	}
	broker.NullEngine = nullEngine
	return broker, nil
}

func (seb *SearchEngineBroker) RegisterElasticsearchEngine(es SearchEngineInterface) {
	seb.ElasticsearchEngine = es
}

type SearchEngineBroker struct {
	cfg                 *model.Config
	jobServer           *jobs.JobServer
	ElasticsearchEngine SearchEngineInterface
	NullEngine          SearchEngineInterface
}

func (seb *SearchEngineBroker) UpdateConfig(cfg *model.Config) *model.AppError {
	seb.cfg = cfg
	if seb.ElasticsearchEngine != nil {
		seb.ElasticsearchEngine.UpdateConfig(cfg)
	}

	return nil
}

func (seb *SearchEngineBroker) GetActiveEngines() []SearchEngineInterface {
	engines := []SearchEngineInterface{}
	if seb.ElasticsearchEngine != nil && seb.ElasticsearchEngine.IsActive() {
		engines = append(engines, seb.ElasticsearchEngine)
	}
	return append(engines, seb.NullEngine)
}
