package searchengine

import (
	"github.com/mattermost/mattermost-server/jobs"
	"github.com/mattermost/mattermost-server/mlog"
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

	if *cfg.BleveSettings.EnableIndexing && *cfg.BleveSettings.Filename != "" {
		bleveEngine, err := bleveengine.NewBleveEngine(cfg, license, jobServer)
		if err != nil {
			return nil, err
		}
		broker.BleveEngine = bleveEngine
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
	license             *model.License
	jobServer           *jobs.JobServer
	BleveEngine         SearchEngineInterface
	ElasticsearchEngine SearchEngineInterface
	NullEngine          SearchEngineInterface
}

func (seb *SearchEngineBroker) UpdateConfig(cfg *model.Config) *model.AppError {
	seb.cfg = cfg
	return nil
}

func (seb *SearchEngineBroker) UpdateLicense(license *model.License) *model.AppError {
	if license == nil && seb.ElasticsearchEngine.IsActive() {
		seb.ElasticsearchEngine.Stop()
	}
	if license != nil && !seb.ElasticsearchEngine.IsActive() {
		seb.ElasticsearchEngine.Stop()
	}
	seb.license = license
	return nil
}

func (seb *SearchEngineBroker) GetActiveEngine() SearchEngineInterface {
	if seb.ElasticsearchEngine != nil && seb.ElasticsearchEngine.IsActive() {
		mlog.Warn("Elasticsearch is active")
		return seb.ElasticsearchEngine
	}
	if seb.BleveEngine != nil && seb.BleveEngine.IsActive() {
		mlog.Warn("Bleve is active")
		return seb.BleveEngine
	}
	mlog.Warn("Null is active")
	return seb.NullEngine
}
