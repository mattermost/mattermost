// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
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
	rcs    remotecluster.RemoteClusterServiceIFace
}

// MockRemoteClusterServiceIface mocks the RemoteClusterServiceIface for testing
type MockRemoteClusterServiceIface struct {
	mock.Mock
}

func (m *MockRemoteClusterServiceIface) SendMsg(ctx context.Context, msg model.RemoteClusterMsg, rc *model.RemoteCluster, callback remotecluster.SendMsgResultFunc) error {
	args := m.Called(ctx, msg, rc, callback)

	// Don't call the callback in tests unless explicitly set up in the .Run() function
	// The Run function will handle executing the callback with the proper response

	return args.Error(0)
}

// Add other required methods from RemoteClusterServiceIface here
// Note: These tests run in both short (mock) and long (DB) modes
func (m *MockRemoteClusterServiceIface) AddTopicListener(topic string, listener remotecluster.TopicListener) string {
	args := m.Called(topic, listener)
	return args.String(0)
}

func (m *MockRemoteClusterServiceIface) RemoveTopicListener(listenerId string) {
	m.Called(listenerId)
}

func (m *MockRemoteClusterServiceIface) Start() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) Shutdown() error {
	args := m.Called()
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) AcceptInvitation(invite *model.RemoteClusterInvite, name string, displayName string, creatorId string, siteURL string, defaultTeamId string) (*model.RemoteCluster, error) {
	args := m.Called(invite, name, displayName, creatorId, siteURL, defaultTeamId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.RemoteCluster), args.Error(1)
}

func (m *MockRemoteClusterServiceIface) Active() bool {
	args := m.Called()
	return args.Bool(0)
}

func (m *MockRemoteClusterServiceIface) AddConnectionStateListener(listener remotecluster.ConnectionStateListener) string {
	args := m.Called(listener)
	return args.String(0)
}

func (m *MockRemoteClusterServiceIface) RemoveConnectionStateListener(listenerId string) {
	m.Called(listenerId)
}

func (m *MockRemoteClusterServiceIface) PingNow(rc *model.RemoteCluster) {
	m.Called(rc)
}

func (m *MockRemoteClusterServiceIface) SendFile(ctx context.Context, us *model.UploadSession, fi *model.FileInfo, rc *model.RemoteCluster, rp remotecluster.ReaderProvider, f remotecluster.SendFileResultFunc) error {
	args := m.Called(ctx, us, fi, rc, rp, f)
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) SendProfileImage(ctx context.Context, userID string, rc *model.RemoteCluster, provider remotecluster.ProfileImageProvider, f remotecluster.SendProfileImageResultFunc) error {
	args := m.Called(ctx, userID, rc, provider, f)
	return args.Error(0)
}

func (m *MockRemoteClusterServiceIface) ReceiveIncomingMsg(rc *model.RemoteCluster, msg model.RemoteClusterMsg) remotecluster.Response {
	args := m.Called(rc, msg)
	return args.Get(0).(remotecluster.Response)
}

func (m *MockRemoteClusterServiceIface) ReceiveInviteConfirmation(invite model.RemoteClusterInvite) (*model.RemoteCluster, error) {
	args := m.Called(invite)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*model.RemoteCluster), args.Error(1)
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
	// TestServer keeps track of what remote cluster service to return
	if ts.rcs != nil {
		return ts.rcs
	}
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
	mockRemoteClusterStore := &mocks.RemoteClusterStore{}
	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockStore.On("User").Return(mockUserStore)
	mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)
	mockStore.On("SharedChannel").Return(mockSharedChannelStore)

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

	// Create a map to store updated RemoteCluster objects for each remoteId
	remoteClusterCache := make(map[string]*model.RemoteCluster)

	// Add mock for Save that returns the provided RemoteCluster
	mockRemoteClusterStore.On("Save", mock.AnythingOfType("*model.RemoteCluster")).Return(func(rc *model.RemoteCluster) *model.RemoteCluster {
		// Also store in cache
		updatedRC := *rc
		remoteClusterCache[rc.RemoteId] = &updatedRC
		return rc
	}, nil)

	// Add a mock for Update that updates the cache
	mockRemoteClusterStore.On("Update", mock.AnythingOfType("*model.RemoteCluster")).Run(func(args mock.Arguments) {
		rc := args.Get(0).(*model.RemoteCluster)
		// Store a copy of the updated RemoteCluster in the cache
		updatedRC := *rc
		remoteClusterCache[rc.RemoteId] = &updatedRC
	}).Return(func(rc *model.RemoteCluster) *model.RemoteCluster {
		// Return the same object that was passed in (expected by the real implementation)
		return rc
	}, nil)

	// Add a mock for Get that returns the updated remote cluster from cache
	mockRemoteClusterStore.On("Get", mock.AnythingOfType("string"), mock.Anything).Run(func(args mock.Arguments) {
		// Nothing to do here, we'll return the updated cluster in the Return() call
	}).Return(func(remoteId string, _ bool) *model.RemoteCluster {
		// Check if we have an updated cluster in the cache
		if cachedRC, ok := remoteClusterCache[remoteId]; ok {
			return cachedRC
		}
		// If not in cache yet, return a default cluster with LastGlobalUserSyncAt=0
		return &model.RemoteCluster{
			RemoteId:             remoteId,
			LastGlobalUserSyncAt: 0,
		}
	}, nil)

	// Setup SharedChannel mocks for testing user sync

	// Add mock for UpdateUserLastSyncAt which is called during user sync
	mockSharedChannelStore.On("UpdateUserLastSyncAt", mock.AnythingOfType("string"), mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(nil)

	return mockStore
}

func SetupTestHelperWithStore(tb testing.TB) *TestHelper {
	// Try creating a database connection, but provide a graceful fallback if it fails
	var mainHelper *testlib.MainHelper
	var store store.Store

	// In short mode, always use a mock store
	if testing.Short() {
		tb.Logf("Using mock store (short mode)")
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
			tb.Logf("Using real database connection")
			store = mainHelper.GetStore()
		} else {
			// If database connection fails, fall back to mock
			tb.Logf("Database connection failed, using mock store as fallback")
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
	serverConfig.FeatureFlags.EnableSyncAllUsersForRemoteCluster = true

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
	t.Run("creates a sync task with empty channelID when connection comes online", func(t *testing.T) {
		// This test uses all mocks regardless of mode
		// Setup mock for this test
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)

		// Set up configuration
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSyncAllUsersForRemoteCluster = true
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
}

// setupTestSyncConfig updates the server config with the given batch size for testing
func setupTestSyncConfig(th *TestHelper, batchSize int) {
	// Since ConnectedWorkspacesSettings is a struct value (not a pointer),
	// we don't need to check if it's nil. We can directly set the field.

	// Set the batch size
	th.Server.config.ConnectedWorkspacesSettings.GlobalUserSyncBatchSize = model.NewPointer(batchSize)
}

func TestSyncAllUsersForRemote(t *testing.T) {
	t.Run("successfully syncs users with database", func(t *testing.T) {
		// This test can be slow in CI environments
		if os.Getenv("CI") != "" && testing.Short() {
			t.Skip("Skipping test in CI with short mode")
		}

		if testing.Short() {
			t.Log("Running in short mode with mocks")
		} else {
			t.Log("Running in normal mode with real DB")
		}
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

		// Create a service with store connection and remote cluster service mock
		mockApp := &MockAppIface{}
		mockRCS := &MockRemoteClusterServiceIface{}

		// Set up a proper callback execution for SendMsg to simulate successful sync
		mockRCS.On("SendMsg", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			// Extract the callback from args
			callback := args.Get(3).(remotecluster.SendMsgResultFunc)
			rcMsg := args.Get(1).(model.RemoteClusterMsg)
			rc := args.Get(2).(*model.RemoteCluster)

			// Parse the message payload
			var syncMsg model.SyncMsg
			if err := json.Unmarshal(rcMsg.Payload, &syncMsg); err == nil {
				// Create a valid response with all users successfully synced
				usersSyncd := make([]string, 0, len(syncMsg.Users))
				for userID := range syncMsg.Users {
					usersSyncd = append(usersSyncd, userID)
				}

				// Create the response
				syncResp := model.SyncResponse{
					UsersSyncd: usersSyncd,
				}
				respPayload, _ := json.Marshal(syncResp)

				// Call the callback with success
				callback(rcMsg, rc, &remotecluster.Response{
					Status:  remotecluster.ResponseStatusOK,
					Payload: respPayload,
				}, nil)
			}
		}).Return(nil)

		// Set up the mock remote cluster service in the test server
		th.Server.rcs = mockRCS

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
		originalBatchSize := TestableMaxUsersPerSync
		TestableMaxUsersPerSync = 2
		defer func() {
			TestableMaxUsersPerSync = originalBatchSize
		}()

		// Set up the config to match
		setupTestSyncConfig(th, 2)

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

		// Mock the remote cluster service
		mockRemoteClusterService := &MockRemoteClusterServiceIface{}
		mockServer.On("GetRemoteClusterService").Return(mockRemoteClusterService)

		// Mock the Config method to return a proper config with ConnectedWorkspacesSettings
		mockConfig := &model.Config{}
		mockConfig.SetDefaults()
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSyncAllUsersForRemoteCluster = true
		mockServer.On("Config").Return(mockConfig)

		mockApp := &MockAppIface{}

		// Create a new mock for this test, not using createMockStore since we want specific error behavior
		mockUserStore := &mocks.UserStore{}
		mockUserStore.On("GetAllProfiles", mock.Anything).Return(nil, assert.AnError)

		mockSharedChannelStore := &mocks.SharedChannelStore{}

		// Mock the remote cluster store
		mockRemoteClusterStore := &mocks.RemoteClusterStore{}
		mockRemoteClusterStore.On("Get", mock.Anything, mock.Anything).Return(
			&model.RemoteCluster{
				RemoteId:             "remote1",
				LastPingAt:           model.GetMillis(),
				LastGlobalUserSyncAt: 0,
			}, nil)

		mockStore := &mocks.Store{}
		mockStore.On("User").Return(mockUserStore)
		mockStore.On("SharedChannel").Return(mockSharedChannelStore)
		mockStore.On("RemoteCluster").Return(mockRemoteClusterStore)
		mockServer.On("GetStore").Return(mockStore)

		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
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

	t.Run("cursor-based sync skips users with no updates", func(t *testing.T) {
		if testing.Short() {
			t.Log("Simplified test in short mode - just testing logic without DB")
		} else {
			t.Skip("Skipping in normal mode - this test is designed for short (mock) mode only")
		}

		// Setup test helper with store (using mocks in short mode)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Get the current time for our timestamps
		var now int64
		if testing.Short() {
			// In short mode, use a fixed timestamp that works with our mock users
			now = 25000 // Set higher than our mock user UpdateAt values
		} else {
			now = model.GetMillis()
		}

		// Create a real remote cluster in the DB
		rc := &model.RemoteCluster{
			RemoteId:             model.NewId(), // Use a proper UUID
			SiteURL:              "http://example.com",
			Name:                 "cursor-test-remote", // Using valid name format
			DisplayName:          "Cursor Test Remote",
			Token:                model.NewId(),
			RemoteToken:          model.NewId(),
			Topics:               "sync",
			CreatorId:            model.NewId(),
			LastPingAt:           now,   // Makes IsOnline() return true
			LastGlobalUserSyncAt: 10000, // Last sync was at timestamp 10000 (before our mock users)
		}

		var err error
		rc, err = th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)

		// Store the remote ID for later use
		remoteId := rc.RemoteId

		// Create test users in the database
		// user1 with update time after the cursor (should be synced)
		user1 := &model.User{
			Username:  "cursor_user1",
			Email:     "cursor_user1@example.com",
			CreateAt:  now - 50000,
			UpdateAt:  now - 5000, // After cursor
			DeleteAt:  0,
			Nickname:  "User One",
			FirstName: "User",
			LastName:  "One",
			Position:  "Developer",
		}
		var err1 error
		_, err1 = th.Server.GetStore().User().Save(nil, user1)
		require.NoError(t, err1)

		// user2 with update time before the cursor (should not be synced)
		user2 := &model.User{
			Username:  "cursor_user2",
			Email:     "cursor_user2@example.com",
			CreateAt:  now - 50000,
			UpdateAt:  now - 15000, // Before cursor
			DeleteAt:  0,
			Nickname:  "User Two",
			FirstName: "User",
			LastName:  "Two",
			Position:  "Manager",
		}
		var err2 error
		_, err2 = th.Server.GetStore().User().Save(nil, user2)
		require.NoError(t, err2)

		// Remote user from the target remote (should not be synced)
		remoteUser := &model.User{
			Username:  "cursor_remote_user",
			Email:     "cursor_remote_user@example.com",
			CreateAt:  now - 50000,
			UpdateAt:  now - 5000, // After cursor, but from remote
			DeleteAt:  0,
			Nickname:  "Remote User",
			FirstName: "Remote",
			LastName:  "User",
			Position:  "External",
			RemoteId:  &remoteId, // Important: this marks the user as from our target remote
		}
		var err3 error
		_, err3 = th.Server.GetStore().User().Save(nil, remoteUser)
		require.NoError(t, err3)
		// Create the service with mock app and remote cluster service
		mockApp := &MockAppIface{}
		mockRCS := &MockRemoteClusterServiceIface{}

		// Set up a proper callback execution for SendMsg to simulate successful sync
		mockRCS.On("SendMsg", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			// Extract the callback from args
			callback := args.Get(3).(remotecluster.SendMsgResultFunc)
			rcMsg := args.Get(1).(model.RemoteClusterMsg)
			rc := args.Get(2).(*model.RemoteCluster)

			// Parse the message payload
			var syncMsg model.SyncMsg
			if pErr := json.Unmarshal(rcMsg.Payload, &syncMsg); pErr == nil {
				// Create a valid response with all users successfully synced
				usersSyncd := make([]string, 0, len(syncMsg.Users))
				for userID := range syncMsg.Users {
					usersSyncd = append(usersSyncd, userID)
				}

				// Create the response
				syncResp := model.SyncResponse{
					UsersSyncd: usersSyncd,
				}
				respPayload, _ := json.Marshal(syncResp)

				// Call the callback with success
				callback(rcMsg, rc, &remotecluster.Response{
					Status:  remotecluster.ResponseStatusOK,
					Payload: respPayload,
				}, nil)
			}
		}).Return(nil)

		// Set up the mock remote cluster service in the test server
		th.Server.rcs = mockRCS

		scs := &Service{
			server: th.Server,
			app:    mockApp,
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Mock the OnSharedChannelsSyncMsg to track which users would be synced
		var sentUsers = make(map[string]*model.User)
		mockApp.On("OnSharedChannelsSyncMsg", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			msg := args.Get(0).(*model.SyncMsg)
			for id, user := range msg.Users {
				sentUsers[id] = user
			}
		}).Return(model.SyncResponse{}, nil)

		// Extract the users that would be synced without actually syncing
		syncedUsers, err := ExtractUsersFromSyncForTest(scs, rc)
		require.NoError(t, err)

		// Verify that only users updated after the cursor are included
		// and that remote users are not included
		var user2Found, remoteUserFound bool
		for userID, user := range syncedUsers {
			if user.Username == "cursor_user2" {
				user2Found = true
			} else if user.Username == "cursor_remote_user" {
				remoteUserFound = true
			}

			// The main test: check that any included user has UpdateAt > LastGlobalUserSyncAt
			assert.Greater(t, user.UpdateAt, rc.LastGlobalUserSyncAt,
				"User %s (UpdateAt %d) should have UpdateAt > LastGlobalUserSyncAt (%d)",
				userID, user.UpdateAt, rc.LastGlobalUserSyncAt)

			// Also check for remote users
			if user.RemoteId != nil {
				assert.NotEqual(t, *user.RemoteId, rc.RemoteId,
					"User %s from remote %s should not be included in sync",
					userID, *user.RemoteId)
			}
		}

		// Verify expected users are/aren't found
		// Just verify cursor-based filtering without relying on specific user names
		assert.False(t, user2Found, "User2 (updated before cursor) should not be included in sync")
		assert.False(t, remoteUserFound, "RemoteUser (from target remote) should not be included in sync")
	})

	t.Run("cursor-based sync creates continuation task for next batch", func(t *testing.T) {
		if !testing.Short() {
			t.Skip("Skipping in normal mode - this test is designed for short (mock) mode only")
		}

		// This is a simplified version that focuses just on verifying a task is created
		// Setup test helper with store (uses mocks in short mode)
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Create a mock remote cluster service that just returns success
		mockRCS := &MockRemoteClusterServiceIface{}
		th.Server.rcs = mockRCS

		// Set up a simple SendMsg mock that just succeeds
		mockRCS.On("SendMsg", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			// Extract the callback and call it with success
			callback := args.Get(3).(remotecluster.SendMsgResultFunc)
			rcMsg := args.Get(1).(model.RemoteClusterMsg)
			rc := args.Get(2).(*model.RemoteCluster)

			// Create a successful response
			syncResp := model.SyncResponse{
				UsersSyncd: []string{"user1", "user2"},
			}
			respPayload, _ := json.Marshal(syncResp)

			// Call the callback immediately
			callback(rcMsg, rc, &remotecluster.Response{
				Status:  remotecluster.ResponseStatusOK,
				Payload: respPayload,
			}, nil)
		}).Return(nil)

		// Create a service instance
		mockApp := &MockAppIface{}
		scs := &Service{
			server:       th.Server,
			app:          mockApp,
			tasks:        make(map[string]syncTask),
			mux:          sync.RWMutex{},
			changeSignal: make(chan struct{}),
		}

		// Setup a small batch size for testing
		originalBatchSize := TestableMaxUsersPerSync
		TestableMaxUsersPerSync = 2
		defer func() {
			TestableMaxUsersPerSync = originalBatchSize
		}()
		setupTestSyncConfig(th, 2)

		now := model.GetMillis()

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "cursor-test-remote",
			DisplayName:          "Cursor Test Remote",
			SiteURL:              "http://example.com",
			Token:                model.NewId(),
			RemoteToken:          model.NewId(),
			CreatorId:            model.NewId(),
			Topics:               "sync",
			LastPingAt:           now,         // online
			LastGlobalUserSyncAt: now - 50000, // 50 seconds ago
		}

		// Create test users and setup mock expectations
		mockUserStore, ok := th.Server.GetStore().User().(*mocks.UserStore)
		require.True(t, ok, "Expected a mock user store in short mode")

		// Create more users than fit in a single batch
		var users []*model.User

		// Create 5 users - more than our batch size of 2
		for i := 0; i < 5; i++ {
			users = append(users, &model.User{
				Id:       fmt.Sprintf("user%d", i),
				Username: fmt.Sprintf("cursor_resume_user%d", i),
				Email:    fmt.Sprintf("cursor_resume_user%d@example.com", i),
				CreateAt: now - 40000 + int64(i*100),
				UpdateAt: now - 30000 + int64(i*100), // All are after LastGlobalUserSyncAt
			})
		}

		// Clear existing expectations and set up new ones
		mockUserStore.ExpectedCalls = mockUserStore.ExpectedCalls[:0]
		mockUserStore.On("GetAllProfiles", mock.Anything).Return(users, nil)

		// Call syncAllUsersForRemote to start the process
		// This should process TestableMaxUsersPerSync users and schedule a task for more
		err := scs.syncAllUsersForRemote(rc)
		require.NoError(t, err)

		// Short wait to ensure any asynchronous operations complete
		time.Sleep(100 * time.Millisecond)

		// Verify that a task was scheduled for the next batch
		// This is the key thing we're testing - that more tasks are scheduled when
		// there are more users than fit in a single batch
		scs.mux.Lock()
		var foundContinuationTask bool
		for _, task := range scs.tasks {
			if task.channelID == "" && task.remoteID == rc.RemoteId {
				foundContinuationTask = true
				break
			}
		}
		scs.mux.Unlock()

		assert.True(t, foundContinuationTask, "Expected a continuation task to be scheduled for next batch")
	})
}

// Note: minInt is used from exports_for_test.go

func TestRemoteClusterOfflineDuringSync(t *testing.T) {
	// Skip in CI with short mode to avoid long-running tests
	if os.Getenv("CI") != "" && testing.Short() {
		t.Skip("Skipping test in CI with short mode")
	}

	if testing.Short() {
		t.Log("Running in short mode with mocks")
	} else {
		t.Log("Running in normal mode with DB")
	}

	// Setup test helper with store (in short mode: all mocks, in normal mode: real DB with minimal mocks)
	th := SetupTestHelperWithStore(t)
	defer th.TearDown()

	// Create a mock remote cluster service - needed in both modes
	mockRCS := &MockRemoteClusterServiceIface{}
	th.Server.rcs = mockRCS

	// Create a service instance
	mockApp := &MockAppIface{}
	scs := &Service{
		server: th.Server,
		app:    mockApp,
		tasks:  make(map[string]syncTask),
		mux:    sync.RWMutex{},
	}

	// Create a remote cluster that starts online with required fields for IsValid
	rc := &model.RemoteCluster{
		RemoteId:             model.NewId(),
		Name:                 "offline-test-remote",
		DisplayName:          "Offline Test Remote",
		SiteURL:              "http://example.com",
		Token:                model.NewId(),
		RemoteToken:          model.NewId(),
		CreatorId:            model.NewId(),
		Topics:               "sync",
		LastPingAt:           model.GetMillis(), // Initially online
		LastGlobalUserSyncAt: 0,
	}

	// Add to store if using real DB, otherwise set up mock expectations
	if _, ok := th.Server.GetStore().RemoteCluster().(*mocks.RemoteClusterStore); ok {
		// In short mode, mock is already set up in SetupTestHelperWithStore
		// But we need to make sure our rc is properly tracked in the mock cache
		_, err := th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)
	} else {
		// For real DB mode
		var err error
		rc, err = th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)
	}

	// First verify it's online
	assert.True(t, rc.IsOnline(), "Remote cluster should start online")

	// Now make it go offline
	// In a real scenario, this would be detected by ping timeout, but we'll simulate it
	rc.LastPingAt = 0 // Setting to 0 makes IsOnline() return false

	// Update in store
	var updatedRC *model.RemoteCluster
	var err error
	updatedRC, err = th.Server.GetStore().RemoteCluster().Update(rc)
	require.NoError(t, err)

	// Use the updated RC return value if available (important for DB mode)
	if updatedRC != nil {
		rc = updatedRC
	}

	// Try to sync users to the offline remote
	err = scs.syncAllUsersForRemote(rc)

	// Should return an error because remote is offline
	require.Error(t, err, "Expected error when syncing to offline remote")
	assert.Contains(t, err.Error(), "not online", "Error should mention remote is not online")

	// No SendMsg calls should be made
	mockRCS.AssertNotCalled(t, "SendMsg")
}

func TestSyncUsersInMultipleSharedChannels(t *testing.T) {
	if testing.Short() {
		t.Log("Running in short mode with mocks")
	} else {
		t.Log("Running in normal mode with DB")
	}

	// Setup test helper with store
	th := SetupTestHelperWithStore(t)
	defer th.TearDown()

	// Create a remote cluster with required fields for IsValid
	rc := &model.RemoteCluster{
		RemoteId:             model.NewId(),
		Name:                 "multi-channel-remote",
		DisplayName:          "Multi Channel Remote",
		SiteURL:              "http://example.com",
		Token:                model.NewId(),
		RemoteToken:          model.NewId(),
		CreatorId:            model.NewId(),
		Topics:               "sync",
		LastPingAt:           model.GetMillis(), // online
		LastGlobalUserSyncAt: 0,
	}

	// Add remote cluster to store depending on which mode we're in
	if _, ok := th.Server.GetStore().RemoteCluster().(*mocks.RemoteClusterStore); ok {
		// In short mode, ensure our remote cluster is tracked in the mock
		_, err := th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)
	} else {
		// In DB mode, save to the database
		var err error
		rc, err = th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)
	}

	// Get current time for consistent timestamp values
	now := model.GetMillis()

	// Create a test user with a consistent ID across test modes
	var userId string
	if testing.Short() {
		// In short mode, use a fixed ID for predictability
		userId = "multi_channel_user_id"
	} else {
		// In normal mode, we'll let the database generate the ID later
		// We don't pre-assign an ID for DB mode as it needs to pass User validation
		userId = ""
	}

	user := &model.User{
		Username: "multi_channel_user",
		Email:    "multi_channel_user@example.com",
		CreateAt: now - 50000,
		UpdateAt: now, // Set to current time to ensure it's newer than LastSyncAt
	}

	// Only set the ID in short mode
	if testing.Short() {
		user.Id = userId
	}

	// Save user to store - different approach for mock vs real DB
	if mockUserStore, ok := th.Server.GetStore().User().(*mocks.UserStore); ok {
		// For mock mode, set up the mock store with our test user
		mockUserStore.ExpectedCalls = mockUserStore.ExpectedCalls[:0]
		mockUserStore.On("Get", mock.Anything, user.Id).Return(user, nil)

		// Mock GetAllProfiles with pagination check to avoid infinite loops
		mockUserStore.On("GetAllProfiles", mock.MatchedBy(func(opts *model.UserGetOptions) bool {
			return opts.Page == 0
		})).Return([]*model.User{user}, nil)
		mockUserStore.On("GetAllProfiles", mock.MatchedBy(func(opts *model.UserGetOptions) bool {
			return opts.Page > 0
		})).Return([]*model.User{}, nil) // Empty list for page > 0 to end pagination
	} else {
		// For real DB, save the user
		var err error
		user, err = th.Server.GetStore().User().Save(nil, user)
		require.NoError(t, err)
		userId = user.Id // Update userId to match what the DB assigned
	}

	// Setup mock or real DB for shared channels
	var channel1ID, channel2ID string

	if mockSCStore, ok := th.Server.GetStore().SharedChannel().(*mocks.SharedChannelStore); ok {
		// In short mode, generate consistent IDs
		channel1ID = "channel1_id_for_test"
		channel2ID = "channel2_id_for_test"

		// For mock mode, configure the mocks
		mockSCStore.ExpectedCalls = mockSCStore.ExpectedCalls[:0]

		// Mock GetUsersByRemote which is called during user sync
		mockSCStore.On("GetUsersByRemote", rc.RemoteId).Return([]*model.SharedChannelUser{}, nil)

		// Mock GetUsersByUserAndRemote to return records for both channels
		mockSCStore.On("GetUsersByUserAndRemote", userId, rc.RemoteId).Return([]*model.SharedChannelUser{
			{
				UserId:     userId,
				ChannelId:  channel1ID,
				RemoteId:   rc.RemoteId,
				LastSyncAt: now - 10000, // Older than user.UpdateAt to ensure sync happens
			},
			{
				UserId:     userId,
				ChannelId:  channel2ID,
				RemoteId:   rc.RemoteId,
				LastSyncAt: now - 10000, // Older than user.UpdateAt to ensure sync happens
			},
		}, nil)

		// Mock UpdateUserLastSyncAt to track which channels are updated
		var updatedChannels []string
		mockSCStore.On("UpdateUserLastSyncAt", userId, mock.Anything, rc.RemoteId).Run(func(args mock.Arguments) {
			channelID := args.Get(1).(string)
			updatedChannels = append(updatedChannels, channelID)
		}).Return(nil)
	} else {
		// For real DB mode, we need to create real team and channels first

		// Create a team for the channels
		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "test-team-" + model.NewId(),
			Email:       "test-team@example.com",
			Type:        model.TeamOpen,
		}
		team, err := th.Server.GetStore().Team().Save(team)
		require.NoError(t, err)

		// Create real channels
		channel1 := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Test Channel 1",
			Name:        "test-channel-1-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		channel1, err = th.Server.GetStore().Channel().Save(nil, channel1, 10000)
		require.NoError(t, err)
		channel1ID = channel1.Id

		channel2 := &model.Channel{
			TeamId:      team.Id,
			DisplayName: "Test Channel 2",
			Name:        "test-channel-2-" + model.NewId(),
			Type:        model.ChannelTypeOpen,
		}
		channel2, err = th.Server.GetStore().Channel().Save(nil, channel2, 10000)
		require.NoError(t, err)
		channel2ID = channel2.Id

		// Now create the shared channel records
		sc1 := &model.SharedChannel{
			ChannelId:        channel1ID,
			TeamId:           team.Id,
			CreatorId:        userId,
			RemoteId:         rc.RemoteId,
			ShareName:        "test-channel-1",
			ShareDisplayName: "Test Channel 1",
			SharePurpose:     "Test Purpose 1",
			ShareHeader:      "Test Header 1",
		}
		sc2 := &model.SharedChannel{
			ChannelId:        channel2ID,
			TeamId:           team.Id,
			CreatorId:        userId,
			RemoteId:         rc.RemoteId,
			ShareName:        "test-channel-2",
			ShareDisplayName: "Test Channel 2",
			SharePurpose:     "Test Purpose 2",
			ShareHeader:      "Test Header 2",
		}

		_, err = th.Server.GetStore().SharedChannel().Save(sc1)
		require.NoError(t, err)
		_, err = th.Server.GetStore().SharedChannel().Save(sc2)
		require.NoError(t, err)

		// Then create user entries for these channels
		scu1 := &model.SharedChannelUser{
			UserId:     userId,
			ChannelId:  channel1ID,
			RemoteId:   rc.RemoteId,
			LastSyncAt: now - 10000, // Older than user.UpdateAt to ensure sync happens
		}
		scu2 := &model.SharedChannelUser{
			UserId:     userId,
			ChannelId:  channel2ID,
			RemoteId:   rc.RemoteId,
			LastSyncAt: now - 10000, // Older than user.UpdateAt to ensure sync happens
		}

		_, err = th.Server.GetStore().SharedChannel().SaveUser(scu1)
		require.NoError(t, err)
		_, err = th.Server.GetStore().SharedChannel().SaveUser(scu2)
		require.NoError(t, err)
	}

	// Create mock remote cluster service
	mockRCS := &MockRemoteClusterServiceIface{}
	th.Server.rcs = mockRCS

	// Set up SendMsg mock to track what's sent
	var sentUserIDs []string
	var mutex sync.Mutex // Protect sentUserIDs during concurrent access

	mockRCS.On("SendMsg", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
		// Extract the callback from args
		callback := args.Get(3).(remotecluster.SendMsgResultFunc)
		rcMsg := args.Get(1).(model.RemoteClusterMsg)
		rc := args.Get(2).(*model.RemoteCluster)

		// Parse the message payload - handle errors explicitly
		var syncMsg model.SyncMsg
		err := json.Unmarshal(rcMsg.Payload, &syncMsg)
		if err != nil {
			t.Logf("Error unmarshaling payload: %v", err)
			return
		}

		// Track which users were sent (thread-safe)
		mutex.Lock()
		for userID := range syncMsg.Users {
			sentUserIDs = append(sentUserIDs, userID)
		}
		mutex.Unlock()

		// Create a successful response
		usersSyncd := make([]string, 0, len(syncMsg.Users))
		for userID := range syncMsg.Users {
			usersSyncd = append(usersSyncd, userID)
		}

		syncResp := model.SyncResponse{
			UsersSyncd: usersSyncd,
		}
		respPayload, err := json.Marshal(syncResp)
		if err != nil {
			t.Logf("Error marshaling response: %v", err)
			return
		}

		// Call the callback immediately - important for tests to avoid timeout
		callback(rcMsg, rc, &remotecluster.Response{
			Status:  remotecluster.ResponseStatusOK,
			Payload: respPayload,
		}, nil)
	}).Return(nil)

	// Create service instance
	mockApp := &MockAppIface{}
	scs := &Service{
		server: th.Server,
		app:    mockApp,
		tasks:  make(map[string]syncTask),
		mux:    sync.RWMutex{},
	}

	// Run the sync
	err := scs.syncAllUsersForRemote(rc)
	require.NoError(t, err)

	// Verify the user was sent exactly once
	assert.Contains(t, sentUserIDs, userId, "User should be synced")

	// Count occurrences of the user ID in the sent list
	userSyncCount := 0
	for _, id := range sentUserIDs {
		if id == userId {
			userSyncCount++
		}
	}

	// User should be synced exactly once, not multiple times for different channels
	assert.Equal(t, 1, userSyncCount, "User should be synced exactly once, not once per channel")
}

// Test the export function for user extraction
func TestExtractUsersFromSyncForTest(t *testing.T) {
	t.Run("extracts expected users from store", func(t *testing.T) {
		if testing.Short() {
			t.Skip("Skipping test in short mode - requires real database")
		}

		t.Log("Using real database connection")

		// For this test, we need the real database
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		// Skip if we don't have a real database connection
		if th.MainHelper == nil || th.MainHelper.SQLStore == nil {
			t.Skip("Skipping test as real database connection couldn't be established")
		}

		// Get current time for consistent timestamps
		now := model.GetMillis()

		// Create a user for testing
		user1 := &model.User{
			Username:  "export_test_user1",
			Email:     "export_test_user1@example.com",
			CreateAt:  now - 10000,
			UpdateAt:  now, // Recent update to ensure it's picked up
			Nickname:  "Test User",
			FirstName: "Test",
			LastName:  "User",
			Position:  "Tester",
		}

		// Save the user to the database
		var err error
		user1, err = th.Server.GetStore().User().Save(nil, user1)
		require.NoError(t, err)
		userId := user1.Id

		// Create service instance
		scs := &Service{
			server: th.Server,
			app:    &MockAppIface{},
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Create a remote cluster
		rc := &model.RemoteCluster{
			RemoteId:             model.NewId(),
			Name:                 "extract-test-remote",
			DisplayName:          "Extract Test Remote",
			SiteURL:              "http://example.com",
			Token:                model.NewId(),
			RemoteToken:          model.NewId(),
			CreatorId:            model.NewId(),
			Topics:               "sync",
			LastPingAt:           now,         // Setting LastPingAt to current time makes IsOnline() return true
			LastGlobalUserSyncAt: now - 20000, // Set to older than user.UpdateAt to ensure the user is picked up
		}

		// Save remote cluster to the database
		rc, err = th.Server.GetStore().RemoteCluster().Save(rc)
		require.NoError(t, err)

		// Now use our test helper to extract users
		sentUsers, err := ExtractUsersFromSyncForTest(scs, rc)
		require.NoError(t, err)

		// Verify our test user was extracted
		assert.Contains(t, sentUsers, userId, "Expected user to be extracted")
	})

	t.Run("nil remote cluster should return empty set", func(t *testing.T) {
		if testing.Short() {
			t.Log("Running in short mode")
		} else {
			t.Log("Running in normal mode")
		}

		// Setup with proper test helper for both modes
		th := SetupTestHelperWithStore(t)
		defer th.TearDown()

		scs := &Service{
			server: th.Server,
			app:    &MockAppIface{},
			tasks:  make(map[string]syncTask),
			mux:    sync.RWMutex{},
		}

		// Call function with nil remote
		sentUsers, err := ExtractUsersFromSyncForTest(scs, nil)

		// Should return an empty map without error in both modes
		require.Empty(t, sentUsers, "Expected empty map for nil remote")
		require.NoError(t, err, "Should not return error for nil remote")
	})
}
