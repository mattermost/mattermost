package app

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/services/sharedchannel"

	"github.com/mattermost/mattermost-server/v5/model"
)

type mockRemoteClusterService struct {
	sharedchannel.ServiceIFace
	notifications []string
}

func (mrcs *mockRemoteClusterService) NotifyChannelChanged(channelId string) {
	mrcs.notifications = append(mrcs.notifications, channelId)
}

func (mrcs *mockRemoteClusterService) Shutdown() error {
	return nil
}

func (mrcs *mockRemoteClusterService) Start() error {
	return nil
}

func TestNotifySharedChannelSync(t *testing.T) {
	t.Run("when channel is not a shared one it does not notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := &mockRemoteClusterService{}
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(false)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Empty(t, mockService.notifications)
	})

	t.Run("when channel is shared and sync service is enabled it does notify", func(t *testing.T) {
		th := SetupWithStoreMock(t)
		defer th.TearDown()
		mockService := &mockRemoteClusterService{}
		th.App.srv.sharedChannelSyncService = mockService

		channel := &model.Channel{Id: model.NewId(), Shared: model.NewBool(true)}
		th.App.NotifySharedChannelSync(channel, "")
		assert.Len(t, mockService.notifications, 1)
		assert.Equal(t, channel.Id, mockService.notifications[0])
	})
}
