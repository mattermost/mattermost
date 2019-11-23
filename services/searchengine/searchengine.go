package searchengine

import (
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/searchengine/bleveengine"
	"github.com/mattermost/mattermost-server/services/searchengine/nullengine"
)

func NewSearchEngineBroker(cfg *model.Config, license *model.License, jobServer *jobs.JobServer) (*SearchEngineBroker, error) {
	broker := &SearchEngineBroker{
		cfg:       cfg,
		license:   license,
		jobServer: jobServer,
	}

	bleveEngine, err := bleveengine.NewBleveEngine(cfg, license, jobServer)
	if err != nil {
		return nil, err
	}
	broker.bleveEngine = bleveEngine

	nullEngine, err := nullengine.NewNullEngine()
	if err != nil {
		return nil, err
	}
	broker.nullEngine = nullEngine
	return broker, nil
}

func (seb *SearchEngineBroker) RegisterElasticsearchEngine(es SearchEngineInterface) {
	seb.elasticsearchEngine = es
}

type SearchEngineBroker struct {
	cfg                 *model.Config
	license             *model.License
	jobServer           *jobs.JobServer
	bleveEngine         SearchEngineInterface
	elasticsearchEngine SearchEngineInterface
	nullEngine          SearchEngineInterface
}

func (seb *SearchEngineBroker) UpdateConfig(cfg *model.Config) *model.AppError {
	seb.cfg = cfg
	return nil
}

func (seb *SearchEngineBroker) UpdateLicense(license *model.License) *model.AppError {
	if license == nil && seb.elasticsearchEngine.IsActive() {
		seb.elasticsearchEngine.Stop()
	}
	if license != nil && !seb.elasticsearchEngine.IsActive() {
		seb.elasticsearchEngine.Stop()
	}
	seb.license = license
	return nil
}

func (seb *SearchEngineBroker) GetActiveEngine() SearchEngineInterface {
	if seb.elasticsearchEngine != nil && seb.elasticsearchEngine.IsActive() {
		return seb.elasticsearchEngine
	}
	if seb.bleveEngine != nil && seb.bleveEngine.IsActive() {
		return seb.bleveEngine
	}
	return seb.nullEngine
}
