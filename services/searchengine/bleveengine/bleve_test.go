// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"io/ioutil"
	"os"
	"testing"

	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store/searchlayer"
	"github.com/mattermost/mattermost-server/v5/store/searchtest"
	"github.com/mattermost/mattermost-server/v5/store/sqlstore"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/testlib"
)

type BleveEngineTestSuite struct {
	suite.Suite

	SQLSettings  *model.SqlSettings
	SQLSupplier  *sqlstore.SqlSupplier
	SearchEngine *searchengine.Broker
	Store        *searchlayer.SearchStore
	IndexDir     string
}

func TestBleveEngineTestSuite(t *testing.T) {
	suite.Run(t, new(BleveEngineTestSuite))
}

func (s *BleveEngineTestSuite) setupIndexes() {
	indexDir, err := ioutil.TempDir("", "mmbleve")
	if err != nil {
		s.Require().FailNow("Cannot setup bleveengine tests: %s", err.Error())
	}
	s.IndexDir = indexDir
}

func (s *BleveEngineTestSuite) setupStore() {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DATABASE_DRIVER_POSTGRES
	}
	s.SQLSettings = storetest.MakeSqlSettings(driverName)
	s.SQLSupplier = sqlstore.NewSqlSupplier(*s.SQLSettings, nil)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.BleveSettings.EnableIndexing = model.NewBool(true)
	cfg.BleveSettings.EnableSearching = model.NewBool(true)
	cfg.BleveSettings.EnableAutocomplete = model.NewBool(true)
	cfg.BleveSettings.IndexDir = model.NewString(s.IndexDir)
	cfg.SqlSettings.DisableDatabaseSearch = model.NewBool(true)

	s.SearchEngine = searchengine.NewBroker(cfg, nil)
	s.Store = searchlayer.NewSearchLayer(&testlib.TestStore{Store: s.SQLSupplier}, s.SearchEngine, cfg)

	bleveEngine := NewBleveEngine(cfg, nil)
	bleveEngine.indexSync = true
	s.SearchEngine.RegisterBleveEngine(bleveEngine)
	if err := bleveEngine.Start(); err != nil {
		s.Require().FailNow("Cannot start bleveengine: %s", err.Error())
	}
}

func (s *BleveEngineTestSuite) SetupSuite() {
	s.setupIndexes()
	s.setupStore()
}

func (s *BleveEngineTestSuite) TearDownSuite() {
	os.RemoveAll(s.IndexDir)
	s.SQLSupplier.Close()
	storetest.CleanupSqlSettings(s.SQLSettings)
}

func (s *BleveEngineTestSuite) TestBleveSearchStoreTests() {
	searchTestEngine := &searchtest.SearchTestEngine{
		Driver: searchtest.ENGINE_BLEVE,
	}

	s.Run("TestSearchChannelStore", func() {
		searchtest.TestSearchChannelStore(s.T(), s.Store, searchTestEngine)
	})

	s.Run("TestSearchUserStore", func() {
		searchtest.TestSearchUserStore(s.T(), s.Store, searchTestEngine)
	})

	s.Run("TestSearchPostStore", func() {
		searchtest.TestSearchPostStore(s.T(), s.Store, searchTestEngine)
	})
}
