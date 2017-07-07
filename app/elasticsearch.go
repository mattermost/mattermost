// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/einterfaces"
	"github.com/mattermost/platform/utils"
)

func TestElasticsearch(cfg *model.Config) *model.AppError {
	if *cfg.ElasticSearchSettings.Password == model.FAKE_SETTING {
		if *cfg.ElasticSearchSettings.ConnectionUrl == *utils.Cfg.ElasticSearchSettings.ConnectionUrl && *cfg.ElasticSearchSettings.Username == *utils.Cfg.ElasticSearchSettings.Username {
			*cfg.ElasticSearchSettings.Password = *utils.Cfg.ElasticSearchSettings.Password
		} else {
			return model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.reenter_password", nil, "", http.StatusBadRequest)
		}
	}

	if esI := einterfaces.GetElasticSearchInterface(); esI != nil {
		if err := esI.TestConfig(cfg); err != nil {
			return err
		}
	} else {
		err := model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	return nil
}
