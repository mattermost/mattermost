// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package bleveengine

import (
	"os"
	"testing"

	"github.com/blevesearch/bleve/v2"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchlayer"
	"github.com/mattermost/mattermost/server/v8/channels/store/searchtest"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type BleveEngineTestSuite struct {
	suite.Suite

	SQLSettings  *model.SqlSettings
	SQLStore     *sqlstore.SqlStore
	SearchEngine *searchengine.Broker
	Store        *searchlayer.SearchStore
	BleveEngine  *BleveEngine
	IndexDir     string
	Context      request.CTX
}

func TestBleveEngineTestSuite(t *testing.T) {
	suite.Run(t, &BleveEngineTestSuite{
		Context: request.TestContext(t),
	})
}

func (s *BleveEngineTestSuite) setupIndexes() {
	indexDir, err := os.MkdirTemp("", "mmbleve")
	if err != nil {
		s.Require().FailNow("Cannot setup bleveengine tests: %s", err.Error())
	}
	s.IndexDir = indexDir
}

func (s *BleveEngineTestSuite) setupStore() {
	driverName := os.Getenv("MM_SQLSETTINGS_DRIVERNAME")
	if driverName == "" {
		driverName = model.DatabaseDriverPostgres
	}
	s.SQLSettings = storetest.MakeSqlSettings(driverName, false)

	var err error
	s.SQLStore, err = sqlstore.New(*s.SQLSettings, s.Context.Logger(), nil)
	if err != nil {
		s.Require().FailNow("Cannot initialize store: %s", err.Error())
	}

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.BleveSettings.EnableIndexing = model.NewPointer(true)
	cfg.BleveSettings.EnableSearching = model.NewPointer(true)
	cfg.BleveSettings.EnableAutocomplete = model.NewPointer(true)
	cfg.BleveSettings.IndexDir = model.NewPointer(s.IndexDir)
	cfg.SqlSettings.DisableDatabaseSearch = model.NewPointer(true)

	s.SearchEngine = searchengine.NewBroker(cfg)
	s.Store = searchlayer.NewSearchLayer(&testlib.TestStore{Store: s.SQLStore}, s.SearchEngine, cfg)

	s.BleveEngine = NewBleveEngine(cfg)
	s.BleveEngine.indexSync = true
	s.SearchEngine.RegisterBleveEngine(s.BleveEngine)
	if err := s.BleveEngine.Start(); err != nil {
		s.Require().FailNow("Cannot start bleveengine: %s", err.Error())
	}
}

func (s *BleveEngineTestSuite) SetupSuite() {
	s.setupIndexes()
	s.setupStore()
}

func (s *BleveEngineTestSuite) TearDownSuite() {
	os.RemoveAll(s.IndexDir)
	s.SQLStore.Close()
	storetest.CleanupSqlSettings(s.SQLSettings)
}

func (s *BleveEngineTestSuite) TestBleveSearchStoreTests() {
	searchTestEngine := &searchtest.SearchTestEngine{
		Driver: searchtest.EngineBleve,
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

	s.Run("TestSearchFileInfoStore", func() {
		searchtest.TestSearchFileInfoStore(s.T(), s.Store, searchTestEngine)
	})
}

func (s *BleveEngineTestSuite) TestDeleteChannelPosts() {
	s.Run("Should remove all the posts that belongs to a channel", func() {
		s.BleveEngine.PurgeIndexes(s.Context)
		teamID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()
		channelToAvoidID := model.NewId()
		for i := 0; i < 10; i++ {
			post := createPost(userID, channelID)
			appErr := s.SearchEngine.BleveEngine.IndexPost(post, teamID)
			require.Nil(s.T(), appErr)
		}
		postToAvoid := createPost(userID, channelToAvoidID)
		appErr := s.SearchEngine.BleveEngine.IndexPost(postToAvoid, teamID)
		require.Nil(s.T(), appErr)

		s.SearchEngine.BleveEngine.DeleteChannelPosts(s.Context, channelID)

		doc, err := s.BleveEngine.PostIndex.Document(postToAvoid.Id)
		require.NoError(s.T(), err)
		require.Equal(s.T(), postToAvoid.Id, doc.ID())
		numberDocs, err := s.BleveEngine.PostIndex.DocCount()
		require.NoError(s.T(), err)
		require.Equal(s.T(), 1, int(numberDocs))
	})

	s.Run("Shouldn't do anything if there is not posts for the selected channel", func() {
		s.BleveEngine.PurgeIndexes(s.Context)
		teamID := model.NewId()
		userID := model.NewId()
		channelID := model.NewId()
		channelToDeleteID := model.NewId()
		post := createPost(userID, channelID)
		appErr := s.SearchEngine.BleveEngine.IndexPost(post, teamID)
		require.Nil(s.T(), appErr)

		s.SearchEngine.BleveEngine.DeleteChannelPosts(s.Context, channelToDeleteID)

		_, err := s.BleveEngine.PostIndex.Document(post.Id)
		require.NoError(s.T(), err)
		numberDocs, err := s.BleveEngine.PostIndex.DocCount()
		require.NoError(s.T(), err)
		require.Equal(s.T(), 1, int(numberDocs))
	})
}

func (s *BleveEngineTestSuite) TestDeleteUserPosts() {
	s.Run("Should remove all the posts that belongs to a user", func() {
		s.BleveEngine.PurgeIndexes(s.Context)
		teamID := model.NewId()
		userID := model.NewId()
		userToAvoidID := model.NewId()
		channelID := model.NewId()
		for i := 0; i < 10; i++ {
			post := createPost(userID, channelID)
			appErr := s.SearchEngine.BleveEngine.IndexPost(post, teamID)
			require.Nil(s.T(), appErr)
		}
		postToAvoid := createPost(userToAvoidID, channelID)
		appErr := s.SearchEngine.BleveEngine.IndexPost(postToAvoid, teamID)
		require.Nil(s.T(), appErr)

		s.SearchEngine.BleveEngine.DeleteUserPosts(s.Context, userID)

		doc, err := s.BleveEngine.PostIndex.Document(postToAvoid.Id)
		require.NoError(s.T(), err)
		require.Equal(s.T(), postToAvoid.Id, doc.ID())
		numberDocs, err := s.BleveEngine.PostIndex.DocCount()
		require.NoError(s.T(), err)
		require.Equal(s.T(), 1, int(numberDocs))
	})

	s.Run("Shouldn't do anything if there is not posts for the selected user", func() {
		s.BleveEngine.PurgeIndexes(s.Context)
		teamID := model.NewId()
		userID := model.NewId()
		userToDeleteID := model.NewId()
		channelID := model.NewId()
		post := createPost(userID, channelID)
		appErr := s.SearchEngine.BleveEngine.IndexPost(post, teamID)
		require.Nil(s.T(), appErr)

		s.SearchEngine.BleveEngine.DeleteUserPosts(s.Context, userToDeleteID)

		_, err := s.BleveEngine.PostIndex.Document(post.Id)
		require.NoError(s.T(), err)
		numberDocs, err := s.BleveEngine.PostIndex.DocCount()
		require.NoError(s.T(), err)
		require.Equal(s.T(), 1, int(numberDocs))
	})
}

func (s *BleveEngineTestSuite) TestDeletePosts() {
	s.BleveEngine.PurgeIndexes(s.Context)
	teamID := model.NewId()
	userID := model.NewId()
	userToAvoidID := model.NewId()
	channelID := model.NewId()
	for i := 0; i < 10; i++ {
		post := createPost(userID, channelID)
		appErr := s.SearchEngine.BleveEngine.IndexPost(post, teamID)
		require.Nil(s.T(), appErr)
	}
	postToAvoid := createPost(userToAvoidID, channelID)
	appErr := s.SearchEngine.BleveEngine.IndexPost(postToAvoid, teamID)
	require.Nil(s.T(), appErr)

	query := bleve.NewTermQuery(userID)
	query.SetField("UserId")
	search := bleve.NewSearchRequest(query)
	count, err := s.BleveEngine.deletePosts(search, 1)
	require.NoError(s.T(), err)
	require.Equal(s.T(), 10, int(count))

	doc, err := s.BleveEngine.PostIndex.Document(postToAvoid.Id)
	require.NoError(s.T(), err)
	require.Equal(s.T(), postToAvoid.Id, doc.ID())
	numberDocs, err := s.BleveEngine.PostIndex.DocCount()
	require.NoError(s.T(), err)
	require.Equal(s.T(), 1, int(numberDocs))
}
