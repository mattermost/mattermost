// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/einterfaces"
)

func TestElasticsearch() *model.AppError {
	if esI := einterfaces.GetElasticSearchInterface(); esI != nil {
		if err := esI.TestConfig(); err != nil {
			return err
		}
	} else {
		err := model.NewAppError("TestElasticsearch", "ent.elasticsearch.test_config.license.error", nil, "", http.StatusNotImplemented)
		return err
	}

	return nil
}
