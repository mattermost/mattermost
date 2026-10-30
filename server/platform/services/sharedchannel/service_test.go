// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestRemoteClusterDisplayName(t *testing.T) {
	t.Run("nil remote", func(t *testing.T) {
		assert.Equal(t, "", remoteClusterDisplayName(nil))
	})

	t.Run("only RemoteId set", func(t *testing.T) {
		rc := &model.RemoteCluster{RemoteId: "rid-abc"}
		assert.Equal(t, "rid-abc", remoteClusterDisplayName(rc))
	})

	t.Run("Name used when DisplayName empty", func(t *testing.T) {
		rc := &model.RemoteCluster{RemoteId: "rid-abc", Name: "internal-name"}
		assert.Equal(t, "internal-name", remoteClusterDisplayName(rc))
	})

	t.Run("DisplayName preferred over Name and RemoteId", func(t *testing.T) {
		rc := &model.RemoteCluster{
			RemoteId:    "rid-abc",
			Name:        "internal-name",
			DisplayName: "Pretty Workspace",
		}
		assert.Equal(t, "Pretty Workspace", remoteClusterDisplayName(rc))
	})
}

func TestMessageForSharedChannelStatePost(t *testing.T) {
	t.Run("shared", func(t *testing.T) {
		props := model.StringInterface{
			model.PostPropsSharedChannelState:         model.SharedChannelStatePostValueShared,
			model.PostPropsSharedChannelWorkspaceName: "Acme",
		}
		got := messageForSharedChannelStatePost(props)
		assert.Equal(t, i18n.T("shared_channel.system_message.now_shared", map[string]any{"WorkspaceName": "Acme"}), got)
	})

	t.Run("unshared with known workspace", func(t *testing.T) {
		props := model.StringInterface{
			model.PostPropsSharedChannelState:         model.SharedChannelStatePostValueUnshared,
			model.PostPropsSharedChannelWorkspaceName: "Acme",
		}
		got := messageForSharedChannelStatePost(props)
		assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared", map[string]any{"WorkspaceName": "Acme"}), got)
	})

	t.Run("unshared without workspace name", func(t *testing.T) {
		props := model.StringInterface{
			model.PostPropsSharedChannelState: model.SharedChannelStatePostValueUnshared,
		}
		got := messageForSharedChannelStatePost(props)
		assert.Equal(t, i18n.T("shared_channel.system_message.no_longer_shared_unknown"), got)
	})

	t.Run("default empty or unknown state uses unknown unshared copy", func(t *testing.T) {
		assert.Equal(t,
			i18n.T("shared_channel.system_message.no_longer_shared_unknown"),
			messageForSharedChannelStatePost(model.StringInterface{}),
		)
		assert.Equal(t,
			i18n.T("shared_channel.system_message.no_longer_shared_unknown"),
			messageForSharedChannelStatePost(model.StringInterface{
				model.PostPropsSharedChannelState: "unexpected",
			}),
		)
	})
}

func TestOnClusterLeaderChange_QueuesCatchUpForOnlineRemotes(t *testing.T) {
	now := model.GetMillis()
	online1 := &model.RemoteCluster{RemoteId: model.NewId(), SiteURL: "http://online1.example", LastPingAt: now}
	online2 := &model.RemoteCluster{RemoteId: model.NewId(), SiteURL: "http://online2.example", LastPingAt: now}
	offline := &model.RemoteCluster{RemoteId: model.NewId(), SiteURL: "http://offline.example", LastPingAt: now - model.RemoteOfflineAfterMillis - 1000}
	pending := &model.RemoteCluster{RemoteId: model.NewId(), SiteURL: "", LastPingAt: now}
	allRemotes := []*model.RemoteCluster{online1, online2, offline, pending}

	sharedChannels := map[string][]string{
		online1.RemoteId: {"channel-1", "channel-2"},
		online2.RemoteId: {"channel-1"},
		offline.RemoteId: {"channel-3"},
		pending.RemoteId: {"channel-4"},
	}

	newService := func(t *testing.T, cfg *model.Config) (*Service, *mocks.SharedChannelStore) {
		t.Helper()

		rcStore := &mocks.RemoteClusterStore{}
		// Mirrors the SQL store's handling of these filter fields.
		rcStore.On("GetAll", 0, 999999, mock.Anything).Return(func(_, _ int, filter model.RemoteClusterQueryFilter) ([]*model.RemoteCluster, error) {
			var result []*model.RemoteCluster
			for _, rc := range allRemotes {
				if filter.OnlyConfirmed && rc.SiteURL == "" {
					continue
				}
				if filter.ExcludeOffline && !rc.IsOnline() {
					continue
				}
				result = append(result, rc)
			}
			return result, nil
		})

		scStore := &mocks.SharedChannelStore{}
		scStore.On("GetRemotes", 0, 999999, mock.Anything).Return(func(_, _ int, opts model.SharedChannelRemoteFilterOpts) ([]*model.SharedChannelRemote, error) {
			if opts.ExcludeConfirmed {
				return nil, nil // no pending invites
			}
			var scrs []*model.SharedChannelRemote
			for _, channelID := range sharedChannels[opts.RemoteId] {
				scrs = append(scrs, &model.SharedChannelRemote{ChannelId: channelID, RemoteId: opts.RemoteId})
			}
			return scrs, nil
		})

		mockStore := &mocks.Store{}
		mockStore.On("RemoteCluster").Return(rcStore)
		mockStore.On("SharedChannel").Return(scStore)

		mockServer := &MockServerIface{}
		mockServer.On("IsLeader").Return(true)
		mockServer.On("GetStore").Return(mockStore)
		mockServer.On("GetRemoteClusterService").Return(&mockRCSForSync{})
		mockServer.On("Config").Return(cfg)
		mockServer.On("GetMetrics").Return(nil)
		mockServer.On("Log").Return(mlog.CreateConsoleTestLogger(t))

		scs := newTestService()
		scs.server = mockServer
		return scs, scStore
	}

	defaultConfig := func() *model.Config {
		cfg := &model.Config{}
		cfg.SetDefaults()
		return cfg
	}

	expected := map[string]bool{
		"channel-1" + online1.RemoteId: true,
		"channel-2" + online1.RemoteId: true,
		"channel-1" + online2.RemoteId: true,
	}

	assertCatchUpTasks := func(t *testing.T, scs *Service) {
		t.Helper()
		scs.mux.RLock()
		defer scs.mux.RUnlock()
		require.Len(t, scs.tasks, len(expected))
		for _, task := range scs.tasks {
			assert.True(t, expected[task.channelID+task.remoteID], "unexpected catch-up task for channel %s and remote %s", task.channelID, task.remoteID)
			assert.True(t, task.catchUp, "catch-up task should be flagged")
		}
	}

	t.Run("one task per shared channel of each online confirmed remote", func(t *testing.T) {
		scs, scStore := newService(t, defaultConfig())

		scs.catchUpRemotes()

		assertCatchUpTasks(t, scs)
		for _, rc := range []*model.RemoteCluster{online1, online2} {
			scStore.AssertCalled(t, "GetRemotes", 0, 999999, model.SharedChannelRemoteFilterOpts{RemoteId: rc.RemoteId, ExcludeConfirmed: true})
		}
		for _, rc := range []*model.RemoteCluster{offline, pending} {
			scStore.AssertNotCalled(t, "GetRemotes", 0, 999999, model.SharedChannelRemoteFilterOpts{RemoteId: rc.RemoteId, ExcludeConfirmed: true})
		}
	})

	t.Run("becoming leader starts the catch-up", func(t *testing.T) {
		scs, _ := newService(t, defaultConfig())

		scs.onClusterLeaderChange()
		defer scs.pause()

		require.Eventually(t, func() bool {
			scs.mux.RLock()
			defer scs.mux.RUnlock()
			return len(scs.tasks) == len(expected)
		}, 5*time.Second, 10*time.Millisecond)
		assertCatchUpTasks(t, scs)
	})

	t.Run("global user sync is scheduled for each online confirmed remote", func(t *testing.T) {
		cfg := defaultConfig()
		cfg.ConnectedWorkspacesSettings.SyncUsersOnConnectionOpen = model.NewPointer(true)
		scs, _ := newService(t, cfg)

		scs.catchUpRemotes()

		require.Eventually(t, func() bool {
			scs.mux.RLock()
			defer scs.mux.RUnlock()
			return len(scs.tasks) == len(expected)+2
		}, 5*time.Second, 10*time.Millisecond)

		scs.mux.RLock()
		defer scs.mux.RUnlock()
		globalSyncRemotes := make(map[string]bool)
		for _, task := range scs.tasks {
			if task.channelID == "" {
				globalSyncRemotes[task.remoteID] = true
			}
		}
		assert.Equal(t, map[string]bool{online1.RemoteId: true, online2.RemoteId: true}, globalSyncRemotes)
	})
}

func TestPostChannelUnsharedWithWorkspace_emptyWorkspaceName(t *testing.T) {
	mockServer := &MockServerIface{}
	logger := mlog.CreateConsoleTestLogger(t)
	mockServer.On("Log").Return(logger)

	mockApp := &MockAppIface{}
	scs := &Service{
		server: mockServer,
		app:    mockApp,
	}

	bot := &model.Bot{UserId: model.NewId()}
	mockApp.On("GetSystemBot", mock.Anything).Return(bot, (*model.AppError)(nil))

	mockApp.On("CreatePost", mock.Anything, mock.AnythingOfType("*model.Post"), mock.AnythingOfType("*model.Channel"), mock.Anything).
		Run(func(args mock.Arguments) {
			post := args.Get(1).(*model.Post)
			ch := args.Get(2).(*model.Channel)

			assert.Equal(t, model.PostTypeSharedChannelState, post.Type)
			assert.Equal(t, bot.UserId, post.UserId)
			assert.Equal(t, ch.Id, post.ChannelId)
			assert.Equal(t, model.SharedChannelStatePostValueUnshared, post.GetProps()[model.PostPropsSharedChannelState])
			_, hasWorkspaceName := post.GetProps()[model.PostPropsSharedChannelWorkspaceName]
			assert.False(t, hasWorkspaceName)
			assert.Equal(t,
				i18n.T("shared_channel.system_message.no_longer_shared_unknown"),
				post.Message,
			)
		}).Return(&model.Post{}, false, (*model.AppError)(nil))

	channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId()}
	scs.postChannelUnsharedWithWorkspace(channel, "")

	mockApp.AssertExpectations(t)
}
