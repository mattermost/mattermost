// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func setupSendTest(t *testing.T, enableMemberSync bool) (*Service, *mocks.Store, *mocks.ChannelMemberHistoryStore, *mocks.SharedChannelStore, *mocks.UserStore, *mocks.RemoteClusterStore) {
	t.Helper()

	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("GetRemoteClusterService").Return(nil)

	mockApp := &MockAppIface{}
	scs := &Service{
		server: mockServer,
		app:    mockApp,
	}

	mockStore := &mocks.Store{}
	mockCMHStore := &mocks.ChannelMemberHistoryStore{}
	mockSharedChannelStore := &mocks.SharedChannelStore{}
	mockUserStore := &mocks.UserStore{}
	mockRCStore := &mocks.RemoteClusterStore{}

	mockStore.On("ChannelMemberHistory").Return(mockCMHStore)
	mockStore.On("SharedChannel").Return(mockSharedChannelStore)
	mockStore.On("User").Return(mockUserStore)
	mockStore.On("RemoteCluster").Return(mockRCStore)
	mockServer.On("GetStore").Return(mockStore)

	mockConfig := model.Config{}
	mockConfig.SetDefaults()
	mockConfig.FeatureFlags.EnableSharedChannelsMemberSync = enableMemberSync
	mockServer.On("Config").Return(&mockConfig)

	return scs, mockStore, mockCMHStore, mockSharedChannelStore, mockUserStore, mockRCStore
}

func TestFetchMembershipsForSync_FeatureFlagDisabled(t *testing.T) {
	scs, _, _, _, _, _ := setupSendTest(t, false)

	sd := &syncData{
		task:  syncTask{channelID: model.NewId()},
		rc:    &model.RemoteCluster{RemoteId: model.NewId()},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)
	assert.Empty(t, sd.membershipChanges, "should not fetch when feature flag disabled")
}

func TestFetchMembershipsForSync_NoChanges(t *testing.T) {
	scs, _, mockCMHStore, _, _, _ := setupSendTest(t, true)

	channelID := model.NewId()
	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), mock.AnythingOfType("int")).
		Return([]*model.ChannelMemberHistory{}, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: model.NewId()},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)
	assert.Empty(t, sd.membershipChanges)
	assert.Equal(t, int64(0), sd.resultNextMembershipCursor)
}

func TestFetchMembershipsForSync_DeduplicatesJoinLeaveRejoin(t *testing.T) {
	scs, _, mockCMHStore, mockSCStore, mockUserStore, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()
	userID := model.NewId()

	// User joined at 1000, left at 2000, rejoined at 3000
	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), mock.AnythingOfType("int")).
		Return([]*model.ChannelMemberHistory{
			{ChannelId: channelID, UserId: userID, JoinTime: 1000, LeaveTime: model.NewPointer(int64(2000))},
			{ChannelId: channelID, UserId: userID, JoinTime: 3000, LeaveTime: nil},
		}, nil)

	// User profile for the add — local user (no RemoteId) so shouldUserSync includes it
	user := &model.User{Id: userID}
	mockUserStore.On("Get", mock.Anything, userID).Return(user, nil)

	// shouldUserSync needs SharedChannelUser lookup
	mockSCStore.On("GetSingleUser", userID, channelID, remoteID).
		Return(nil, &notFoundError{})
	mockSCStore.On("SaveUser", mock.AnythingOfType("*model.SharedChannelUser")).
		Return(&model.SharedChannelUser{}, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)

	// Should deduplicate to 1 entry: user is currently a member (rejoin at 3000 > leave at 2000)
	require.Len(t, sd.membershipChanges, 1)
	assert.Equal(t, userID, sd.membershipChanges[0].UserId)
	assert.True(t, sd.membershipChanges[0].IsAdd, "user rejoined so should be IsAdd=true")
	assert.Equal(t, int64(3000), sd.membershipChanges[0].ChangeTime)
	assert.Equal(t, int64(3000), sd.resultNextMembershipCursor)
}

func TestFetchMembershipsForSync_DeduplicatesJoinThenLeave(t *testing.T) {
	scs, _, mockCMHStore, _, _, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()
	userID := model.NewId()

	// User joined at 1000, then left at 2000
	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), mock.AnythingOfType("int")).
		Return([]*model.ChannelMemberHistory{
			{ChannelId: channelID, UserId: userID, JoinTime: 1000, LeaveTime: model.NewPointer(int64(2000))},
		}, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)

	require.Len(t, sd.membershipChanges, 1)
	assert.False(t, sd.membershipChanges[0].IsAdd, "user left so should be IsAdd=false")
	assert.Equal(t, int64(2000), sd.membershipChanges[0].ChangeTime)
	assert.Equal(t, int64(2000), sd.resultNextMembershipCursor)
}

func TestFetchMembershipsForSync_MultipleUsers(t *testing.T) {
	scs, _, mockCMHStore, mockSCStore, mockUserStore, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()
	user1 := model.NewId()
	user2 := model.NewId()
	user3 := model.NewId()

	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), mock.AnythingOfType("int")).
		Return([]*model.ChannelMemberHistory{
			{ChannelId: channelID, UserId: user1, JoinTime: 1000, LeaveTime: nil},                           // joined, still member
			{ChannelId: channelID, UserId: user2, JoinTime: 2000, LeaveTime: model.NewPointer(int64(3000))}, // joined then left
			{ChannelId: channelID, UserId: user3, JoinTime: 4000, LeaveTime: nil},                           // joined, still member
		}, nil)

	// User profiles for adds (user1 and user3) — users are local (no RemoteId)
	// so shouldUserSync won't filter them out for the target remote
	for _, uid := range []string{user1, user3} {
		u := &model.User{Id: uid}
		mockUserStore.On("Get", mock.Anything, uid).Return(u, nil)
		mockSCStore.On("GetSingleUser", uid, channelID, remoteID).Return(nil, &notFoundError{})
		mockSCStore.On("SaveUser", mock.MatchedBy(func(scu *model.SharedChannelUser) bool { return scu.UserId == uid })).
			Return(&model.SharedChannelUser{}, nil)
	}

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)

	assert.Len(t, sd.membershipChanges, 3)

	// Build a map for easy lookup
	changeMap := make(map[string]*model.MembershipChangeMsg)
	for _, mc := range sd.membershipChanges {
		changeMap[mc.UserId] = mc
	}

	assert.True(t, changeMap[user1].IsAdd, "user1 is still a member")
	assert.False(t, changeMap[user2].IsAdd, "user2 left")
	assert.True(t, changeMap[user3].IsAdd, "user3 is still a member")

	// Max cursor should be 4000 (user3 join)
	assert.Equal(t, int64(4000), sd.resultNextMembershipCursor)

	// Only user1 and user3 should be in the users map (adds only)
	assert.Contains(t, sd.users, user1)
	assert.NotContains(t, sd.users, user2, "user2 left, should not be in users map")
	assert.Contains(t, sd.users, user3)
}

func TestFetchMembershipsForSync_SetsRepeatWhenLimitHit(t *testing.T) {
	scs, _, mockCMHStore, mockSCStore, mockUserStore, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()

	// Return exactly as many results as the limit (batch size)
	batchSize := scs.GetMemberSyncBatchSize()
	histories := make([]*model.ChannelMemberHistory, batchSize)
	for i := range batchSize {
		uid := model.NewId()
		histories[i] = &model.ChannelMemberHistory{
			ChannelId: channelID,
			UserId:    uid,
			JoinTime:  int64(1000 + i),
			LeaveTime: nil,
		}
		u := &model.User{Id: uid}
		mockUserStore.On("Get", mock.Anything, uid).Return(u, nil)
		mockSCStore.On("GetSingleUser", uid, channelID, remoteID).Return(nil, &notFoundError{})
		mockSCStore.On("SaveUser", mock.MatchedBy(func(scu *model.SharedChannelUser) bool { return scu.UserId == uid })).
			Return(&model.SharedChannelUser{}, nil)
	}

	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), batchSize).
		Return(histories, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)
	assert.True(t, sd.resultRepeat, "should set resultRepeat when limit is hit")
}

func TestFetchMembershipsForSync_CursorFromSCR(t *testing.T) {
	scs, _, mockCMHStore, _, _, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()

	// Verify that LastMembersSyncAt from SCR is used as the cursor
	mockCMHStore.On("GetMembershipChanges", channelID, int64(5000), mock.AnythingOfType("int")).
		Return([]*model.ChannelMemberHistory{}, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 5000},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)
	mockCMHStore.AssertCalled(t, "GetMembershipChanges", channelID, int64(5000), mock.AnythingOfType("int"))
}

func TestFetchMembershipsForSync_RepeatedTimestampsAtBoundary(t *testing.T) {
	scs, _, mockCMHStore, mockSCStore, mockUserStore, _ := setupSendTest(t, true)

	channelID := model.NewId()
	remoteID := model.NewId()
	batchSize := scs.GetMemberSyncBatchSize()

	// Create batch where the last entries share the same JoinTime (boundary timestamp)
	boundaryTime := int64(5000)
	histories := make([]*model.ChannelMemberHistory, batchSize)
	for i := range batchSize {
		uid := model.NewId()
		joinTime := int64(1000 + i)
		// Last 3 entries share the same timestamp
		if i >= batchSize-3 {
			joinTime = boundaryTime
		}
		histories[i] = &model.ChannelMemberHistory{
			ChannelId: channelID,
			UserId:    uid,
			JoinTime:  joinTime,
			LeaveTime: nil,
		}
		u := &model.User{Id: uid}
		mockUserStore.On("Get", mock.Anything, uid).Return(u, nil)
		mockSCStore.On("GetSingleUser", uid, channelID, remoteID).Return(nil, &notFoundError{})
		mockSCStore.On("SaveUser", mock.MatchedBy(func(scu *model.SharedChannelUser) bool { return scu.UserId == uid })).
			Return(&model.SharedChannelUser{}, nil)
	}

	// First fetch returns full batch (hits limit)
	mockCMHStore.On("GetMembershipChanges", channelID, int64(0), batchSize).
		Return(histories, nil)

	sd := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: 0},
		users: make(map[string]*model.User),
	}

	err := scs.fetchMembershipsForSync(sd)
	require.NoError(t, err)
	assert.True(t, sd.resultRepeat, "should signal more data when limit hit")
	assert.Len(t, sd.membershipChanges, batchSize, "all entries in batch should be processed")
	assert.Equal(t, boundaryTime, sd.resultNextMembershipCursor, "cursor should be at boundary timestamp")

	// Second fetch uses the boundary timestamp as cursor (GtOrEq means events
	// AT boundaryTime will be re-fetched, but deduplication handles this)
	extraUser := model.NewId()
	mockCMHStore.On("GetMembershipChanges", channelID, boundaryTime, batchSize).
		Return([]*model.ChannelMemberHistory{
			// Re-fetched rows at boundary (already processed — dedup will handle)
			histories[batchSize-3],
			histories[batchSize-2],
			histories[batchSize-1],
			// New row beyond the boundary
			{ChannelId: channelID, UserId: extraUser, JoinTime: boundaryTime + 1, LeaveTime: nil},
		}, nil)

	extraUserObj := &model.User{Id: extraUser}
	mockUserStore.On("Get", mock.Anything, extraUser).Return(extraUserObj, nil)
	mockSCStore.On("GetSingleUser", extraUser, channelID, remoteID).Return(nil, &notFoundError{})
	mockSCStore.On("SaveUser", mock.MatchedBy(func(scu *model.SharedChannelUser) bool { return scu.UserId == extraUser })).
		Return(&model.SharedChannelUser{}, nil)

	sd2 := &syncData{
		task:  syncTask{channelID: channelID},
		rc:    &model.RemoteCluster{RemoteId: remoteID},
		scr:   &model.SharedChannelRemote{LastMembersSyncAt: boundaryTime},
		users: make(map[string]*model.User),
	}

	err = scs.fetchMembershipsForSync(sd2)
	require.NoError(t, err)
	// Should have 4 entries (3 re-fetched + 1 new) — dedup at the caller level
	// handles duplicate user IDs across batches
	assert.Len(t, sd2.membershipChanges, 4, "should include re-fetched boundary rows and new row")
	assert.Equal(t, boundaryTime+1, sd2.resultNextMembershipCursor, "cursor should advance past boundary")
}

// notFoundError implements the errNotFound interface used by the sharedchannel package
type notFoundError struct{}

func (e *notFoundError) Error() string       { return "not found" }
func (e *notFoundError) IsErrNotFound() bool { return true }
