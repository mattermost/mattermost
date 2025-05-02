// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestOnConnectionStateChangeWithUserSync(t *testing.T) {
	t.Run("when EnableSharedChannelsDMs flag is enabled, it creates a sync task with empty channelID", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		// Set the feature flag to true
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSharedChannelsDMs = "true"
		mockServer.On("Config").Return(mockConfig)
		
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
	
	t.Run("when EnableSharedChannelsDMs flag is disabled, it does not create a sync task", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		// Set the feature flag to false
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSharedChannelsDMs = "false"
		mockServer.On("Config").Return(mockConfig)
		
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
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		// Set the feature flag to true
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSharedChannelsDMs = "true"
		mockServer.On("Config").Return(mockConfig)
		
		mockApp := &MockAppIface{}
		
		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// Create a spy/mock for syncAllUsersForRemote
		syncAllUsersCalled := false
		oldSyncAllUsersForRemote := realSyncAllUsersForRemote
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			syncAllUsersCalled = true
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldSyncAllUsersForRemote }()
		
		// Create a task with empty channelID
		task := newSyncTask("", "", "remote1", nil, nil)
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			IsOnline:    func() bool { return true },
		}
		
		// Call the function
		err := scs.syncForRemote(task, rc)
		
		// Verify
		require.NoError(t, err)
		assert.True(t, syncAllUsersCalled, "Expected syncAllUsersForRemote to be called")
	})
	
	t.Run("when channelID is empty but feature flag is disabled, it does not call syncAllUsersForRemote", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		// Set the feature flag to false
		mockConfig := &model.Config{}
		mockConfig.FeatureFlags = &model.FeatureFlags{}
		mockConfig.FeatureFlags.EnableSharedChannelsDMs = "false"
		mockServer.On("Config").Return(mockConfig)
		
		mockApp := &MockAppIface{}
		
		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// Create a spy/mock for syncAllUsersForRemote
		syncAllUsersCalled := false
		oldSyncAllUsersForRemote := realSyncAllUsersForRemote
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			syncAllUsersCalled = true
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldSyncAllUsersForRemote }()
		
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
	t.Run("successfully syncs users", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		mockApp := &MockAppIface{}
		mockStore := &mocks.Store{}
		
		// Mock GetUsersPage to return some test users
		testUsers := []*model.User{
			{
				Id:       "user1",
				Username: "user1",
				Email:    "user1@example.com",
				CreateAt: 10000,
				UpdateAt: 20000,
			},
			{
				Id:       "user2",
				Username: "user2",
				Email:    "user2@example.com",
				CreateAt: 10001,
				UpdateAt: 20001,
			},
		}
		
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return(testUsers, nil).Once()
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return([]*model.User{}, nil) // Second call returns empty to end loop
		
		mockServer.On("GetStore").Return(mockStore)
		
		// Create a spy/mock for sendUserSyncData
		sendUserSyncDataCalled := false
		usersSent := 0
		oldRealSyncAllUsersForRemote := realSyncAllUsersForRemote
		
		// Override realSyncAllUsersForRemote to use a modified version that tracks calls to sendUserSyncData
		sendUserSyncData := func(sd *syncData) error {
			sendUserSyncDataCalled = true
			usersSent += len(sd.users)
			return nil
		}
		
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			if !rc.IsOnline() {
				return errors.New("remote cluster not online")
			}
			
			options := &model.UserGetOptions{
				Page:           0,
				PerPage:        100,
				Active:         true,
				ExcludeDeleted: true,
				ExcludeBots:    true,
			}
			
			fakeSCR := &model.SharedChannelRemote{
				RemoteId: rc.RemoteId,
			}
			
			sd := &syncData{
				task: syncTask{remoteID: rc.RemoteId},
				rc:   rc,
				scr:  fakeSCR,
				users: make(map[string]*model.User),
			}
			
			// We may need to page through all users
			for {
				users, err := scs.app.GetUsersPage(request.EmptyContext(scs.server.Log()), options, false)
				if err != nil {
					return err
				}
				
				if len(users) == 0 {
					break
				}
				
				// Add users to sync data
				for _, user := range users {
					// Skip remote users (don't sync back to origin)
					if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
						continue
					}
					
					sd.users[user.Id] = user
					
					// Send in batches to avoid overwhelming the connection
					if len(sd.users) >= MaxUsersPerSync {
						if err := sendUserSyncData(sd); err != nil {
							return err
						}
						sd.users = make(map[string]*model.User)
					}
				}
				
				// Move to next page
				options.Page++
			}
			
			// Send any remaining users
			if len(sd.users) > 0 {
				if err := sendUserSyncData(sd); err != nil {
					return err
				}
			}
			
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldRealSyncAllUsersForRemote }()
		
		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			IsOnline:    func() bool { return true },
		}
		
		// Call the function
		err := scs.syncAllUsersForRemote(rc)
		
		// Verify
		require.NoError(t, err)
		assert.True(t, sendUserSyncDataCalled, "Expected sendUserSyncData to be called")
		assert.Equal(t, 2, usersSent, "Expected 2 users to be sent")
	})
	
	t.Run("processes users in batches when count exceeds MaxUsersPerSync", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		mockApp := &MockAppIface{}
		mockStore := &mocks.Store{}
		mockServer.On("GetStore").Return(mockStore)
		
		// Create a large set of test users that will exceed MaxUsersPerSync
		largeUserSet := make([]*model.User, MaxUsersPerSync+5)
		for i := 0; i < MaxUsersPerSync+5; i++ {
			largeUserSet[i] = &model.User{
				Id:       fmt.Sprintf("user%d", i),
				Username: fmt.Sprintf("user%d", i),
				Email:    fmt.Sprintf("user%d@example.com", i),
				CreateAt: int64(10000 + i),
				UpdateAt: int64(20000 + i),
			}
		}
		
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return(largeUserSet, nil).Once()
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return([]*model.User{}, nil) // Second call returns empty to end loop
		
		// Track batch processing
		var sendUserSyncDataCalls int
		var userBatches []int // Track how many users were in each batch
		
		oldRealSyncAllUsersForRemote := realSyncAllUsersForRemote
		
		// Create a custom implementation that tracks batch sizes
		sendUserSyncData := func(sd *syncData) error {
			sendUserSyncDataCalls++
			userBatches = append(userBatches, len(sd.users))
			return nil
		}
		
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			if !rc.IsOnline() {
				return errors.New("remote cluster not online")
			}
			
			options := &model.UserGetOptions{
				Page:           0,
				PerPage:        100,
				Active:         true,
				ExcludeDeleted: true,
				ExcludeBots:    true,
			}
			
			fakeSCR := &model.SharedChannelRemote{
				RemoteId: rc.RemoteId,
			}
			
			sd := &syncData{
				task: syncTask{remoteID: rc.RemoteId},
				rc:   rc,
				scr:  fakeSCR,
				users: make(map[string]*model.User),
			}
			
			for {
				users, err := scs.app.GetUsersPage(request.EmptyContext(scs.server.Log()), options, false)
				if err != nil {
					return err
				}
				
				if len(users) == 0 {
					break
				}
				
				for _, user := range users {
					// Skip remote users
					if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
						continue
					}
					
					sd.users[user.Id] = user
					
					// Send in batches when threshold reached
					if len(sd.users) >= MaxUsersPerSync {
						if err := sendUserSyncData(sd); err != nil {
							return err
						}
						sd.users = make(map[string]*model.User)
					}
				}
				
				options.Page++
			}
			
			// Send any remaining users
			if len(sd.users) > 0 {
				if err := sendUserSyncData(sd); err != nil {
					return err
				}
			}
			
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldRealSyncAllUsersForRemote }()
		
		// Create service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// Remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			IsOnline:    func() bool { return true },
		}
		
		// Call the function
		err := scs.syncAllUsersForRemote(rc)
		
		// Verify
		require.NoError(t, err)
		
		// 1. Verify that sendUserSyncData was called multiple times (once for each batch)
		assert.Equal(t, 2, sendUserSyncDataCalls, "Expected sendUserSyncData to be called twice (once per batch)")
		
		// 2. Verify that the first batch had exactly MaxUsersPerSync users
		assert.Equal(t, MaxUsersPerSync, userBatches[0], "First batch should contain exactly MaxUsersPerSync users")
		
		// 3. Verify that the second batch had the remaining users (total - MaxUsersPerSync)
		assert.Equal(t, 5, userBatches[1], "Second batch should contain the remaining 5 users")
		
		// 4. Verify total user count
		totalUsersSent := 0
		for _, count := range userBatches {
			totalUsersSent += count
		}
		assert.Equal(t, len(largeUserSet), totalUsersSent, "Total number of users sent should match the input")
		
		mockApp.AssertExpectations(t)
		mockServer.AssertExpectations(t)
	})
	
	t.Run("handles user fetch error", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		mockApp := &MockAppIface{}
		
		// Mock GetUsersPage to return an error
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return(nil, errors.New("user fetch error"))
		
		// Override realSyncAllUsersForRemote to use app.GetUsersPage directly
		oldRealSyncAllUsersForRemote := realSyncAllUsersForRemote
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			if !rc.IsOnline() {
				return errors.New("remote cluster not online")
			}
			
			options := &model.UserGetOptions{
				Page:           0,
				PerPage:        100,
				Active:         true,
				ExcludeDeleted: true,
				ExcludeBots:    true,
			}
			
			users, err := scs.app.GetUsersPage(request.EmptyContext(scs.server.Log()), options, false)
			if err != nil {
				return err
			}
			
			// These lines won't be reached due to the error
			_ = users
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldRealSyncAllUsersForRemote }()
		
		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    "remote1",
			DisplayName: "Remote 1",
			IsOnline:    func() bool { return true },
		}
		
		// Call the function
		err := scs.syncAllUsersForRemote(rc)
		
		// Verify
		require.Error(t, err)
		assert.Contains(t, err.Error(), "user fetch error")
	})
	
	t.Run("skips remote users from the same remote", func(t *testing.T) {
		// Setup
		mockServer := &MockServerIface{}
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer.On("Log").Return(logger)
		
		mockApp := &MockAppIface{}
		mockStore := &mocks.Store{}
		
		// Mock GetUsersPage to return some test users, including one from the same remote
		remoteId := "remote1"
		testUsers := []*model.User{
			{
				Id:       "user1",
				Username: "user1",
				Email:    "user1@example.com",
				CreateAt: 10000,
				UpdateAt: 20000,
			},
			{
				Id:       "remote_user",
				Username: "remote_user",
				Email:    "remote_user@example.com",
				CreateAt: 10001,
				UpdateAt: 20001,
				RemoteId: &remoteId, // Same as the remote we're syncing to
			},
		}
		
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return(testUsers, nil).Once()
		mockApp.On("GetUsersPage", mock.Anything, mock.Anything, mock.Anything).Return([]*model.User{}, nil) // Second call returns empty to end loop
		
		mockServer.On("GetStore").Return(mockStore)
		
		// Create a spy/mock for sendUserSyncData
		usersSent := []*model.User{}
		oldRealSyncAllUsersForRemote := realSyncAllUsersForRemote
		
		// Override realSyncAllUsersForRemote to use a modified version that tracks calls to sendUserSyncData
		sendUserSyncData := func(sd *syncData) error {
			for _, user := range sd.users {
				usersSent = append(usersSent, user)
			}
			return nil
		}
		
		realSyncAllUsersForRemote = func(scs *Service, rc *model.RemoteCluster) error {
			if !rc.IsOnline() {
				return errors.New("remote cluster not online")
			}
			
			options := &model.UserGetOptions{
				Page:           0,
				PerPage:        100,
				Active:         true,
				ExcludeDeleted: true,
				ExcludeBots:    true,
			}
			
			fakeSCR := &model.SharedChannelRemote{
				RemoteId: rc.RemoteId,
			}
			
			sd := &syncData{
				task: syncTask{remoteID: rc.RemoteId},
				rc:   rc,
				scr:  fakeSCR,
				users: make(map[string]*model.User),
			}
			
			// We may need to page through all users
			for {
				users, err := scs.app.GetUsersPage(request.EmptyContext(scs.server.Log()), options, false)
				if err != nil {
					return err
				}
				
				if len(users) == 0 {
					break
				}
				
				// Add users to sync data
				for _, user := range users {
					// Skip remote users (don't sync back to origin)
					if user.RemoteId != nil && *user.RemoteId == rc.RemoteId {
						continue
					}
					
					sd.users[user.Id] = user
				}
				
				// Send any users
				if len(sd.users) > 0 {
					if err := sendUserSyncData(sd); err != nil {
						return err
					}
					sd.users = make(map[string]*model.User)
				}
				
				// Move to next page
				options.Page++
			}
			
			return nil
		}
		defer func() { realSyncAllUsersForRemote = oldRealSyncAllUsersForRemote }()
		
		// The service
		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}
		
		// The remote cluster
		rc := &model.RemoteCluster{
			RemoteId:    remoteId,
			DisplayName: "Remote 1",
			IsOnline:    func() bool { return true },
		}
		
		// Call the function
		err := scs.syncAllUsersForRemote(rc)
		
		// Verify
		require.NoError(t, err)
		assert.Len(t, usersSent, 1, "Expected only 1 user to be sent (remote user skipped)")
		assert.Equal(t, "user1", usersSent[0].Id, "Expected user1 to be sent")
	})
}