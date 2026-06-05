// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

// stubPostStore attaches a mock PostStore.GetPostsByIds that returns the given
// posts in a deterministic order regardless of the requested id set.
func stubPostStoreReturning(mockStore *mocks.Store, posts []*model.Post) *mocks.PostStore {
	ps := &mocks.PostStore{}
	mockStore.On("Post").Return(ps).Maybe()
	ps.On("GetPostsByIds", mock.AnythingOfType("[]string")).Return(posts, nil).Maybe()
	return ps
}

func newDeltaSyncData(channelID, remoteID string, scrCursor int64) *syncData {
	scr := &model.SharedChannelRemote{
		Id:                        model.NewId(),
		ChannelId:                 channelID,
		RemoteId:                  remoteID,
		LastPropertyValueUpdateAt: scrCursor,
	}
	return &syncData{
		task:                          syncTask{channelID: channelID},
		rc:                            &model.RemoteCluster{RemoteId: remoteID},
		scr:                           scr,
		resultNextPropertyValueCursor: scr.LastPropertyValueUpdateAt,
	}
}

// ---------- fetchPropertyValueDeltaForSync ----------

func TestFetchPropertyValueDeltaForSync_NoGroup_NoOp(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(nil, errPlaceholder())

	sd := newDeltaSyncData(model.NewId(), model.NewId(), 0)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Empty(t, sd.posts)
	require.Equal(t, int64(0), sd.resultNextPropertyValueCursor, "no group must not move the cursor")
}

func TestFetchPropertyValueDeltaForSync_NoValuesSinceCursor_NoOp(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return([]*model.PropertyValue{}, nil)

	sd := newDeltaSyncData(model.NewId(), model.NewId(), 100)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Empty(t, sd.posts)
	require.Equal(t, int64(100), sd.resultNextPropertyValueCursor)
}

func TestFetchPropertyValueDeltaForSync_PropertyOnlyChangePickedUp(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	channelID := model.NewId()
	remoteID := model.NewId()
	postID := model.NewId()

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	v := &model.PropertyValue{ID: model.NewId(), TargetID: postID, TargetType: "post", UpdateAt: 5000}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return([]*model.PropertyValue{v}, nil)

	stubPostStoreReturning(mockStore, []*model.Post{
		{Id: postID, ChannelId: channelID},
	})

	sd := newDeltaSyncData(channelID, remoteID, 0)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Len(t, sd.posts, 1, "property-only-changed post must be unioned into sd.posts")
	require.Equal(t, postID, sd.posts[0].Id)
	require.Equal(t, int64(5000), sd.resultNextPropertyValueCursor, "cursor must advance to max value UpdateAt")
}

func TestFetchPropertyValueDeltaForSync_CrossChannelFilter(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	channelID := model.NewId()
	otherChannelID := model.NewId()
	remoteID := model.NewId()
	postInOther := model.NewId()

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	v := &model.PropertyValue{ID: model.NewId(), TargetID: postInOther, TargetType: "post", UpdateAt: 7000}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return([]*model.PropertyValue{v}, nil)

	stubPostStoreReturning(mockStore, []*model.Post{
		{Id: postInOther, ChannelId: otherChannelID},
	})

	sd := newDeltaSyncData(channelID, remoteID, 0)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Empty(t, sd.posts, "post in another channel must not enter sd.posts")
	require.Equal(t, int64(7000), sd.resultNextPropertyValueCursor,
		"cursor must still advance even when no post is unioned (forward progress)")
}

func TestFetchPropertyValueDeltaForSync_EchoPrevention(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	channelID := model.NewId()
	remoteID := model.NewId()
	postID := model.NewId()

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	v := &model.PropertyValue{ID: model.NewId(), TargetID: postID, TargetType: "post", UpdateAt: 9000}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return([]*model.PropertyValue{v}, nil)

	// Post originated from the destination remote — must be filtered out.
	stubPostStoreReturning(mockStore, []*model.Post{
		{Id: postID, ChannelId: channelID, RemoteId: &remoteID},
	})

	sd := newDeltaSyncData(channelID, remoteID, 0)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Empty(t, sd.posts, "post originating from the destination remote must not be echoed back")
	require.Equal(t, int64(9000), sd.resultNextPropertyValueCursor)
}

func TestFetchPropertyValueDeltaForSync_SkipsPostsAlreadyInSD(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	channelID := model.NewId()
	remoteID := model.NewId()
	postID := model.NewId()

	// Pre-populate sd.posts with this post — already fetched by fetchPostsForSync.
	existing := &model.Post{Id: postID, ChannelId: channelID}

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	v := &model.PropertyValue{ID: model.NewId(), TargetID: postID, TargetType: "post", UpdateAt: 4500}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return([]*model.PropertyValue{v}, nil)

	// Post().GetPostsByIds must NOT be called if every target is already in sd.posts.
	ps := &mocks.PostStore{}
	mockStore.On("Post").Return(ps).Maybe()
	// Explicitly do NOT register GetPostsByIds expectations; if called this fails.

	sd := newDeltaSyncData(channelID, remoteID, 0)
	sd.posts = []*model.Post{existing}
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Len(t, sd.posts, 1, "no duplicate post entries; existing post is kept once")
	require.Equal(t, int64(4500), sd.resultNextPropertyValueCursor)
	ps.AssertNotCalled(t, "GetPostsByIds", mock.Anything)
}

func TestFetchPropertyValueDeltaForSync_CursorMonotonic(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	channelID := model.NewId()
	remoteID := model.NewId()

	group := &model.PropertyGroup{ID: model.NewId(), Name: model.ChannelPostPropertyGroupName}
	pg := &mocks.PropertyGroupStore{}
	mockStore.On("PropertyGroup").Return(pg)
	pg.On("Get", model.ChannelPostPropertyGroupName).Return(group, nil)

	pv := &mocks.PropertyValueStore{}
	mockStore.On("PropertyValue").Return(pv)
	values := []*model.PropertyValue{
		{ID: model.NewId(), TargetID: model.NewId(), TargetType: "post", UpdateAt: 1000},
		{ID: model.NewId(), TargetID: model.NewId(), TargetType: "post", UpdateAt: 3000},
		{ID: model.NewId(), TargetID: model.NewId(), TargetType: "post", UpdateAt: 2000},
	}
	pv.On("SearchPropertyValues", mock.AnythingOfType("model.PropertyValueSearchOpts")).Return(values, nil)
	stubPostStoreReturning(mockStore, nil)

	sd := newDeltaSyncData(channelID, remoteID, 500)
	require.NoError(t, scs.fetchPropertyValueDeltaForSync(sd))
	require.Equal(t, int64(3000), sd.resultNextPropertyValueCursor, "cursor must reach the maximum UpdateAt regardless of input order")
}

// ---------- isCursorChanged with property cursor only ----------

func TestIsCursorChanged_PropertyCursorOnlyAdvanced(t *testing.T) {
	scr := &model.SharedChannelRemote{LastPropertyValueUpdateAt: 100}
	sd := &syncData{
		scr:                           scr,
		rc:                            &model.RemoteCluster{},
		resultNextCursor:              model.GetPostsSinceForSyncCursor{}, // empty post cursor
		resultNextPropertyValueCursor: 200,
	}
	require.True(t, sd.isCursorChanged(), "advancing only the property cursor must still report cursor changed")
}

func TestIsCursorChanged_NothingAdvanced(t *testing.T) {
	scr := &model.SharedChannelRemote{LastPropertyValueUpdateAt: 100}
	sd := &syncData{
		scr:                           scr,
		rc:                            &model.RemoteCluster{},
		resultNextCursor:              model.GetPostsSinceForSyncCursor{},
		resultNextPropertyValueCursor: 100,
	}
	require.False(t, sd.isCursorChanged(), "no cursor advance must report false")
}

// ---------- updatePropertyValueCursorForRemote ----------

func TestUpdatePropertyValueCursorForRemote_NoAdvance_NoStoreCall(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	scs2 := &mocks.SharedChannelStore{}
	mockStore.On("SharedChannel").Return(scs2).Maybe()
	// Do not register UpdateRemotePropertyValueCursor; if called this fails.

	sd := newDeltaSyncData(model.NewId(), model.NewId(), 500)
	sd.resultNextPropertyValueCursor = 500 // equal to scr cursor
	scs.updatePropertyValueCursorForRemote(sd)
	scs2.AssertNotCalled(t, "UpdateRemotePropertyValueCursor", mock.Anything, mock.Anything)
}

func TestUpdatePropertyValueCursorForRemote_AdvancePersistsAndMirrorsToScr(t *testing.T) {
	scs, _, mockStore := scsWithMocks(t)

	scs2 := &mocks.SharedChannelStore{}
	mockStore.On("SharedChannel").Return(scs2)
	scs2.On("UpdateRemotePropertyValueCursor", mock.AnythingOfType("string"), int64(900)).Return(nil)

	sd := newDeltaSyncData(model.NewId(), model.NewId(), 500)
	sd.resultNextPropertyValueCursor = 900
	scs.updatePropertyValueCursorForRemote(sd)
	scs2.AssertCalled(t, "UpdateRemotePropertyValueCursor", sd.scr.Id, int64(900))
	require.Equal(t, int64(900), sd.scr.LastPropertyValueUpdateAt, "in-memory scr cursor must also advance so re-emit is suppressed within the same cycle")
}

// ---------- helpers ----------

// errPlaceholder returns a non-nil error suitable for "soft fail" paths where
// we don't care about the exact error.
func errPlaceholder() error {
	return placeholderErr{}
}

type placeholderErr struct{}

func (placeholderErr) Error() string { return "placeholder" }
