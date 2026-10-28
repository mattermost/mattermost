// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

func (a *App) TestElasticsearch(rctx request.CTX, cfg *model.Config) *model.AppError {
	if *cfg.ElasticsearchSettings.Password == model.FakeSetting {
		if *cfg.ElasticsearchSettings.ConnectionURL == *a.Config().ElasticsearchSettings.ConnectionURL && *cfg.ElasticsearchSettings.Username == *a.Config().ElasticsearchSettings.Username {
			*cfg.ElasticsearchSettings.Password = *a.Config().ElasticsearchSettings.Password
		} else {
			return model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.reenter_password", nil, "", http.StatusBadRequest)
		}
	}

	seI := a.SearchEngine().ElasticsearchEngine
	if seI == nil {
		err := model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}
	if err := seI.TestConfig(rctx, cfg); err != nil {
		return err
	}

	// TestConfig doesn't start the engine. If it isn't running, let the
	// watcher retry Start() now rather than after its backoff. The watcher
	// starts the engine with the saved config, so only wake it when the test
	// used the same connection settings; waking it also resets its backoff.
	if !seI.IsActive() && sameSearchEngineConnection(cfg.ElasticsearchSettings, a.Config().ElasticsearchSettings) {
		a.Srv().Platform().ReevaluateSearchEngine()
	}

	return nil
}

// sameSearchEngineConnection reports whether a and b connect to the same
// cluster in the same way.
func sameSearchEngineConnection(a, b model.ElasticsearchSettings) bool {
	return model.SafeDereference(a.Backend) == model.SafeDereference(b.Backend) &&
		model.SafeDereference(a.ConnectionURL) == model.SafeDereference(b.ConnectionURL) &&
		model.SafeDereference(a.Username) == model.SafeDereference(b.Username) &&
		model.SafeDereference(a.Password) == model.SafeDereference(b.Password) &&
		model.SafeDereference(a.Sniff) == model.SafeDereference(b.Sniff) &&
		model.SafeDereference(a.SkipTLSVerification) == model.SafeDereference(b.SkipTLSVerification) &&
		model.SafeDereference(a.CA) == model.SafeDereference(b.CA) &&
		model.SafeDereference(a.ClientCert) == model.SafeDereference(b.ClientCert) &&
		model.SafeDereference(a.ClientKey) == model.SafeDereference(b.ClientKey)
}

func (a *App) SetSearchEngine(se *searchengine.Broker) {
	a.ch.srv.platform.SearchEngine = se
}

func (a *App) PurgeElasticsearchIndexes(rctx request.CTX, indexes []string) *model.AppError {
	engine := a.SearchEngine().ElasticsearchEngine
	if engine == nil {
		err := model.NewAppError("PurgeElasticsearchIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	var appErr *model.AppError
	if len(indexes) > 0 {
		appErr = engine.PurgeIndexList(rctx, indexes)
	} else {
		appErr = engine.PurgeIndexes(rctx)
	}

	return appErr
}

func (a *App) ActiveSearchBackend() string {
	return a.ch.srv.platform.SearchEngine.ActiveEngine()
}
