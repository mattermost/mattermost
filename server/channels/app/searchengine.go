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

	return nil
}

func (a *App) SetSearchEngine(se *searchengine.Broker) {
	a.ch.srv.platform.SearchEngine = se
}

func (a *App) PurgeElasticsearchIndexes(c request.CTX, indexes []string) *model.AppError {
	engine := a.SearchEngine().ElasticsearchEngine
	if engine == nil {
		err := model.NewAppError("PurgeElasticsearchIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	var appErr *model.AppError
	if len(indexes) > 0 {
		appErr = engine.PurgeIndexList(c, indexes)
	} else {
		appErr = engine.PurgeIndexes(c)
	}

	return appErr
}

func (a *App) PurgeBleveIndexes(c request.CTX) *model.AppError {
	engine := a.SearchEngine().BleveEngine
	if engine == nil {
		err := model.NewAppError("PurgeBleveIndexes", "searchengine.bleve.disabled.error", nil, "", http.StatusNotImplemented)
		return err
	}
	if err := engine.PurgeIndexes(c); err != nil {
		return err
	}
	return nil
}

func (a *App) ActiveSearchBackend() string {
	return a.ch.srv.platform.SearchEngine.ActiveEngine()
}
