// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/utils"
)

func TestElasticsearch(cfg *model.Config) *model.AppError {
	if *cfg.ElasticsearchSettings.Password == model.FAKE_SETTING {
		if *cfg.ElasticsearchSettings.ConnectionUrl == *utils.Cfg.ElasticsearchSettings.ConnectionUrl && *cfg.ElasticsearchSettings.Username == *utils.Cfg.ElasticsearchSettings.Username {
			*cfg.ElasticsearchSettings.Password = *utils.Cfg.ElasticsearchSettings.Password
		} else {
			return model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.reenter_password", nil, "", http.StatusBadRequest)
		}
	}

	if esI := einterfaces.GetElasticsearchInterface(); esI != nil {
		if err := esI.TestConfig(cfg); err != nil {
			return err
		}
	} else {
		err := model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	return nil
}

func PurgeElasticsearchIndexes() *model.AppError {
	if esI := einterfaces.GetElasticsearchInterface(); esI != nil {
		if err := esI.PurgeIndexes(); err != nil {
			return err
		}
	} else {
		err := model.NewAppError("PurgeElasticsearchIndexes", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	return nil
}
