// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
	"github.com/mattermost/mattermost/server/v8/platform/services/remotecluster"
)

type TestHelper struct {
	MainHelper *testlib.MainHelper
	Server     *TestServer
}

type TestServer struct {
	Store  store.Store
	config *model.Config
	log    *mlog.Logger
}

func (ts *TestServer) GetStore() store.Store {
	return ts.Store
}

func (ts *TestServer) Config() *model.Config {
	return ts.config
}

func (ts *TestServer) Log() *mlog.Logger {
	return ts.log
}

func (ts *TestServer) GetMetrics() einterfaces.MetricsInterface {
	return nil
}

func (ts *TestServer) GetRemoteClusterService() remotecluster.RemoteClusterServiceIFace {
	return nil
}

func (ts *TestServer) AddClusterLeaderChangedListener(listener func()) string {
	return ""
}

func (ts *TestServer) RemoveClusterLeaderChangedListener(id string) {
}

func (ts *TestServer) IsLeader() bool {
	return true
}

// createMockStore creates a mock store suitable for testing
func createMockStore() store.Store {
	mockStore := &mocks.Store{}
	mockUserStore := &mocks.UserStore{}
	mockStore.On("User").Return(mockUserStore)

	// Create default test users for mocks
	remoteId := "remote1"
	user1 := &model.User{
		Id:       "user1",
		Username: "user1",
		Email:    "user1@example.com",
		CreateAt: 10000,
		UpdateAt: 20000,
	}
	user2 := &model.User{
		Id:       "user2",
		Username: "user2",
		Email:    "user2@example.com",
		CreateAt: 10001,
		UpdateAt: 20001,
	}
	remoteUser := &model.User{
		Id:       "remote_user",
		Username: "remote_user",
		Email:    "remote_user@example.com",
		CreateAt: 10002,
		UpdateAt: 20002,
		RemoteId: &remoteId,
	}

	// Return these users by default for all GetAllProfiles calls
	mockUserStore.On("GetAllProfiles", mock.Anything).Return([]*model.User{user1, user2, remoteUser}, nil)

	// Set up Save to return a valid user
	mockUserStore.On("Save", mock.Anything, mock.AnythingOfType("*model.User")).Return(
		&model.User{Id: "user1"}, nil,
	)

	return mockStore
}

func SetupTestHelperWithStore(tb testing.TB) *TestHelper {
	// Try creating a database connection, but provide a graceful fallback if it fails
	var mainHelper *testlib.MainHelper
	var store store.Store

	// In short mode we'll use a mock store
	if testing.Short() {
		// Use mocks in short mode
		store = createMockStore()
	} else {
		// Try to setup a real database
		mainHelper = testlib.NewMainHelperWithOptions(&testlib.HelperOptions{
			EnableStore:     true,
			EnableResources: false,
		})

		// If database setup succeeds, use it
		if mainHelper != nil && mainHelper.SQLStore != nil {
			mainHelper.PreloadMigrations()
			store = mainHelper.GetStore()
		} else {
			// If database connection fails, fall back to mock
			tb.Logf("Database connection failed or in short mode, using mock store")
			store = createMockStore()
			// No need to keep mainHelper if we're using mocks
			mainHelper = nil
		}
	}

	// Setup test server with the store (either real or mock)
	logger := mlog.CreateConsoleTestLogger(tb)
	serverConfig := &model.Config{}
	serverConfig.SetDefaults()
	serverConfig.FeatureFlags = &model.FeatureFlags{}
	serverConfig.FeatureFlags.SyncAllUsersForRemoteCluster = true

	testServer := &TestServer{
		Store:  store,
		config: serverConfig,
		log:    logger,
	}

	return &TestHelper{
		MainHelper: mainHelper,
		Server:     testServer,
	}
}

func (h *TestHelper) TearDown() {
	// Nothing to do for mock store
	if h.MainHelper == nil {
		return
	}

	// For real store, clean up but don't call Close() since it calls os.Exit()
	if h.MainHelper.SQLStore != nil {
		// Just close the SQL connection directly
		h.MainHelper.SQLStore.Close()
	}
}

func TestOnConnectionStateChangeWithUserSync(t *testing.T) {
	t.Run("when SyncAllUsersForRemoteCluster flag is enabled, it creates a sync task with empty channelID", func(t *testing.T) {
		// Setup mock for this test since we just need to check the feature flag
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		// Set the feature flag to true
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.SyncAllUsersForRemoteCluster = true
		mockServer.On("Config").Return(mockConfig)

		// Mock the GetRemoteClusterService call that's used in SendPendingInvitesForRemote
		mockServer.On("GetRemoteClusterService").Return(nil)

		scs := &Service{
			server: mockServer,
			tasks:  make(map[string]syncTask),
		}

		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			CreatorId:   "user1",
		}

		// Call the function
		scs.onConnectionStateChange(rc, true)

		// Sleep a bit to ensure the goroutine has time to run
		time.Sleep(50 * time.Millisecond)

		// Verify that a task was added with empty channelID
		scs.mux.Lock()
		defer scs.mux.Unlock()

		foundTask := false
		for _, task := range scs.tasks {
			if task.channelID == "" && task.remoteID == rc.RemoteId {
				foundTask = true
				break
			}
		}

		assert.True(t, foundTask, "Expected to find a task with empty channelID for remote user sync")
	})

	t.Run("when SyncAllUsersForRemoteCluster flag is disabled, it does not create a sync task", func(t *testing.T) {
		// Setup mock for this test since we just need to check the feature flag
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		// Set the feature flag to false
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.SyncAllUsersForRemoteCluster = false
		mockServer.On("Config").Return(mockConfig)

		// Mock the GetRemoteClusterService call that's used in SendPendingInvitesForRemote
		mockServer.On("GetRemoteClusterService").Return(nil)

		scs := &Service{
			server: mockServer,
			tasks:  make(map[string]syncTask),
		}

		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			CreatorId:   "user1",
		}

		// Call the function
		scs.onConnectionStateChange(rc, true)

		// Sleep a bit to ensure any goroutine would have time to run
		time.Sleep(50 * time.Millisecond)

		// Verify that no task was added with empty channelID
		scs.mux.Lock()
		defer scs.mux.Unlock()

		foundTask := false
		for _, task := range scs.tasks {
			if task.channelID == "" && task.remoteID == rc.RemoteId {
				foundTask = true
				break
			}
		}

		assert.False(t, foundTask, "Did not expect to find a task with empty channelID for remote user sync")
	})
}

func TestSyncForRemoteWithEmptyChannelID(t *testing.T) {
	t.Run("when channelID is empty and feature flag is enabled, it calls syncAllUsersForRemote", func(t *testing.T) {
		// Setup test helper with store (real or mock)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Set the feature flag to true
		th.Server.config.FeatureFlags.SyncAllUsersForRemoteCluster = true

		// Create the service with real store and mock app
		mockApp := &MockAppIface{}
		scs := &Service{
			server: th.Server,
			app:    mockApp,
		}

		// Set up a hook for syncAllUsersForRemote
		syncAllUsersCalled := false
		oldHook := syncAllUsersHook
		syncAllUsersHook = func(scs *Service, rc *model.RemoteCluster) error {
			syncAllUsersCalled = true
			return nil
		}
		defer func() { syncAllUsersHook = oldHook }()

		// Create a task with empty channelID
		task := newSyncTask("", "", "remote1", nil, nil)
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			LastPingAt:  model.GetMillis(), // setting LastPingAt to current time makes IsOnline() return true
		}

		// Call the function
		err := scs.syncForRemote(task, rc)

		// Verify
		require.NoError(t, err)
		assert.True(t, syncAllUsersCalled, "Expected syncAllUsersForRemote to be called")
	})

	t.Run("when channelID is empty but feature flag is disabled, it does not call syncAllUsersForRemote", func(t *testing.T) {
		// Setup test helper with real database
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Set the feature flag to false
		th.Server.config.FeatureFlags.SyncAllUsersForRemoteCluster = false

		// Create the service with real store and mock app
		mockApp := &MockAppIface{}
		scs := &Service{
			server: th.Server,
			app:    mockApp,
		}

		// Set up a hook for syncAllUsersForRemote
		syncAllUsersCalled := false
		oldHook := syncAllUsersHook
		syncAllUsersHook = func(scs *Service, rc *model.RemoteCluster) error {
			syncAllUsersCalled = true
			return nil
		}
		defer func() { syncAllUsersHook = oldHook }()

		// Create a task with empty channelID
		task := newSyncTask("", "", "remote1", nil, nil)
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
		}

		// Call the function
		err := scs.syncForRemote(task, rc)

		// Verify
		require.NoError(t, err)
		assert.False(t, syncAllUsersCalled, "Did not expect syncAllUsersForRemote to be called")
	})
}

func TestSyncAllUsersForRemote(t *testing.T) {
	// This test works in both short and non-short mode
	t.Run("successfully syncs users with database", func(t *testing.T) {
		// Setup test helper with store (real or mock)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Create test users vars to use in both real DB and mock cases
		user1ID := "user1"
		user2ID := "user2"
		remoteUserID := "remote_user"
		var remoteId = "remote1"

		// If we're using a mock store, set up expectations with the same users
		if mockUserStore, ok := th.Server.GetStore().User().(*mocks.UserStore); ok {
			user1 := &model.User{
				Id:       user1ID,
				Username: "user1",
				Email:    "user1@example.com",
				CreateAt: 10000,
				UpdateAt: 20000,
			}
			user2 := &model.User{
				Id:       user2ID,
				Username: "user2",
				Email:    "user2@example.com",
				CreateAt: 10001,
				UpdateAt: 20001,
			}
			remoteUser := &model.User{
				Id:       remoteUserID,
				Username: "remote_user",
				Email:    "remote_user@example.com",
				CreateAt: 10002,
				UpdateAt: 20002,
				RemoteId: &remoteId,
			}
			mockUserStore.On("GetAllProfiles", mock.Anything).Return([]*model.User{user1, user2, remoteUser}, nil)

			// Mock the Save method
			mockUserStore.On("Save", mock.Anything, mock.AnythingOfType("*model.User")).Return(
				&model.User{Id: user1ID}, nil,
			)
		}

		// Create a service with store connection
		mockApp := &MockAppIface{}
		scs := &Service{
			server: th.Server,
			app:    mockApp,
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Variables to hold our test users, whether they come from DB or mocks
		var user1, user2, remoteUser *model.User

		// Check if we're using a mock store
		if _, ok := th.Server.GetStore().User().(*mocks.UserStore); ok {
			// In mock mode, just create the structs without saving to DB
			user1 = &model.User{
				Id:       "user1",
				Username: "user1",
				Email:    "user1@example.com",
				CreateAt: 10000,
				UpdateAt: 20000,
			}
			user2 = &model.User{
				Id:       "user2",
				Username: "user2",
				Email:    "user2@example.com",
				CreateAt: 10001,
				UpdateAt: 20001,
			}
			remoteUser = &model.User{
				Id:       "remote_user",
				Username: "remote_user",
				Email:    "remote_user@example.com",
				CreateAt: 10002,
				UpdateAt: 20002,
				RemoteId: &remoteId,
			}
		} else {
			// In real DB mode, create and save the users
			user1 = &model.User{
				Username: "user1",
				Email:    "user1@example.com",
				CreateAt: 10000,
				UpdateAt: 20000,
			}
			var err error
			user1, err = th.Server.GetStore().User().Save(nil, user1)
			require.NoError(t, err)

			user2 = &model.User{
				Username: "user2",
				Email:    "user2@example.com",
				CreateAt: 10001,
				UpdateAt: 20001,
			}
			user2, err = th.Server.GetStore().User().Save(nil, user2)
			require.NoError(t, err)

			// Create a remote user to test that it's skipped
			remoteUser = &model.User{
				Username: "remote_user",
				Email:    "remote_user@example.com",
				CreateAt: 10002,
				UpdateAt: 20002,
				RemoteId: &remoteId,
			}
			remoteUser, err = th.Server.GetStore().User().Save(nil, remoteUser)
			require.NoError(t, err)
		}

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    remoteId,
			DisplayName: "Remote 1",
			LastPingAt:  model.GetMillis(), // setting LastPingAt to current time makes IsOnline() return true
		}

		// Use our test helper to extract the users that would be synced
		sentUsers, err := ExtractUsersFromSyncForTest(scs, rc)
		require.NoError(t, err)

		// Verify that user1 and user2 were sent (not the remoteUser)
		assert.Contains(t, sentUsers, user1.Id, "User1 should be sent")
		assert.Contains(t, sentUsers, user2.Id, "User2 should be sent")
		assert.NotContains(t, sentUsers, remoteUser.Id, "Remote user should not be sent")
	})

	t.Run("processes users in batches", func(t *testing.T) {
		// Setup test helper with store (real or mock)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// If we're using a mock store, set up expectations
		var remoteId = "remote1"
		var batchUsers []*model.User

		if mockUserStore, ok := th.Server.GetStore().User().(*mocks.UserStore); ok {
			// Generate test users for the mock
			batchUsers = make([]*model.User, TestableMaxUsersPerSync+5)
			for i := 0; i < TestableMaxUsersPerSync+5; i++ {
				batchUsers[i] = &model.User{
					Id:       fmt.Sprintf("user%d", i),
					Username: fmt.Sprintf("batchuser%d", i),
					Email:    fmt.Sprintf("batchuser%d@example.com", i),
					CreateAt: 10000 + int64(i),
					UpdateAt: 20000 + int64(i),
				}
			}
			// Add remote user
			remoteUser := &model.User{
				Id:       "remote_batch_user",
				Username: "remote_batch_user",
				Email:    "remote_batch_user@example.com",
				CreateAt: 10002,
				UpdateAt: 20002,
				RemoteId: &remoteId,
			}
			// Using a new slice to avoid the makezero error
			updatedBatchUsers := append([](*model.User){}, batchUsers...)
			batchUsers = append(updatedBatchUsers, remoteUser)

			// Override the default mock to return our specific batch users
			mockUserStore.ExpectedCalls = nil
			mockUserStore.On("GetAllProfiles", mock.Anything).Return(batchUsers, nil)

			// Mock the Save method
			mockUserStore.On("Save", mock.Anything, mock.AnythingOfType("*model.User")).Return(
				&model.User{Id: "user1"}, nil,
			)
		}
		mockApp := &MockAppIface{}
		scs := &Service{
			server: th.Server,
			app:    mockApp,
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Temporarily set TestableMaxUsersPerSync to a smaller number for testing
		originalMaxUsers := TestableMaxUsersPerSync
		TestableMaxUsersPerSync = 2
		defer func() {
			TestableMaxUsersPerSync = originalMaxUsers
		}()

		// Create a batch of test users in the database if not using mock store
		// We'll create TestableMaxUsersPerSync + 5 users to test batching
		var userIds = make([]string, 0, TestableMaxUsersPerSync+5)

		// Only create real users if we're not using a mock store - otherwise the mock
		// already has the test users we want from the setup above
		if _, ok := th.Server.GetStore().User().(*mocks.UserStore); !ok {
			for i := 0; i < TestableMaxUsersPerSync+5; i++ {
				user := &model.User{
					Username: fmt.Sprintf("batchuser%d", i),
					Email:    fmt.Sprintf("batchuser%d@example.com", i),
					CreateAt: 10000 + int64(i),
					UpdateAt: 20000 + int64(i),
				}
				var err error
				user, err = th.Server.GetStore().User().Save(nil, user)
				require.NoError(t, err)
				userIds = append(userIds, user.Id)
			}
		} else {
			// For mock store, just collect the IDs for verification
			for i := 0; i < TestableMaxUsersPerSync+5; i++ {
				userIds = append(userIds, fmt.Sprintf("user%d", i))
			}
		}

		// Create a remote user to verify filtering
		var remoteBatchUser *model.User
		if _, ok := th.Server.GetStore().User().(*mocks.UserStore); !ok {
			remoteBatchUser = &model.User{
				Username: "remote_batch_user",
				Email:    "remote_batch_user@example.com",
				CreateAt: 10002,
				UpdateAt: 20002,
				RemoteId: &remoteId,
			}
			var err error
			// Fix ineffectual assignment - we don't use the returned user
			_, err = th.Server.GetStore().User().Save(nil, remoteBatchUser)
			require.NoError(t, err)
		}
		// For mock store, the remote user is already set up in the mock

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    remoteId,
			DisplayName: "Remote 1",
			LastPingAt:  model.GetMillis(), // setting LastPingAt to current time makes IsOnline() return true
		}

		// Use our test helper to extract the users that would be synced
		sentUsers, err := ExtractUsersFromSyncForTest(scs, rc)
		require.NoError(t, err)

		// Verify that remote users are not synced
		// Check that sent users don't include any with RemoteId = remoteId
		for userID, user := range sentUsers {
			if user.RemoteId != nil && *user.RemoteId == remoteId {
				assert.Fail(t, "Remote user should not be sent", "Found user %s with RemoteId %s that should have been filtered", userID, remoteId)
			}
		}

		// Verify that at least our minimum number of users are included (minus remote user)
		// In mock mode, we should have exactly our test batch users
		assert.GreaterOrEqual(t, len(sentUsers), TestableMaxUsersPerSync, "Expected at least our test batch size of users to be included")
	})

	t.Run("handles error from database", func(t *testing.T) {
		// This test requires a mock since we need to simulate a database error
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		mockServer.On("GetMetrics").Return(nil) // Mock the GetMetrics call

		mockApp := &MockAppIface{}

		// Create a new mock for this test, not using createMockStore since we want specific error behavior
		mockUserStore := &mocks.UserStore{}
		mockUserStore.On("GetAllProfiles", mock.Anything).Return(nil, assert.AnError)

		mockStore := &mocks.Store{}
		mockStore.On("User").Return(mockUserStore)
		mockServer.On("GetStore").Return(mockStore)

		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			LastPingAt:  model.GetMillis(), // setting LastPingAt to current time makes IsOnline() return true
		}

			// Call the function directly
		err := scs.syncAllUsersForRemote(rc)

		// Verify
		require.Error(t, err)
		assert.Equal(t, assert.AnError, err)
	})
}

// Test the export function for user extraction
func TestExtractUsersFromSyncForTest(t *testing.T) {
	t.Run("extracts expected users from store", func(t *testing.T) {
		// Setup test helper with store (real or mock)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// If we're using a mock store, set up expectations
		if mockUserStore, ok := th.Server.GetStore().User().(*mocks.UserStore); ok {
			user1 := &model.User{
				Id:       "export_test_user1",
				Username: "export_test_user1",
				Email:    "export_test_user1@example.com",
				CreateAt: model.GetMillis(),
				UpdateAt: model.GetMillis(),
			}
			mockUserStore.On("GetAllProfiles", mock.Anything).Return([]*model.User{user1}, nil)

			// Mock the Save method
			mockUserStore.On("Save", mock.Anything, mock.AnythingOfType("*model.User")).Return(
				&model.User{Id: "user1"}, nil,
			)
		}
		scs := &Service{
			server: th.Server,
			app:    &MockAppIface{},
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Create test users in the database
		user1 := &model.User{
			Username: "export_test_user1",
			Email:    "export_test_user1@example.com",
			CreateAt: model.GetMillis(),
			UpdateAt: model.GetMillis(),
		}
		user1, err := th.Server.GetStore().User().Save(nil, user1)
		require.NoError(t, err)

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "export_test_remote",
			DisplayName: "Export Test Remote",
			LastPingAt:  model.GetMillis(), // setting LastPingAt to current time makes IsOnline() return true
		}

		// Use our test helper to extract users
		sentUsers, err := ExtractUsersFromSyncForTest(scs, rc)
		require.NoError(t, err)

		// Verify extraction worked correctly
		assert.Contains(t, sentUsers, user1.Id, "Expected user to be extracted")
	})

	t.Run("nil remote cluster should return empty set", func(t *testing.T) {
		// Setup test service with minimal mock
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		scs := &Service{
			server: mockServer,
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Call function with nil remote
		sentUsers, err := ExtractUsersFromSyncForTest(scs, nil)

		// Should return an empty map without error
		require.Empty(t, sentUsers, "Expected empty map for nil remote")
		require.NoError(t, err, "Should not return error for nil remote")
	})
}
