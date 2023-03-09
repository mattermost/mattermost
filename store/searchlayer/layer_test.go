// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer_test

import (
	"os"
	"sync"
	"testing"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/store/searchlayer"
	"github.com/mattermost/mattermost-server/v6/store/sqlstore"
	"github.com/mattermost/mattermost-server/v6/store/storetest"
	"github.com/mattermost/mattermost-server/v6/testlib"
)

// Test to verify race condition on UpdateConfig. The test must run with -race flag in order to verify
// that there is no race. Ref: (#MM-30868)
func TestUpdateConfigRace(t *testing.T) {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}
	settings := storetest.MakeSqlSettings(driverName, false)
	store := sqlstore.New(*settings, nil, nil)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ClusterSettings.MaxIdleConns = model.NewInt(1)
	searchEngine := searchengine.NewBroker(cfg)
	layer := searchlayer.NewSearchLayer(&testlib.TestStore{Store: store}, searchEngine, cfg)
	var wg sync.WaitGroup

	wg.Add(5)
	for i := 0; i < 5; i++ {
		go func() {
			defer wg.Done()
			layer.UpdateConfig(cfg.Clone())
		}()
	}

	wg.Wait()
}
