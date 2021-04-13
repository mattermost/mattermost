// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"hash/maphash"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
)

func TestServePluginPublicRequest(t *testing.T) {
	t.Run("returns not found when plugins environment is nil", func(t *testing.T) {
		cfg := model.Config{}
		cfg.SetDefaults()
		configStore := config.NewTestMemoryStore()
		configStore.Set(&cfg)

		srv := &Server{
			goroutineExitSignal: make(chan struct{}, 1),
			RootRouter:          mux.NewRouter(),
			LocalRouter:         mux.NewRouter(),
			licenseListeners:    map[string]func(*model.License, *model.License){},
			hashSeed:            maphash.MakeSeed(),
			uploadLockMap:       map[string]bool{},
			configStore:         configStore,
		}
		app := New(ServerConnector(srv))
		app.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = true })

		req, err := http.NewRequest("GET", "/plugins", nil)
		require.NoError(t, err)

		rr := httptest.NewRecorder()
		handler := http.HandlerFunc(app.ServePluginPublicRequest)
		handler.ServeHTTP(rr, req)

		assert.Equal(t, http.StatusNotFound, rr.Code)
	})
}
