package searchengine

import (
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/searchengine/bleveengine"
)

type SearchEngineFactory func(*model.Config, *model.License, *jobs.JobServer) (SearchEngineInterface, error)

type SearchEnginesFactories struct {
	Elasticsearch *SearchEngineFactory
}

var searchEngines SearchEnginesFactories

func init() {
	searchEngines = SearchEnginesFactories{}
}

func RegisterElasticsearchEngine(se *SearchEngineFactory) {
	searchEngines.Elasticsearch = se
}

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

	if searchEngines.Elasticsearch != nil {
		elasticsearchEngine, err := (*searchEngines.Elasticsearch)(cfg, license, jobServer)
		if err != nil {
			return nil, err
		}
		broker.elasticsearchEngine = elasticsearchEngine
	}
	// TODO: Create the null engine
	broker.nullEngine = nil
	return broker, nil
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

func (seb *SearchEngineBroker) GetActiveEngine(cfg *model.Config) SearchEngineInterface {
	if seb.elasticsearchEngine != nil && seb.elasticsearchEngine.IsActive() {
		return seb.elasticsearchEngine
	}
	if seb.bleveEngine != nil && seb.bleveEngine.IsActive() {
		return seb.bleveEngine
	}
	return seb.nullEngine
}
