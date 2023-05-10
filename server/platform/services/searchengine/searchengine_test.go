// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchengine

import (
	"testing"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/searchengine/mocks"
	"github.com/stretchr/testify/assert"
)

func TestActiveEngine(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()

	b := NewBroker(cfg)

	esMock := &mocks.SearchEngineInterface{}
	esMock.On("IsActive").Return(true)
	esMock.On("GetName").Return("elasticsearch")

	bleveMock := &mocks.SearchEngineInterface{}
	bleveMock.On("IsActive").Return(true)
	bleveMock.On("IsIndexingEnabled").Return(true)
	bleveMock.On("GetName").Return("bleve")

	assert.Equal(t, "database", b.ActiveEngine())

	b.ElasticsearchEngine = esMock
	assert.Equal(t, "elasticsearch", b.ActiveEngine())

	b.ElasticsearchEngine = nil
	b.BleveEngine = bleveMock
	assert.Equal(t, "bleve", b.ActiveEngine())

	b.BleveEngine = nil
	*b.cfg.SqlSettings.DisableDatabaseSearch = true

	assert.Equal(t, "none", b.ActiveEngine())
}
