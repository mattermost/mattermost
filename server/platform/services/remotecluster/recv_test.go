// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package remotecluster

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// TestReceiveInviteConfirmation_TokenInvalidation tests that the invite token is properly
// invalidated after the first successful confirmation, preventing token reuse attacks.
// This addresses the security vulnerability described in MM-65152.
func TestReceiveInviteConfirmation_TokenInvalidation(t *testing.T) {
	t.Run("Protocol v2+ with RefreshedToken - token is rotated", func(t *testing.T) {
		// Setup
		originalToken := model.NewId()
		refreshedToken := model.NewId()
		remoteId := model.NewId()

		originalRC := &model.RemoteCluster{
			RemoteId: remoteId,
			Token:    originalToken,
			SiteURL:  model.SiteURLPending + model.NewId(),
			CreateAt: model.GetMillis(),
		}

		// Mock store
		remoteClusterStoreMock := &mocks.RemoteClusterStore{}
		remoteClusterStoreMock.On("Get", remoteId, false).Return(originalRC, nil)

		// Capture the Update call to verify the token was rotated
		var capturedRC *model.RemoteCluster
		remoteClusterStoreMock.On("Update", mock.AnythingOfType("*model.RemoteCluster")).Run(func(args mock.Arguments) {
			capturedRC = args.Get(0).(*model.RemoteCluster)
		}).Return(func(rc *model.RemoteCluster) *model.RemoteCluster {
			return rc
		}, nil)

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		// Create invite confirmation with protocol v2+ (includes RefreshedToken)
		confirm := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://example.com",
			Token:          model.NewId(),
			RefreshedToken: refreshedToken,
			Version:        3, // v3 protocol
		}

		// Execute
		rcUpdated, err := service.ReceiveInviteConfirmation(confirm)

		// Assert
		require.NoError(t, err)
		require.NotNil(t, rcUpdated)
		require.NotNil(t, capturedRC, "Update should have been called")

		assert.Equal(t, refreshedToken, capturedRC.Token, "Token should be rotated to RefreshedToken")
		assert.NotEqual(t, originalToken, capturedRC.Token, "Original invite token should be invalidated")
		assert.Equal(t, remoteId, capturedRC.RemoteId, "RemoteId should be preserved")

		remoteClusterStoreMock.AssertExpectations(t)
	})

	t.Run("Protocol v1 or no RefreshedToken - token is regenerated", func(t *testing.T) {
		// Setup
		originalToken := model.NewId()
		remoteId := model.NewId()

		originalRC := &model.RemoteCluster{
			RemoteId: remoteId,
			Token:    originalToken,
			SiteURL:  model.SiteURLPending + model.NewId(),
			CreateAt: model.GetMillis(),
		}

		// Mock store
		remoteClusterStoreMock := &mocks.RemoteClusterStore{}
		remoteClusterStoreMock.On("Get", remoteId, false).Return(originalRC, nil)

		// Capture what Update was called with for explicit assertions
		var capturedRC *model.RemoteCluster
		remoteClusterStoreMock.On("Update", mock.AnythingOfType("*model.RemoteCluster")).Run(func(args mock.Arguments) {
			capturedRC = args.Get(0).(*model.RemoteCluster)
		}).Return(func(rc *model.RemoteCluster) *model.RemoteCluster {
			return rc
		}, nil)

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		// Create invite confirmation WITHOUT RefreshedToken (protocol v1)
		confirm := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://example.com",
			Token:          model.NewId(),
			RefreshedToken: "", // No refreshed token
			Version:        1,  // v1 protocol
		}

		// Execute
		rcUpdated, err := service.ReceiveInviteConfirmation(confirm)

		// Assert
		require.NoError(t, err)
		require.NotNil(t, rcUpdated)
		require.NotNil(t, capturedRC, "Update should have been called")

		assert.NotEmpty(t, capturedRC.Token, "Token should be set")
		assert.NotEqual(t, originalToken, capturedRC.Token, "Original invite token must be invalidated")
		assert.Len(t, capturedRC.Token, 26, "New token should be a valid ID (26 chars)")
		assert.Equal(t, remoteId, capturedRC.RemoteId, "RemoteId should be preserved")

		remoteClusterStoreMock.AssertExpectations(t)
	})

	t.Run("Already confirmed cluster - returns error", func(t *testing.T) {
		// Setup - cluster is already confirmed (has a real SiteURL)
		remoteId := model.NewId()
		confirmedRC := &model.RemoteCluster{
			RemoteId: remoteId,
			Token:    model.NewId(),
			SiteURL:  "http://already-confirmed.com", // NOT a pending URL
			CreateAt: model.GetMillis(),
		}

		// Mock store
		remoteClusterStoreMock := &mocks.RemoteClusterStore{}
		remoteClusterStoreMock.On("Get", remoteId, false).Return(confirmedRC, nil)
		// Update should NOT be called

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		confirm := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://attacker.com",
			Token:          model.NewId(),
			RefreshedToken: model.NewId(),
			Version:        3,
		}

		// Execute
		rcUpdated, err := service.ReceiveInviteConfirmation(confirm)

		// Assert
		require.Error(t, err, "Should return error for already confirmed cluster")
		assert.Nil(t, rcUpdated)
		assert.Contains(t, err.Error(), "already been confirmed",
			"Error should indicate cluster is already confirmed")

		// Verify Update was NOT called (token reuse prevented)
		remoteClusterStoreMock.AssertNotCalled(t, "Update", mock.Anything)
	})

	t.Run("Token reuse scenario - second confirmation with old token fails", func(t *testing.T) {
		// This test simulates the security vulnerability:
		// 1. First confirmation succeeds and rotates token
		// 2. Attacker tries to reuse the old token
		// 3. Second confirmation should fail because token was rotated

		originalToken := model.NewId()
		newToken := model.NewId()
		remoteId := model.NewId()

		// Initial state - unconfirmed cluster
		originalRC := &model.RemoteCluster{
			RemoteId: remoteId,
			Token:    originalToken,
			SiteURL:  model.SiteURLPending + model.NewId(),
			CreateAt: model.GetMillis(),
		}

		// After first confirmation - token has been rotated
		confirmedRC := &model.RemoteCluster{
			RemoteId:    remoteId,
			Token:       newToken, // Token was rotated
			RemoteToken: model.NewId(),
			SiteURL:     "http://legitimate.com",
			CreateAt:    model.GetMillis(),
		}

		// Mock store
		remoteClusterStoreMock := &mocks.RemoteClusterStore{}

		// First call: return unconfirmed cluster
		remoteClusterStoreMock.On("Get", remoteId, false).Return(originalRC, nil).Once()

		// First update: rotate token
		remoteClusterStoreMock.On("Update", mock.MatchedBy(func(rc *model.RemoteCluster) bool {
			return rc.RemoteId == remoteId
		})).Return(confirmedRC, nil).Once()

		// Second call: return confirmed cluster with new token
		remoteClusterStoreMock.On("Get", remoteId, false).Return(confirmedRC, nil).Once()

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		// First confirmation (legitimate)
		confirm1 := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://legitimate.com",
			Token:          model.NewId(),
			RefreshedToken: newToken,
			Version:        3,
		}

		rcUpdated, err := service.ReceiveInviteConfirmation(confirm1)
		require.NoError(t, err)
		require.NotNil(t, rcUpdated)
		assert.Equal(t, newToken, rcUpdated.Token, "Token should be rotated after first confirmation")

		// Second confirmation attempt (attacker trying to reuse invite)
		confirm2 := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://attacker.com", // Attacker's malicious URL
			Token:          originalToken,         // Reusing OLD token from original invite
			RefreshedToken: model.NewId(),
			Version:        3,
		}

		rcUpdated2, err := service.ReceiveInviteConfirmation(confirm2)

		// Assert: Second confirmation should fail
		require.Error(t, err, "Second confirmation should fail - cluster already confirmed")
		assert.Nil(t, rcUpdated2, "No cluster should be returned on failed reuse attempt")
		assert.Contains(t, err.Error(), "already been confirmed",
			"Should indicate cluster already confirmed, preventing token reuse")

		remoteClusterStoreMock.AssertExpectations(t)
	})
}

// TestReceiveInviteConfirmation_EdgeCases tests various edge cases
func TestReceiveInviteConfirmation_EdgeCases(t *testing.T) {
	t.Run("Non-existent remote ID", func(t *testing.T) {
		remoteId := model.NewId()

		remoteClusterStoreMock := &mocks.RemoteClusterStore{}
		remoteClusterStoreMock.On("Get", remoteId, false).Return(nil, &model.AppError{
			Message: "not found",
		})

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		confirm := model.RemoteClusterInvite{
			RemoteId: remoteId,
			SiteURL:  "http://example.com",
			Token:    model.NewId(),
			Version:  3,
		}

		rcUpdated, err := service.ReceiveInviteConfirmation(confirm)

		require.Error(t, err)
		assert.Nil(t, rcUpdated)
		assert.Contains(t, err.Error(), "cannot accept invite confirmation")
	})

	t.Run("Protocol v2+ with empty RefreshedToken - falls back to NewId", func(t *testing.T) {
		originalToken := model.NewId()
		remoteId := model.NewId()

		originalRC := &model.RemoteCluster{
			RemoteId: remoteId,
			Token:    originalToken,
			SiteURL:  model.SiteURLPending + model.NewId(),
			CreateAt: model.GetMillis(),
		}

		remoteClusterStoreMock := &mocks.RemoteClusterStore{}
		remoteClusterStoreMock.On("Get", remoteId, false).Return(originalRC, nil)

		// Capture what Update was called with for explicit assertions
		var capturedRC *model.RemoteCluster
		remoteClusterStoreMock.On("Update", mock.AnythingOfType("*model.RemoteCluster")).Run(func(args mock.Arguments) {
			capturedRC = args.Get(0).(*model.RemoteCluster)
		}).Return(func(rc *model.RemoteCluster) *model.RemoteCluster {
			return rc
		}, nil)

		storeMock := &mocks.Store{}
		storeMock.On("RemoteCluster").Return(remoteClusterStoreMock)

		mockServer := newMockServerWithStore(t, storeMock)
		mockApp := newMockApp(t, nil)
		service, err := NewRemoteClusterService(mockServer, mockApp)
		require.NoError(t, err)

		// v3 protocol but RefreshedToken is empty
		confirm := model.RemoteClusterInvite{
			RemoteId:       remoteId,
			SiteURL:        "http://example.com",
			Token:          model.NewId(),
			RefreshedToken: "", // Empty - should trigger fallback
			Version:        3,
		}

		rcUpdated, err := service.ReceiveInviteConfirmation(confirm)

		require.NoError(t, err)
		require.NotNil(t, rcUpdated)
		require.NotNil(t, capturedRC, "Update should have been called")

		assert.NotEqual(t, originalToken, capturedRC.Token, "Original token should be invalidated")
		assert.Len(t, capturedRC.Token, 26, "Should generate new token via fallback (26 chars)")
		assert.Equal(t, remoteId, capturedRC.RemoteId, "RemoteId should be preserved")

		remoteClusterStoreMock.AssertExpectations(t)
	})
}
