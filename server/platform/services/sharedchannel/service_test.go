// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sharedchannel

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
