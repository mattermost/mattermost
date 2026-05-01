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
	newBroker := func(disableDatabaseSearch bool) *Broker {
		cfg := &model.Config{}
		cfg.SetDefaults()
		cfg.SqlSettings.DisableDatabaseSearch = model.NewPointer(disableDatabaseSearch)

		return NewBroker(cfg)
	}

	getESEngine := func(isActive bool, isHealthy bool) SearchEngineInterface {
		esMock := &mocks.SearchEngineInterface{}
		esMock.On("IsActive").Return(isActive)
		esMock.On("IsHealthy").Return(isHealthy)
		esMock.On("GetName").Return("elasticsearch")

		return esMock
	}

	t.Run("default to database", func(t *testing.T) {
		b := newBroker(false)
		assert.Equal(t, "database", b.ActiveEngine())
	})

	t.Run("no active engine when DisableDatabaseSearch", func(t *testing.T) {
		// Disable database search
		b := newBroker(true)

		assert.Equal(t, "none", b.ActiveEngine())
	})

	t.Run("switches to elasticsearch when active and healthy", func(t *testing.T) {
		b := newBroker(false)

		// Use an active, healthy ES engine
		b.ElasticsearchEngine = getESEngine(true, true)
		assert.Equal(t, "elasticsearch", b.ActiveEngine())
	})

	t.Run("active engines", func(t *testing.T) {
		for _, isActive := range []bool{true, false} {
			for _, isHealthy := range []bool{true, false} {
				t.Run("(in)active/(un)healthy engines", func(t *testing.T) {
					b := newBroker(false)
					b.ElasticsearchEngine = getESEngine(isActive, isHealthy)

					engines := b.GetActiveEngines()

					// Default to database, since DisableDatabaseSearch is false
					if isActive && isHealthy {
						assert.Equal(t, "elasticsearch", b.ActiveEngine())
						assert.Equal(t, []SearchEngineInterface{b.ElasticsearchEngine}, engines, "active healthy engine should appear in active engines")
					} else {
						assert.Equal(t, "database", b.ActiveEngine())
						assert.Empty(t, engines, "inactive or unhealthy engines should not appear in active engines")
					}
				})
			}
		}
	})
}
