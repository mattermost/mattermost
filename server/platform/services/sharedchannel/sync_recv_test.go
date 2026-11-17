// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"net/http"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestProcessSyncMessage(t *testing.T) {
	remoteID := model.NewId()
	channelID := model.NewId()
	rc := &model.RemoteCluster{
		RemoteId: remoteID,
		Name:     "test-remote",
	}

	makeConfig := func() *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		return cfg
	}

	t.Run("returns SyncResponse directly for empty sync message", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(true, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Empty(t, resp.PostErrors)
		assert.Empty(t, resp.UserErrors)
	})

	t.Run("returns error when channel not found", func(t *testing.T) {
		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(nil, store.NewErrNotFound("Channel", channelID))

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "channel not found")
	})

	t.Run("returns error when channel not shared with remote", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(false, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrChannelNotShared)
	})

	t.Run("returns error for global user sync with posts", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: "", // global user sync
			Posts:     []*model.Post{{Id: model.NewId()}},
		}

		_, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "should not contain posts")
	})

	t.Run("returns empty response for global user sync with no users", func(t *testing.T) {
		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: "", // global user sync
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Empty(t, resp.UsersSyncd)
	})

	t.Run("post with mismatched channelID is reported in PostErrors", func(t *testing.T) {
		channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}
		wrongChannelID := model.NewId()
		postID := model.NewId()

		mockChannelStore := &mocks.ChannelStore{}
		mockChannelStore.On("Get", channelID, true).Return(channel, nil)

		mockSCStore := &mocks.SharedChannelStore{}
		mockSCStore.On("HasRemote", channelID, remoteID).Return(true, nil)

		mockStore := &mocks.Store{}
		mockStore.On("Channel").Return(mockChannelStore)
		mockStore.On("SharedChannel").Return(mockSCStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)
		mockServer.On("Config").Return(makeConfig())

		scs := &Service{server: mockServer}

		syncMsg := &model.SyncMsg{
			ChannelId: channelID,
			Posts: []*model.Post{
				{Id: postID, ChannelId: wrongChannelID},
			},
		}

		resp, err := scs.ProcessSyncMessage(request.TestContext(t), syncMsg, rc)
		require.NoError(t, err)
		assert.Contains(t, resp.PostErrors, postID)
	})
}

func TestUpsertSyncUserStatus(t *testing.T) {
	setup := func(remoteID string, user *model.User) (*Service, *MockAppIface, *model.Status, *model.RemoteCluster) {
		var userID string
		if user == nil {
			userID = model.NewId()
		} else {
			userID = user.Id
		}

		status := &model.Status{
			UserId: userID,
			Status: model.StatusDnd,
		}
		remoteCluster := &model.RemoteCluster{
			RemoteId: remoteID,
			Name:     "test-remote",
		}

		mockUserStore := &mocks.UserStore{}
		if user == nil {
			mockUserStore.On("Get", mockTypeContext, mock.Anything).Return(nil, store.NewErrNotFound("User", userID))
		} else {
			mockUserStore.On("Get", mockTypeContext, user.Id).Return(user, nil)
		}

		mockStore := &mocks.Store{}
		mockStore.On("User").Return(mockUserStore)

		logger := mlog.CreateConsoleTestLogger(t)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)

		mockApp := &MockAppIface{}
		mockApp.On("SaveAndBroadcastStatus", status).Return()

		scs := &Service{
			server: mockServer,
			app:    mockApp,
		}

		return scs, mockApp, status, remoteCluster
	}

	t.Run("should broadcast changes to a remote user's status", func(t *testing.T) {
		remoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: new(remoteID),
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		err := scs.upsertSyncUserStatus(request.TestContext(t), status, remoteCluster)

		require.NoError(t, err)
		mockApp.AssertCalled(t, "SaveAndBroadcastStatus", status)
	})

	t.Run("should return an error when the user doesn't exist locally", func(t *testing.T) {
		remoteID := model.NewId()
		var user *model.User

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.Contains(t, err.Error(), "error getting user when syncing status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})

	t.Run("should return an error when attempting to sync a local user", func(t *testing.T) {
		remoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: nil,
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		assert.Contains(t, err.Error(), "error updating user status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})

	t.Run("should return an error when attempting to sync a user from a different remote", func(t *testing.T) {
		remoteID := model.NewId()
		anotherRemoteID := model.NewId()
		user := &model.User{
			Id:       model.NewId(),
			RemoteId: new(anotherRemoteID),
		}

		scs, mockApp, status, remoteCluster := setup(remoteID, user)

		rctx := request.TestContext(t)
		err := scs.upsertSyncUserStatus(rctx, status, remoteCluster)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		assert.Contains(t, err.Error(), "error updating user status")
		mockApp.AssertNotCalled(t, "SaveAndBroadcastStatus")
	})
}

func TestUpsertSyncPost(t *testing.T) {
	remoteID := model.NewId()
	channelID := model.NewId()
	channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}
	rc := &model.RemoteCluster{RemoteId: remoteID, Name: "test-remote"}

	setup := func(t *testing.T, existing *model.Post) (*Service, *MockAppIface, *mocks.PostAcknowledgementStore) {
		mockPostStore := &mocks.PostStore{}
		mockPostStore.On("GetSingle", mock.Anything, existing.Id, true).Return(existing, nil)

		mockAckStore := &mocks.PostAcknowledgementStore{}

		mockUserStore := &mocks.UserStore{}
		mockUserStore.On("Get", mock.Anything, mock.Anything).Return(nil, store.NewErrNotFound("User", "unknown"))

		mockStore := &mocks.Store{}
		mockStore.On("Post").Return(mockPostStore)
		mockStore.On("PostAcknowledgement").Return(mockAckStore)
		mockStore.On("User").Return(mockUserStore)

		logger := mlog.CreateConsoleTestLogger(t)
		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(logger)

		mockApp := &MockAppIface{}

		return &Service{server: mockServer, app: mockApp}, mockApp, mockAckStore
	}

	t.Run("rejects edit of a post owned by a different remote", func(t *testing.T) {
		otherRemoteID := model.NewId()
		postID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", RemoteId: new(otherRemoteID)}

		scs, mockApp, _ := setup(t, existing)

		_, err := scs.upsertSyncPost(&model.Post{Id: postID, ChannelId: channelID, Message: "tampered"}, channel, rc, nil)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		mockApp.AssertNotCalled(t, "UpdatePost", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("rejects delete of a post owned by a local user", func(t *testing.T) {
		postID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", RemoteId: nil}

		scs, mockApp, _ := setup(t, existing)

		_, err := scs.upsertSyncPost(&model.Post{Id: postID, ChannelId: channelID, DeleteAt: model.GetMillis()}, channel, rc, nil)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrRemoteIDMismatch)
		mockApp.AssertNotCalled(t, "DeletePost", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("allows edit of a post owned by the sending remote", func(t *testing.T) {
		postID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", RemoteId: new(remoteID)}

		scs, mockApp, _ := setup(t, existing)
		updated := &model.Post{Id: postID, ChannelId: channelID, Message: "updated"}
		// A federated, remote-owned edit must be allowed to carry mm_blocks_actions
		// changes through the UpdatePost freeze — the origin cluster is the trust
		// boundary. Assert the option is set so a revert to nil options is caught.
		allowsMmBlocks := mock.MatchedBy(func(opts *model.UpdatePostOptions) bool {
			return opts != nil && opts.AllowMmBlocksActionsUpdate
		})
		mockApp.On("UpdatePost", mock.Anything, mock.Anything, allowsMmBlocks).Return(updated, false, (*model.AppError)(nil))

		_, err := scs.upsertSyncPost(&model.Post{Id: postID, ChannelId: channelID, Message: "updated"}, channel, rc, nil)

		require.NoError(t, err)
		mockApp.AssertCalled(t, "UpdatePost", mock.Anything, mock.Anything, allowsMmBlocks)
	})

	t.Run("ignores a re-sent unchanged post with a rewritten mention", func(t *testing.T) {
		postID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "hello @admin:test-remote", RemoteId: new(remoteID)}

		scs, mockApp, _ := setup(t, existing)
		mockApp.On("UpdatePost", mock.Anything, mock.Anything, mock.Anything).Return(existing, false, (*model.AppError)(nil))

		resent := &model.Post{Id: postID, ChannelId: channelID, Message: "hello @admin"}
		_, err := scs.upsertSyncPost(resent, channel, rc, map[string]string{"admin": model.NewId()})

		require.NoError(t, err)
		mockApp.AssertNotCalled(t, "UpdatePost", mock.Anything, mock.Anything, mock.Anything)
	})

	t.Run("rewrites mentions exactly once on edit", func(t *testing.T) {
		postID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "hello @admin:test-remote", RemoteId: new(remoteID)}

		scs, mockApp, _ := setup(t, existing)
		rewritten := mock.MatchedBy(func(p *model.Post) bool {
			return p.Message == "bye @admin:test-remote"
		})
		mockApp.On("UpdatePost", mock.Anything, rewritten, mock.Anything).Return(existing, false, (*model.AppError)(nil))

		edited := &model.Post{Id: postID, ChannelId: channelID, Message: "bye @admin"}
		_, err := scs.upsertSyncPost(edited, channel, rc, map[string]string{"admin": model.NewId()})

		require.NoError(t, err)
		mockApp.AssertCalled(t, "UpdatePost", mock.Anything, rewritten, mock.Anything)
	})

	// The sender re-sends every post on each sync. A write on receive gives the post or its
	// acknowledgements a new timestamp, and the next sync sends them back to the sender.
	t.Run("re-sent post with unchanged acknowledgements writes nothing", func(t *testing.T) {
		postID := model.NewId()
		userID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", UpdateAt: 100, RemoteId: new(remoteID)}
		existingAcks := []*model.PostAcknowledgement{
			{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 50, RemoteId: new(remoteID)},
		}

		scs, mockApp, mockAckStore := setup(t, existing)
		mockApp.On("GetAcknowledgementsForPost", postID).Return(existingAcks, (*model.AppError)(nil))

		resent := &model.Post{
			Id:        postID,
			ChannelId: channelID,
			Message:   "original",
			UpdateAt:  100,
			Metadata: &model.PostMetadata{Acknowledgements: []*model.PostAcknowledgement{
				{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 50},
			}},
		}

		rpost, err := scs.upsertSyncPost(resent, channel, rc, nil)

		require.NoError(t, err)
		require.NotNil(t, rpost.Metadata)
		assert.Equal(t, existingAcks, rpost.Metadata.Acknowledgements)
		mockApp.AssertNotCalled(t, "UpdatePost", mock.Anything, mock.Anything, mock.Anything)
		mockApp.AssertNotCalled(t, "SaveAcknowledgementsForPost", mock.Anything, mock.Anything, mock.Anything)
		mockAckStore.AssertNotCalled(t, "BatchDelete", mock.Anything)
	})

	t.Run("re-sent post with a new acknowledgement replaces acknowledgements only", func(t *testing.T) {
		postID := model.NewId()
		existingUserID := model.NewId()
		newUserID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", UpdateAt: 100, RemoteId: new(remoteID)}
		existingAcks := []*model.PostAcknowledgement{
			{PostId: postID, UserId: existingUserID, ChannelId: channelID, AcknowledgedAt: 50},
		}
		savedAcks := []*model.PostAcknowledgement{
			{PostId: postID, UserId: existingUserID, ChannelId: channelID, AcknowledgedAt: 200},
			{PostId: postID, UserId: newUserID, ChannelId: channelID, AcknowledgedAt: 200},
		}

		scs, mockApp, mockAckStore := setup(t, existing)
		mockApp.On("GetAcknowledgementsForPost", postID).Return(existingAcks, (*model.AppError)(nil))
		mockAckStore.On("BatchDelete", existingAcks).Return(nil)
		mockApp.On("SaveAcknowledgementsForPost", mock.Anything, postID, []string{existingUserID, newUserID}).Return(savedAcks, (*model.AppError)(nil))

		resent := &model.Post{
			Id:        postID,
			ChannelId: channelID,
			Message:   "original",
			UpdateAt:  100,
			Metadata: &model.PostMetadata{Acknowledgements: []*model.PostAcknowledgement{
				{PostId: postID, UserId: existingUserID, ChannelId: channelID, AcknowledgedAt: 50},
				{PostId: postID, UserId: newUserID, ChannelId: channelID, AcknowledgedAt: 60},
			}},
		}

		rpost, err := scs.upsertSyncPost(resent, channel, rc, nil)

		require.NoError(t, err)
		require.NotNil(t, rpost.Metadata)
		assert.Equal(t, savedAcks, rpost.Metadata.Acknowledgements)
		mockApp.AssertNotCalled(t, "UpdatePost", mock.Anything, mock.Anything, mock.Anything)
		mockAckStore.AssertCalled(t, "BatchDelete", existingAcks)
		mockApp.AssertCalled(t, "SaveAcknowledgementsForPost", mock.Anything, postID, []string{existingUserID, newUserID})
	})

	t.Run("failed acknowledgement lookup saves received acknowledgements without deleting", func(t *testing.T) {
		postID := model.NewId()
		userID := model.NewId()
		existing := &model.Post{Id: postID, ChannelId: channelID, Message: "original", UpdateAt: 100, RemoteId: new(remoteID)}
		savedAcks := []*model.PostAcknowledgement{
			{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 200},
		}

		scs, mockApp, mockAckStore := setup(t, existing)
		mockApp.On("GetAcknowledgementsForPost", postID).Return(nil, model.NewAppError("test", "test.error", nil, "", http.StatusInternalServerError))
		mockApp.On("SaveAcknowledgementsForPost", mock.Anything, postID, []string{userID}).Return(savedAcks, (*model.AppError)(nil))

		resent := &model.Post{
			Id:        postID,
			ChannelId: channelID,
			Message:   "original",
			UpdateAt:  100,
			Metadata: &model.PostMetadata{Acknowledgements: []*model.PostAcknowledgement{
				{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 50},
			}},
		}

		rpost, err := scs.upsertSyncPost(resent, channel, rc, nil)

		require.NoError(t, err)
		require.NotNil(t, rpost.Metadata)
		assert.Equal(t, savedAcks, rpost.Metadata.Acknowledgements)
		mockAckStore.AssertNotCalled(t, "BatchDelete", mock.Anything)
		mockApp.AssertCalled(t, "SaveAcknowledgementsForPost", mock.Anything, postID, []string{userID})
	})
}

func TestSameAcknowledgedUsers(t *testing.T) {
	userA := model.NewId()
	userB := model.NewId()
	ack := func(userID string, acknowledgedAt int64) *model.PostAcknowledgement {
		return &model.PostAcknowledgement{UserId: userID, AcknowledgedAt: acknowledgedAt}
	}

	testCases := []struct {
		name     string
		existing []*model.PostAcknowledgement
		received []*model.PostAcknowledgement
		expected bool
	}{
		{"both empty", nil, nil, true},
		{"same users with different timestamps", []*model.PostAcknowledgement{ack(userA, 1), ack(userB, 2)}, []*model.PostAcknowledgement{ack(userB, 9), ack(userA, 8)}, true},
		{"received adds a user", []*model.PostAcknowledgement{ack(userA, 1)}, []*model.PostAcknowledgement{ack(userA, 1), ack(userB, 2)}, false},
		{"received drops a user", []*model.PostAcknowledgement{ack(userA, 1), ack(userB, 2)}, []*model.PostAcknowledgement{ack(userA, 1)}, false},
		{"received has a different user", []*model.PostAcknowledgement{ack(userA, 1)}, []*model.PostAcknowledgement{ack(userB, 2)}, false},
		{"withdrawn received acknowledgement is ignored", []*model.PostAcknowledgement{ack(userA, 1)}, []*model.PostAcknowledgement{ack(userA, 1), ack(userB, 0)}, true},
		{"received withdraws the only acknowledgement", []*model.PostAcknowledgement{ack(userA, 1)}, []*model.PostAcknowledgement{ack(userA, 0)}, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, sameAcknowledgedUsers(tc.existing, tc.received))
		})
	}
}

func TestUpsertSyncAcknowledgement(t *testing.T) {
	remoteID := model.NewId()
	channelID := model.NewId()
	postID := model.NewId()
	userID := model.NewId()
	channel := &model.Channel{Id: channelID, Type: model.ChannelTypeOpen}
	rc := &model.RemoteCluster{RemoteId: remoteID, Name: "test-remote"}

	setup := func(t *testing.T) (*Service, *MockAppIface, *mocks.UserStore) {
		mockPostStore := &mocks.PostStore{}
		mockPostStore.On("GetSingle", mock.Anything, postID, true).Return(&model.Post{Id: postID, ChannelId: channelID}, nil)

		mockAckStore := &mocks.PostAcknowledgementStore{}
		mockAckStore.On("GetSingle", userID, postID, remoteID).Return(nil, store.NewErrNotFound("PostAcknowledgement", postID))

		mockUserStore := &mocks.UserStore{}

		mockStore := &mocks.Store{}
		mockStore.On("Post").Return(mockPostStore)
		mockStore.On("PostAcknowledgement").Return(mockAckStore)
		mockStore.On("User").Return(mockUserStore)

		mockServer := &MockServerIface{}
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

		mockApp := &MockAppIface{}

		return &Service{server: mockServer, app: mockApp}, mockApp, mockUserStore
	}

	received := func() *model.PostAcknowledgement {
		return &model.PostAcknowledgement{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 100}
	}

	// PostAcknowledgements holds one row per (PostId, UserId) and its upsert keeps the existing
	// RemoteId, so a save over a row from another origin repeats on every sync.
	t.Run("active acknowledgement from another origin is not saved again", func(t *testing.T) {
		otherOrigin := &model.PostAcknowledgement{PostId: postID, UserId: userID, ChannelId: channelID, AcknowledgedAt: 50}

		scs, mockApp, _ := setup(t)
		mockApp.On("GetAcknowledgementsForPost", postID).Return([]*model.PostAcknowledgement{
			{PostId: postID, UserId: model.NewId(), ChannelId: channelID, AcknowledgedAt: 60},
			otherOrigin,
		}, (*model.AppError)(nil))

		saved, err := scs.upsertSyncAcknowledgement(received(), channel, rc)

		require.NoError(t, err)
		assert.Equal(t, otherOrigin, saved)
		mockApp.AssertNotCalled(t, "SaveAcknowledgementForPostWithModel", mock.Anything, mock.Anything)
	})

	t.Run("new acknowledgement from the remote user is saved with the remote id", func(t *testing.T) {
		scs, mockApp, mockUserStore := setup(t)
		mockApp.On("GetAcknowledgementsForPost", postID).Return([]*model.PostAcknowledgement{
			{PostId: postID, UserId: model.NewId(), ChannelId: channelID, AcknowledgedAt: 60},
		}, (*model.AppError)(nil))
		mockUserStore.On("Get", mockTypeContext, userID).Return(&model.User{Id: userID, RemoteId: new(remoteID)}, nil)
		hasRemoteID := mock.MatchedBy(func(ack *model.PostAcknowledgement) bool {
			return ack.GetRemoteID() == remoteID
		})
		mockApp.On("SaveAcknowledgementForPostWithModel", mock.Anything, hasRemoteID).Return(received(), (*model.AppError)(nil))

		_, err := scs.upsertSyncAcknowledgement(received(), channel, rc)

		require.NoError(t, err)
		mockApp.AssertCalled(t, "SaveAcknowledgementForPostWithModel", mock.Anything, hasRemoteID)
	})
}
