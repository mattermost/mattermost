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

type pluginSyncFixture struct {
	scs        *Service
	rcs        *mockRCSForSync
	app        *MockAppIface
	scStore    *mocks.SharedChannelStore
	postStore  *mocks.PostStore
	channelID  string
	remoteID   string
	scr        *model.SharedChannelRemote
	posts      []*model.Post
	nextCursor model.GetPostsSinceForSyncCursor
}

// newPluginSyncFixture sets up a plugin remote with one batch of posts waiting to sync.
// Each post gets the given number of reactions.
func newPluginSyncFixture(t *testing.T, postCount, maxPostsPerSync, reactionsPerPost int) *pluginSyncFixture {
	t.Helper()

	f := &pluginSyncFixture{
		rcs:       &mockRCSForSync{},
		app:       &MockAppIface{},
		scStore:   &mocks.SharedChannelStore{},
		postStore: &mocks.PostStore{},
		channelID: model.NewId(),
		remoteID:  model.NewId(),
	}

	rc := &model.RemoteCluster{
		RemoteId:    f.remoteID,
		DisplayName: "plugin-remote",
		PluginID:    "com.example.bridge",
		LastPingAt:  model.GetMillis(),
	}
	f.scr = &model.SharedChannelRemote{
		Id:               model.NewId(),
		ChannelId:        f.channelID,
		RemoteId:         f.remoteID,
		LastPostCreateAt: 1000,
		LastPostUpdateAt: 1000,
	}

	author := &model.User{Id: model.NewId(), RemoteId: model.NewPointer(f.remoteID)}
	var reactions []*model.Reaction
	for i := range postCount {
		at := int64(2000 + i)
		post := &model.Post{Id: model.NewId(), ChannelId: f.channelID, UserId: author.Id, Message: "hello", CreateAt: at, UpdateAt: at}
		f.posts = append(f.posts, post)
		for range reactionsPerPost {
			reactions = append(reactions, &model.Reaction{UserId: author.Id, PostId: post.Id, EmojiName: "smile", CreateAt: at, UpdateAt: at})
		}
	}
	last := f.posts[len(f.posts)-1]
	f.nextCursor = model.GetPostsSinceForSyncCursor{
		LastPostCreateAt: last.CreateAt, LastPostCreateID: last.Id,
		LastPostUpdateAt: last.UpdateAt, LastPostUpdateID: last.Id,
	}

	rcStore := &mocks.RemoteClusterStore{}
	rcStore.On("Get", f.remoteID, false).Return(rc, nil)

	f.scStore.On("GetRemoteByIds", f.channelID, f.remoteID).Return(f.scr, nil)
	f.scStore.On("GetUsersForSync", mock.Anything).Return([]*model.User{}, nil)
	f.scStore.On("Get", f.channelID).Return(&model.SharedChannel{ChannelId: f.channelID, TeamId: model.NewId()}, nil)
	f.scStore.On("UpdateRemoteCursor", f.scr.Id, mock.Anything).Return(nil)

	f.postStore.On("GetPostsSinceForSync", mock.MatchedBy(func(o model.GetPostsSinceForSyncOptions) bool { return o.SinceCreateAt }), mock.Anything, mock.Anything).
		Return(f.posts, f.nextCursor, nil)
	f.postStore.On("GetPostsSinceForSync", mock.MatchedBy(func(o model.GetPostsSinceForSyncOptions) bool { return !o.SinceCreateAt }), mock.Anything, mock.Anything).
		Return([]*model.Post{}, f.nextCursor, nil)
	for _, p := range f.posts {
		f.postStore.On("GetSingle", mock.Anything, p.Id, true).Return(p, nil)
	}

	reactionStore := &mocks.ReactionStore{}
	for _, p := range f.posts {
		var forPost []*model.Reaction
		for _, r := range reactions {
			if r.PostId == p.Id {
				forPost = append(forPost, r)
			}
		}
		reactionStore.On("GetForPostSince", p.Id, mock.Anything, f.remoteID, true).Return(forPost, nil)
	}

	ackStore := &mocks.PostAcknowledgementStore{}
	ackStore.On("GetForPostSince", mock.Anything, mock.Anything, f.remoteID, true).Return([]*model.PostAcknowledgement{}, nil)

	cmhStore := &mocks.ChannelMemberHistoryStore{}
	cmhStore.On("GetMembershipChanges", f.channelID, mock.Anything, mock.Anything).Return([]*model.ChannelMemberHistory{}, nil)

	userStore := &mocks.UserStore{}
	userStore.On("Get", mock.Anything, author.Id).Return(author, nil)

	fileInfoStore := &mocks.FileInfoStore{}
	fileInfoStore.On("GetForPost", mock.Anything, false, true, true).Return([]*model.FileInfo{}, nil)

	mockStore := &mocks.Store{}
	mockStore.On("RemoteCluster").Return(rcStore)
	mockStore.On("SharedChannel").Return(f.scStore)
	mockStore.On("Post").Return(f.postStore)
	mockStore.On("Reaction").Return(reactionStore)
	mockStore.On("PostAcknowledgement").Return(ackStore)
	mockStore.On("ChannelMemberHistory").Return(cmhStore)
	mockStore.On("User").Return(userStore)
	mockStore.On("FileInfo").Return(fileInfoStore)

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.ConnectedWorkspacesSettings.MaxPostsPerSync = model.NewPointer(maxPostsPerSync)

	mockServer := &MockServerIface{}
	mockServer.On("GetStore").Return(mockStore)
	mockServer.On("GetMetrics").Return(nil)
	mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))
	mockServer.On("Config").Return(cfg)
	mockServer.On("GetRemoteClusterService").Return(f.rcs)

	f.app.On("PreparePostForClient", mock.Anything, mock.Anything, mock.Anything).Return(func(_ request.CTX, p *model.Post, _ *model.PreparePostForClientOpts) *model.Post { return p })
	f.app.On("MentionsToTeamMembers", mock.Anything, mock.Anything, mock.Anything).Return(model.UserMentionMap{})

	f.scs = &Service{
		server:       mockServer,
		app:          f.app,
		changeSignal: make(chan struct{}, 1),
		tasks:        make(map[string]syncTask),
	}
	return f
}

func (f *pluginSyncFixture) postIDs() []string {
	ids := make([]string, 0, len(f.posts))
	for _, p := range f.posts {
		ids = append(ids, p.Id)
	}
	return ids
}

func (f *pluginSyncFixture) queuedTasks() []syncTask {
	f.scs.mux.Lock()
	defer f.scs.mux.Unlock()
	tasks := make([]syncTask, 0, len(f.scs.tasks))
	for _, task := range f.scs.tasks {
		tasks = append(tasks, task)
	}
	return tasks
}

func syncMsgPostIDs(msg *model.SyncMsg) []string {
	ids := make([]string, 0, len(msg.Posts))
	for _, p := range msg.Posts {
		ids = append(ids, p.Id)
	}
	return ids
}

func TestSyncForPluginRemote_Cursor(t *testing.T) {
	t.Run("hook error holds the cursor and the retry re-sends the batch", func(t *testing.T) {
		// A full batch sets resultRepeat, which must not bypass the retry delay.
		f := newPluginSyncFixture(t, 2, 2, 0)

		var sent [][]string
		f.app.On("OnSharedChannelsSyncMsg", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) { sent = append(sent, syncMsgPostIDs(args.Get(0).(*model.SyncMsg))) }).
			Return(model.SyncResponse{}, errors.New("transport down")).Once()

		before := time.Now()
		require.NoError(t, f.scs.processTask(newSyncTask(f.channelID, "", f.remoteID, nil, nil)))

		f.scStore.AssertNotCalled(t, "UpdateRemoteCursor", mock.Anything, mock.Anything)
		assert.Equal(t, []string{f.remoteID}, f.rcs.notifyCalls)

		tasks := f.queuedTasks()
		require.Len(t, tasks, 1, "only the delayed retry should be queued")
		assert.Equal(t, 1, tasks[0].retryCount)
		assert.True(t, tasks[0].schedule.After(before.Add(SyncRetryDelay-time.Second)), "retry must wait SyncRetryDelay")

		f.app.On("OnSharedChannelsSyncMsg", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) { sent = append(sent, syncMsgPostIDs(args.Get(0).(*model.SyncMsg))) }).
			Return(model.SyncResponse{}, nil).Once()

		require.NoError(t, f.scs.processTask(tasks[0]))

		require.Len(t, sent, 2)
		assert.Equal(t, f.postIDs(), sent[0])
		assert.Equal(t, sent[0], sent[1], "the retry must re-send the same batch")
		f.scStore.AssertCalled(t, "UpdateRemoteCursor", f.scr.Id, f.nextCursor)
	})

	t.Run("success advances the cursor", func(t *testing.T) {
		f := newPluginSyncFixture(t, 2, 50, 0)
		f.app.On("OnSharedChannelsSyncMsg", mock.Anything, mock.Anything).Return(model.SyncResponse{}, nil)

		require.NoError(t, f.scs.processTask(newSyncTask(f.channelID, "", f.remoteID, nil, nil)))

		f.scStore.AssertCalled(t, "UpdateRemoteCursor", f.scr.Id, f.nextCursor)
		assert.Empty(t, f.rcs.notifyCalls)
		assert.Empty(t, f.queuedTasks())
	})

	t.Run("PostErrors with a nil error advance the cursor and retry those posts", func(t *testing.T) {
		f := newPluginSyncFixture(t, 2, 50, 0)
		failed := f.posts[1]
		f.app.On("OnSharedChannelsSyncMsg", mock.Anything, mock.Anything).
			Return(model.SyncResponse{PostErrors: []string{failed.Id}}, nil)

		require.NoError(t, f.scs.processTask(newSyncTask(f.channelID, "", f.remoteID, nil, nil)))

		f.scStore.AssertCalled(t, "UpdateRemoteCursor", f.scr.Id, f.nextCursor)
		assert.Empty(t, f.rcs.notifyCalls)

		tasks := f.queuedTasks()
		require.Len(t, tasks, 1)
		require.NotNil(t, tasks[0].retryMsg)
		assert.Equal(t, []string{failed.Id}, syncMsgPostIDs(tasks[0].retryMsg))
	})

	t.Run("reaction hook error holds the cursor after the posts were delivered", func(t *testing.T) {
		f := newPluginSyncFixture(t, 2, 50, 1)
		f.app.On("OnSharedChannelsSyncMsg", mock.MatchedBy(func(msg *model.SyncMsg) bool { return len(msg.Reactions) == 0 }), mock.Anything).
			Return(model.SyncResponse{}, nil)
		f.app.On("OnSharedChannelsSyncMsg", mock.MatchedBy(func(msg *model.SyncMsg) bool { return len(msg.Reactions) != 0 }), mock.Anything).
			Return(model.SyncResponse{}, errors.New("rate limited"))

		require.NoError(t, f.scs.processTask(newSyncTask(f.channelID, "", f.remoteID, nil, nil)))

		f.scStore.AssertNotCalled(t, "UpdateRemoteCursor", mock.Anything, mock.Anything)
		assert.Equal(t, []string{f.remoteID}, f.rcs.notifyCalls)

		tasks := f.queuedTasks()
		require.Len(t, tasks, 1)
		assert.Equal(t, 1, tasks[0].retryCount)
	})
}
