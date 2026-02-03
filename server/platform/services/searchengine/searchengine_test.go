// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine/mocks"
	"github.com/stretchr/testify/assert"
)

func TestActiveEngine(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	b := NewBroker(cfg)

	esMock := &mocks.SearchEngineInterface{}
	esMock.On("IsActive").Return(true)
	esMock.On("GetName").Return("elasticsearch")

	assert.Equal(t, "database", b.ActiveEngine())

	b.ElasticsearchEngine = esMock
	assert.Equal(t, "elasticsearch", b.ActiveEngine())

	b.ElasticsearchEngine = nil
	*b.cfg.SqlSettings.DisableDatabaseSearch = true

	assert.Equal(t, "none", b.ActiveEngine())
}
